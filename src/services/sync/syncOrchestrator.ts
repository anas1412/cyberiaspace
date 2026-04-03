import { db } from '../../db';
import { supabaseSync, supabase, toCamelCase } from '../supabaseSync';
import { supabaseStorage, isStorageUrl } from '../supabaseStorage';
import type { SyncConflictData } from './syncTypes';
import { type RealtimeChannel } from '@supabase/supabase-js';

let isSyncBlocked = false;
let syncRequestedDuringActiveSync = false;
let realtimeChannel: RealtimeChannel | null = null;
let remoteSyncDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let outgoingSyncDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let isFocusEditing = false;
let focusEditingThoughtId: string | null = null;

// Editing registry for multi-thought editing support
const editingThoughtIds = new Set<string>();

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

  setFocusEditing(editing: boolean, thoughtId: string | null = null) {
    if (editing === isFocusEditing && thoughtId === focusEditingThoughtId) {
      return;
    }
    console.log(`[Sync] Focus editing set to: ${editing} for thought: ${thoughtId}`);
    isFocusEditing = editing;
    focusEditingThoughtId = editing ? thoughtId : null;
    if (editing && thoughtId) {
      editingThoughtIds.add(thoughtId);
    } else if (!editing && thoughtId) {
      editingThoughtIds.delete(thoughtId);
      this.flushThought(thoughtId);
    } else if (!editing) {
      this.flushAllEditingThoughts();
      editingThoughtIds.clear();
    }
  },

  getFocusEditing() {
    return { isFocusEditing, focusEditingThoughtId };
  },

  // New editing registry methods for multi-thought editing support
  startEditing(thoughtId: string) {
    console.log(`[Sync] Started editing thought: ${thoughtId}`);
    editingThoughtIds.add(thoughtId);
    // Keep legacy focus editing in sync for backward compatibility
    isFocusEditing = true;
    focusEditingThoughtId = thoughtId;
  },

  stopEditing(thoughtId: string) {
    console.log(`[Sync] Stopped editing thought: ${thoughtId}`);
    // Flush the thought to IndexedDB before removing from registry
    this.flushThought(thoughtId);
    editingThoughtIds.delete(thoughtId);
    // Update legacy focus editing if this was the focused thought
    if (focusEditingThoughtId === thoughtId) {
      const remainingIds = Array.from(editingThoughtIds);
      if (remainingIds.length > 0) {
        focusEditingThoughtId = remainingIds[remainingIds.length - 1];
      } else {
        isFocusEditing = false;
        focusEditingThoughtId = null;
      }
    }
  },

  isEditing(thoughtId: string): boolean {
    return editingThoughtIds.has(thoughtId);
  },

  getEditingThoughts(): Set<string> {
    return new Set(editingThoughtIds);
  },

  async flushThought(thoughtId: string) {
    try {
      const { useStore } = await import('../../store/useStore');
      const thought = useStore.getState().thoughts.find((t: any) => t.id === thoughtId);
      if (!thought) {
        return;
      }
      console.log('[Sync] Flushing thought to IndexedDB:', thoughtId);
      const saveTimers = (window as any)._cyberia_save_timers || {};
      if (saveTimers[thoughtId]) {
        clearTimeout(saveTimers[thoughtId]);
        delete saveTimers[thoughtId];
        (window as any)._cyberia_save_timers = saveTimers;
      }
      const statusToWrite = thought.syncStatus === 'syncing' ? 'syncing' : 'local';
      await db.thoughts.put({ ...thought, syncStatus: statusToWrite });
    } catch (e) {
      console.warn('[Sync] Failed to flush thought:', thoughtId, e);
    }
  },

  async flushAllEditingThoughts() {
    const ids = Array.from(editingThoughtIds);
    if (ids.length === 0) return;
    console.log(`[Sync] Flushing ${ids.length} editing thoughts`);
    await Promise.all(ids.map(id => this.flushThought(id)));
  },

  async flushFocusEditingThought() {
    if (!focusEditingThoughtId) return;
    try {
      const { useStore } = await import('../../store/useStore');
      const thought = useStore.getState().thoughts.find((t: any) => t.id === focusEditingThoughtId);
      if (thought) {
        console.log('[Sync] Flushing focused thought to IndexedDB:', focusEditingThoughtId);
        const saveTimers = (window as any)._cyberia_save_timers || {};
        if (saveTimers[focusEditingThoughtId]) {
          clearTimeout(saveTimers[focusEditingThoughtId]);
          delete saveTimers[focusEditingThoughtId];
          (window as any)._cyberia_save_timers = saveTimers;
        }
        const statusToWrite = thought.syncStatus === 'syncing' ? 'syncing' : 'local';
        await db.thoughts.put({ ...thought, syncStatus: statusToWrite });
      }
    } catch (e) {
      console.warn('[Sync] Failed to flush focus editing thought:', e);
    }
  },


  async triggerSync(force: boolean = false): Promise<void> {
    const { useSyncStore } = await import('../../store/useSyncStore');
    const { useAuthStore } = await import('../../store/useAuthStore');
    
    const authState = useAuthStore.getState();
    const syncState = useSyncStore.getState();
    
    if (authState.status !== 'authenticated' || !authState.isOnline) return;
    if (!force && !authState.autoSync) return;
    
    if (syncState.status === 'syncing') {
      console.log('[Sync] Sync already in progress, queuing follow-up...');
      syncRequestedDuringActiveSync = true;
      return;
    }

    // Clear any existing outgoing debounce
    if (outgoingSyncDebounceTimer) {
      clearTimeout(outgoingSyncDebounceTimer);
      outgoingSyncDebounceTimer = null;
    }

    if (force) {
      // Immediate execution for remote changes or forced triggers
      await syncOrchestrator.deltaSync(force);
    } else {
      // 2.5s Debounce for local modifications (typing, dragging, etc)
      // This prevents "Save Storms" while the user is actively working.
      outgoingSyncDebounceTimer = setTimeout(async () => {
        await syncOrchestrator.deltaSync(false);
        outgoingSyncDebounceTimer = null;
      }, 2500);
    }
  },

  /**
   * Trigger sync after a delay. Use when you want to let the UI update first.
   * 
   * @param delayMs - Milliseconds to wait before syncing (default: 50)
   * 
   * @example
   * // Sync after UI updates (e.g., after delete operations)
   * syncOrchestrator.syncSoon();
   * 
   * // Sync after 100ms
   * syncOrchestrator.syncSoon(100);
   */
  syncSoon(delayMs: number = 50): void {
    setTimeout(() => {
      this.triggerSync();
    }, delayMs);
  },

  setupRealtimeListener(userId: string) {
    if (realtimeChannel) {
      console.log('[Sync] Existing realtime listener found, cleaning up...');
      this.cleanupRealtimeListener();
    }

    console.log(`[Sync] Setting up instant realtime listener for user: ${userId}`);
    
    const handleRemoteChange = async (payload: any, table: string) => {
      // Profile/Settings update - handle immediately without full delta sync
      if (table === 'users') {
        const userData = payload.new;
        if (!userData?.id) return;

        console.log('[Sync] Remote user settings change detected, updating local profile...');
        const { useAuthStore } = await import('../../store/useAuthStore');
        const { useStore } = await import('../../store/useStore');
        const authStore = useAuthStore.getState();
        
        // Use payload.new directly — no extra Supabase query needed with REPLICA IDENTITY FULL
        const camelData = toCamelCase(userData);
        const newSettings = camelData.settings || {};
        
        if (newSettings.customBg !== undefined) {
          useStore.getState().setCustomBgValue(newSettings.customBg);
        }

        // Update user object in auth store
        const updatedUser = { 
          ...camelData,
          settings: { ...authStore.user?.settings, ...newSettings }
        };
        useAuthStore.getState().mergeUserData(updatedUser);
        return;
      }

      // ECHO FILTER: Ignore if we already have this or newer data locally
      // This prevents infinite loops from self-broadcasts
      if (payload.new && payload.new.updated_at) {
        const id = payload.new.id;
        const cloudTime = new Date(payload.new.updated_at).getTime();
        
        let localItem;
        if (table === 'thoughts') localItem = await db.thoughts.get(id);
        else if (table === 'spaces') localItem = await db.spaces.get(id);
        else if (table === 'stacks') localItem = await db.stacks.get(id);

        if (localItem && localItem.updatedAt && localItem.updatedAt >= cloudTime) {
          // console.log(`[Sync] Ignoring echo for ${table}:${id}`);
          return;
        }
      }

      // BATCH REMOTE TRIGGERS: Small 500ms debounce for remote events
      // to handle bursts (e.g. moving multiple thoughts) efficiently.
      if (remoteSyncDebounceTimer) clearTimeout(remoteSyncDebounceTimer);
      remoteSyncDebounceTimer = setTimeout(() => {
        console.log(`[Sync] Remote ${table} change detected, triggering sync...`);
        this.triggerSync(true);
      }, 500);
    };

    realtimeChannel = supabase
      .channel(`sync:${userId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'thoughts', 
        filter: `user_id=eq.${userId}` 
      }, (payload) => handleRemoteChange(payload, 'thoughts'))
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'spaces', 
        filter: `user_id=eq.${userId}` 
      }, (payload) => handleRemoteChange(payload, 'spaces'))
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'stacks', 
        filter: `user_id=eq.${userId}` 
      }, (payload) => handleRemoteChange(payload, 'stacks'))
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'users',
        filter: `id=eq.${userId}`
      }, (payload) => handleRemoteChange(payload, 'users'))
      .subscribe((status) => {
        console.log(`[Sync] Realtime subscription status: ${status}`);
      });
  },

  cleanupRealtimeListener() {
    if (realtimeChannel) {
      console.log('[Sync] Cleaning up realtime listener...');
      realtimeChannel.unsubscribe();
      realtimeChannel = null;
    }
    if (remoteSyncDebounceTimer) {
      clearTimeout(remoteSyncDebounceTimer);
      remoteSyncDebounceTimer = null;
    }
    if (outgoingSyncDebounceTimer) {
      clearTimeout(outgoingSyncDebounceTimer);
      outgoingSyncDebounceTimer = null;
    }
  },

  async deltaSync(bypassBlock: boolean = false, providedCloudData: SyncConflictData | null = null): Promise<{ success: boolean; error?: string }> {
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
      
      const lastSync = localStorage.getItem('cyberia-last-sync');
      const isFirstSync = !lastSync;

      // ==========================================
      // Step 1: Fetch Cloud Metadata & Reconcile
      // ==========================================
      // CRITICAL: We fetch cloud state BEFORE pushing so we learn about 
      // parent deletions (Stacks/Spaces) before trying to push children (Thoughts).
      console.log('[Sync] Step 1: Reconciling with cloud...');
      
      let cloudSpaces, cloudStacks, cloudThoughts;
      
      if (providedCloudData) {
        cloudSpaces = { spaces: providedCloudData.spaces };
        cloudStacks = { stacks: providedCloudData.stacks };
        cloudThoughts = { thoughts: providedCloudData.thoughts };
      } else {
        [cloudSpaces, cloudStacks, cloudThoughts] = await Promise.all([
          supabaseSync.getSpaces(userId, 'id, updated_at, custom_bg'),
          supabaseSync.getStacks(userId, 'id, updated_at'),
          supabaseSync.getThoughts(userId, 'id, updated_at, space_id, type, storage_url'),
        ]);
      }

      const cloudSpaceMap = new Map<string, any>(cloudSpaces.spaces.map((s: any) => [s.id, s]));
      const cloudStackMap = new Map<string, any>(cloudStacks.stacks.map((s: any) => [s.id, s]));
      const cloudThoughtMap = new Map<string, any>(cloudThoughts.thoughts.map((t: any) => [t.id, t]));

      const localAllSpacesBefore = await db.spaces.filter((s: any) => s.userId === userId).toArray();
      const localAllStacksBefore = await db.stacks.filter((s: any) => s.userId === userId).toArray();
      const localAllThoughtsBefore = await db.thoughts.filter((t: any) => t.userId === userId).toArray();

      // Deletion (Absence Rule)
      // Only run this if we have established a local baseline (lastSync exists)
      if (!isFirstSync) {
        const DELETION_GRACE_PERIOD_MS = 30000; // 30s grace period for cloud visibility
        const now = Date.now();

        for (const s of localAllSpacesBefore) {
          if (s.syncStatus === 'synced' && !cloudSpaceMap.has(s.id)) {
            const timeSinceUpdate = now - (s.updatedAt || 0);
            if (timeSinceUpdate > DELETION_GRACE_PERIOD_MS) {
              // FK Safety: Clear spaceId from orphaned stacks and thoughts before deleting space
              await db.stacks.where('spaceId').equals(s.id).and(st => st.userId === userId).modify((st: any) => { st.spaceId = null; });
              await db.thoughts.where('spaceId').equals(s.id).and(t => t.userId === userId).modify((t: any) => { t.spaceId = null; });
              // Clean up background file from storage before deleting the space record
              if (s.customBg && isStorageUrl(s.customBg)) {
                supabaseStorage.deleteSpaceBackground(userId, s.id)
                  .catch((e: any) => console.warn('[Sync] Absence rule bg cleanup failed:', s.id, e));
              }
              await db.spaces.delete(s.id);
            }
          }
        }
        for (const s of localAllStacksBefore) {
          if (s.syncStatus === 'synced' && !cloudStackMap.has(s.id)) {
            const timeSinceUpdate = now - (s.updatedAt || 0);
            if (timeSinceUpdate > DELETION_GRACE_PERIOD_MS) {
              // Dexie Cleanup: Since Dexie has no CASCADE, we manually clear stackId from orphans
              await db.thoughts.where('stackId').equals(s.id).and(t => t.userId === userId).modify({ stackId: null });
              await db.stacks.delete(s.id);
            }
          }
        }
        for (const t of localAllThoughtsBefore) {
          if (t.syncStatus === 'synced' && !cloudThoughtMap.has(t.id)) {
            const timeSinceUpdate = now - (t.updatedAt || 0);
            if (timeSinceUpdate > DELETION_GRACE_PERIOD_MS) {
              if (syncOrchestrator.isEditing(t.id)) {
                console.warn(`[Sync] Skipping deletion of actively edited thought: ${t.id}`);
                continue;
              }
              await db.thoughts.delete(t.id);
              await db.blobs.delete(t.id);
            }
          }
        }
      }

      // Updates (Cloud is newer)
      const currentActiveSpaceId = store.activeSpaceId;

      const allKnownSpaceIds = new Set([
        ...localAllSpacesBefore.filter(s => !s.deletedAt).map(s => s.id),
        ...Array.from(cloudSpaceMap.keys())
      ]);

      for (const [id, cloudS] of cloudSpaceMap) {
        const localS = localAllSpacesBefore.find(ls => ls.id === id);
        if (!localS || (cloudS.updatedAt && new Date(cloudS.updatedAt).getTime() > (localS.updatedAt || 0))) {
          let incomingSpace = null;
          
          // OPTIMIZATION: Use provided data if available to avoid extra network calls
          if (providedCloudData) {
            incomingSpace = toCamelCase(cloudS);
          } else {
            const { data } = await supabase.from('spaces').select('*').eq('id', id).single();
            if (data) incomingSpace = toCamelCase(data);
          }

          if (incomingSpace) {
            await db.spaces.put({ ...incomingSpace, syncStatus: 'synced' } as any);

            if (id === store.activeSpaceId) {
              if (incomingSpace.customBg !== undefined) {
                useStore.getState().setCustomBgValue(incomingSpace.customBg);
              }
            }
          }
        }
      }

      for (const [id, cloudStack] of cloudStackMap) {
        const localStack = localAllStacksBefore.find(ls => ls.id === id);
        const cloudTime = cloudStack.updatedAt ? new Date(cloudStack.updatedAt).getTime() : 0;
        const localTime = localStack?.updatedAt || 0;

        if (!localStack || cloudTime > localTime) {
          let incomingStack = null;
          if (providedCloudData) {
            incomingStack = toCamelCase(cloudStack);
          } else {
            const { data } = await supabase.from('stacks').select('*').eq('id', id).single();
            if (data) incomingStack = toCamelCase(data);
          }

          if (incomingStack) {
            await db.stacks.put({ ...incomingStack, syncStatus: 'synced' } as any);
          }
        } else if (localStack && localStack.syncStatus === 'local' && cloudTime === localTime) {
          await db.stacks.update(id, { syncStatus: 'synced' });
        }
      }

      for (const [id, cloudT] of cloudThoughtMap) {
        if (allKnownSpaceIds.has(cloudT.spaceId)) {
          const localT = localAllThoughtsBefore.find(lt => lt.id === id);
          const needsHealing = localT && localT.type === 'file' && localT.storageUrl && !(await db.blobs.where('thoughtId').equals(id).first());
          
          const cloudTime = cloudT.updatedAt ? new Date(cloudT.updatedAt).getTime() : 0;
          const localTime = localT?.updatedAt || 0;
          
          if (!localT || cloudTime > localTime || needsHealing) {
            let incoming = null;
            if (providedCloudData) {
              incoming = toCamelCase(cloudT);
            } else {
              const { data } = await supabase.from('thoughts').select('*').eq('id', id).single();
              if (data) incoming = toCamelCase(data);
            }

            if (incoming) {
              // PRESERVE SPATIAL: If we already have this thought locally, 
              // keep our local x,y,vx,vy instead of resetting to defaults.
              if (localT) {
                incoming.x = localT.x;
                incoming.y = localT.y;
                incoming.vx = localT.vx;
                incoming.vy = localT.vy;
              }

              await db.thoughts.put({ ...incoming, syncStatus: 'synced' } as any);
              
              if (incoming.type === 'file' && incoming.storageUrl) {
                if (incoming.spaceId === currentActiveSpaceId || localT) {
                  authState.downloadSingleBlob(id);
                }
              }
            }
          } else if (localT && localT.syncStatus === 'local' && cloudTime === localTime) {
            await db.thoughts.update(id, { syncStatus: 'synced' });
          }
        }
      }

      // ==========================================
      // Step 2: Push Local Changes (Deltas)
      // ==========================================
      console.log('[Sync] Step 2: Pushing local changes...');
      
      const [localSpaces, localStacks, localThoughts] = await Promise.all([
        db.spaces.filter((s: any) => s.syncStatus === 'local' && s.userId === userId).toArray(),
        db.stacks.filter((s: any) => s.syncStatus === 'local' && s.userId === userId).toArray(),
        db.thoughts.filter((t: any) => t.syncStatus === 'local' && t.userId === userId).toArray(),
      ]);

      if (isFirstSync) {
        console.log('[Sync] New device detected. Outgoing cloud deletions are disabled for safety.');
      }

      const onboardingSpaceIds = new Set(localSpaces.filter(s => s.isOnboarding).map(s => s.id));

      // 2.1 Handle Deletions (Reverse Order: Thoughts -> Stacks -> Spaces)
      // This order ensures FK safety during individual cloud delete calls.
      for (const thought of localThoughts.filter(t => t.deletedAt)) {
        let storageDeleted = true;
        if (thought.storagePath) {
          try {
            await supabaseStorage.deleteFile(thought.storagePath);
          } catch (e: any) {
            const is404 = e.message?.includes('404') || e.status === 404;
            if (!is404) storageDeleted = false;
          }
        }
        
        if (storageDeleted) {
          try {
            await supabaseSync.deleteThought(thought.id, userId);
            await db.thoughts.delete(thought.id);
            await db.blobs.delete(thought.id); // Deterministic delete
          } catch (e: any) {
            if (e.status === 404 || e.message?.includes('not found')) {
              await db.thoughts.delete(thought.id);
              await db.blobs.delete(thought.id);
            }
          }
        }
      }

      for (const stack of localStacks.filter(s => s.deletedAt)) {
        try {
          await supabaseSync.deleteStack(stack.id, userId);
          await db.stacks.delete(stack.id);
        } catch (e: any) {
          if (e.status === 404 || e.message?.includes('not found')) await db.stacks.delete(stack.id);
          else console.warn('[Sync] Stack deletion failed:', e);
        }
      }

      for (const space of localSpaces.filter(s => s.deletedAt)) {
        // Clean up background file from storage before DB deletion
        if (space.customBg && isStorageUrl(space.customBg)) {
          try {
            await supabaseStorage.deleteSpaceBackground(userId, space.id);
          } catch (e: any) {
            // On non-404 errors, skip this space to prevent permanent orphans
            // The tombstone is preserved and deletion will retry on next sync
            const is404 = e.message?.includes('404') || e.message?.includes('not found') || e.status === 404;
            if (!is404) {
              console.warn('[Sync] Background cleanup failed, deferring space deletion:', space.id);
              continue;
            }
          }
        }
        try {
          await supabaseSync.deleteSpace(space.id, userId);
          await db.spaces.delete(space.id);
        } catch (e: any) {
          if (e.status === 404 || e.message?.includes('not found')) await db.spaces.delete(space.id);
          else console.warn('[Sync] Space deletion failed:', e);
        }
      }

      // 2.2 Handle Creates/Updates (Order: Spaces -> Stacks -> Thoughts)
      const spacesToPush = localSpaces.filter(s => !s.deletedAt && !s.isOnboarding);
      const stacksToPush = localStacks.filter(s => !s.deletedAt && !s.isOnboarding);
      const thoughtsToPush = localThoughts.filter(t => 
        !t.deletedAt && 
        !t.archivedAt &&
        !onboardingSpaceIds.has(t.spaceId) &&
        !syncOrchestrator.isEditing(t.id)
      );

      // ==========================================
      // Step 2.2.1: Upload any pending blob backgrounds from IndexedDB
      // This ensures cloud storage has the actual image, not a blob: URL
      // ==========================================
      const spacesWithPendingBlobs = spacesToPush.filter(s => s.customBg && s.customBg.startsWith('blob:'));
      if (spacesWithPendingBlobs.length > 0) {
        console.log(`[Sync] Found ${spacesWithPendingBlobs.length} spaces with pending blob backgrounds to upload`);
        for (const space of spacesWithPendingBlobs) {
          try {
            // Get blob from IndexedDB instead of fetching from blob: URL
            const bgEntry = await db.spaceBackgrounds.get(space.id);
            if (!bgEntry) {
              console.warn(`[Sync] No local background found for space ${space.id}, skipping bg upload`);
              continue;
            }
            
            const { url: storageUrl } = await supabaseStorage.uploadSpaceBackground(
              userId,
              space.id,
              bgEntry.blob,
              bgEntry.type
            );
            // Update IndexedDB with the storage URL so it syncs properly
            await db.spaces.update(space.id, {
              customBg: storageUrl,
              syncStatus: 'local',
              updatedAt: Date.now(),
            });
            console.log(`[Sync] Background uploaded for space ${space.id}: ${storageUrl}`);
          } catch (e) {
            console.warn(`[Sync] Failed to upload background for space ${space.id}:`, e);
            // Don't fail the whole sync — push the space without the bg, it will retry next sync
          }
        }
        // Re-fetch spaces with updated customBg URLs
        const updatedSpaceIds = new Set(spacesWithPendingBlobs.map(s => s.id));
        spacesToPush.length = 0; // Clear the array
        spacesToPush.push(...localSpaces.filter(s => !s.deletedAt && !s.isOnboarding && updatedSpaceIds.has(s.id)));
      }

      // Capture timestamps to prevent race conditions (Sync Overwrite)
      const spaceTimestamps = new Map(spacesToPush.map(s => [s.id, s.updatedAt]));
      const stackTimestamps = new Map(stacksToPush.map(s => [s.id, s.updatedAt]));
      const thoughtTimestamps = new Map(thoughtsToPush.map(t => [t.id, t.updatedAt]));

      if (spacesToPush.length > 0) {
        await supabaseSync.createSpaces(spacesToPush.map(s => ({ ...s, user_id: userId })), userId);
        
        // Atomic update: Only mark as synced if not modified during push
        await db.spaces.where('id').anyOf(spacesToPush.map(s => s.id)).modify((s: any) => {
          if (s.updatedAt === spaceTimestamps.get(s.id)) {
            s.syncStatus = 'synced';
          }
        });
        await store.refreshSpaces();
      }

      if (stacksToPush.length > 0) {
        // FK Safety: Clear invalid spaceId before pushing
        const existingCloudSpaceIds = new Set(Array.from(cloudSpaceMap.keys()));
        const pushingSpaceIds = new Set(spacesToPush.map(s => s.id));
        
        const safeStacks = stacksToPush.map(s => {
          if (s.spaceId && !existingCloudSpaceIds.has(s.spaceId) && !pushingSpaceIds.has(s.spaceId)) {
            console.warn(`[Sync] Clearing invalid spaceId ${s.spaceId} from stack ${s.id} to prevent FK violation`);
            return { ...s, spaceId: null, user_id: userId };
          }
          return { ...s, user_id: userId };
        });
        
        await supabaseSync.createStacks(safeStacks.map(s => ({ ...s, user_id: userId })), userId);
        
        // Atomic update
        await db.stacks.where('id').anyOf(stacksToPush.map(s => s.id)).modify((s: any) => {
          if (s.updatedAt === stackTimestamps.get(s.id)) {
            s.syncStatus = 'synced';
          }
        });
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
              data: { ...currentData, url: result.url },
              updatedAt: Date.now() // Bump timestamp for file metadata update
            };
            await db.thoughts.update(t.id, updates);
            thoughtsToPush[i] = { ...t, ...updates };
            // Update the captured timestamp so the final 'synced' mark works
            thoughtTimestamps.set(t.id, updates.updatedAt);
            filesUploaded = true;
          }
        }
      }

      if (thoughtsToPush.length > 0) {
        const existingCloudSpaceIds = new Set(Array.from(cloudSpaceMap.keys()));
        const pushingSpaceIds = new Set(spacesToPush.map(s => s.id));
        const existingCloudStackIds = new Set(Array.from(cloudStackMap.keys()));
        const pushingStackIds = new Set(stacksToPush.map(s => s.id));
        
        const safeThoughts = thoughtsToPush.map(t => {
          let result: any = { ...t, user_id: userId };
          
          if (t.spaceId && !existingCloudSpaceIds.has(t.spaceId) && !pushingSpaceIds.has(t.spaceId)) {
            console.warn(`[Sync] Clearing invalid spaceId ${t.spaceId} from thought ${t.id}`);
            result.spaceId = null;
          }
          if (t.stackId && !existingCloudStackIds.has(t.stackId) && !pushingStackIds.has(t.stackId)) {
            console.warn(`[Sync] Clearing invalid stackId ${t.stackId} from thought ${t.id}`);
            result.stackId = null;
          }
          return result;
        });

        await supabaseSync.createThoughts(safeThoughts);
        const ids = thoughtsToPush.map(t => t.id);
        
        // Atomic update: Only mark as synced if not modified during push
        await db.thoughts.where('id').anyOf(ids).and(t => t.userId === userId).modify((t: any) => {
          if (t.updatedAt === thoughtTimestamps.get(t.id)) {
            t.syncStatus = 'synced';
          }
        });
        await store.refreshThoughts();
      } else if (filesUploaded) {
        await store.refreshThoughts();
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
      // CRITICAL: Final UI Refresh to ensure 'synced' statuses and any remote
      // changes are perfectly reflected after the sync cycle completes.
      // Note: Editing thoughts merge logic is handled in thoughtSlice.refreshThoughts()
      try {
        const { useStore } = await import('../../store/useStore');
        const store = useStore.getState();

        await store.refreshThoughts();

        await Promise.all([
          store.refreshSpaces(),
          store.refreshStacks()
        ]);

        // Refresh storage usage after any sync to reflect new blobs on disk/cloud
        const st: any = store;
        st?.calculateUsage?.(st.totalThoughtCount || 0);
      } catch (e) {
        console.warn('[Sync] Post-sync refresh failed:', e);
      }

      if (syncRequestedDuringActiveSync) {
        syncRequestedDuringActiveSync = false;
        // 500ms cooldown for follow-up sync to prevent hammering
        this.syncSoon(500);
      }
    }
  },

  async handshake(cloudData: SyncConflictData) {
    const { useStore } = await import('../../store/useStore');
    const { useAuthStore } = await import('../../store/useAuthStore');
    const store = useStore.getState();
    const authStore = useAuthStore.getState();
    const userId = authStore.user?.id;
    if (!userId) return;

    console.log('[Sync] Handshake started with provided cloud data');

    // 1. Run deltaSync with the provided data to reconcile
    // This will update IndexedDB with any newer cloud data
    await this.deltaSync(true, cloudData);

    // 2. Final UI Refresh - Patch the store with the latest from IndexedDB
    await store.refreshSpaces();
    const currentActive = store.activeSpaceId;
    if (currentActive) {
      await Promise.all([
        store.refreshThoughts(currentActive),
        store.refreshStacks(currentActive)
      ]);
    }
    
    console.log('[Sync] Handshake complete');
  },

  async fetchCloudData(): Promise<SyncConflictData | null> {
    const { useAuthStore } = await import('../../store/useAuthStore');
    const authState = useAuthStore.getState();
    console.log('[Sync] fetchCloudData called. status:', authState.status, 'isOnline:', authState.isOnline, 'user:', authState.user?.id);
    if (authState.status !== 'authenticated' || !authState.isOnline) {
      console.log('[Sync] fetchCloudData: returning null - not authenticated or offline');
      return null;
    }
    const userId = authState.user!.id;
    try {
      const spaces = await supabaseSync.getSpaces(userId);
      const thoughts = await supabaseSync.getThoughts(userId);
      const stacks = await supabaseSync.getStacks(userId);
      console.log('[Sync] fetchCloudData: success, spaces:', spaces.spaces?.length, 'thoughts:', thoughts.thoughts?.length);
      return { spaces: spaces.spaces || [], thoughts: thoughts.thoughts || [], stacks: stacks.stacks || [] };
    } catch (err) {
      console.error('[Sync] Failed to fetch cloud data:', err);
      return null;
    }
  },

  async isLocalEmpty(userId: string): Promise<boolean> {
    const thoughtsCount = await db.thoughts.filter(t => !t.deletedAt && t.userId === userId).count();
    return thoughtsCount === 0;
  },

  async restoreFromCloud(choice: 'cloud' | 'local'): Promise<void> {
    if (choice === 'cloud') {
      const { useStore } = await import('../../store/useStore');
      const cloudData = await syncOrchestrator.fetchCloudData();
      if (cloudData) await useStore.getState().importFullState(cloudData);
    } else {
      await syncOrchestrator.deltaSync();
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

// Crash recovery: flush all editing thoughts on browser close
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (editingThoughtIds.size > 0) {
      syncOrchestrator.flushAllEditingThoughts();
    } else if (isFocusEditing && focusEditingThoughtId) {
      syncOrchestrator.flushFocusEditingThought();
    }
  });
}
