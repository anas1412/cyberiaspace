import { type StateCreator } from 'zustand';
import { db } from '../../db';
import { supabaseStorage, isStorageUrl } from '../../services/supabaseStorage';
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
    
    // 1. Calculate Local Usage (Instant & Offline friendly)
    // This provides immediate feedback even before sync
    // Scope blobs to current user's thoughts to prevent cross-user data leakage
    let storageMB = 0;
    try {
      const currentUserId = user?.id ?? 'guest';
      const userThoughtIds = new Set(
        (await db.thoughts.filter((t: any) => t.userId === currentUserId).primaryKeys())
      );
      const userBlobs = await db.blobs.filter((b: any) => userThoughtIds.has(b.thoughtId)).toArray();
      const localBytes = userBlobs.reduce((sum: number, b: any) => sum + (b.blob?.size || 0), 0);
      storageMB = localBytes / (1024 * 1024);
    } catch (e) {
      console.warn('[Storage] Could not calculate local usage:', e);
    }
    
    // 2. If Online, fetch Cloud Usage for definitive quota status
    if (user?.id && isOnline) {
      try {
        const cloudBytes = await supabaseStorage.getStorageUsage(user.id);
        const cloudMB = cloudBytes / (1024 * 1024);
        
        // We use the MAX of local vs cloud to be safe
        // This handles cases where local cache is cleared but cloud is full,
        // OR when local has new files that haven't hit the cloud yet.
        storageMB = Math.max(storageMB, cloudMB);
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

  uploadSpaceBackground: async (spaceId: string, force?: boolean) => {
    const { user, isOnline } = get();
    if (!user || !isOnline) return;

    try {
      // Get local blob from IndexedDB
      const bgEntry = await db.spaceBackgrounds.get(spaceId);
      if (!bgEntry) {
        console.log('[Storage] No local background to upload for space:', spaceId);
        return;
      }

      // Check if already synced (has cloud URL in space record)
      const space = await db.spaces.get(spaceId);
      if (space?.customBg && !space.customBg.startsWith('blob:') && !force) {
        // Already has cloud URL, skip
        return;
      }

      // Upload to Supabase Storage
      const { url } = await supabaseStorage.uploadSpaceBackground(
        user.id,
        spaceId,
        bgEntry.blob,
        bgEntry.type
      );

      // Update space with cloud URL
      const now = Date.now();
      await db.spaces.update(spaceId, { 
        customBg: url, 
        updatedAt: now,
        syncStatus: 'synced' 
      });

      // Update local state
      const { useStore } = await import('../useStore');
      const store = useStore.getState();
      
      // Revoke old blob URL and use cloud URL
      const oldBg = store.customBg;
      if (oldBg && oldBg.startsWith('blob:')) {
        URL.revokeObjectURL(oldBg);
      }
      
      store.setCustomBgValue(url);
      const updated = store.spaces.map((s: any) => s.id === spaceId ? { ...s, customBg: url } : s);
      store.spaces = updated;

      // Clean up local blob (optional - keep for offline backup)
      // await db.spaceBackgrounds.delete(spaceId);

      console.log('[Storage] Background uploaded for space:', spaceId, url);
      syncOrchestrator.triggerSync(true);

    } catch (err) {
      console.error('[Storage] Failed to upload space background:', err);
    }
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
      if (!thought.storageUrl) return;

      console.log(`[Storage] Downloading blob for thought: ${thoughtId}`);
      const response = await fetch(thought.storageUrl);
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
        .filter(t => !!t.storageUrl && !t.deletedAt && t.userId === currentUserId)
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
    const { user, isOnline } = get();
    if (!user || !isOnline) return;

    try {
      const currentUserId = user!.id;
      // Find all spaces with customBg (cloud URLs)
      const spacesWithBg = await db.spaces
        .filter((s: any) => !!s.customBg && isStorageUrl(s.customBg) && !s.deletedAt && s.userId === currentUserId)
        .toArray();

      if (spacesWithBg.length === 0) return;

      const { useStore } = await import('../useStore');
      const healed: string[] = [];
      const cleared: string[] = [];

      for (const space of spacesWithBg) {
        try {
          // Check if the background file is actually accessible in cloud storage
          const res = await fetch(space.customBg!, { method: 'HEAD' });
          if (res.ok) {
            // Check if we have local blob, if not download it
            let bgEntry = await db.spaceBackgrounds.get(space.id);
            if (!bgEntry) {
              // Download and store locally
              const downloadRes = await fetch(space.customBg!);
              const blob = await downloadRes.blob();
              await db.spaceBackgrounds.put({
                id: space.id,
                spaceId: space.id,
                blob,
                name: 'background',
                type: blob.type || 'image/jpeg',
                userId: currentUserId,
                updatedAt: Date.now()
              });
            }
            continue; // File exists, all good
          }

          // File is gone from cloud storage — check local IndexedDB
          const localBg = await db.spaceBackgrounds.get(space.id);
          if (localBg) {
            // Re-upload from local blob
            const { url: newUrl } = await supabaseStorage.uploadSpaceBackground(
              user.id,
              space.id,
              localBg.blob,
              localBg.type
            );
            await db.spaces.update(space.id, { customBg: newUrl, syncStatus: 'synced' });
            healed.push(space.id);
            console.log(`[Heal] Background re-uploaded for space ${space.id}`);
          } else {
            // No local copy — clear the broken URL
            await db.spaces.update(space.id, {
              customBg: null,
              syncStatus: 'local',
              updatedAt: Date.now(),
            });
            cleared.push(space.id);
            console.log(`[Heal] Background URL broken and cleared for space ${space.id}`);
          }
        } catch (e) {
          console.warn(`[Heal] Background check failed for space ${space.id}:`, e);
        }
      }

      if (healed.length > 0 || cleared.length > 0) {
        await useStore.getState().refreshSpaces();
        // Trigger sync to push any cleared backgrounds
        syncOrchestrator.triggerSync();
      }
    } catch (err) {
      console.error('[Storage] Space background healing failed:', err);
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

      const { useStore } = await import('../useStore');
      useStore.getState().updateThought(thoughtId, updates, { skipSync: true });

      await db.thoughts.update(thoughtId, updates);

    } catch (err) {
      console.error('[Storage] Failed to remove cloud asset:', err);
    }
  },
});
