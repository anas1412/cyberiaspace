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

  uploadThoughtBlob: async (thoughtId: string, force?: boolean) => {
    const { autoSync, user, isOnline } = get();
    
    const isBlocked = syncOrchestrator.getSyncBlocked();
    console.log(`[Storage] uploadThoughtBlob started for thoughtId: ${thoughtId}, autoSync: ${autoSync}, force: ${force}, isBlocked: ${isBlocked}`);

    if (isBlocked && !force) {
      console.log('[Storage] Sync is currently blocked, skipping individual upload');
      return;
    }

    if ((!autoSync && !force) || !user) {
      console.log('[Storage] Auto-sync is OFF, keeping blob locally');
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

      if (thought.storagePath && thought.syncStatus === 'synced' && !force) {
        return;
      }

      const sizeCheck = supabaseStorage.checkFileSize(blobEntry.blob);
      if (!sizeCheck.valid) {
        console.error('[Storage] File too large:', sizeCheck.message);
        await db.thoughts.update(thoughtId, { syncStatus: 'error', updatedAt: Date.now() });
        useStore.getState().updateThought(thoughtId, { syncStatus: 'error' }, { skipSync: true });
        return;
      }

      if (!isOnline) {
        console.log('[Storage] Offline, will retry when online');
        return;
      }

      useStore.getState().updateThought(thoughtId, { syncStatus: 'syncing' }, { skipSync: true });

      const result = await supabaseStorage.uploadFile(
        user.id,
        blobEntry.blob,
        blobEntry.name,
        thoughtId
      );

      const updates: any = {
        storageUrl: result.url,
        storagePath: result.path,
        syncStatus: 'synced',
        updatedAt: Date.now()
      };

      if (thought.type === 'file') {
        const currentData = (thought.data || {}) as any;
        updates.data = {
          ...currentData,
          type: 'file',
          url: result.url,
          meta: {
            ...(currentData.meta || {}),
            file: {
              ...(currentData.meta?.file || {}),
              name: blobEntry.name,
              size: blobEntry.blob.size,
              type: blobEntry.blob.type
            }
          }
        };
      }

      await db.thoughts.update(thoughtId, updates);
      useStore.getState().updateThought(thoughtId, updates, { skipSync: true });

    } catch (err) {
      console.error('[Storage] Failed to upload blob:', err);
      const { useStore } = await import('../useStore');
      await db.thoughts.update(thoughtId, { syncStatus: 'error', updatedAt: Date.now() });
      useStore.getState().updateThought(thoughtId, { syncStatus: 'error' }, { skipSync: true });
    }
  },

  downloadSingleBlob: async (thoughtId: string) => {
    const { activeDownloads, user, isOnline } = get();
    if (!user || !isOnline) return;
    if (activeDownloads.includes(thoughtId)) return;

    set({ activeDownloads: [...activeDownloads, thoughtId] });

    try {
      const thought = await db.thoughts.get(thoughtId);
      if (!thought || !thought.storageUrl) return;

      console.log(`[Storage] Downloading blob for thought: ${thoughtId}`);
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

      const { useStore } = await import('../useStore');
      // Update locally without triggering another sync
      await useStore.getState().updateThought(thoughtId, { updatedAt: Date.now() }, { skipSync: true });
    } catch (err) {
      console.error(`[Storage] Download failed for ${thoughtId}:`, err);
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

            await useStore.getState().updateThought(t.id, { updatedAt: Date.now() }, { skipSync: true });
          } catch (e) {
            console.warn(`[Storage] Background download failed for ${t.id}:`, e);
          }
        }));
      }
    } catch (err) {
      console.error('[Storage] Background sync failed:', err);
    }
  },

  removeCloudAsset: async (thoughtId: string) => {
    const { user, isOnline } = get();
    if (!user) return;

    try {
      const thought = await db.thoughts.get(thoughtId);
      if (!thought || !thought.storagePath) return;

      if (isOnline) {
        try {
          await supabaseStorage.deleteFile(thought.storagePath);
        } catch (err) {
          console.warn('[Storage] Could not delete cloud file:', err);
        }
      }

      const updates: any = {
        storageUrl: undefined,
        storagePath: undefined,
        syncStatus: 'local' as const,
        updatedAt: Date.now()
      };

      if (thought.type === 'file' && thought.data?.type === 'file') {
        updates.data = { ...thought.data, url: '' };
      }

      await db.thoughts.update(thoughtId, updates);
      const { useStore } = await import('../useStore');
      useStore.getState().updateThought(thoughtId, updates, { skipSync: true });

    } catch (err) {
      console.error('[Storage] Failed to remove cloud asset:', err);
    }
  },

  deleteServiceContent: async (_thought: any) => {
    // This will be handled by the new Delta Sync Ack-based deletion in Phase 4
    console.log('[Storage] deleteServiceContent deferred to Sync Engine');
  },

  processPendingDeletions: async () => {
    console.warn('[Storage] processPendingDeletions is deprecated');
  },

  processPendingBlobs: async () => {
    console.warn('[Storage] processPendingBlobs is deprecated');
  },
});
