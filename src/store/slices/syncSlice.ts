import { type StateCreator } from 'zustand';
import { db } from '../../db';
import { syncOrchestrator } from '../../services/sync/syncOrchestrator';
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
  handlePostAuthSync: () => Promise<void>; // Kept as fallback in authSlice
  setAutoSync: (enabled: boolean) => Promise<void>;
}

let handshakeInProgress = false;

export const createSyncSlice: StateCreator<AuthState, [], [], SyncSlice> = (set, get, _api) => ({
  // Show syncing when logged in - more accurate than amber/offline
  syncStatus: localStorage.getItem('cyberia-user') ? 'syncing' : 'offline',
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
      
      // Sync local changes to cloud
      console.log('[SYNC-HANDSHAKE] Syncing local data to cloud...');
      await syncOrchestrator.deltaSync(true);
      
      // Setup active space
      const updatedSpaces = await db.spaces.filter(s => s.userId === currentUserId && !s.deletedAt).toArray();
      if (updatedSpaces.length > 0 && !store.activeSpaceId) {
        await store.setActiveSpace(updatedSpaces[0].id);
      }
      
      // Calculate usage and mark synced
      try {
        const st: any = useStore.getState();
        st?.calculateUsage?.(st.totalThoughtCount || 0);
      } catch {}
      
      const now = new Date();
      localStorage.setItem('cyberia-last-sync', now.toISOString());
      set({ lastSync: now, syncStatus: 'synced' });
      
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
