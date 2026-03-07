import { db } from '../../db';
import { supabaseSync } from '../supabaseSync';
import { supabaseStorage } from '../supabaseStorage';
import type { SyncConflictData } from './syncTypes';

let syncDebounceTimer: ReturnType<typeof setTimeout> | null = null;
const SYNC_DEBOUNCE_MS = 5000;

let isSyncBlocked = false;

export const syncOrchestrator = {
  async setSyncBlocked(blocked: boolean) {
    console.log(`[Sync] Sync blocked set to: ${blocked}`);
    isSyncBlocked = blocked;
    
    // Update store for reactivity
    try {
      const { useSyncStore } = await import('../../store/useSyncStore');
      useSyncStore.getState().setSyncBlocked(blocked);
    } catch (e) {
      // In case store isn't available during early init
    }
  },

  getSyncBlocked() {
    return isSyncBlocked;
  },

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

  async fullPushSync(bypassBlock: boolean = false): Promise<{ success: boolean; error?: string }> {
    const { useSyncStore } = await import('../../store/useSyncStore');
    const { useAuthStore } = await import('../../store/useAuthStore');
    
    console.log('[Sync] fullPushSync checking block state:', { isSyncBlocked, bypassBlock });
    if (isSyncBlocked && !bypassBlock) {
      console.log('[Sync] Skipping - sync is currently blocked');
      return { success: false, error: 'Sync is blocked' };
    }
    
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
      
      // PRE-STEP: Ensure all local thoughts with blobs are "healed" for re-upload if needed
      console.log('[Sync] Step 0: Repairing local empty file thoughts...');
      await authState.repairEmptyFileThoughts();
      
      // Get local data
      console.log('[Sync] Step 1: Gathering local data...');
      const [localSpaces, localStacks, allLocalThoughts] = await Promise.all([
        db.spaces.toArray(),
        db.stacks.toArray(),
        db.thoughts.toArray(), // Fetch ALL local items including deleted ones
      ]);

      const activeLocalThoughts = allLocalThoughts.filter(t => !t.deletedAt);
      const activeLocalSpaces = localSpaces.filter(s => !s.deletedAt);
      const activeLocalStacks = localStacks.filter(s => !s.deletedAt);
      
      console.log(`[Sync] Local: ${activeLocalSpaces.length} active spaces, ${activeLocalStacks.length} active stacks, ${activeLocalThoughts.length} active thoughts, ${allLocalThoughts.length} total thoughts`);
      
      // Fetch cloud data for comparison
      console.log('[Sync] Step 2: Fetching cloud data for comparison...');
      const [cloudSpaces, cloudStacks, cloudThoughts] = await Promise.all([
        supabaseSync.getSpaces(userId),
        supabaseSync.getStacks(userId),
        supabaseSync.getThoughts(userId),
      ]);
      
      const cloudSpaceIds = new Set(cloudSpaces.spaces?.map(s => s.id) || []);
      const cloudStackIds = new Set(cloudStacks.stacks?.map(s => s.id) || []);
      const cloudThoughtIds = new Set(cloudThoughts.thoughts?.map(t => t.id) || []);
      
      console.log(`[Sync] Cloud: ${cloudSpaceIds.size} spaces, ${cloudStackIds.size} stacks, ${cloudThoughtIds.size} thoughts`);
      
      // STEP 1: Delete orphaned cloud data (exists in cloud but marked deleted locally)
      console.log('[Sync] Step 3: Cleaning up orphaned cloud metadata...');
      // Delete orphaned spaces
      for (const spaceId of cloudSpaceIds) {
        const localSpace = localSpaces.find(s => s.id === spaceId);
        // If it exists in cloud but not locally, skip it (don't delete during imports)
        if (!localSpace) continue;

        // If it's explicitly deleted locally, delete from cloud
        if (localSpace.deletedAt) {
          console.log(`[Sync] Deleting orphaned cloud space: ${spaceId}`);
          await supabaseSync.deleteSpace(spaceId, userId);
        }
      }
      
      // Delete orphaned stacks
      for (const stackId of cloudStackIds) {
        const localStack = localStacks.find(s => s.id === stackId);
        // If it exists in cloud but not locally, skip it
        if (!localStack) continue;

        // If it's explicitly deleted locally, delete from cloud
        if (localStack.deletedAt) {
          console.log(`[Sync] Deleting orphaned cloud stack: ${stackId}`);
          await supabaseSync.deleteStack(stackId, userId);
        }
      }
      
      // Delete orphaned thoughts and their storage files
      for (const thoughtId of cloudThoughtIds) {
        const localThought = allLocalThoughts.find(t => t.id === thoughtId);
        // If it exists in cloud but not locally at all, skip it (critical for imports)
        if (!localThought) continue;

        // ONLY delete if we HAVE a local record AND it's marked as deleted
        if (localThought.deletedAt) {
          const cloudThought = cloudThoughts.thoughts?.find(t => t.id === thoughtId);
          if (cloudThought?.storagePath) {
            console.log(`[Sync] Deleting orphaned cloud file for thought: ${cloudThought.storagePath}`);
            await supabaseStorage.deleteFile(cloudThought.storagePath);
          }
          console.log(`[Sync] Deleting orphaned cloud thought: ${thoughtId}`);
          await supabaseSync.deleteThought(thoughtId, userId);
        }
      }
      
      console.log('[Sync] Cloud orphan cleanup complete');
      
      // STEP 2: Build valid storage paths from local thoughts
      console.log('[Sync] Step 4: Building valid storage index...');
      const validStoragePaths = new Set<string>();
      for (const thought of activeLocalThoughts) {
        if (thought.storagePath) {
          validStoragePaths.add(thought.storagePath);
        }
      }
      
      // STEP 3: Push local spaces to cloud
      console.log('[Sync] Step 5: Syncing spaces to cloud...');
      if (activeLocalSpaces.length > 0) {
        const cleanedSpaces = activeLocalSpaces
          .filter(s => !s.isOnboarding)
          .map(s => ({
            ...s,
            user_id: userId,
          }));
        if (cleanedSpaces.length > 0) {
          await supabaseSync.createSpaces(cleanedSpaces, userId);
          console.log('[Sync] Spaces synced successfully');
        }
      }
      
      // STEP 4: Push local stacks to cloud
      console.log('[Sync] Step 6: Syncing stacks to cloud...');
      if (activeLocalStacks.length > 0) {
        const cleanedStacks = activeLocalStacks
          .filter(s => !s.isOnboarding)
          .map(s => ({
            ...s,
            user_id: userId,
          }));
        if (cleanedStacks.length > 0) {
          await supabaseSync.createStacks(cleanedStacks, userId);
          console.log('[Sync] Stacks synced successfully');
        }
      }
      
      // STEP 5: Push local thoughts to cloud and upload new files
      console.log('[Sync] Step 7: Syncing thoughts and media to cloud...');
      if (activeLocalThoughts.length > 0) {
        // Filter out thoughts from onboarding spaces
        const onboardingSpaceIds = new Set(localSpaces.filter(s => s.isOnboarding).map(s => s.id));
        const nonOnboardingThoughts = activeLocalThoughts.filter(t => !onboardingSpaceIds.has(t.spaceId));

        // Upload new files if user has auto-sync enabled
        if (authState.autoSync || bypassBlock) {
          for (const thought of nonOnboardingThoughts) {
            // Upload new files if thought has a blob and no storagePath (or is in local/error state)
            if (thought.type === 'file' && (!thought.storagePath || thought.syncStatus === 'local' || thought.syncStatus === 'error')) {
              const blob = await db.blobs.where('thoughtId').equals(thought.id).first();
              if (blob?.blob) {
                console.log(`[Sync] Uploading media for thought ${thought.id}...`);
                const result = await supabaseStorage.uploadFile(userId, blob.blob, blob.name, thought.id);
                await db.thoughts.update(thought.id, {
                  storageUrl: result.url,
                  storagePath: result.path,
                });
                validStoragePaths.add(result.path);
                console.log(`[Sync] Uploaded file for thought ${thought.id}: ${result.path}`);
              }
            }
          }
        }
        
        // Push thoughts to cloud
        const cleanedThoughts = nonOnboardingThoughts.map(t => ({
          ...t,
          user_id: userId,
        }));
        if (cleanedThoughts.length > 0) {
          await supabaseSync.createThoughts(cleanedThoughts);
          console.log(`[Sync] ${cleanedThoughts.length} thoughts synced successfully`);
        }
      }
      
      // STEP 6: Clean up orphaned storage files (Only if previous steps succeeded)
      console.log(`[Sync] Step 8: Final structural storage cleanup. Index size: ${validStoragePaths.size}`);
      const cleanedCount = await supabaseStorage.cleanupOrphanedFiles(userId, validStoragePaths);
      if (cleanedCount > 0) {
        console.log(`[Sync] Cleaned up ${cleanedCount} orphaned files or folders`);
      } else {
        console.log('[Sync] No orphaned storage items found');
      }
      
      const now = new Date();
      useSyncStore.setState({
        status: 'synced',
        lastSyncTime: now,
        pendingCount: 0,
      });
      
      localStorage.setItem('cyberia-last-sync', now.toISOString());
      console.log('[Sync] Full push sync successfully completed');
      
      // Background download missing blobs
      authState.downloadMissingBlobs();
      
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
      .filter(t => t.type === 'file' && !t.deletedAt)
      .count();
    
    if (mediaCount > 0) return false;
    
    const allSpaces = await db.spaces.toArray();
    const onboardingSpaceIds = new Set(allSpaces.filter(s => s.isOnboarding === true).map(s => s.id));

    const customThoughts = await db.thoughts
      .filter(t => !onboardingSpaceIds.has(t.spaceId) && !t.deletedAt)
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
      const result = await supabaseStorage.uploadFile(userId, blob.blob, blob.name, thoughtId);
      
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
