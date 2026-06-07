import { type StateCreator } from 'zustand';
import { db, type Space, type Thought, type Stack } from '../../db';
import { useModalStore } from '../useModalStore';
import { DEFAULT_THEME } from '../../constants';
import { type CyberiaState } from '../types';
import { migrateThoughtsToModular, migrateThoughtsToTimeFields } from '../../utils/migrations';
import { ulid } from 'ulid';

export const createDataSlice: StateCreator<CyberiaState, [], [], any> = (set, get, _api) => ({
  isInitializing: true,
  setInitializing: (isInitializing: boolean) => set({ isInitializing }),
  isSpaceLoading: false,
  setSpaceLoading: (loading: boolean) => set({ isSpaceLoading: loading }),
  setInitializationState: (isInitializing: boolean, isSpaceLoading: boolean) => set({ isInitializing, isSpaceLoading }),
  isDemo: false,
  lastSpaceRequestId: 0,
  _savedUserState: null as { spaces: Space[]; thoughts: Thought[]; stacks: Stack[]; activeSpaceId: string | null } | null,

  init: async () => {
    try {
      // Ensure DB is open and ready
      try {
        await db.open();
      } catch (err) {
        console.error('Failed to open database:', err);
      }

      // Run data migration for modular thought payloads
      await migrateThoughtsToModular();
      await migrateThoughtsToTimeFields();

      set({ isSpaceLoading: true });
      const savedTheme = localStorage.getItem('cyberia-theme') || DEFAULT_THEME;
      document.body.setAttribute('data-theme', savedTheme);

      try {
        // 1. Load local IndexedDB data
        await get().refreshSpaces();
        await get().refreshTotalThoughtCount();
        await get().cleanupTrash();

        let currentSpaces = get().spaces;

        // Ensure at least one space exists
        if (currentSpaces.length === 0) {
          console.log('[Init] No local spaces - creating initial workspace');
          await get().createInitialWorkspace();
          currentSpaces = get().spaces;
        }

        // Determine which space to show
        const savedSpaceId = localStorage.getItem('cyberia-active-space-id');
        const spaceExists = savedSpaceId ? currentSpaces.find((s: Space) => s.id === savedSpaceId) : null;
        const targetSpaceId = spaceExists?.id || (currentSpaces.length > 0 ? currentSpaces[0].id : null);

        // 2. Set space settings directly
        const activeSpace = currentSpaces.find((s: Space) => s.id === targetSpaceId);
        if (activeSpace) {
          const transform = activeSpace.mode === 'spatial'
            ? { x: activeSpace.transformX ?? 0, y: activeSpace.transformY ?? 0, scale: activeSpace.transformScale ?? 1 }
            : { x: 0, y: 0, scale: 1 };

          set({
            activeSpaceId: targetSpaceId,
            transform,
            customBg: activeSpace.customBg || null,
            isReadOnly: false
          });
        }

        // 3. Show app now
        set({ isInitializing: false, isSpaceLoading: false });

        // 4. Background: Load thoughts for the active space
        if (targetSpaceId) {
          get().refreshThoughts(targetSpaceId);
          get().refreshStacks(targetSpaceId);
        }
      } catch (err) {
        console.error('Failed to load local data:', err);
        await get().createInitialWorkspace();
        set({ isInitializing: false, isSpaceLoading: false });
      }
    } catch (err) {
      console.error('Init failed:', err);
      set({ isInitializing: false, isSpaceLoading: false });
    }
  },

  createInitialWorkspace: async () => {
    try {
      console.log('[Store] Checking if initial space needed...');
      const currentUserId = 'guest';

      const userSpacesCount = await db.spaces.filter(s => s.userId === currentUserId && !s.deletedAt).count();

      if (userSpacesCount > 0) {
        console.log('[Store] Initial space already exists, skipping creation.');
        await get().refreshSpaces();
        return;
      }

      console.log('[Store] No spaces found, creating initial workspace...');
      const workspaceId = ulid();
      const now = Date.now();

      const initialSpace: Space = {
        id: workspaceId,
        userId: currentUserId,
        name: 'Workspace',
        mode: 'spatial',
        physics: localStorage.getItem('cyberia-physics-enabled') !== 'false',
        order: 0,
        updatedAt: now,
      };

      await db.spaces.add(initialSpace);
      localStorage.setItem('cyberia-active-space-id', workspaceId);
      await get().refreshSpaces();
      await get().setActiveSpace(workspaceId);
    } catch (err) {
      console.error('Failed to create initial space:', err);
    }
  },

  isLocalWorkspaceEmpty: async () => {
    const currentUserId = 'guest';

    const thoughtsCount = await db.thoughts.filter((t: any) => !t.deletedAt && !t.archivedAt && t.userId === currentUserId).count();
    const spaces = await db.spaces.filter((s: any) => !s.deletedAt && s.userId === currentUserId).toArray();

    if (thoughtsCount > 0) return false;
    if (spaces.length > 1) return false;

    if (spaces.length === 1) {
      const s = spaces[0];
      const defaultNames = ['Workspace', 'New Space', 'Personal'];
      if (!defaultNames.includes(s.name)) return false;
    }

    return true;
  },

  exportData: async () => {
    const currentUserId = 'guest';
    const allSpaces = await db.spaces.filter((s: any) => s.userId === currentUserId).toArray();
    const allThoughts = await db.thoughts.filter((t: any) => t.userId === currentUserId).toArray();
    const allStacks = await db.stacks.filter((s: any) => s.userId === currentUserId).toArray();
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

      const currentUserId = 'guest';

      const remappedSpaces = (data.spaces || []).map((s: any) => ({
        ...s, userId: currentUserId, id: ulid(), updatedAt: Date.now(),
      }));

      const spaceIdMap = new Map<string, string>();
      const oldSpaceIds = (data.spaces || []).map((s: any) => s.id);
      const newSpaceIds = remappedSpaces.map((s: any) => s.id);
      oldSpaceIds.forEach((oldId: string, i: number) => spaceIdMap.set(oldId, newSpaceIds[i]));

      const remappedThoughts = (data.thoughts || []).map((t: any) => ({
        ...t, userId: currentUserId, id: ulid(), spaceId: spaceIdMap.get(t.spaceId) || t.spaceId, updatedAt: Date.now(),
      }));

      const thoughtIdMap = new Map<string, string>();
      const oldThoughtIds = (data.thoughts || []).map((t: any) => t.id);
      const newThoughtIds = remappedThoughts.map((t: any) => t.id);
      oldThoughtIds.forEach((oldId: string, i: number) => thoughtIdMap.set(oldId, newThoughtIds[i]));

      const remappedStacks = (data.stacks || []).map((s: any) => ({
        ...s, userId: currentUserId, id: ulid(), spaceId: spaceIdMap.get(s.spaceId) || s.spaceId, updatedAt: Date.now(),
      }));

      const remappedBlobs = (data.blobs || []).map((b: any) => ({
        ...b, id: thoughtIdMap.get(b.thoughtId) || b.thoughtId, thoughtId: thoughtIdMap.get(b.thoughtId) || b.thoughtId, updatedAt: Date.now(),
      }));

      await db.transaction('rw', db.spaces, db.thoughts, db.stacks, db.blobs, async () => {
        await db.spaces.clear();
        await db.thoughts.clear();
        await db.stacks.clear();
        await db.blobs.clear();
        await db.spaces.bulkAdd(remappedSpaces);
        await db.thoughts.bulkAdd(remappedThoughts);
        if (remappedStacks.length > 0) await db.stacks.bulkAdd(remappedStacks);
        if (remappedBlobs.length > 0) await db.blobs.bulkAdd(remappedBlobs);
      });

      if (data.activeSpaceId) localStorage.setItem('cyberia-active-space-id', data.activeSpaceId);
      if (data.settings?.theme) localStorage.setItem('cyberia-theme', data.settings.theme);

      window.location.reload();
    };
    if (input instanceof File) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try { await processData(JSON.parse(e.target?.result as string)); }
        catch (err) {
          useModalStore.getState().openModal({ title: 'Import Failed', description: 'The backup file is invalid or corrupted.', type: 'alert', confirmText: 'Okay' });
        }
      };
      reader.readAsText(input);
    } else {
      try { await processData(input); } catch (err) { console.error('Import failed', err); }
    }
  },

  cleanupTrash: async () => {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    const thoughtsToPurge = await db.thoughts.filter((t: any) => Boolean(t.deletedAt) && t.deletedAt < thirtyDaysAgo).toArray();

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
    const now = Date.now();
    console.log('[Migration] Starting migration for user:', userId);
    try {
      await db.transaction('rw', [db.spaces, db.thoughts, db.stacks, db.blobs], async () => {
        await db.spaces.filter((s: any) => !s.userId || s.userId === 'guest').modify((s: any) => {
          s.userId = userId;
          s.updatedAt = now;
        });

        await db.thoughts.filter((t: any) => !t.userId || t.userId === 'guest').modify({ userId, updatedAt: now });
        await db.stacks.filter((s: any) => !s.userId || s.userId === 'guest').modify({ userId, updatedAt: now });
        await db.blobs.filter((b: any) => !b.userId || b.userId === 'guest').modify({ userId, updatedAt: now });
      });
    } catch (err) {
      console.error('[Migration] Failed to migrate legacy data:', err);
      throw err;
    }
  },

  ensureWorkspaceForCurrentUser: async () => {
    const currentUserId = 'guest';
    const spaces = await db.spaces.filter((s: any) => s.userId === currentUserId && !s.deletedAt).toArray();
    if (spaces.length === 0) {
      const workspaceId = ulid();
      const now = Date.now();
      await db.spaces.add({ id: workspaceId, userId: currentUserId, name: 'My Space', mode: 'spatial', physics: true, order: 0, updatedAt: now });
      localStorage.setItem('cyberia-active-space-id', workspaceId);
      await get().refreshSpaces();
      await get().setActiveSpace(workspaceId);
    }
  },

  resetStoreState: (theme?: 'dark' | 'light') => {
    set({
      thoughts: [],
      spaces: [],
      stacks: [],
      activeSpaceId: null,
      transform: { x: 0, y: 0, scale: 1 },
      selectedThoughtIds: [],
      creatorName: null,
      customBg: null,
      theme: theme || DEFAULT_THEME
    });
  },

});
