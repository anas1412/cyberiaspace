import { type StateCreator } from 'zustand';
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
  autoSync: false, // Forced to false per user request
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  _syncPromise: null,

  syncData: async () => {
    console.log('[Auth] syncData called');
    await syncOrchestrator.fullPushSync();
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
    console.log('[Sync] handlePostAuthSync: Triggering delta hydration...');
    // In the future, this will trigger the Metadata-First Hydration logic
    await get().syncData();
  },

  setAutoSync: async (enabled: boolean) => {
    localStorage.setItem('cyberia-auto-sync', String(enabled));
    set({ autoSync: enabled });
    
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
