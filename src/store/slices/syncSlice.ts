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
  isQuotaResolverPending: boolean;

  syncData: () => Promise<void>;
  syncToServices: () => Promise<void>;
  processOfflineChanges: () => Promise<void>;
  importCloudData: () => Promise<unknown | null>;
  mediaSweep: () => Promise<void>; // Deprecated but kept for type compatibility
  repairEmptyFileThoughts: () => Promise<number>; // Deprecated but kept for type compatibility
  handlePostAuthSync: () => Promise<void>; // Deprecated but kept for type compatibility
  setAutoSync: (enabled: boolean) => Promise<void>;
  setQuotaResolverPending: (pending: boolean) => void;
}

let handshakeInProgress = false;

export const createSyncSlice: StateCreator<AuthState, [], [], SyncSlice> = (set, get, _api) => ({
  syncStatus: typeof navigator !== 'undefined' && navigator.onLine 
    ? (localStorage.getItem('cyberia-user') ? 'synced' : 'offline') 
    : 'offline',
  lastSync: localStorage.getItem('cyberia-last-sync') ? new Date(localStorage.getItem('cyberia-last-sync')!) : null,
  autoSync: true,
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  _syncPromise: null,
  isQuotaResolverPending: false,
  
  setQuotaResolverPending: (pending: boolean) => {
    set({ isQuotaResolverPending: pending });
  },

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
    if (handshakeInProgress) {
      console.log('[Sync] Handshake already in progress, skipping duplicate call');
      return;
    }
    handshakeInProgress = true;

    try {
      console.log('[SYNC-HANDSHAKE] Starting post-auth sync...');
      const { useStore } = await import('../useStore');
      const store = useStore.getState();
      const { useAuthStore } = await import('../useAuthStore');
      const authStore = useAuthStore.getState();
      const currentUserId = authStore.user?.id ?? 'guest';
      
      // FAST PATH: Check for unmigrated local data FIRST (before cloud fetch)
      // This allows the modal to open instantly without waiting for cloud API
      console.log('[SYNC-HANDSHAKE] Checking for local unmigrated data...');
      const localSpaces = await db.spaces.filter(s => 
        (s.syncStatus === 'local' || s.syncStatus === undefined) && 
        s.userId === currentUserId && 
        !s.deletedAt
      ).toArray();
      
      const unmigratedSpaces = localSpaces.filter(s => s.syncStatus === undefined);
      const hasUnmigratedData = unmigratedSpaces.length > 0;
      
      if (hasUnmigratedData) {
        console.log(`[SYNC-HANDSHAKE] UNMIGRATED LOCAL DATA: Opening resolver immediately. unmigratedSpaces: ${unmigratedSpaces.length}`);
        
        // CRITICAL: Set flag BEFORE opening modal to block delta sync
        authStore.setQuotaResolverPending(true);
        
        // Open modal immediately - DO NOT wait for cloud fetch
        const { useModalStore } = await import('../useModalStore');
        useModalStore.getState().openModal({
          title: 'Import Local Data',
          type: 'quota_resolver'
        });
        
        // Return early - modal will fetch cloud data itself
        handshakeInProgress = false;
        return;
      }
      
      // STANDARD PATH: Fetch cloud data for quota check
      try {
        const cloudData = await syncOrchestrator.fetchCloudData();
        if (cloudData) {
          console.log('[SYNC-HANDSHAKE] Fetched cloud data, spaces:', (cloudData.spaces || []).length);
          const cloudSpaces = (cloudData.spaces || []) as any[];
          
          const totalUniqueSpaces = new Set([
            ...localSpaces.map(s => s.id),
            ...cloudSpaces.map(s => s.id)
          ]).size;
          
          const { user } = get();
          const plan = user?.plan || 'free';
          const limit = PLAN_CONFIG[plan].MAX_SPACES;
          
          // Trigger resolver only if quota exceeded
          if (totalUniqueSpaces > limit) {
            console.log(`[SYNC-HANDSHAKE] QUOTA CONFLICT: Opening resolver. totalUniqueSpaces: ${totalUniqueSpaces}, limit: ${limit}`);
            
            authStore.setQuotaResolverPending(true);
            const { useModalStore } = await import('../useModalStore');
            useModalStore.getState().openModal({
              title: 'Space Limit Reached',
              type: 'quota_resolver'
            });
            
            handshakeInProgress = false;
            return;
          } else {
            const isEmpty = await store.isLocalWorkspaceEmpty();
            const shouldMerge = isEmpty;
            
            console.log(`[Sync] Local empty: ${isEmpty}, No conflict. Mode: ${shouldMerge ? 'Merge' : 'Overwrite'}`);
            await store.importFullState(cloudData, shouldMerge);
          }
          
          const updatedSpaces = await db.spaces.filter(s => s.userId === currentUserId && !s.deletedAt).toArray();
          if (updatedSpaces.length > 0 && !store.activeSpaceId) {
            const firstSpace = updatedSpaces[0];
            await store.setActiveSpace(firstSpace.id);
          }

          try {
            const st: any = useStore.getState();
            st?.calculateUsage?.(st.totalThoughtCount || 0);
          } catch {}
          
          const now = new Date();
          localStorage.setItem('cyberia-last-sync', now.toISOString());
          set({ lastSync: now, syncStatus: 'synced' });

          syncOrchestrator.triggerSync(true);
          return;
        }
      } catch (e) {
        console.warn('[Sync] Initial cloud hydration failed:', e);
      }
      
      // Fallback to standard sync if hydration was empty or failed
      await get().syncData();
      const finalNow = new Date();
      localStorage.setItem('cyberia-last-sync', finalNow.toISOString());
      set({ lastSync: finalNow, syncStatus: 'synced' });
      
      const finalSpaces = await db.spaces.filter(s => s.userId === currentUserId && !s.deletedAt).toArray();
      if (finalSpaces.length > 0 && !store.activeSpaceId) {
        await store.setActiveSpace(finalSpaces[0].id);
      }

      syncOrchestrator.triggerSync(true);
    } finally {
      handshakeInProgress = false;
    }
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
