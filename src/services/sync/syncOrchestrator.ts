import { db } from '../../db';
import { supabaseSync } from '../supabaseSync';
import { supabaseStorage } from '../supabaseStorage';
import type { SyncConflictData } from './syncTypes';

let syncDebounceTimer: ReturnType<typeof setTimeout> | null = null;
const SYNC_DEBOUNCE_MS = 5000;

export const syncOrchestrator = {
  async triggerSync(force: boolean = false): Promise<void> {
    const { useSyncStore } = await import('../../store/useSyncStore');
    const { useAuthStore } = await import('../../store/useAuthStore');
    
    const authState = useAuthStore.getState();
    const syncState = useSyncStore.getState();
    
    if (authState.status !== 'authenticated' || !authState.isOnline) {
      return;
    }
    
    if (!force && !authState.autoSync) {
      return;
    }
    
    if (syncState.status === 'syncing') {
      return;
    }
    
    if (syncDebounceTimer) {
      clearTimeout(syncDebounceTimer);
    }
    
    if (force) {
      await syncOrchestrator.fullPushSync();
    } else {
      syncDebounceTimer = setTimeout(async () => {
        await syncOrchestrator.fullPushSync();
      }, SYNC_DEBOUNCE_MS);
    }
  },

  async fullPushSync(): Promise<{ success: boolean; error?: string }> {
    const { useSyncStore } = await import('../../store/useSyncStore');
    const { useAuthStore } = await import('../../store/useAuthStore');
    
    const authState = useAuthStore.getState();
    const currentStatus = useSyncStore.getState().status;
    
    console.log('[Sync] fullPushSync called', { authStatus: authState.status, isOnline: authState.isOnline, currentStatus });
    
    if (authState.status !== 'authenticated' || !authState.isOnline) {
      console.log('[Sync] Skipping - not authenticated or offline');
      return { success: false, error: 'Not authenticated or offline' };
    }
    
    if (currentStatus === 'syncing') {
      console.log('[Sync] Skipping - already syncing');
      return { success: false, error: 'Already syncing' };
    }
    
    useSyncStore.getState().setStatus('syncing');
    console.log('[Sync] Status set to syncing');
    
    try {
      const userId = authState.user!.id;
      
      // Get local data
      const [localSpaces, localStacks, localThoughts] = await Promise.all([
        db.spaces.toArray(),
        db.stacks.toArray(),
        db.thoughts.filter(t => !t.deletedAt).toArray(),
      ]);
      
      console.log(`[Sync] Local: ${localSpaces.length} spaces, ${localStacks.length} stacks, ${localThoughts.length} thoughts`);
      
      // Fetch cloud data for comparison
      console.log('[Sync] Fetching cloud data for comparison...');
      const [cloudSpaces, cloudStacks, cloudThoughts] = await Promise.all([
        supabaseSync.getSpaces(userId),
        supabaseSync.getStacks(userId),
        supabaseSync.getThoughts(userId),
      ]);
      
      const cloudSpaceIds = new Set(cloudSpaces.spaces?.map(s => s.id) || []);
      const cloudStackIds = new Set(cloudStacks.stacks?.map(s => s.id) || []);
      const cloudThoughtIds = new Set(cloudThoughts.thoughts?.map(t => t.id) || []);
      
      console.log(`[Sync] Cloud: ${cloudSpaceIds.size} spaces, ${cloudStackIds.size} stacks, ${cloudThoughtIds.size} thoughts`);
      
      // STEP 1: Delete orphaned cloud data (exists in cloud but not in local)
      // Delete orphaned spaces
      for (const spaceId of cloudSpaceIds) {
        if (!localSpaces.find(s => s.id === spaceId)) {
          console.log(`[Sync] Deleting orphaned space: ${spaceId}`);
          await supabaseSync.deleteSpace(spaceId, userId);
        }
      }
      
      // Delete orphaned stacks
      for (const stackId of cloudStackIds) {
        if (!localStacks.find(s => s.id === stackId)) {
          console.log(`[Sync] Deleting orphaned stack: ${stackId}`);
          await supabaseSync.deleteStack(stackId, userId);
        }
      }
      
      // Delete orphaned thoughts and their storage files
      for (const thoughtId of cloudThoughtIds) {
        if (!localThoughts.find(t => t.id === thoughtId)) {
          const cloudThought = cloudThoughts.thoughts?.find(t => t.id === thoughtId);
          if (cloudThought?.storagePath) {
            console.log(`[Sync] Deleting orphaned file: ${cloudThought.storagePath}`);
            await supabaseStorage.deleteFile(cloudThought.storagePath);
          }
          console.log(`[Sync] Deleting orphaned thought: ${thoughtId}`);
          await supabaseSync.deleteThought(thoughtId, userId);
        }
      }
      
      console.log('[Sync] Orphan cleanup complete');
      
      // STEP 2: Build valid storage paths from local thoughts
      const validStoragePaths = new Set<string>();
      for (const thought of localThoughts) {
        if (thought.storagePath) {
          validStoragePaths.add(thought.storagePath);
        }
      }
      
      // STEP 3: Push local spaces to cloud
      if (localSpaces.length > 0) {
        const cleanedSpaces = localSpaces.map(s => ({
          ...s,
          user_id: userId,
        }));
        await supabaseSync.createSpaces(cleanedSpaces, userId);
        console.log('[Sync] Spaces synced');
      }
      
      // STEP 4: Push local stacks to cloud
      if (localStacks.length > 0) {
        const cleanedStacks = localStacks.map(s => ({
          ...s,
          user_id: userId,
        }));
        await supabaseSync.createStacks(cleanedStacks, userId);
        console.log('[Sync] Stacks synced');
      }
      
      // STEP 5: Push local thoughts to cloud and upload new files
      if (localThoughts.length > 0) {
        // Upload new files if user has auto-sync enabled
        if (authState.autoSync) {
          for (const thought of localThoughts) {
            // Upload new files if thought has a blob and no storagePath
            if ((thought.type === 'image' || thought.type === 'file') && !thought.storagePath) {
              const blob = await db.blobs.where('thoughtId').equals(thought.id).first();
              if (blob?.blob) {
                const result = await supabaseStorage.uploadFile(userId, blob.blob, blob.name);
                await db.thoughts.update(thought.id, {
                  storageUrl: result.url,
                  storagePath: result.path,
                });
                validStoragePaths.add(result.path);
                console.log(`[Sync] Uploaded file for thought ${thought.id}`);
              }
            }
          }
        }
        
        // Push thoughts to cloud
        const cleanedThoughts = localThoughts.map(t => ({
          ...t,
          user_id: userId,
        }));
        await supabaseSync.createThoughts(cleanedThoughts);
        console.log('[Sync] Thoughts synced');
      }
      
      // STEP 6: Clean up orphaned storage files
      console.log(`[Sync] Valid storage paths: ${validStoragePaths.size}`);
      const cleanedCount = await supabaseStorage.cleanupOrphanedFiles(userId, validStoragePaths);
      console.log(`[Sync] Cleaned up ${cleanedCount} orphaned files`);
      
      const now = new Date();
      useSyncStore.setState({
        status: 'synced',
        lastSyncTime: now,
        pendingCount: 0,
      });
      
      localStorage.setItem('cyberia-last-sync', now.toISOString());
      console.log('[Sync] Full push complete');
      
      return { success: true };
    } catch (err) {
      console.error('[Sync] Full push failed:', err);
      useSyncStore.getState().setStatus('error');
      return { success: false, error: String(err) };
    }
  },

  async fetchCloudData(): Promise<SyncConflictData | null> {
    const { useAuthStore } = await import('../../store/useAuthStore');
    const authState = useAuthStore.getState();
    
    if (authState.status !== 'authenticated' || !authState.isOnline) {
      return null;
    }
    
    const userId = authState.user!.id;
    
    try {
      const [spaces, thoughts, stacks] = await Promise.all([
        supabaseSync.getSpaces(userId),
        supabaseSync.getThoughts(userId),
        supabaseSync.getStacks(userId),
      ]);
      
      return {
        spaces: spaces.spaces || [],
        thoughts: thoughts.thoughts || [],
        stacks: stacks.stacks || [],
      };
    } catch (err) {
      console.error('[Sync] Failed to fetch cloud data:', err);
      return null;
    }
  },

  async isLocalEmpty(): Promise<boolean> {
    const thoughtsCount = await db.thoughts.filter(t => !t.deletedAt).count();
    
    if (thoughtsCount === 0) return true;
    
    const mediaCount = await db.thoughts
      .filter(t => t.type === 'image' || t.type === 'file')
      .count();
    
    if (mediaCount > 0) return false;
    
    const customThoughts = await db.thoughts
      .filter(t => t.spaceId !== 's-onboarding' && t.spaceId !== 's-workspace')
      .count();
    
    return customThoughts === 0;
  },

  async restoreFromCloud(choice: 'cloud' | 'local'): Promise<void> {
    if (choice === 'cloud') {
      const { useStore } = await import('../../store/useStore');
      const cloudData = await syncOrchestrator.fetchCloudData();
      
      if (cloudData) {
        await useStore.getState().importFullState(cloudData);
      }
    } else {
      await syncOrchestrator.fullPushSync();
    }
  },

  async deleteCloudContent(): Promise<void> {
    const { useAuthStore } = await import('../../store/useAuthStore');
    const authState = useAuthStore.getState();
    
    if (authState.status !== 'authenticated' || !authState.user) {
      return;
    }
    
    const userId = authState.user.id;
    
    try {
      const spaces = await supabaseSync.getSpaces(userId);
      for (const space of spaces.spaces || []) {
        await supabaseSync.deleteSpace(space.id, userId);
      }
      
      const thoughts = await supabaseSync.getThoughts(userId);
      for (const thought of thoughts.thoughts || []) {
        await supabaseSync.deleteThought(thought.id, userId);
      }
      
      const stacks = await supabaseSync.getStacks(userId);
      for (const stack of stacks.stacks || []) {
        await supabaseSync.deleteStack(stack.id, userId);
      }
      
      console.log('[Sync] Cloud data deleted, wiping storage...');
      const files = await supabaseStorage.listFiles(userId);
      if (files && files.length > 0) {
        for (const f of files) {
          try {
            await supabaseStorage.deleteFile(`${userId}/${f.name}`);
          } catch {}
        }
      }
      console.log('[Sync] Storage wiped');
    } catch (err) {
      console.error('[Sync] Failed to delete cloud content:', err);
      throw err;
    }
  },

  async uploadMedia(thoughtId: number): Promise<void> {
    const thought = await db.thoughts.get(thoughtId);
    if (!thought) return;
    
    // Skip if already has storagePath (don't re-upload)
    if (thought.storagePath) {
      console.log('[Sync] uploadMedia: Thought already has storagePath, skipping');
      return;
    }
    
    const { useAuthStore } = await import('../../store/useAuthStore');
    if (useAuthStore.getState().status !== 'authenticated') return;
    
    try {
      const blob = await db.blobs.where('thoughtId').equals(thoughtId).first();
      if (!blob?.blob) return;
      
      const userId = useAuthStore.getState().user!.id;
      const result = await supabaseStorage.uploadFile(userId, blob.blob, blob.name);
      
      await db.thoughts.update(thoughtId, {
        storageUrl: result.url,
        storagePath: result.path,
      });
      
      console.log(`[Sync] Media uploaded for thought ${thoughtId}`);
      
      await syncOrchestrator.triggerSync();
    } catch (err) {
      console.error('[Sync] Media upload failed:', err);
    }
  },

  async deleteMedia(storagePath: string): Promise<void> {
    try {
      await supabaseStorage.deleteFile(storagePath);
    } catch (err) {
      if (!String(err).includes('404')) {
        console.error('[Sync] Media deletion failed:', err);
      }
    }
  },
};
