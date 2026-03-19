import { type StateCreator } from 'zustand';
import { db } from '../../db';
import { syncOrchestrator } from '../../services/sync/syncOrchestrator';
import { PLAN_CONFIG } from '../../constants';
import { type AuthState } from '../types';

export interface SyncSlice {
  syncStatus: 'synced' | 'syncing' | 'error' | 'offline';
  lastSync: Date | null;
  autoSync: boolean;
  isOnline: boolean;
  _syncPromise: Promise<void> | null;

  syncData: () => Promise<void>;
  syncToServices: () => Promise<void>;
  processOfflineChanges: () => Promise<void>;
  importCloudData: () => Promise<unknown | null>;
  mediaSweep: () => Promise<void>; // Deprecated but kept for type compatibility
  repairEmptyFileThoughts: () => Promise<number>; // Deprecated but kept for type compatibility
  handlePostAuthSync: () => Promise<void>; // Deprecated but kept for type compatibility
  setAutoSync: (enabled: boolean) => Promise<void>;
}

export const createSyncSlice: StateCreator<AuthState, [], [], SyncSlice> = (set, get, _api) => ({
  syncStatus: typeof navigator !== 'undefined' && navigator.onLine 
    ? (localStorage.getItem('cyberia-user') ? 'synced' : 'offline') 
    : 'offline',
  lastSync: localStorage.getItem('cyberia-last-sync') ? new Date(localStorage.getItem('cyberia-last-sync')!) : null,
  autoSync: true,
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  _syncPromise: null,

  syncData: async () => {
    console.log('[Auth] syncData called');
    
    // 1. Run "Deep Healing" — check if cloud background files are missing/deleted
    // This handles the case where the DB has a URL but the file is gone from Supabase
    try {
      await get().healSpaceBackgrounds();
    } catch (e) {
      console.warn('[Sync] Background healing failed during sync:', e);
    }

    // 2. Standard delta sync (includes upload of pending blob backgrounds)
    await syncOrchestrator.deltaSync();
    
    // 3. After a full push sync, refresh storage usage to reflect recent changes
    try {
      const { useStore } = await import('../useStore');
      const st: any = useStore.getState();
      st?.calculateUsage?.(st.totalThoughtCount || 0);
    } catch {
      // best-effort only
    }
  },

  syncToServices: async () => {
    // Media files are now synced via uploadThoughtBlob in syncOrchestrator
  },

  processOfflineChanges: async () => {
    const { isOnline, user } = get();
    if (!isOnline || !user) return;
    await syncOrchestrator.deltaSync();
  },

  importCloudData: async () => {
    const { accessToken, isOnline, user } = get();
    if (!accessToken || !isOnline || !user) return null;

    set({ syncStatus: 'syncing' });
    try {
      const data = await syncOrchestrator.fetchCloudData();
      set({ syncStatus: 'synced' });
      return data;
    } catch (err) {
      console.warn('[Sync] importCloudData failed:', err);
      set({ syncStatus: 'error' });
      return null;
    }
  },

  repairEmptyFileThoughts: async () => {
    console.warn('[Sync] repairEmptyFileThoughts is deprecated');
    return 0;
  },

  mediaSweep: async () => {
    console.warn('[Sync] mediaSweep is deprecated');
  },

  handlePostAuthSync: async () => {
    console.log('[Sync] Starting initial handshake...');
    const { useStore } = await import('../useStore');
    const store = useStore.getState();
    
    // Fast path: try cloud hydration first
    try {
      const { useAuthStore } = await import('../useAuthStore');
      const currentUserId = useAuthStore.getState().user?.id ?? 'guest';
      
      const cloudData = await syncOrchestrator.fetchCloudData();
      if (cloudData) {
        // 1. Check for Quota Conflict - filter by current user only
        const localSpaces = await db.spaces.filter(s => s.syncStatus === 'local' && s.userId === currentUserId).toArray();
        const cloudSpaces = (cloudData.spaces || []) as any[];
        
        const totalUniqueSpaces = new Set([
          ...localSpaces.map(s => s.id),
          ...cloudSpaces.map(s => s.id)
        ]).size;
        
        const { user } = get();
        const plan = user?.plan || 'free';
        const limit = PLAN_CONFIG[plan].MAX_SPACES;
        
        if (totalUniqueSpaces > limit) {
          console.warn('[Sync] Quota conflict detected during login');
          // We will show a modal AFTER the loading screen fades
          setTimeout(async () => {
            const { useModalStore } = await import('../useModalStore');
            useModalStore.getState().openModal({
              title: 'Space Limit Reached',
              type: 'quota_resolver'
            });
          }, 1500);
        }

        // 2. Perform Smart Hydration
        // If local is just the default empty workspace, we overwrite to prevent "Space 1, Space 2, Workspace" clutter.
        // If local has real work (guest session), we merge.
        // CRITICAL: If we have a conflict, we MUST merge so the user can resolve it in the QuotaResolver.
        const isEmpty = await store.isLocalWorkspaceEmpty();
        const hasConflict = totalUniqueSpaces > limit;
        const shouldMerge = !isEmpty || hasConflict;
        
        console.log(`[Sync] Local empty: ${isEmpty}, Conflict: ${hasConflict}. Mode: ${shouldMerge ? 'Merge' : 'Overwrite'}`);
        await store.importFullState(cloudData, shouldMerge);
        
        // 3. Auto-select first space if none active
        const updatedSpaces = await db.spaces.filter(s => s.userId === currentUserId).toArray();
        if (updatedSpaces.length > 0 && !store.activeSpaceId) {
          const firstSpace = updatedSpaces[0];
          await store.setActiveSpace(firstSpace.id);
        }

        try {
          const st: any = useStore.getState();
          st?.calculateUsage?.(st.totalThoughtCount || 0);
        } catch {}
        
        // 4. Mark first sync as successful to unlock deletions
        localStorage.setItem('cyberia-last-sync', new Date().toISOString());
        set({ lastSync: new Date(), syncStatus: 'synced' });

        // 5. Trigger an immediate push sync to upload any local guest work
        syncOrchestrator.triggerSync(true);
        return;
      }
    } catch (e) {
      console.warn('[Sync] Initial cloud hydration failed:', e);
    }
    
    // Fallback to standard sync if hydration was empty
    await get().syncData();
    localStorage.setItem('cyberia-last-sync', new Date().toISOString());
    set({ lastSync: new Date(), syncStatus: 'synced' });
    
    // Final auto-selection check - FIXED: filter by userId to prevent cross-user data leak
    const { useAuthStore } = await import('../useAuthStore');
    const currentUserId = useAuthStore.getState().user?.id ?? 'guest';
    const finalSpaces = await db.spaces.filter(s => s.userId === currentUserId && !s.deletedAt).toArray();
    if (finalSpaces.length > 0 && !store.activeSpaceId) {
      const { useStore: dynamicStore } = await import('../useStore');
      await dynamicStore.getState().setActiveSpace(finalSpaces[0].id);
    }

    // Trigger an immediate push sync to upload any local guest work
    syncOrchestrator.triggerSync(true);
  },

  setAutoSync: async (enabled: boolean) => {
    localStorage.setItem('cyberia-auto-sync', String(enabled));
    set({ autoSync: enabled });
    
    if (enabled) {
      syncOrchestrator.triggerSync(true);
    }
    
    const { user, accessToken } = get();
    if (user && accessToken) {
      try {
        const { supabaseSync } = await import('../../services/supabaseSync');
        await supabaseSync.updateSettings(user.id, { ...user.settings, autoSync: enabled });
      } catch (e) {
        console.warn('[Auth] Failed to save autoSync preference:', e);
      }
    }
  },
});
