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
      
      console.log('[Sync] Wiping cloud content before push...');
      await syncOrchestrator.deleteCloudContent();
      console.log('[Sync] Cloud wiped');
      
      const [localSpaces, localStacks, localThoughts] = await Promise.all([
        db.spaces.toArray(),
        db.stacks.toArray(),
        db.thoughts.toArray(),
      ]);
      
      console.log(`[Sync] Pushing ${localSpaces.length} spaces, ${localStacks.length} stacks, ${localThoughts.length} thoughts`);
      
      const validStoragePaths = new Set<string>();
      
      if (localSpaces.length > 0) {
        const cleanedSpaces = localSpaces.map(s => ({
          ...s,
          user_id: userId,
        }));
        await supabaseSync.createSpaces(cleanedSpaces, userId);
        console.log('[Sync] Spaces synced');
      }
      
      if (localStacks.length > 0) {
        const cleanedStacks = localStacks.map(s => ({
          ...s,
          user_id: userId,
        }));
        await supabaseSync.createStacks(cleanedStacks, userId);
        console.log('[Sync] Stacks synced');
      }
      
      if (localThoughts.length > 0) {
        for (const thought of localThoughts) {
          if (thought.storagePath) {
            validStoragePaths.add(thought.storagePath);
          }
          
          if (thought.type === 'image' || thought.type === 'file') {
            const blob = await db.blobs.where('thoughtId').equals(thought.id).first();
            if (blob?.blob) {
              const exists = await supabaseStorage.fileExists(userId, blob.name);
              if (!exists) {
                const result = await supabaseStorage.uploadFile(userId, blob.blob, blob.name);
                await db.thoughts.update(thought.id, {
                  storageUrl: result.url,
                  storagePath: result.path,
                });
                validStoragePaths.add(result.path);
                console.log(`[Sync] Uploaded file for thought ${thought.id}`);
              } else {
                console.log(`[Sync] File already exists for thought ${thought.id}, skipping`);
              }
            }
          }
        }
        
        const cleanedThoughts = localThoughts.map(t => ({
          ...t,
          user_id: userId,
        }));
        await supabaseSync.createThoughts(cleanedThoughts);
        console.log('[Sync] Thoughts synced');
      }
      
      console.log(`[Sync] Valid storage paths: ${validStoragePaths.size}`);
      
      if (validStoragePaths.size > 0 || localThoughts.length > 0) {
        const cleanedCount = await supabaseStorage.cleanupOrphanedFiles(userId, validStoragePaths);
        console.log(`[Sync] Cleaned up ${cleanedCount} orphaned files`);
      }
      
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
    const thoughtsCount = await db.thoughts.count();
    
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
