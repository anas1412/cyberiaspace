import { type StateCreator } from 'zustand';
import { db } from '../../db';
import { syncOrchestrator } from '../../services/sync/syncOrchestrator';
import { supabaseSync } from '../../services/supabaseSync';
import { supabaseStorage } from '../../services/supabaseStorage';

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
  mediaSweep: () => Promise<void>;
  handlePostAuthSync: () => Promise<void>;
  setAutoSync: (enabled: boolean) => Promise<void>;
}

export const createSyncSlice: StateCreator<AuthState, [], [], SyncSlice> = (set, get, _api) => ({
  syncStatus: typeof navigator !== 'undefined' && navigator.onLine 
    ? (localStorage.getItem('cyberia-user') ? 'synced' : 'offline') 
    : 'offline',
  lastSync: localStorage.getItem('cyberia-last-sync') ? new Date(localStorage.getItem('cyberia-last-sync')!) : null,
  autoSync: localStorage.getItem('cyberia-auto-sync') !== 'false',
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  _syncPromise: null,

  syncData: async () => {
    console.log('[Auth] syncData called - forcing manual sync');
    await syncOrchestrator.fullPushSync();
  },

  syncToServices: async () => {
    const { autoSync, user } = get();
    if (!autoSync || !user) return;

    // Media files are now synced via uploadThoughtBlob
    // This function can be used for additional cloud operations if needed
    console.log('[Storage] Service sync is now handled via Supabase Storage');
  },

  processOfflineChanges: async () => {
    const { isOnline, user, autoSync } = get();
    if (!isOnline || !user || !autoSync) return;

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
      console.warn('[Sync] importCloudData failed (user may not exist in Supabase yet):', err);
      set({ syncStatus: 'synced' });
      return null;
    }
  },

  mediaSweep: async () => {
    const { autoSync, user, isOnline } = get();
    if (!autoSync || !user) return;

    console.log('[Storage] Conducting Media Sweep...');
    try {
      const { useStore } = await import('../useStore');
      const mediaThoughts = await db.thoughts
        .filter(t => (t.type === 'image' || t.type === 'file') && t.syncStatus !== 'synced' && !t.deletedAt)
        .toArray();

      if (mediaThoughts.length === 0) {
        console.log('[Sync] Media sweep: Nothing to upload.');
        return;
      }

      console.log(`[Sync] Media sweep: Found ${mediaThoughts.length} items to upload.`);
      
      for (const t of mediaThoughts) {
        // Skip if already has storagePath (don't re-upload)
        if (t.storagePath) {
          console.log(`[Sync] Media sweep: Thought ${t.id} already has storagePath, skipping`);
          continue;
        }
        
        const blobEntry = await db.blobs.where('thoughtId').equals(t.id).first();
        
        if (!blobEntry) {
          console.log(`[Sync] Media sweep: Blob not found for thought ${t.id}, skipping`);
          continue;
        }

        if (!isOnline) {
          await db.pendingBlobs.add({
            thoughtId: t.id,
            name: blobEntry.name,
            type: blobEntry.type,
            createdAt: Date.now(),
            retryCount: 0
          });
          await db.thoughts.update(t.id, { syncStatus: 'pending' });
          continue;
        }

        useStore.getState().updateThought(t.id, { syncStatus: 'syncing' });

        try {
          const result = await supabaseStorage.uploadFile(
            user.id,
            blobEntry.blob,
            blobEntry.name
          );

          await db.thoughts.update(t.id, {
            storageUrl: result.url,
            storagePath: result.path,
            syncStatus: 'synced'
          });
          
          console.log(`[Sync] Media sweep: Uploaded ${t.id}`);
        } catch (err) {
          console.error(`[Sync] Media sweep: Failed to upload ${t.id}:`, err);
          await db.thoughts.update(t.id, { syncStatus: 'error' });
        }
      }
      
      console.log('[Sync] Media sweep complete.');
    } catch (err) {
      console.error('[Sync] Media sweep failed:', err);
    }
  },

  handlePostAuthSync: async () => {
    // Coalesce multiple calls into one
    if (get()._syncPromise) {
      console.log('[Sync] Coalescing handlePostAuthSync call...');
      return get()._syncPromise!;
    }

    const syncTask = (async () => {
      const { useStore } = await import('../useStore');
      const isBooting = useStore.getState().isInitializing;
      
      console.log('[Sync] Starting handlePostAuthSync...');
      set({ syncStatus: 'syncing' });
      
      // Start global loading state
      useStore.setState({ isInitializing: true });
      
      try {
        const data: any = await get().importCloudData();
        console.log('[Sync] Cloud data fetched:', data ? 'Data exists' : 'No data');
        
        // Check if cloud data is actually meaningful
        const cloudIsEmpty = !data || (
          (!data.thoughts || data.thoughts.length === 0) && 
          (!data.spaces || data.spaces.length <= 1)
        );

        if (data && !cloudIsEmpty) {
          console.log('[Sync] Cloud data found, showing conflict modal...');
          const { useModalStore } = await import('../useModalStore');
          
          useStore.setState({ isInitializing: false });

          await new Promise((resolve) => {
            useModalStore.getState().openModal({
              title: 'Choose Data Source',
              description: 'Do you want to use your cloud backup or keep your local workspace?',
              type: 'conflict_resolver',
              onConfirm: async (choice) => {
                console.log('[Sync] User choice:', choice);
                useStore.setState({ isInitializing: true });
                try {
                  if (choice === 'cloud') {
                    // Import cloud data to local
                    await useStore.getState().importFullState(data);
                    
                    // Clean up LOCAL orphaned blobs only (not cloud storage!)
                    // Get valid local thought IDs after import
                    const localThoughtIds = new Set((await db.thoughts.toArray()).map(t => t.id));
                    
                    // Delete blobs whose thoughtId doesn't exist locally
                    const allBlobs = await db.blobs.toArray();
                    for (const blob of allBlobs) {
                      if (blob.thoughtId && !localThoughtIds.has(blob.thoughtId)) {
                        await db.blobs.delete(blob.id!);
                        console.log(`[Sync] Deleted orphaned local blob: ${blob.id}`);
                      }
                    }
                    
                    // NO cloud storage cleanup when choosing cloud!
                  } else if (choice === 'local') {
                    // Push local to cloud (wipes cloud first, then pushes)
                    await syncOrchestrator.fullPushSync();
                    
                    // Clean up CLOUD orphaned files (this is correct for local choice)
                    const validPaths = new Set<string>();
                    const allThoughts = await db.thoughts.toArray();
                    for (const t of allThoughts) {
                      if (t.storagePath) validPaths.add(t.storagePath);
                    }
                    await supabaseStorage.cleanupOrphanedFiles(get().user!.id, validPaths);
                  }
                  
                  const now = new Date();
                  set({ lastSync: now, syncStatus: 'synced' });
                  localStorage.setItem('cyberia-last-sync', now.toISOString());
                  
                  await get().mediaSweep();
                } finally {
                  useStore.setState({ isInitializing: false });
                  resolve(void 0);
                }
              }
            });
          });
        } else if (!data || cloudIsEmpty) {
          console.log('[Sync] Cloud is empty or no data, pushing local data to cloud...');
          if (get().status === 'authenticated') {
            await syncOrchestrator.fullPushSync();
            await get().mediaSweep();
          }
        }
        
        const now = new Date();
        set({ syncStatus: 'synced', lastSync: now });
        localStorage.setItem('cyberia-last-sync', now.toISOString());
        console.log('[Sync] Post-auth sync complete.');
      } catch (e: any) {
        console.error('[Sync] Post-auth sync failed:', e);
        set({ syncStatus: 'error' });
      } finally {
        set({ _syncPromise: null });
        // Only clear initializing if we are actually in a booting sequence
        if (isBooting) {
          useStore.setState({ isInitializing: false });
        }
      }
    })();

    set({ _syncPromise: syncTask });
    return syncTask;
  },

  setAutoSync: async (enabled: boolean) => {
    localStorage.setItem('cyberia-auto-sync', String(enabled));
    set({ autoSync: enabled });
    
    // Save to Supabase for cross-device persistence
    const { user, accessToken } = get();
    if (user && accessToken) {
      try {
        await supabaseSync.updateSettings(user.id, { autoSync: enabled });
        const updatedUser = { ...user, settings: { ...user.settings, autoSync: enabled } };
        set({ user: updatedUser });
        localStorage.setItem('cyberia-user', JSON.stringify(updatedUser));
      } catch (e) {
        console.warn('[Auth] Failed to save autoSync preference:', e);
      }
    }
  },
});
