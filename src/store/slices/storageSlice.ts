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
    const { user, isOnline } = get();
    const plan = (user?.plan || 'free') as SubscriptionPlan;
    
    // Cloud storage is the authoritative source of truth for what's actually in cloud.
    // We use it directly and add local-only pending blobs on top.
    let storageMB = 0;
    
    // 1. Calculate local-only bytes (blobs that haven't been pushed to cloud yet)
    // These are thoughts with syncStatus: 'local' that have blobs but no storagePath
    try {
      const currentUserId = user?.id ?? 'guest';
      
      // Get thoughts that have blobs locally but haven't been uploaded to cloud
      const pendingThoughts = await db.thoughts
        .filter((t: any) => t.userId === currentUserId && !t.deletedAt && t.syncStatus === 'local' && !t.storagePath)
        .toArray();
      const pendingThoughtIds = new Set(pendingThoughts.map((t: any) => t.id));
      
      const pendingBlobs = await db.blobs
        .filter((b: any) => pendingThoughtIds.has(b.thoughtId) && b.userId === currentUserId)
        .toArray();
      const pendingBytes = pendingBlobs.reduce((sum: number, b: any) => sum + (b.blob?.size || 0), 0);
      
      // Include space backgrounds that haven't been uploaded (blob: URLs)
      // Only count backgrounds for non-deleted spaces
      const validSpaceIds = new Set(
        (await db.spaces.filter((s: any) => s.userId === currentUserId && !s.deletedAt).primaryKeys())
      );
      const spaceBgs = await db.spaceBackgrounds
        .filter((b: any) => b.userId === currentUserId && validSpaceIds.has(b.spaceId))
        .toArray();
      const pendingBgBytes = spaceBgs.reduce((sum: number, b: any) => sum + (b.blob?.size || 0), 0);
      
      storageMB = (pendingBytes + pendingBgBytes) / (1024 * 1024);
    } catch (e) {
      console.warn('[Storage] Could not calculate local pending usage:', e);
    }
    
    // 2. If Online, add cloud usage for definitive quota status
    // Cloud is authoritative - it reflects what's actually stored in Supabase
    if (user?.id && isOnline) {
      try {
        const cloudBytes = await supabaseStorage.getStorageUsage(user.id);
        const cloudMB = cloudBytes / (1024 * 1024);
        storageMB += cloudMB;
      } catch (e) {
        console.warn('[Storage] Could not fetch cloud storage usage:', e);
      }
    }
    
    // 3. Calculate cloud thoughts usage (DB quota)
    const thoughtLimit = PLAN_CONFIG[plan].MAX_CLOUD_THOUGHTS;
    const currentCount = user?.usage?.sync_thoughts ?? thoughtCount;
    
    set({ 
      cloudUsage: (currentCount / thoughtLimit) * 100,
      storageUsageMB: storageMB 
    });
  },

  uploadThoughtBlob: async (thoughtId: string, force?: boolean) => {
    const { autoSync, user, isOnline } = get();
    
    const isBlocked = syncOrchestrator.getSyncBlocked();

    if (isBlocked && !force) {
      return;
    }

    if ((!autoSync && !force) || !user) {
      return;
    }

    try {
      const { useStore } = await import('../useStore');
      const store = useStore.getState();
      const currentUserId = user?.id ?? 'guest';

      const blobEntry = await db.blobs.filter(b => b.thoughtId === thoughtId && b.userId === currentUserId).first();
      const thought = await db.thoughts.filter(t => t.id === thoughtId).first();

      if (!thought || thought.userId !== currentUserId) {
        return;
      }

      if (!blobEntry) {
        return;
      }

      if (thought.storagePath && thought.syncStatus === 'synced' && !force) {
        return;
      }

      const sizeCheck = supabaseStorage.checkFileSize(blobEntry.blob);
      if (!sizeCheck.valid) {
        console.error('[Storage] File too large:', sizeCheck.message);
        const now = Date.now();
        await db.thoughts.update(thoughtId, { syncStatus: 'error', updatedAt: now });
        store.patchThought(thoughtId, { syncStatus: 'error', updatedAt: now });
        return;
      }

      // Check storage quota before uploading
      const plan = (user.plan || 'free') as SubscriptionPlan;
      const storageLimitMB = PLAN_CONFIG[plan].MAX_STORAGE_MB;
      const fileMB = blobEntry.blob.size / (1024 * 1024);
      if (get().storageUsageMB + fileMB > storageLimitMB) {
        console.error('[Storage] Quota exceeded:', `Need ${fileMB.toFixed(1)}MB, have ${(storageLimitMB - get().storageUsageMB).toFixed(1)}MB remaining`);
        const now = Date.now();
        await db.thoughts.update(thoughtId, { syncStatus: 'error', updatedAt: now });
        store.patchThought(thoughtId, { syncStatus: 'error', updatedAt: now });
        return;
      }

      if (!isOnline) {
        console.log('[Storage] Offline, will retry when online');
        return;
      }

      // Use patchThought for immediate store update without debounce
      store.patchThought(thoughtId, { syncStatus: 'syncing' });

      const result = await supabaseStorage.uploadFile(
        user.id,
        blobEntry.blob,
        blobEntry.name,
        thoughtId
      );

      const updates: any = {
        storageUrl: result.url,
        storagePath: result.path,
        // CRITICAL: We don't mark as 'synced' here. 
        // We leave it as 'local' (or 'syncing') and bump updatedAt.
        // The syncOrchestrator will handle the official push and mark it 'synced' 
        // after the DB record is confirmed on the cloud.
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
      store.patchThought(thoughtId, updates);

      // Force an immediate metadata push to cloud so the UI reflects 
      // the 'synced' status ASAP after the file is physically uploaded.
      syncOrchestrator.triggerSync(true);

      // Refresh storage usage after cloud update
      try {
        const { useStore } = await import('../useStore');
        const st: any = useStore.getState();
        st?.calculateUsage?.(st.totalThoughtCount || 0);
      } catch {
        // best-effort only
      }

    } catch (err) {
      console.error('[Storage] Failed to upload blob:', err);
      const now = Date.now();
      try {
        const { useStore } = await import('../useStore');
        const store = useStore.getState();
        await db.thoughts.update(thoughtId, { syncStatus: 'error', updatedAt: now });
        store.patchThought(thoughtId, { syncStatus: 'error', updatedAt: now });
      } catch (e) {}
    }
  },

  uploadSpaceBackground: async (_spaceId: string, _force?: boolean) => {
    // Backgrounds are local-only now — no cloud upload needed.
    // The blob is already stored in IndexedDB (db.spaceBackgrounds).
    // This is intentional: zero egress, instant load, no signed URL complexity.
    console.log('[Storage] Background upload skipped — backgrounds are local-only');
  },

  downloadSingleBlob: async (thoughtId: string) => {
    const { activeDownloads, user, isOnline } = get();
    if (!user || !isOnline) return;
    if (activeDownloads.includes(thoughtId)) return;

    set({ activeDownloads: [...activeDownloads, thoughtId] });

    try {
      const thought = await db.thoughts.get(thoughtId);
      const currentUserId = user.id ?? 'guest';
      if (!thought || thought.userId !== currentUserId) {
        console.warn('[Storage] Thought not found or belongs to another user:', thoughtId);
        return;
      }
      if (!thought.storagePath) return;

      console.log(`[Storage] Downloading blob for thought: ${thoughtId}`);
      // Use signed URL since bucket is private
      const signedUrl = await supabaseStorage.getSignedUrl(thought.storagePath);
      const response = await fetch(signedUrl);
      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
      }
      const blob = await response.blob();
      
      const fileName = thought.text || 'asset';
      const fileType = blob.type || 'application/octet-stream';
      const now = Date.now();

      const { useStore } = await import('../useStore');
      const store = useStore.getState();

      store.patchThought(thoughtId, { updatedAt: now });

      await db.blobs.put({
        id: thoughtId,
        thoughtId,
        blob,
        name: fileName,
        type: fileType,
        userId: currentUserId,
        updatedAt: now
      });

      await db.thoughts.update(thoughtId, { updatedAt: now });

      // Refresh storage usage after local update
      try {
        const st: any = useStore.getState();
        st?.calculateUsage?.(st.totalThoughtCount || 0);
      } catch {}
      // Recalculate storage usage after local blob write
      try {
        const st: any = useStore.getState();
        st?.calculateUsage?.(st.totalThoughtCount || 0);
      } catch {}
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
      const currentUserId = user?.id ?? 'guest';
      const cloudThoughts = await db.thoughts
        .filter(t => !!t.storagePath && !t.deletedAt && t.userId === currentUserId)
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
            // Use signed URL since bucket is private
            const signedUrl = await supabaseStorage.getSignedUrl(t.storagePath!);
            const res = await fetch(signedUrl);
            if (!res.ok) {
              throw new Error(`Failed to download file: ${res.status}`);
            }
            const blob = await res.blob();
            const now = Date.now();

            useStore.getState().patchThought(t.id, { updatedAt: now });

            await db.blobs.put({
              id: t.id,
              thoughtId: t.id,
              blob,
              name: t.text || 'asset',
              type: blob.type || 'application/octet-stream',
              userId: currentUserId,
              updatedAt: now
            });

            await db.thoughts.update(t.id, { updatedAt: now });
          } catch (e) {
            console.warn(`[Storage] Background download failed for ${t.id}:`, e);
          }
        }));
      }
    } catch (err) {
      console.error('[Storage] Background sync failed:', err);
    }
  },

  healSpaceBackgrounds: async () => {
    // No-op: backgrounds are local-only now. No cloud backgrounds to heal.
    // Kept as stub for interface compatibility.
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

      const { useStore } = await import('../useStore');
      useStore.getState().updateThought(thoughtId, updates, { skipSync: true });

      await db.thoughts.update(thoughtId, updates);

    } catch (err) {
      console.error('[Storage] Failed to remove cloud asset:', err);
    }
  },
});
