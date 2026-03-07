import { type StateCreator } from 'zustand';
import { db } from '../../db';
import { supabaseStorage } from '../../services/supabaseStorage';
import { PLAN_CONFIG, type SubscriptionPlan } from '../../constants';
import { syncOrchestrator } from '../../services/sync/syncOrchestrator';
import { type AuthState } from '../types';

export const createStorageSlice: StateCreator<AuthState, [], [], any> = (set, get, _api) => ({
  cloudUsage: 0,
  storageUsageMB: 0,
  activeDownloads: [],

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
    
    const isBlocked = syncOrchestrator.getSyncBlocked();
    console.log(`[Storage] uploadThoughtBlob started for thoughtId: ${thoughtId}, autoSync: ${autoSync}, force: ${force}, isBlocked: ${isBlocked}`);

    if (isBlocked && !force) {
      console.log('[Storage] Sync is currently blocked by another operation, skipping individual upload');
      return;
    }

    if ((!autoSync && !force) || !user) {
      console.log('[Storage] Auto-sync is OFF and no force sync requested, keeping blob locally');
      
      // Reset status to local if it was stuck in pending/syncing
      const thought = await db.thoughts.get(thoughtId);
      if (thought && (thought.syncStatus === 'pending' || thought.syncStatus === 'syncing')) {
        const { useStore } = await import('../useStore');
        const updates = { syncStatus: 'local' as const };
        await db.thoughts.update(thoughtId, updates);
        useStore.getState().updateThought(thoughtId, updates);
      }
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

      // Skip if already has storagePath (don't re-upload) unless forced
      if (thought.storagePath && !force) {
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
        blobEntry.name,
        thoughtId
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
      if (thought.type === 'file') {
        updates.data = {
          ...(thought.data || {}),
          type: 'file',
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

  downloadSingleBlob: async (thoughtId: number) => {
    const { activeDownloads, user, isOnline } = get();
    if (!user || !isOnline) return;
    if (activeDownloads.includes(thoughtId)) return;

    set({ activeDownloads: [...activeDownloads, thoughtId] });

    try {
      const thought = await db.thoughts.get(thoughtId);
      if (!thought || !thought.storageUrl) return;

      console.log(`[Storage] Priority download starting for thought: ${thoughtId}`);
      const response = await fetch(thought.storageUrl);
      const blob = await response.blob();
      
      const fileName = thought.text || 'asset';
      const fileType = blob.type || 'application/octet-stream';

      await db.blobs.put({
        id: `cloud-${Date.now()}-${thoughtId}`,
        thoughtId,
        blob,
        name: fileName,
        type: fileType,
        updatedAt: Date.now()
      });

      // Dynamic import to avoid circular dependency
      const { useStore } = await import('../useStore');
      // "Ping" the UI by updating updatedAt
      await useStore.getState().updateThought(thoughtId, { updatedAt: Date.now() });
      console.log(`[Storage] Priority download complete: ${thoughtId}`);
    } catch (err) {
      console.error(`[Storage] Priority download failed for ${thoughtId}:`, err);
    } finally {
      const { activeDownloads: currentDownloads } = get();
      set({ activeDownloads: currentDownloads.filter(id => id !== thoughtId) });
    }
  },

  downloadMissingBlobs: async () => {
    const { user, isOnline } = get();
    if (!user || !isOnline) return;

    try {
      const { useStore } = await import('../useStore');
      
      // Find thoughts with storage but no local blob
      const cloudThoughts = await db.thoughts
        .filter(t => !!t.storageUrl && !t.deletedAt)
        .toArray();
      
      const missing = [];
      for (const t of cloudThoughts) {
        const localBlob = await db.blobs.where('thoughtId').equals(t.id).first();
        if (!localBlob) {
          missing.push(t);
        }
      }

      if (missing.length === 0) return;
      console.log(`[Storage] Background sync: ${missing.length} missing blobs detected.`);

      // Batch process in groups of 3
      const BATCH_SIZE = 3;
      for (let i = 0; i < missing.length; i += BATCH_SIZE) {
        const batch = missing.slice(i, i + BATCH_SIZE);
        
        await Promise.all(batch.map(async (t) => {
          try {
            const res = await fetch(t.storageUrl!);
            const blob = await res.blob();
            
            await db.blobs.put({
              id: `cloud-${Date.now()}-${t.id}`,
              thoughtId: t.id,
              blob,
              name: t.text || 'asset',
              type: blob.type || 'application/octet-stream',
              updatedAt: Date.now()
            });

            // Ping UI for each thought in the batch
            await useStore.getState().updateThought(t.id, { updatedAt: Date.now() });
          } catch (e) {
            console.warn(`[Storage] Background download failed for ${t.id}:`, e);
          }
        }));
      }
      
      console.log('[Storage] Background sync complete');
    } catch (err) {
      console.error('[Storage] Background sync failed:', err);
    }
  },

  removeCloudAsset: async (thoughtId: number) => {
    // Disable auto-sync to prevent immediate re-upload
    await get().setAutoSync(false);

    const { user, isOnline } = get();
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
            blobEntry.name,
            blob.thoughtId
          );

          const updates: any = {
            storageUrl: result.url,
            storagePath: result.path,
            syncStatus: 'synced'
          };

          // Modular data update
          if (thought && thought.type === 'file') {
            updates.data = {
              ...(thought.data || {}),
              type: 'file',
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
