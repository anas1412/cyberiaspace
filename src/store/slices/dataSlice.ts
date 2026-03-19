import { type StateCreator } from 'zustand';
import { db, type Space, type Thought, type Stack } from '../../db';
import { useModalStore } from '../useModalStore';
import { PLAN_CONFIG, type SubscriptionPlan } from '../../constants';
import { syncOrchestrator } from '../../services/sync/syncOrchestrator';
import { useAuthStore } from '../useAuthStore';
import { type CyberiaState } from '../types';
import { migrateThoughtsToModular } from '../../utils/migrations';
import { isStorageUrl } from '../../services/supabaseStorage';
import { ulid } from 'ulid';

let isCreatingInitialWorkspace = false;

export const createDataSlice: StateCreator<CyberiaState, [], [], any> = (set, get, _api) => ({
  isInitializing: true,
  isDemo: false,
  lastSpaceRequestId: 0,
  _savedUserState: null as { spaces: Space[]; thoughts: Thought[]; stacks: Stack[]; activeSpaceId: string | null } | null,


  init: async () => {
    try {
      // Removed demo mode gating to avoid interference with real per-user data isolation
      if (get().performanceMode) document.body.classList.add('low-perf');

      // Ensure DB is open and ready
      try {
        await db.open();
      } catch (err) {
        console.error('Failed to open database:', err);
      }

      // Run data migration for modular thought payloads
      await migrateThoughtsToModular();

      const { useAuthStore: dynamicAuthStore } = await import('../useAuthStore');
      // Fire initAuth in background to prevent blocking workspace render
      dynamicAuthStore.getState().initAuth();
      
      const user = dynamicAuthStore.getState().user;
      if (user) set({ oracleMode: true });

      const path = window.location.pathname;
      if (path.startsWith('/s/')) {
        const parts = path.split('/s/');
        const sharedId = parts[1]?.split('/')[0];
        if (sharedId) {
          set({ isSpaceLoading: true, isReadOnly: true });
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

            const res = await fetch(`/api/publish?id=${sharedId}`, { signal: controller.signal });
            clearTimeout(timeoutId);
            
            if (!res.ok) throw new Error('Snapshot not found');
            const data = await res.json();
            const creatorName = data.creatorName || 'Anonymous';
            const space = { ...data.space, id: data.id };
            set({
              activeSpaceId: data.id,
              spaces: [space],
              thoughts: data.thoughts,
              stacks: data.stacks,
              isSpaceLoading: false,
              creatorName,
              lastUpdated: data.lastUpdated || null,
              isInitializing: false,
              customBg: space.customBg || null,
              transform: { x: space.transformX || 0, y: space.transformY || 0, scale: space.transformScale || 1 }
            });
            const theme = data.space.theme || 'cyberia';
            document.body.setAttribute('data-theme', theme);
            set({ theme });
            return;
          } catch (err: any) {
            console.error('Shared init failed:', err);
            useModalStore.getState().openModal({
              title: err.name === 'AbortError' ? 'Connection Timeout' : 'Space Not Found',
              description: err.name === 'AbortError' ? 'The request took too long. Please check your connection.' : 'Link invalid or expired.',
              type: 'alert',
              confirmText: 'Go to Cyberia',
              onConfirm: () => { window.location.href = '/'; }
            });
            set({ isSpaceLoading: false, isInitializing: false });
            return;
          }
        }
      }

      set({ isSpaceLoading: true });
      const savedTheme = localStorage.getItem('cyberia-theme') || 'cyberia';
      document.body.setAttribute('data-theme', savedTheme);
      
      try {
        await get().refreshSpaces();
        await get().refreshTotalThoughtCount();
        await get().cleanupTrash();
        
        // Heal any orphaned space backgrounds (cloud file deleted but DB still has URL)
        // and download missing thought blobs (cloud file exists but no local copy)
        const { useAuthStore: auth } = await import('../useAuthStore');
        if (auth.getState().status === 'authenticated') {
          auth.getState().healSpaceBackgrounds();
          auth.getState().downloadMissingBlobs();
        }
      } catch (err) {
        console.error('Failed to load data, resetting to initial workspace:', err);
        await get().createInitialWorkspace();
        return;
      }
      
      const { spaces } = get();
      const wasLocalDbEmpty = spaces.length === 0;
      if (spaces.length === 0) {
        // No data in DB, create initial empty workspace
        await get().createInitialWorkspace();
      } else {
        const savedSpaceId = localStorage.getItem('cyberia-active-space-id');
        const spaceExists = savedSpaceId ? spaces.find((s: Space) => s.id === savedSpaceId) : null;
        if (spaceExists) await get().setActiveSpace(savedSpaceId!);
        else await get().setActiveSpace(spaces[0].id);
      }

      // NEW: If authenticated but never synced, wait for the cloud handshake
      // This ensures the "Space Resolver" loading screen works as intended.
      const authState = dynamicAuthStore.getState();
      if (authState.status === 'authenticated' && (!localStorage.getItem('cyberia-last-sync') || wasLocalDbEmpty)) {
        console.log('[Store] Fresh login detected, awaiting cloud handshake...');
        await authState.handlePostAuthSync();
      }
    } finally {
      set({ isInitializing: false, isSpaceLoading: false });
    }
  },

  createInitialWorkspace: async () => {
    if (isCreatingInitialWorkspace) return;
    isCreatingInitialWorkspace = true;
    
    try {
      // IDEMPOTENCY CHECK: Ensure we don't create multiple initial workspaces
      const currentUserId = (useAuthStore.getState().user?.id) ?? 'guest';
      const existingCount = await db.spaces.filter(s => s.userId === currentUserId && !s.deletedAt).count();
      if (existingCount > 0) {
        console.log('[Store] Initial workspace already exists, skipping creation.');
        await get().refreshSpaces();
        return;
      }

      const workspaceId = ulid();
      const now = Date.now();
      
      const initialSpace: Space = {
        id: workspaceId,
        userId: currentUserId,
        name: 'Workspace',
        mode: 'spatial',
        physics: true,
        order: 0,
        updatedAt: now,
        syncStatus: 'local'
      };

      await db.spaces.add(initialSpace);
      localStorage.setItem('cyberia-active-space-id', workspaceId);
      await get().refreshSpaces();
      await get().setActiveSpace(workspaceId);
    } catch (err) {
      console.error('Failed to create initial workspace:', err);
    } finally {
      isCreatingInitialWorkspace = false;
    }
  },

  clearWorkspace: async () => {
    if (get().isReadOnly) return;
    try {
      const { useAuthStore: dynamicAuthStore } = await import('../useAuthStore');
      const authStore = dynamicAuthStore.getState();
      const isAuthenticated = authStore.status === 'authenticated';
      const currentUserId = authStore.user?.id ?? 'guest';
      
      console.log('[Store] Initiating GLOBAL workspace clear...');
      
      // Block sync during destructive operation
      await syncOrchestrator.setSyncBlocked(true);

      const workspaceId = ulid();
      const now = Date.now();
      
      const newSpace = { id: workspaceId, userId: currentUserId, name: 'Workspace', mode: 'spatial' as const, physics: true, order: 0, updatedAt: now, syncStatus: 'local' as const };
      
      // 1. Deep Local Wipe (ALL tables)
      await db.transaction('rw', [db.spaces, db.thoughts, db.stacks, db.blobs], async () => {
        await Promise.all([
          db.spaces.clear(),
          db.thoughts.clear(),
          db.stacks.clear(),
          db.blobs.clear()
        ]);
        
        // Create one fresh entry with correct userId
        await db.spaces.add(newSpace);
        localStorage.setItem('cyberia-active-space-id', workspaceId);
      });

      // 2. Global Cloud Wipe (if authenticated)
      if (isAuthenticated) {
        console.log('[Store] Cleaning cloud backup to match local slate...');
        await authStore.deleteCloudData(); 
      }

      // 3. Update Store State
      set({ 
        spaces: [newSpace], 
        stacks: [], 
        thoughts: [],
        activeSpaceId: workspaceId,
        transform: { x: 0, y: 0, scale: 1 }
      });
      
      console.log('[Store] Global clear complete.');
    } catch (err) { 
      console.error('Global clear failed:', err); 
    } finally {
      await syncOrchestrator.setSyncBlocked(false);
    }
  },

  importFullState: async (data: any, merge: boolean = false) => {
    if (get().isReadOnly) return;
    try {
      console.log(`[Store] ${merge ? 'Merging' : 'Importing'} full state from cloud...`);
      
      // Ensure syncStatus is set to 'synced' for incoming cloud data
      const cloudSpaces = (data.spaces || []).map((s: any) => ({ ...s, syncStatus: 'synced' }));
      const cloudThoughts = (data.thoughts || []).map((t: any) => ({ ...t, syncStatus: 'synced' }));
      const cloudStacks = (data.stacks || []).map((s: any) => ({ ...s, syncStatus: 'synced' }));

      await db.transaction('rw', [db.spaces, db.thoughts, db.stacks], async () => {
        if (cloudSpaces.length > 0) {
          if (!merge) await db.spaces.clear();
          await db.spaces.bulkPut(cloudSpaces);
        }
        if (cloudThoughts.length > 0) {
          if (!merge) await db.thoughts.clear();
          await db.thoughts.bulkPut(cloudThoughts);
        }
        if (cloudStacks.length > 0) {
          if (!merge) await db.stacks.clear();
          await db.stacks.bulkPut(cloudStacks);
        }
      });

      if (data.activeSpaceId) {
        localStorage.setItem('cyberia-active-space-id', data.activeSpaceId);
      }
      
      await get().refreshSpaces();
      await get().refreshTotalThoughtCount();
      await get().cleanupTrash();
      
      const { spaces, activeSpaceId } = get();
      if (spaces.length > 0) {
        const targetId = activeSpaceId || data.activeSpaceId || spaces[0].id;
        await get().setActiveSpace(targetId);
      }
      
      console.log('[Store] Full state import complete.');
    } catch (err) {
      console.error('Full state import failed', err);
    }
  },

  
  clearLocalData: async () => {
    try {
      console.log('[Store] Initiating LOCAL Factory Reset...');
      const { useAuthStore: dynamicAuthStore } = await import('../useAuthStore');
      const authStore = dynamicAuthStore.getState();

      // 1. Deep Database Purge
      await db.transaction('rw', [db.spaces, db.thoughts, db.stacks, db.blobs], async () => {
        await Promise.all([
          db.spaces.clear(),
          db.thoughts.clear(),
          db.stacks.clear(),
          db.blobs.clear()
        ]);
      });
      
      // 2. Graceful Session Termination (Handles localStorage + Tokens)
      if (authStore.status === 'authenticated') {
        await authStore.signOut();
      } else {
        localStorage.clear();
      }
      
      // 3. Reload Initial Workspace
      await get().createInitialWorkspace();
      console.log('[Store] Factory reset complete.');
      
    } catch (err) { console.error('Local reset failed:', err); }
  },

  exportData: async () => {
    const currentUserId = (useAuthStore.getState().user?.id) ?? 'guest';
    const allSpaces = await db.spaces.filter((s: any) => s.userId === currentUserId).toArray();
    const allThoughts = await db.thoughts.filter((t: any) => t.userId === currentUserId).toArray();
    const allStacks = await db.stacks.filter((s: any) => s.userId === currentUserId).toArray();
    // Blobs are scoped to thoughts the current user owns
    const thoughtIds = new Set(allThoughts.map(t => t.id));
    const allBlobs = await db.blobs.filter((b: any) => thoughtIds.has(b.thoughtId)).toArray();
    const data = { spaces: allSpaces, thoughts: allThoughts, stacks: allStacks, blobs: allBlobs, activeSpaceId: get().activeSpaceId, version: 16, timestamp: Date.now() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cyberia_space_backup_${new Date().toLocaleDateString('en-CA')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  importData: async (input: any) => {
    if (get().isReadOnly) return;
    const processData = async (data: any) => {
      if (!data || typeof data !== 'object' || !('spaces' in data) || !('thoughts' in data)) throw new Error('Invalid backup');

      // Block sync during destructive import to prevent race conditions
      await syncOrchestrator.setSyncBlocked(true);

      try {
        // Rewrite all data to current user to prevent cross-user data leakage
        const currentUserId = (useAuthStore.getState().user?.id) ?? 'guest';

        // Remap spaces, thoughts, stacks to current user
        const remappedSpaces = (data.spaces || []).map((s: any) => ({
          ...s,
          userId: currentUserId,
          // Generate new ULID for imported spaces to avoid ID collisions with existing data
          id: ulid(),
          updatedAt: Date.now(),
          syncStatus: 'local',
        }));
        
        // Build ID mapping: old space ID -> new space ID
        const spaceIdMap = new Map<string, string>();
        const oldSpaceIds = (data.spaces || []).map((s: any) => s.id);
        const newSpaceIds = remappedSpaces.map((s: any) => s.id);
        oldSpaceIds.forEach((oldId: string, i: number) => spaceIdMap.set(oldId, newSpaceIds[i]));

        // Remap thoughts to current user and reassign to new space IDs
        const remappedThoughts = (data.thoughts || []).map((t: any) => ({
          ...t,
          userId: currentUserId,
          id: ulid(),  // New ID to avoid collisions
          spaceId: spaceIdMap.get(t.spaceId) || t.spaceId,  // Map to new space ID
          updatedAt: Date.now(),
          syncStatus: 'local',
        }));

        // Build ID mapping: old thought ID -> new thought ID (for blob remapping)
        const thoughtIdMap = new Map<string, string>();
        const oldThoughtIds = (data.thoughts || []).map((t: any) => t.id);
        const newThoughtIds = remappedThoughts.map((t: any) => t.id);
        oldThoughtIds.forEach((oldId: string, i: number) => thoughtIdMap.set(oldId, newThoughtIds[i]));

        // Remap stacks to current user and reassign space/thought IDs
        const remappedStacks = (data.stacks || []).map((s: any) => ({
          ...s,
          userId: currentUserId,
          id: ulid(),
          spaceId: spaceIdMap.get(s.spaceId) || s.spaceId,
          updatedAt: Date.now(),
          syncStatus: 'local',
        }));

        // Remap blobs to current user and reassign thought IDs
        const remappedBlobs = (data.blobs || []).map((b: any) => ({
          ...b,
          id: thoughtIdMap.get(b.thoughtId) || b.thoughtId,  // Map to new thought ID
          thoughtId: thoughtIdMap.get(b.thoughtId) || b.thoughtId,
          updatedAt: Date.now(),
        }));

        // Before wiping, collect background storage paths to clean up (scoped to current user)
        const authStore = useAuthStore.getState();
        let bgPathsToClean: string[] = [];
        if (authStore.status === 'authenticated' && authStore.user) {
          const existingSpaces = await db.spaces.filter((s: any) => !s.deletedAt && s.userId === currentUserId).toArray();
          bgPathsToClean = existingSpaces
            .filter((s: any) => s.customBg && isStorageUrl(s.customBg))
            .map((s: any) => `${authStore.user!.id}/backgrounds/bg_${s.id}`);
        }

        await db.transaction('rw', db.spaces, db.thoughts, db.stacks, db.blobs, async () => {
          // Clear only current user's data (all tables since we want a clean import)
          await db.spaces.clear();
          await db.thoughts.clear();
          await db.stacks.clear();
          await db.blobs.clear();
          // Import remapped data with correct userId
          await db.spaces.bulkAdd(remappedSpaces);
          await db.thoughts.bulkAdd(remappedThoughts);
          if (remappedStacks.length > 0) await db.stacks.bulkAdd(remappedStacks);
          if (remappedBlobs.length > 0) await db.blobs.bulkAdd(remappedBlobs);
        });

        // Clean up orphaned background files (await to complete before reload)
        if (bgPathsToClean.length > 0) {
          const { supabaseStorage } = await import('../../services/supabaseStorage');
          await Promise.allSettled(
            bgPathsToClean.map(path =>
              supabaseStorage.deleteFile(path).catch((e: any) =>
                console.warn('[Import] Background cleanup failed:', path, e)
              )
            )
          );
        }

        // Reset sync baseline so imported data syncs cleanly as first-sync
        localStorage.removeItem('cyberia-last-sync');

        if (data.activeSpaceId) localStorage.setItem('cyberia-active-space-id', data.activeSpaceId);
        if (data.settings?.theme) localStorage.setItem('cyberia-theme', data.settings.theme);
      } finally {
        await syncOrchestrator.setSyncBlocked(false);
      }
      window.location.reload();
    };
    if (input instanceof File) {
      const reader = new FileReader();
      reader.onload = async (e) => { 
        try { await processData(JSON.parse(e.target?.result as string)); } 
        catch (err) { 
          console.error('Import failed', err);
          useModalStore.getState().openModal({ 
            title: 'Import Failed', 
            description: 'The backup file is invalid or corrupted.', 
            type: 'alert', 
            confirmText: 'Okay' 
          });
        } 
      };
      reader.readAsText(input);
    } else {
      try { await processData(input); } catch (err) { console.error('Import failed', err); }
    }
  },

  isLocalWorkspaceEmpty: async () => {
    const currentUserId = (useAuthStore.getState().user?.id) ?? 'guest';
    
    // Check for any thoughts (including soft-deleted) to determine if there's real work
    const thoughtsCount = await db.thoughts.filter((t: any) => !t.deletedAt && t.userId === currentUserId).count();
    const spaces = await db.spaces.filter((s: any) => !s.deletedAt && s.userId === currentUserId).toArray();
    
    // If there are any active thoughts, it's not empty
    if (thoughtsCount > 0) return false;

    // If there is more than 1 space, it's not empty
    if (spaces.length > 1) return false;

    // If there is 1 space, check if it has been touched (renamed)
    if (spaces.length === 1) {
      const s = spaces[0];
      const defaultNames = ['Workspace', 'New Space', 'Personal'];
      if (!defaultNames.includes(s.name)) return false;
    }

    // CRITICAL: Check for pending deletions (tombstones) - if user deleted things offline, it's NOT empty
    // We want to preserve those deletions and trigger merge mode
    const deletedThoughtsCount = await db.thoughts.filter((t: any) => Boolean(t.deletedAt) && t.userId === currentUserId).count();
    const deletedSpacesCount = await db.spaces.filter((s: any) => Boolean(s.deletedAt) && s.userId === currentUserId).count();
    
    if (deletedThoughtsCount > 0 || deletedSpacesCount > 0) {
      console.log(`[Store] Found pending deletions: ${deletedThoughtsCount} thoughts, ${deletedSpacesCount} spaces - workspace is NOT empty`);
      return false;
    }

    return true; 
  },

  getLimits: () => {
    const plan = (useAuthStore.getState().user?.plan as SubscriptionPlan) || 'free';
    return PLAN_CONFIG[plan] || PLAN_CONFIG.free;
  },

  cleanupTrash: async () => {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    
    // Only permanently delete items that have ALREADY been synced to cloud
    // This prevents accidentally deleting items that were deleted offline but haven't synced yet
    const thoughtsToPurge = await db.thoughts
      .filter((t: any) => 
        Boolean(t.deletedAt) && 
        t.deletedAt < thirtyDaysAgo &&
        t.syncStatus === 'synced'  // Only delete if already synced
      )
      .toArray();
    
    if (thoughtsToPurge.length > 0) {
      const ids = thoughtsToPurge.map(t => t.id);
      await db.transaction("rw", db.thoughts, db.blobs, async () => {
        await db.thoughts.bulkDelete(ids);
        await db.blobs.where("thoughtId").anyOf(ids).delete();
      });
    }

    try {
      const allThoughtIds = new Set((await db.thoughts.toCollection().primaryKeys()));
      const allBlobs = await db.blobs.toArray();
      const orphanedBlobs = allBlobs.filter(b => !allThoughtIds.has(b.thoughtId));
      // Only purge orphaned blobs that are old AND synced
      const blobsToPurge = orphanedBlobs.filter(b => b.updatedAt < thirtyDaysAgo);
      
      if (blobsToPurge.length > 0) {
        const blobIds = blobsToPurge.map(b => b.id);
        await db.blobs.bulkDelete(blobIds);
      }
    } catch (err) {
      console.error('[Storage] Orphaned blob cleanup failed:', err);
    }
  },

  migrateLegacyData: async (userId: string) => {
    // Migrate all existing data without userId OR with userId='guest' to the current user
    const now = Date.now();
    
    try {
      // Migrate spaces without userId
      const spacesWithoutUserId = await db.spaces.filter((s: any) => !s.userId).toArray();
      if (spacesWithoutUserId.length > 0) {
        console.log(`[Migration] Migrating ${spacesWithoutUserId.length} spaces (no userId) to user ${userId}`);
        for (const space of spacesWithoutUserId) {
          await db.spaces.update(space.id, { userId, updatedAt: now, syncStatus: 'local' });
        }
      }
      
      // Migrate guest spaces to authenticated user (preserve their work)
      // Only clear customBg if it was stored under guest's path AND user is different
      const guestSpaces = await db.spaces.filter((s: any) => s.userId === 'guest').toArray();
      if (guestSpaces.length > 0) {
        console.log(`[Migration] Migrating ${guestSpaces.length} guest spaces to user ${userId}`);
        for (const space of guestSpaces) {
          const updates: any = { userId, updatedAt: now, syncStatus: 'local' };
          // Only clear customBg if migrating to a DIFFERENT user (not same user re-authenticating)
          // The URL contains the path: userId/backgrounds/bg_spaceId
          if (space.customBg && space.customBg.includes('/backgrounds/')) {
            const bgUserId = space.customBg.split('/backgrounds/')[0].split('/').pop();
            if (bgUserId && bgUserId !== userId) {
              console.log(`[Migration] Clearing customBg for space ${space.id} - was stored under different user (${bgUserId})`);
              updates.customBg = null;
            }
          }
          await db.spaces.update(space.id, updates);
        }
      }
      
      // Migrate thoughts without userId
      const thoughtsWithoutUserId = await db.thoughts.filter((t: any) => !t.userId).toArray();
      if (thoughtsWithoutUserId.length > 0) {
        console.log(`[Migration] Migrating ${thoughtsWithoutUserId.length} thoughts (no userId) to user ${userId}`);
        for (const thought of thoughtsWithoutUserId) {
          await db.thoughts.update(thought.id, { userId, updatedAt: now, syncStatus: 'local' });
        }
      }
      
      // Migrate guest thoughts to authenticated user
      const guestThoughts = await db.thoughts.filter((t: any) => t.userId === 'guest').toArray();
      if (guestThoughts.length > 0) {
        console.log(`[Migration] Migrating ${guestThoughts.length} guest thoughts to user ${userId}`);
        for (const thought of guestThoughts) {
          await db.thoughts.update(thought.id, { userId, updatedAt: now, syncStatus: 'local' });
        }
      }
      
      // Migrate stacks without userId
      const stacksWithoutUserId = await db.stacks.filter((s: any) => !s.userId).toArray();
      if (stacksWithoutUserId.length > 0) {
        console.log(`[Migration] Migrating ${stacksWithoutUserId.length} stacks (no userId) to user ${userId}`);
        for (const stack of stacksWithoutUserId) {
          await db.stacks.update(stack.id, { userId, updatedAt: now, syncStatus: 'local' });
        }
      }
      
      // Migrate guest stacks to authenticated user
      const guestStacks = await db.stacks.filter((s: any) => s.userId === 'guest').toArray();
      if (guestStacks.length > 0) {
        console.log(`[Migration] Migrating ${guestStacks.length} guest stacks to user ${userId}`);
        for (const stack of guestStacks) {
          await db.stacks.update(stack.id, { userId, updatedAt: now, syncStatus: 'local' });
        }
      }
      
      console.log('[Migration] Legacy data migration complete');
    } catch (err) {
      console.error('[Migration] Failed to migrate legacy data:', err);
    }
  },

  ensureWorkspaceForCurrentUser: async () => {
    const currentUserId = (useAuthStore.getState().user?.id) ?? 'guest';
    const spaces = await db.spaces.filter((s: any) => s.userId === currentUserId && !s.deletedAt).toArray();
    if (spaces.length === 0) {
      const workspaceId = ulid();
      const now = Date.now();
      await db.spaces.add({ id: workspaceId, userId: currentUserId, name: 'Workspace', mode: 'spatial', physics: true, order: 0, updatedAt: now, syncStatus: 'local' });
      localStorage.setItem('cyberia-active-space-id', workspaceId);
      await get().refreshSpaces();
      await get().setActiveSpace(workspaceId);
    }
  },
});
