import { type StateCreator } from 'zustand';
import { db, type Space, type Thought, type Stack } from '../../db';
import { useModalStore } from '../useModalStore';
import { DEFAULT_THEME } from '../../constants';
import { type CyberiaState } from '../types';
import { migrateThoughtsToModular, migrateThoughtsToTimeFields } from '../../utils/migrations';
import { getSetting, setSetting } from '../../utils/settings';
import { ulid } from 'ulid';
import JSZip from 'jszip';

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
      const savedTheme = getSetting('theme') || DEFAULT_THEME;
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
        const savedSpaceId = getSetting('active-space-id');
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

      const userSpacesCount = await db.spaces.filter(s => !s.deletedAt).count();

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
        name: 'Workspace',
        mode: 'spatial',
        physics: getSetting('physics-enabled') !== 'false',
        order: 0,
        updatedAt: now,
      };

      await db.spaces.add(initialSpace);
      await setSetting('active-space-id', workspaceId);
      await get().refreshSpaces();
      await get().setActiveSpace(workspaceId);
    } catch (err) {
      console.error('Failed to create initial space:', err);
    }
  },

  isLocalWorkspaceEmpty: async () => {

    const thoughtsCount = await db.thoughts.filter((t: any) => !t.deletedAt && !t.archivedAt).count();
    const spaces = await db.spaces.filter((s: any) => !s.deletedAt).toArray();

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
    try {
      // Filter out soft-deleted entities
      const allSpaces = await db.spaces.filter((s: any) => !s.deletedAt).toArray();
      const allThoughts = await db.thoughts.filter((t: any) => !t.deletedAt).toArray();
      const allStacks = await db.stacks.filter((s: any) => !s.deletedAt).toArray();
      const exportedSpaceIds = new Set(allSpaces.map((s: any) => s.id));

      // Only export blobs/chats/backgrounds belonging to exported spaces/thoughts
      const exportedThoughtIds = new Set(allThoughts.map((t: any) => t.id));
      const allBlobs = await db.blobs.filter((b: any) => exportedThoughtIds.has(b.thoughtId)).toArray();
      const allChatHistory = await db.chatHistory.filter((m: any) => exportedSpaceIds.has(m.spaceId)).toArray();
      const allChatConversations = await db.chatConversations.filter((c: any) => exportedSpaceIds.has(c.spaceId)).toArray();
      const allSpaceBackgrounds = await db.spaceBackgrounds.filter((b: any) => exportedSpaceIds.has(b.spaceId)).toArray();
      const allSettings = await db.settings.toArray();

      // Build data.json payload — blob entries exclude the binary `blob` field
      const blobMeta: any[] = allBlobs.map((b: any) => ({
        id: b.id,
        thoughtId: b.thoughtId,
        name: b.name,
        type: b.type,
        updatedAt: b.updatedAt,
      }));

      const data = {
        spaces: allSpaces,
        thoughts: allThoughts,
        stacks: allStacks,
        blobs: blobMeta,
        chatHistory: allChatHistory,
        chatConversations: allChatConversations,
        spaceBackgrounds: allSpaceBackgrounds,
        settings: allSettings,
        activeSpaceId: get().activeSpaceId,
        version: 23,
        timestamp: Date.now(),
      };

      const zip = new JSZip();
      zip.file('data.json', JSON.stringify(data, null, 2));

      // Add blob files to blobs/ directory
      const blobsFolder = zip.folder('blobs');
      if (blobsFolder) {
        for (const b of allBlobs) {
          const ext = b.name.includes('.') ? b.name.split('.').pop() : '';
          const filename = ext ? `${b.id}.${ext}` : b.id;
          blobsFolder.file(filename, b.blob);
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cyberia_backup_${new Date().toLocaleDateString('en-CA')}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      useModalStore.getState().openModal({
        title: 'Export Failed',
        description: err instanceof Error ? err.message : 'Could not create backup',
        type: 'alert',
        confirmText: 'Okay',
      });
    }
  },

  importData: async (input: any) => {
    if (get().isReadOnly) return;
    if (!(input instanceof File)) return;

    const showError = () => {
      useModalStore.getState().openModal({
        title: 'Import Failed',
        description: 'The backup file is invalid or corrupted.',
        type: 'alert',
        confirmText: 'Okay',
      });
    };

    try {
      const arrayBuffer = await input.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);

      const dataFile = zip.file('data.json');
      if (!dataFile) { showError(); return; }

      const data = JSON.parse(await dataFile.async('string'));
      if (!data || typeof data !== 'object' || !('spaces' in data) || !('thoughts' in data))
        { showError(); return; }

      // Remap spaces with new ULIDs
      const remappedSpaces = (data.spaces || []).map((s: any) => ({
        ...s, id: ulid(), updatedAt: Date.now(),
      }));

      const spaceIdMap = new Map<string, string>();
      const oldSpaceIds = (data.spaces || []).map((s: any) => s.id);
      const newSpaceIds = remappedSpaces.map((s: any) => s.id);
      oldSpaceIds.forEach((oldId: string, i: number) => spaceIdMap.set(oldId, newSpaceIds[i]));

      // Remap thoughts with new ULIDs
      const remappedThoughts = (data.thoughts || []).map((t: any) => ({
        ...t, id: ulid(), spaceId: spaceIdMap.get(t.spaceId) || t.spaceId, updatedAt: Date.now(),
      }));

      const thoughtIdMap = new Map<string, string>();
      const oldThoughtIds = (data.thoughts || []).map((t: any) => t.id);
      const newThoughtIds = remappedThoughts.map((t: any) => t.id);
      oldThoughtIds.forEach((oldId: string, i: number) => thoughtIdMap.set(oldId, newThoughtIds[i]));

      // Remap stacks
      const remappedStacks = (data.stacks || []).map((s: any) => ({
        ...s, id: ulid(), spaceId: spaceIdMap.get(s.spaceId) || s.spaceId, updatedAt: Date.now(),
      }));

      // Extract blob files from blobs/ folder
      const blobsFolder = zip.folder('blobs');
      const blobsByOldId = new Map<string, Blob>();
      if (blobsFolder) {
        const blobEntries: any[] = [];
        blobsFolder.forEach((_rp, file) => {
          if (file.dir) return;
          blobEntries.push(file);
        });
        for (const f of blobEntries) {
          const name = f.name.split('/').pop() || '';
          const id = name.includes('.') ? name.substring(0, name.lastIndexOf('.')) : name;
          blobsByOldId.set(id, await f.async('blob'));
        }
      }

      // Remap blobs — only keep entries with matching blob files in the zip
      const remappedBlobs: any[] = [];
      for (const b of (data.blobs || [])) {
        const blobData = blobsByOldId.get(b.id);
        if (!blobData) continue;
        remappedBlobs.push({
          id: ulid(),
          thoughtId: thoughtIdMap.get(b.thoughtId) || b.thoughtId,
          blob: blobData,
          name: b.name,
          type: b.type,
          updatedAt: Date.now(),
        });
      }

      // Remap chat entities
      const remappedChatHistory = (data.chatHistory || []).map((m: any) => ({
        ...m, spaceId: spaceIdMap.get(m.spaceId) || m.spaceId,
      }));
      const remappedChatConversations = (data.chatConversations || []).map((c: any) => ({
        ...c, spaceId: spaceIdMap.get(c.spaceId) || c.spaceId, updatedAt: Date.now(),
      }));

      // Remap space backgrounds
      const remappedSpaceBackgrounds: any[] = [];
      for (const bg of (data.spaceBackgrounds || [])) {
        const bgData = blobsByOldId.get(bg.id);
        if (!bgData) continue;
        remappedSpaceBackgrounds.push({
          ...bg, spaceId: spaceIdMap.get(bg.spaceId) || bg.spaceId, blob: bgData,
        });
      }

      // Settings as-is
      const remappedSettings = (data.settings || []).map((s: any) => ({
        key: s.key, value: s.value,
      }));

      // Clear ALL tables and import
      const allTables = [
        db.spaces, db.thoughts, db.stacks, db.blobs,
        db.chatHistory, db.chatConversations, db.spaceBackgrounds,
        db.settings,
      ];
      await db.transaction('rw', allTables, async () => {
        for (const table of allTables) await table.clear();
        await db.spaces.bulkAdd(remappedSpaces);
        await db.thoughts.bulkAdd(remappedThoughts);
        if (remappedStacks.length > 0) await db.stacks.bulkAdd(remappedStacks);
        if (remappedBlobs.length > 0) await db.blobs.bulkAdd(remappedBlobs);
        if (remappedChatHistory.length > 0) await db.chatHistory.bulkAdd(remappedChatHistory);
        if (remappedChatConversations.length > 0) await db.chatConversations.bulkAdd(remappedChatConversations);
        if (remappedSpaceBackgrounds.length > 0) await db.spaceBackgrounds.bulkAdd(remappedSpaceBackgrounds);
        if (remappedSettings.length > 0) await db.settings.bulkAdd(remappedSettings);
      });

      // Map activeSpaceId through space ID map
      const newActiveSpaceId = data.activeSpaceId ? spaceIdMap.get(data.activeSpaceId) : null;
      if (newActiveSpaceId) await setSetting('active-space-id', newActiveSpaceId);

      window.location.reload();
    } catch (err) {
      showError();
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

  ensureWorkspaceForCurrentUser: async () => {
    const spaces = await db.spaces.filter((s: any) => !s.deletedAt).toArray();
    if (spaces.length === 0) {
      const workspaceId = ulid();
      const now = Date.now();
      await db.spaces.add({ id: workspaceId, name: 'My Space', mode: 'spatial', physics: true, order: 0, updatedAt: now });
      await setSetting('active-space-id', workspaceId);
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
