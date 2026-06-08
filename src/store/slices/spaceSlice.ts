import { type StateCreator } from 'zustand';
import { db, type Space } from '../../db';
import { type CyberiaState } from '../types';
import { setSetting, getSetting } from '../../utils/settings';
import { ulid } from 'ulid';

export const createSpaceSlice: StateCreator<CyberiaState, [], [], any> = (set, get, _api) => ({
  activeSpaceId: null,
  spaces: [],
  isSpaceLoading: typeof window !== 'undefined' ? (window.location.hostname !== 'cyberiaspace.app' && window.location.hostname !== 'www.cyberiaspace.app') : true,
  isReadOnly: false,
  creatorName: null,
  lastUpdated: null,

  setActiveSpace: async (id: string) => {
    const requestId = Date.now();
    try {
      await setSetting('active-space-id', id);
      const space = get().spaces.find((s: Space) => s.id === id);

      set({
        activeSpaceId: id,
        thoughts: [],
        stacks: [],
        isSpaceLoading: true,
        lastSpaceRequestId: requestId,
        history: [],
        historyIndex: -1,
        layerActionTrigger: null
      });

      if (space) {
        const transform = space.mode === 'spatial'
          ? { x: space.transformX ?? 0, y: space.transformY ?? 0, scale: space.transformScale ?? 1 }
          : { x: 0, y: 0, scale: 1 };

        set({ transform } as Partial<CyberiaState>);
        set({ customBg: space.customBg || null });

        // Load background from local IndexedDB first (local pattern)
        if (space.customBg) {
          const currentUserId = 'guest';
          const localBg = await db.spaceBackgrounds.filter(b => b.spaceId === id && b.userId === currentUserId).first();
          if (localBg) {
            const blobUrl = URL.createObjectURL(localBg.blob);
            set({ customBg: blobUrl });
            console.log('[BG] Loaded background from local IndexedDB:', id);
          }
        }

        // Opportunistic migration: convert Base64 backgrounds to local blob URLs
        if (space.customBg && space.customBg.startsWith('data:')) {
          const spaceId = space.id;
          const capturedBase64 = space.customBg;
          (async () => {
            try {
              console.log('[BG] Migrating Base64 background to local blob for space:', spaceId);
              const response = await fetch(capturedBase64);
              const blob = await response.blob();

              const userId = 'guest';

              await db.spaceBackgrounds.put({
                id: spaceId,
                spaceId: spaceId,
                blob,
                name: 'background',
                type: blob.type || 'image/jpeg',
                userId,
                updatedAt: Date.now()
              });

              const blobUrl = URL.createObjectURL(blob);

              const currentSpace = await db.spaces.get(spaceId);
              if (!currentSpace || currentSpace.customBg !== capturedBase64) {
                return;
              }

              await db.spaces.update(spaceId, { customBg: blobUrl, updatedAt: Date.now() });
              const migSpaces = get().spaces.map((ms: any) => ms.id === spaceId ? { ...ms, customBg: blobUrl } : ms);
              set({ spaces: migSpaces });
              if (get().activeSpaceId === spaceId) {
                set({ customBg: blobUrl });
              }
            } catch (e) {
              console.warn('[BG] Base64 migration failed, keeping current value:', e);
            }
          })();
        }
      }

      // Load data for the new space
      await Promise.all([
        get().refreshThoughts(id),
        get().refreshStacks(id)
      ]);

    } catch (err) {
      console.error('Failed to set active space:', err);
    } finally {
      if (get().lastSpaceRequestId === requestId) {
        set({ isSpaceLoading: false });
      }
    }
  },

  refreshSpaces: async () => {
    const currentUserId = 'guest';
    const activeSpaces = await db.spaces
      .filter((s: any) => !s.deletedAt && s.userId === currentUserId)
      .toArray();
    activeSpaces.sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));

    set({ spaces: activeSpaces });
  },

  addSpace: async (name: string) => {
    if (get().isReadOnly) return;
    const currentUserId = 'guest';
    const userSpaces = await db.spaces.filter((s: any) => s.userId === currentUserId && !s.deletedAt).toArray();

    const id = ulid();
    await db.spaces.add({
      id,
      userId: currentUserId,
      name,
      mode: 'spatial',
      physics: getSetting('physics-enabled') !== 'false',
      order: userSpaces.length,
      updatedAt: Date.now(),
    });
    await get().refreshSpaces();
    await get().setActiveSpace(id);
    get().pushHistory();
  },

  updateSpace: async (id: string, updates: Partial<Space>) => {
    const { spaces } = get();
    const index = spaces.findIndex((s: Space) => s.id === id);
    if (index !== -1) {
      const newSpaces = [...spaces];
      newSpaces[index] = { ...newSpaces[index], ...updates };
      set({ spaces: newSpaces });
    }
    if (get().isReadOnly) return;

    await db.spaces.update(id, {
      ...updates,
      updatedAt: Date.now(),
    });
    await get().refreshSpaces();
  },

  deleteSpace: async (id: string) => {
    if (get().isReadOnly) return;
    const { spaces, activeSpaceId } = get();

    const remainingSpaces = spaces.filter(s => s.id !== id && !s.deletedAt);
    if (remainingSpaces.length === 0) {
      const { useModalStore } = await import('../useModalStore');
      useModalStore.getState().openModal({
        title: 'Core Workspace Required',
        description: 'You must have at least one active space. Create a new one before removing this dimension.',
        type: 'alert',
        confirmText: 'Acknowledged'
      });
      return;
    }

    const space = spaces.find((s: Space) => s.id === id);
    if (!space) return;

    const currentUserId = 'guest';
    const now = Date.now();
    try {
      await db.transaction('rw', [db.spaces, db.thoughts, db.stacks], async () => {
        await db.spaces.update(id, {
          deletedAt: now,
          updatedAt: now,
        });

        await db.thoughts.where('spaceId').equals(id).and(t => t.userId === currentUserId).modify({
          deletedAt: now,
          updatedAt: now,
        });

        await db.stacks.where('spaceId').equals(id).and(s => s.userId === currentUserId).modify({
          deletedAt: now,
          updatedAt: now,
        });
      });

      await get().refreshSpaces();
      get().pushHistory();

      const freshSpaces = get().spaces;
      if (id === activeSpaceId && freshSpaces.length > 0) {
        await get().setActiveSpace(freshSpaces[Math.max(0, freshSpaces.length - 1)].id);
      }
    } catch (err) {
      console.error('[Space] Deletion failed:', err);
    }
  },

  reorderSpaces: async (newSpaces: Space[]) => {
    if (get().isReadOnly) return;
    const now = Date.now();
    await Promise.all(newSpaces.map((s, i) => db.spaces.update(s.id, {
      order: i,
      updatedAt: now,
    })));
    await get().refreshSpaces();
    get().pushHistory();
  },

  saveSpaceTransform: async (id: string, transform: { x: number; y: number; scale: number }) => {
    const { spaces } = get();
    const space = spaces.find((s: Space) => s.id === id);
    if (!space || space.mode !== 'spatial') return;

    const now = Date.now();

    const index = spaces.findIndex((s: Space) => s.id === id);
    if (index !== -1) {
      const newSpaces = [...spaces];
      newSpaces[index] = {
        ...newSpaces[index],
        transformX: transform.x,
        transformY: transform.y,
        transformScale: transform.scale,
        updatedAt: now,
      };
      set({ spaces: newSpaces });
    }

    await db.spaces.update(id, {
      transformX: transform.x,
      transformY: transform.y,
      transformScale: transform.scale,
      updatedAt: now,
    });
  },
});
