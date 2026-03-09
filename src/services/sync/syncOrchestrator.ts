import { db } from '../../db';
import { supabaseSync, supabase, toCamelCase } from '../supabaseSync';
import { supabaseStorage } from '../supabaseStorage';
import type { SyncConflictData } from './syncTypes';

let syncDebounceTimer: ReturnType<typeof setTimeout> | null = null;
const SYNC_DEBOUNCE_MS = 10000;

let isSyncBlocked = false;
let syncRequestedDuringActiveSync = false;

export const syncOrchestrator = {
  async setSyncBlocked(blocked: boolean) {
    console.log(`[Sync] Sync blocked set to: ${blocked}`);
    isSyncBlocked = blocked;
    
    try {
      const { useSyncStore } = await import('../../store/useSyncStore');
      useSyncStore.getState().setSyncBlocked(blocked);
    } catch (e) {}
  },

  getSyncBlocked() {
    return isSyncBlocked;
  },

  async triggerSync(force: boolean = false): Promise<void> {
    const { useSyncStore } = await import('../../store/useSyncStore');
    const { useAuthStore } = await import('../../store/useAuthStore');
    
    const authState = useAuthStore.getState();
    const syncState = useSyncStore.getState();
    
    if (authState.status !== 'authenticated' || !authState.isOnline) return;
    if (!force && !authState.autoSync) return;
    
    if (syncState.status === 'syncing') {
      syncRequestedDuringActiveSync = true;
      return;
    }
    
    if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
    
    if (force) {
      await syncOrchestrator.fullPushSync();
    } else {
      syncDebounceTimer = setTimeout(async () => {
        await syncOrchestrator.fullPushSync();
      }, SYNC_DEBOUNCE_MS);
    }
  },

  async fullPushSync(bypassBlock: boolean = false): Promise<{ success: boolean; error?: string }> {
    const { useSyncStore } = await import('../../store/useSyncStore');
    const { useAuthStore } = await import('../../store/useAuthStore');
    
    if (isSyncBlocked && !bypassBlock) {
      return { success: false, error: 'Sync is blocked' };
    }
    
    const authState = useAuthStore.getState();
    if (authState.status !== 'authenticated' || !authState.isOnline) {
      return { success: false, error: 'Not authenticated or offline' };
    }
    
    const syncStore = useSyncStore.getState();
    if (syncStore.status === 'syncing') return { success: false, error: 'Already syncing' };
    
    syncStore.setStatus('syncing');
    console.log('[Sync] Delta sync started...');
    
    try {
      const userId = authState.user!.id;
      const { useStore } = await import('../../store/useStore');
      const store = useStore.getState();
      
      // Step 1: Push Local Changes (Deltas)
      console.log('[Sync] Step 1: Pushing local changes...');
      const [localSpaces, localStacks, localThoughts] = await Promise.all([
        db.spaces.filter(s => s.syncStatus === 'local').toArray(),
        db.stacks.filter(s => s.syncStatus === 'local').toArray(),
        db.thoughts.filter(t => t.syncStatus === 'local').toArray(),
      ]);

      const onboardingSpaceIds = new Set(localSpaces.filter(s => s.isOnboarding).map(s => s.id));

      // Handle deletions first (Synchronized Tombstones)
      for (const space of localSpaces.filter(s => s.deletedAt)) {
        try {
          await supabaseSync.deleteSpace(space.id, userId);
          await db.spaces.delete(space.id);
        } catch (e) {
          console.warn('[Sync] Space deletion failed, will retry:', e);
        }
      }
      for (const stack of localStacks.filter(s => s.deletedAt)) {
        try {
          await supabaseSync.deleteStack(stack.id, userId);
          await db.stacks.delete(stack.id);
        } catch (e) {
          console.warn('[Sync] Stack deletion failed, will retry:', e);
        }
      }
      for (const thought of localThoughts.filter(t => t.deletedAt)) {
        let storageDeleted = true;
        if (thought.storagePath) {
          try {
            await supabaseStorage.deleteFile(thought.storagePath);
          } catch (e: any) {
            const isNetworkError = e.message?.toLowerCase().includes('network') || e.message?.toLowerCase().includes('fetch');
            const is404 = e.message?.includes('404') || e.status === 404;
            if (isNetworkError && !is404) {
              storageDeleted = false;
            }
          }
        }
        
        if (storageDeleted) {
          try {
            await supabaseSync.deleteThought(thought.id, userId);
            await db.thoughts.delete(thought.id);
            await db.blobs.where('thoughtId').equals(thought.id).delete();
          } catch (e: any) {
            const is404 = e.status === 404 || e.message?.includes('not found');
            if (is404) {
              await db.thoughts.delete(thought.id);
              await db.blobs.where('thoughtId').equals(thought.id).delete();
            }
          }
        }
      }

      // Handle Creates/Updates
      const spacesToPush = localSpaces.filter(s => !s.deletedAt && !s.isOnboarding);
      const stacksToPush = localStacks.filter(s => !s.deletedAt && !s.isOnboarding);
      const thoughtsToPush = localThoughts.filter(t => !t.deletedAt && !onboardingSpaceIds.has(t.spaceId));

      if (spacesToPush.length > 0) {
        await supabaseSync.createSpaces(spacesToPush.map(s => ({ ...s, user_id: userId })), userId);
        await db.spaces.where('id').anyOf(spacesToPush.map(s => s.id)).modify({ syncStatus: 'synced' });
        await store.refreshSpaces();
      }
      if (stacksToPush.length > 0) {
        await supabaseSync.createStacks(stacksToPush.map(s => ({ ...s, user_id: userId })), userId);
        await db.stacks.where('id').anyOf(stacksToPush.map(s => s.id)).modify({ syncStatus: 'synced' });
        await store.refreshStacks();
      }

      let filesUploaded = false;
      for (let i = 0; i < thoughtsToPush.length; i++) {
        const t = thoughtsToPush[i];
        if (t.type === 'file' && !t.storagePath) {
          const blobEntry = await db.blobs.where('thoughtId').equals(t.id).first();
          if (blobEntry?.blob) {
            const result = await supabaseStorage.uploadFile(userId, blobEntry.blob, blobEntry.name, t.id);
            const currentData = (t.data || {}) as any;
            const updates = { 
              storageUrl: result.url, 
              storagePath: result.path,
              data: { ...currentData, url: result.url }
            };
            await db.thoughts.update(t.id, updates);
            thoughtsToPush[i] = { ...t, ...updates };
            filesUploaded = true;
          }
        }
      }

      if (thoughtsToPush.length > 0) {
        await supabaseSync.createThoughts(thoughtsToPush.map(t => ({ ...t, user_id: userId })));
        const ids = thoughtsToPush.map(t => t.id);
        await db.thoughts.where('id').anyOf(ids).modify({ syncStatus: 'synced' });
        await store.refreshThoughts();
      } else if (filesUploaded) {
        await store.refreshThoughts();
      }

      // Step 2: Fetch Cloud Metadata & Reconcile
      console.log('[Sync] Step 2: Reconciling with cloud...');
      const [cloudSpaces, cloudStacks, cloudThoughts] = await Promise.all([
        supabaseSync.getSpaces(userId, 'id, updated_at'),
        supabaseSync.getStacks(userId, 'id, updated_at'),
        supabaseSync.getThoughts(userId, 'id, updated_at, space_id, type, storage_url'),
      ]);

      const cloudSpaceMap = new Map<string, any>(cloudSpaces.spaces.map((s: any) => [s.id, s]));
      const cloudStackMap = new Map<string, any>(cloudStacks.stacks.map((s: any) => [s.id, s]));
      const cloudThoughtMap = new Map<string, any>(cloudThoughts.thoughts.map((t: any) => [t.id, t]));

      const localAllSpaces = await db.spaces.toArray();
      const localAllStacks = await db.stacks.toArray();
      const localAllThoughts = await db.thoughts.toArray();

      // Deletion (Absence Rule)
      for (const s of localAllSpaces) {
        if (s.syncStatus === 'synced' && !cloudSpaceMap.has(s.id)) await db.spaces.delete(s.id);
      }
      for (const s of localAllStacks) {
        if (s.syncStatus === 'synced' && !cloudStackMap.has(s.id)) await db.stacks.delete(s.id);
      }
      for (const t of localAllThoughts) {
        if (t.syncStatus === 'synced' && !cloudThoughtMap.has(t.id)) {
          await db.thoughts.delete(t.id);
          await db.blobs.where('thoughtId').equals(t.id).delete();
        }
      }

      // Updates (Cloud is newer) - Lazy loading aware
      let cloudChanges = false;
      const currentActiveSpaceId = store.activeSpaceId;

      for (const [id, cloudS] of cloudSpaceMap) {
        const localS = localAllSpaces.find(ls => ls.id === id);
        if (!localS || (cloudS.updatedAt && localS.updatedAt && new Date(cloudS.updatedAt).getTime() > localS.updatedAt)) {
          const { data } = await supabase.from('spaces').select('*').eq('id', id).single();
          if (data) {
            await db.spaces.put({ ...toCamelCase(data), syncStatus: 'synced' } as any);
            cloudChanges = true;
          }
        }
      }

      for (const [id, cloudStack] of cloudStackMap) {
        const localStack = localAllStacks.find(ls => ls.id === id);
        const cloudTime = cloudStack.updatedAt ? new Date(cloudStack.updatedAt).getTime() : 0;
        const localTime = localStack?.updatedAt || 0;

        if (!localStack || cloudTime > localTime) {
          const { data } = await supabase.from('stacks').select('*').eq('id', id).single();
          if (data) {
            await db.stacks.put({ ...toCamelCase(data), syncStatus: 'synced' } as any);
            cloudChanges = true;
          }
        } else if (localStack && localStack.syncStatus === 'local' && cloudTime === localTime) {
          await db.stacks.update(id, { syncStatus: 'synced' });
          cloudChanges = true;
        }
      }

      const wokenSpaceIds = new Set(localAllThoughts.map(t => t.spaceId));
      if (currentActiveSpaceId) wokenSpaceIds.add(currentActiveSpaceId);

      for (const [id, cloudT] of cloudThoughtMap) {
        if (wokenSpaceIds.has(cloudT.spaceId)) {
          const localT = localAllThoughts.find(lt => lt.id === id);
          const needsHealing = localT && localT.type === 'file' && localT.storageUrl && !(await db.blobs.where('thoughtId').equals(id).first());
          
          const cloudTime = cloudT.updatedAt ? new Date(cloudT.updatedAt).getTime() : 0;
          const localTime = localT?.updatedAt || 0;
          
          if (!localT || cloudTime > localTime || needsHealing) {
            const { data } = await supabase.from('thoughts').select('*').eq('id', id).single();
            if (data) {
              await db.thoughts.put({ ...toCamelCase(data), syncStatus: 'synced' } as any);
              cloudChanges = true;
              if (data.type === 'file' && data.storage_url) {
                authState.downloadSingleBlob(id);
              }
            }
          } else if (localT && localT.syncStatus === 'local' && cloudTime === localTime) {
            await db.thoughts.update(id, { syncStatus: 'synced' });
            cloudChanges = true;
          }
        }
      }

      if (cloudChanges) {
        await Promise.all([
          store.refreshSpaces(),
          store.refreshThoughts(),
          store.refreshStacks()
        ]);
      }

      const now = new Date();
      useSyncStore.setState({ status: 'synced', lastSyncTime: now, pendingCount: 0 });
      useAuthStore.setState({ lastSync: now });
      localStorage.setItem('cyberia-last-sync', now.toISOString());
      
      return { success: true };
    } catch (err) {
      console.error('[Sync] Full push failed:', err);
      syncStore.setStatus('error');
      return { success: false, error: String(err) };
  } finally {
    // Refresh storage usage after any sync to reflect new blobs on disk/cloud
    try {
      const { useStore } = await import('../../store/useStore');
      const st: any = useStore.getState();
      st?.calculateUsage?.(st.totalThoughtCount || 0);
    } catch {
      // best-effort only
    }
    if (syncRequestedDuringActiveSync) {
      syncRequestedDuringActiveSync = false;
      setTimeout(() => syncOrchestrator.triggerSync(), SYNC_DEBOUNCE_MS);
    }
  }
  },

  async fetchCloudData(): Promise<SyncConflictData | null> {
    const { useAuthStore } = await import('../../store/useAuthStore');
    const authState = useAuthStore.getState();
    if (authState.status !== 'authenticated' || !authState.isOnline) return null;
    const userId = authState.user!.id;
    try {
      const [spaces, thoughts, stacks] = await Promise.all([
        supabaseSync.getSpaces(userId),
        supabaseSync.getThoughts(userId),
        supabaseSync.getStacks(userId),
      ]);
      return { spaces: spaces.spaces || [], thoughts: thoughts.thoughts || [], stacks: stacks.stacks || [] };
    } catch (err) {
      console.error('[Sync] Failed to fetch cloud data:', err);
      return null;
    }
  },

  async isLocalEmpty(): Promise<boolean> {
    const thoughtsCount = await db.thoughts.filter(t => !t.deletedAt).count();
    return thoughtsCount === 0;
  },

  async restoreFromCloud(choice: 'cloud' | 'local'): Promise<void> {
    if (choice === 'cloud') {
      const { useStore } = await import('../../store/useStore');
      const cloudData = await syncOrchestrator.fetchCloudData();
      if (cloudData) await useStore.getState().importFullState(cloudData);
    } else {
      await syncOrchestrator.fullPushSync();
    }
  },

  async deleteCloudContent(): Promise<void> {
    const { useAuthStore } = await import('../../store/useAuthStore');
    const authState = useAuthStore.getState();
    if (authState.status !== 'authenticated' || !authState.user) return;
    const userId = authState.user.id;
    try {
      const [spaces, thoughts, stacks] = await Promise.all([
        supabaseSync.getSpaces(userId, 'id'),
        supabaseSync.getThoughts(userId, 'id'),
        supabaseSync.getStacks(userId, 'id'),
      ]);
      for (const s of spaces.spaces) await supabaseSync.deleteSpace(s.id, userId);
      for (const t of thoughts.thoughts) await supabaseSync.deleteThought(t.id, userId);
      for (const s of stacks.stacks) await supabaseSync.deleteStack(s.id, userId);
      await supabaseStorage.deleteAllUserFiles(userId);
    } catch (err) {
      console.error('[Sync] Failed to delete cloud content:', err);
      throw err;
    }
  },

  async uploadMedia(thoughtId: string): Promise<void> {
    const thought = await db.thoughts.get(thoughtId);
    if (!thought || thought.storagePath) return;
    const { useAuthStore } = await import('../../store/useAuthStore');
    if (useAuthStore.getState().status !== 'authenticated') return;
    try {
      const blob = await db.blobs.where('thoughtId').equals(thoughtId).first();
      if (!blob?.blob) return;
      const userId = useAuthStore.getState().user!.id;
      const result = await supabaseStorage.uploadFile(userId, blob.blob, blob.name, thoughtId);
      await db.thoughts.update(thoughtId, { storageUrl: result.url, storagePath: result.path });
      await syncOrchestrator.triggerSync();
    } catch (err) {
      console.error('[Sync] Media upload failed:', err);
    }
  },

  async deleteMedia(storagePath: string): Promise<void> {
    try {
      await supabaseStorage.deleteFile(storagePath);
    } catch (err) {
      if (!String(err).includes('404')) console.error('[Sync] Media deletion failed:', err);
    }
  },
};
