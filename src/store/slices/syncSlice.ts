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
  autoSync: localStorage.getItem('cyberia-auto-sync') === 'true',
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  _syncPromise: null,

  syncData: async () => {
    console.log('[Auth] syncData called');
    await syncOrchestrator.fullPushSync();
    // After a full push sync, refresh storage usage to reflect recent changes
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
    await syncOrchestrator.fullPushSync();
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
    
    // Fast path: try cloud hydration first
    try {
      const cloudData = await syncOrchestrator.fetchCloudData();
      if (cloudData) {
        const { useStore } = await import('../useStore');
        const store = useStore.getState();
        
        // 1. Check for Quota Conflict
        const localSpaces = await db.spaces.filter(s => s.syncStatus === 'local').toArray();
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
              description: `You have extra work from your guest session, but your ${plan} account is at its ${limit}-space limit. Your guest work will stay on this device only until you upgrade or merge it.`,
              type: 'alert',
              confirmText: 'Got it'
            });
          }, 1000);
        }

        // 2. Perform Smart Hydration (Merge)
        await store.importFullState(cloudData);
        
        try {
          const st: any = useStore.getState();
          st?.calculateUsage?.(st.totalThoughtCount || 0);
        } catch {}
        
        // 3. Mark first sync as successful to unlock deletions
        localStorage.setItem('cyberia-last-sync', new Date().toISOString());
        set({ lastSync: new Date(), syncStatus: 'synced' });
        return;
      }
    } catch (e) {
      console.warn('[Sync] Initial cloud hydration failed:', e);
    }
    
    // Fallback to standard sync if hydration was empty
    await get().syncData();
    localStorage.setItem('cyberia-last-sync', new Date().toISOString());
    set({ lastSync: new Date(), syncStatus: 'synced' });
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
