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
        await supabaseSync.deleteSpace(space.id, userId);
        await db.spaces.delete(space.id);
      }
      for (const stack of localStacks.filter(s => s.deletedAt)) {
        await supabaseSync.deleteStack(stack.id, userId);
        await db.stacks.delete(stack.id);
      }
      for (const thought of localThoughts.filter(t => t.deletedAt)) {
        if (thought.storagePath) await supabaseStorage.deleteFile(thought.storagePath);
        await supabaseSync.deleteThought(thought.id, userId);
        await db.thoughts.delete(thought.id);
        await db.blobs.where('thoughtId').equals(thought.id).delete();
      }

      // Handle Creates/Updates
      const spacesToPush = localSpaces.filter(s => !s.deletedAt && !s.isOnboarding);
      const stacksToPush = localStacks.filter(s => !s.deletedAt && !s.isOnboarding);
      const thoughtsToPush = localThoughts.filter(t => !t.deletedAt && !onboardingSpaceIds.has(t.spaceId));

      if (spacesToPush.length > 0) {
        await supabaseSync.createSpaces(spacesToPush.map(s => ({ ...s, user_id: userId })), userId);
        await db.spaces.where('id').anyOf(spacesToPush.map(s => s.id)).modify({ syncStatus: 'synced' });
      }
      if (stacksToPush.length > 0) {
        await supabaseSync.createStacks(stacksToPush.map(s => ({ ...s, user_id: userId })), userId);
        await db.stacks.where('id').anyOf(stacksToPush.map(s => s.id)).modify({ syncStatus: 'synced' });
      }

      // Special handling for file thoughts (Upload binary first)
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
          }
        }
      }

      if (thoughtsToPush.length > 0) {
        await supabaseSync.createThoughts(thoughtsToPush.map(t => ({ ...t, user_id: userId })));
        await db.thoughts.where('id').anyOf(thoughtsToPush.map(t => t.id)).modify({ syncStatus: 'synced' });
      }

      // Step 2: Fetch Cloud Metadata & Reconcile
      console.log('[Sync] Step 2: Reconciling with cloud...');
      const [cloudSpaces, cloudStacks, cloudThoughts] = await Promise.all([
        supabaseSync.getSpaces(userId, 'id, updated_at'),
        supabaseSync.getStacks(userId, 'id, updated_at'),
        supabaseSync.getThoughts(userId, 'id, updated_at, space_id, type, storage_url'),
      ]);

      const cloudSpaceMap = new Map(cloudSpaces.spaces.map(s => [s.id, s]));
      const cloudStackMap = new Map(cloudStacks.stacks.map(s => [s.id, s]));
      const cloudThoughtMap = new Map(cloudThoughts.thoughts.map(t => [t.id, t]));

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
      for (const [id, cloudS] of cloudSpaceMap) {
        const localS = localAllSpaces.find(ls => ls.id === id);
        if (!localS || (cloudS.updatedAt && localS.updatedAt && new Date(cloudS.updatedAt).getTime() > localS.updatedAt)) {
          const { data } = await supabase.from('spaces').select('*').eq('id', id).single();
          if (data) await db.spaces.put({ ...toCamelCase(data), syncStatus: 'synced' } as any);
        }
      }

      const wokenSpaceIds = new Set(localAllThoughts.map(t => t.spaceId));
      for (const [id, cloudT] of cloudThoughtMap) {
        if (wokenSpaceIds.has(cloudT.spaceId)) {
          const localT = localAllThoughts.find(lt => lt.id === id);
          const needsHealing = localT && localT.type === 'file' && localT.storageUrl && !(await db.blobs.where('thoughtId').equals(id).first());
          
          if (!localT || (cloudT.updatedAt && localT.updatedAt && new Date(cloudT.updatedAt).getTime() > (localT.updatedAt || 0)) || needsHealing) {
            const { data } = await supabase.f
