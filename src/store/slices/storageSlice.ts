import { type StateCreator } from 'zustand';
import { db } from '../../db';
import { supabaseStorage } from '../../services/supabaseStorage';
import { PLAN_CONFIG, type SubscriptionPlan } from '../../constants';
import { type AuthState } from '../types';

export const createStorageSlice: StateCreator<AuthState, [], [], any> = (set, get, _api) => ({
  cloudUsage: 0,
  storageUsageMB: 0,

  calculateUsage: async (thoughtCount: number) => {
    const { user } = get();
    const plan = (user?.plan || 'free') as SubscriptionPlan;
    
    // Calculate cloud thoughts usage
    const thoughtLimit = PLAN_CONFIG[plan].MAX_CLOUD_THOUGHTS;
    const currentCount = user?.usage?.sync_thoughts ?? thoughtCount;
    
    // Calculate storage usage
    let storageMB = 0;
    if (user?.id) {
      try {
        const bytes = await supabaseStorage.getStorageUsage(user.id);
        storageMB = bytes / (1024 * 1024);
      } catch (e) {
        console.warn('[Storage] Could not fetch storage usage:', e);
      }
    }
    
    set({ 
      cloudUsage: (currentCount / thoughtLimit) * 100,
      storageUsageMB: storageMB 
    });
  },

  uploadThoughtBlob: async (thoughtId: number, force?: boolean) => {
    const { autoSync, user, isOnline } = get();
    
    console.log(`[Storage] uploadThoughtBlob started for thoughtId: ${thoughtId}, autoSync: ${autoSync}, force: ${force}`);

    if ((!autoSync && !force) || !user) {
      console.log('[Storage] Auto-sync is OFF and no force sync requested, keeping blob locally');
      return;
    }

    try {
      const { useStore } = await import('../useStore');

      const blobEntry = await db.blobs.where('thoughtId').equals(thoughtId).first();
      const thought = await db.thoughts.get(thoughtId);

      if (!blobEntry || !thought) {
        console.warn('[Storage] No blob entry or thought found for id:', thoughtId);
        return;
      }

      // Skip if already has storagePath (don't re-upload)
      if (thought.storagePath) {
        console.log('[Storage] Thought already has storagePath, skipping upload');
        return;
      }

      // Check file size
      const sizeCheck = supabaseStorage.checkFileSize(blobEntry.blob);
      if (!sizeCheck.valid) {
        console.error('[Storage] File too large:', sizeCheck.message);
        const updates = { syncStatus: 'error' as const };
        await db.thoughts.update(thoughtId, updates);
        useStore.getState().updateThought(thoughtId, updates);
        return;
      }

      // If offline, queue for later
      if (!isOnline) {
        console.log('[Storage] Offline, queuing blob for later upload');
        await db.pendingBlobs.put({
          thoughtId,
          name: blobEntry.name,
          type: blobEntry.type,
          createdAt: Date.now(),
          retryCount: 0
        });
        const updates = { syncStatus: 'pending' as const };
        await db.thoughts.update(thoughtId, updates);
        useStore.getState().updateThought(thoughtId, updates);
        return;
      }

      console.log('[Storage] Transitioning status to syncing...');
      useStore.getState().updateThought(thoughtId, { syncStatus: 'syncing' });

      // Add a timeout to prevent hanging forever
      const uploadPromise = supabaseStorage.uploadFile(
        user.id,
        blobEntry.blob,
        blobEntry.name
      );

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Upload timed out')), 60000)
      );

      console.log('[Storage] Calling supabaseStorage.uploadFile with 60s timeout...');
      const result = await Promise.race([uploadPromise, timeoutPromise]) as any;

      console.log('[Storage] Upload successful:', result.path);

      const updates: any = {
        storageUrl: result.url,
        storagePath: result.path,
        syncStatus: 'synced',
      };

      // Modular data update
      if (thought.type === 'file' && thought.data?.type === 'file') {
        updates.data = {
          ...thought.data,
          url: result.url
        };
      }

      await db.thoughts.update(thoughtId, updates);
      useStore.getState().updateThought(thoughtId, updates);

    } catch (err) {
      console.error('[Storage] Failed to upload blob:', err);
      const { useStore } = await import('../useStore');
      const updates = { syncStatus: 'error' as const };
      await db.thoughts.update(thoughtId, updates);
      useStore.getState().updateThought(thoughtId, updates);
    }
  },

  removeCloudAsset: async (thoughtId: number) => {
    // Disable auto-sync to prevent immediate re-upload
    await get().updateSettings({ autoSync: false });

    const { user, isOnline, syncData } = get();
    if (!user) return;

    try {
      const thought = await db.thoughts.get(thoughtId);
      if (!thought || !thought.storagePath) return;

      console.log('[Storage] Removing cloud asset:', thought.storagePath);

      if (isOnline) {
        try {
          await supabaseStorage.deleteFile(thought.storagePath);
        } catch (err) {
          console.warn('[Storage] Could not delete cloud file, it might be already gone:', err);
        }
      } else {
        await db.pendingDeletions.add({
          tableName: 'thoughts',
          localId: thought.id,
          storagePath: thought.storagePath,
          createdAt: Date.now(),
        }).catch(() => {});
      }

      const updates: any = {
        storageUrl: undefined,
        storagePath: undefined,
        syncStatus: 'local' as const
      };

      // Modular data update
      if (thought.type === 'file' && thought.data?.type === 'file') {
        updates.data = {
          ...thought.data,
          url: '' // Revert to empty/local
        };
      }

      await db.thoughts.update(thoughtId, updates);
      
      const { useStore } = await import('../useStore');
      useStore.getState().updateThought(thoughtId, updates);

      await syncData();
    } catch (err) {
      console.error('[Storage] Failed to remove cloud asset:', err);
    }
  },

  deleteServiceContent: async (thought: any) => {
    const { user } = get();
    if (!user) return;

    // Get storage path from thought
    const latest = await db.thoughts.get(thought.id).catch(() => null);
    const storagePath = latest?.storagePath || thought.storagePath;

    if (!storagePath) return;

    // Add to pending deletions for retry
    await db.pendingDeletions.add({
      tableName: 'thoughts',
      localId: thought.id,
      storagePath: storagePath,
      createdAt: Date.now(),
    }).catch(() => {});

    // Try immediate deletion
    if (get().isOnline) {
      try {
        console.log(`[Storage] Deleting: ${storagePath}`);
        await supabaseStorage.deleteFile(storagePath);
        // Remove from pending
        const pending = await db.pendingDeletions.where('storagePath').equals(storagePath).first();
        if (pending?.id) {
          await db.pendingDeletions.delete(pending.id);
        }
        console.log('[Storage] Deletion successful');
      } catch (err) {
        console.warn('[Storage] Immediate deletion failed (will retry):', err);
      }
    }
  },

  processPendingDeletions: async () => {
    const { isOnline, user } = get();
    if (!isOnline || !user) return;

    try {
      const pending = await db.pendingDeletions.toArray();
      if (pending.length === 0) return;

      console.log(`[Storage] Processing ${pending.length} pending deletions...`);

      for (const item of pending) {
        if (item.storagePath) {
          try {
            await supabaseStorage.deleteFile(item.storagePath);
            await db.pendingDeletions.delete(item.id!);
            console.log(`[Storage] Deleted: ${item.storagePath}`);
          } catch (err: any) {
            if (err.message?.includes('404') || err.message?.includes('not found')) {
              await db.pendingDeletions.delete(item.id!);
            } else {
              console.warn(`[Storage] Failed to delete ${item.storagePath}:`, err);
            }
          }
        }
      }
    } catch (err) {
      console.error('[Storage] Pending deletions failed:', err);
    }
  },

  processPendingBlobs: async () => {
    const { isOnline, user, autoSync } = get();
    if (!isOnline || !user || !autoSync) return;

    try {
      const blobs = await db.pendingBlobs.where('retryCount').below(3).toArray();
      if (blobs.length === 0) return;

      console.log(`[Storage] Processing ${blobs.length} pending blob uploads...`);

      for (const blob of blobs) {
        try {
          // Get the blob from db.blobs
          const blobEntry = await db.blobs.where('thoughtId').equals(blob.thoughtId).first();
          const thought = await db.thoughts.get(blob.thoughtId);
          
          if (!blobEntry) {
            // Blob no longer exists, remove from queue
            await db.pendingBlobs.delete(blob.id!);
            continue;
          }

          // Skip if already has storagePath (don't re-upload)
          if (thought?.storagePath) {
            console.log('[Storage] Thought already has storagePath, skipping pending upload');
            await db.pendingBlobs.delete(blob.id!);
            continue;
          }

          const result = await supabaseStorage.uploadFile(
            user.id,
            blobEntry.blob,
            blobEntry.name
          );

          const updates: any = {
            storageUrl: result.url,
            storagePath: result.path,
            syncStatus: 'synced'
          };

          // Modular data update
          if (thought && thought.type === 'file' && thought.data?.type === 'file') {
            updates.data = {
              ...thought.data,
              url: result.url
            };
          }

          await db.thoughts.update(blob.thoughtId, updates);

          const { useStore } = await import('../useStore');
          useStore.getState().updateThought(blob.thoughtId, updates);

          await db.pendingBlobs.delete(blob.id!);
          console.log(`[Storage] Uploaded pending blob for thought:`, blob.thoughtId);
        } catch (err) {
          console.error(`[Storage] Failed to upload pending blob:`, err);
          await db.pendingBlobs.update(blob.id!, { retryCount: blob.retryCount + 1 });
        }
      }
    } catch (err) {
      console.error('[Storage] Process pending blobs failed:', err);
    }
  },
});
