import { type StateCreator } from 'zustand';
import { db, type Space } from '../../db';
import { useAuthStore } from '../useAuthStore';
import { useModalStore } from '../useModalStore';
import { syncOrchestrator } from '../../services/sync/syncOrchestrator';
import { type CyberiaState } from '../types';
import { ulid } from 'ulid';

export const createSpaceSlice: StateCreator<CyberiaState, [], [], any> = (set, get, _api) => ({
  activeSpaceId: null,
  spaces: [],
  isSpaceLoading: typeof window !== 'undefined' ? (window.location.hostname !== 'cyberia.tn' && window.location.hostname !== 'www.cyberia.tn') : true,
  isReadOnly: false,
  creatorName: null,
  lastUpdated: null,

  setActiveSpace: async (id: string) => {
    const requestId = Date.now();
    try {
      localStorage.setItem('cyberia-active-space-id', id);
      const space = get().spaces.find((s: Space) => s.id === id);
      
      // Set loading state and clear current thoughts/stacks
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
        
        if (space.theme) { 
          set({ theme: space.theme });
          document.body.setAttribute('data-theme', space.theme); 
        }
        set({ customBg: space.customBg || null });
      }

      // Load data for the new space
      await Promise.all([
        get().refreshThoughts(id),
        get().refreshStacks(id)
      ]);
    } catch (err) {
      console.error('Failed to set active space:', err);
    } finally {
      // Data loaded (or failed), stop loading state ONLY if this is the latest request
      if (get().lastSpaceRequestId === requestId) {
        set({ isSpaceLoading: false });
      }
    }
  },

  refreshSpaces: async () => {
    // Robust fetching: Get all non-deleted spaces and sort by order
    const allSpaces = await db.spaces.toArray();
    const activeSpaces = allSpaces
      .filter(s => !s.deletedAt)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    
    set({ spaces: activeSpaces });
  },

  addSpace: async (name: string) => {
    if (get().isReadOnly || get().isDemo) return;
    const { spaces } = get();
    const limits = get().getLimits();
    if (spaces.length >= limits.MAX_SPACES) {
      useModalStore.getState().openModal({ 
        title: 'Space Limit Reached', 
        description: `You’ve reached the free limit of ${limits.MAX_SPACES} spaces. Upgrade to Cyberia Pro to create more workspaces and unlock premium features.`, 
        type: 'limit_space', 
        confirmText: 'Upgrade to Pro', 
        onConfirm: () => useModalStore.getState().openPricing() 
      });
      return;
    }
    const id = ulid();
    await db.spaces.add({ 
      id, 
      name, 
      mode: 'spatial', 
      physics: true, 
      order: spaces.length,
      updatedAt: Date.now(),
      syncStatus: 'local'
    });
    await get().refreshSpaces();
    await get().setActiveSpace(id);
    
    const authStore = useAuthStore.getState();
    if (authStore.status === 'authenticated') {
      await syncOrchestrator.triggerSync();
    }
  },

  updateSpace: async (id: string, updates: Partial<Space>, options?: { skipSync?: boolean }) => {
    const { spaces } = get();
    const index = spaces.findIndex((s: Space) => s.id === id);
    if (index !== -1) {
      const newSpaces = [...spaces];
      newSpaces[index] = { ...newSpaces[index], ...updates };
      set({ spaces: newSpaces });
    }
    if (get().isReadOnly || get().isDemo) return;
    
    const finalUpdates = {
      ...updates,
      updatedAt: Date.now(),
      syncStatus: 'local' as const
    };
    
    await db.spaces.update(id, finalUpdates);
    await get().refreshSpaces();
    
    const authStore = useAuthStore.getState();
    if (authStore.status === 'authenticated' && !options?.skipSync) {
      await syncOrchestrator.triggerSync();
    }
  },

  deleteSpace: async (id: string) => {
    if (get().isReadOnly || get().isDemo) return;
    const { spaces, activeSpaceId } = get();
    
    // Prevent deleting the last space
    const remainingSpaces = spaces.filter(s => s.id !== id && !s.deletedAt);
    if (remainingSpaces.length === 0) {
      useModalStore.getState().openModal({
        title: 'Core Workspace Required',
        description: 'You must have at least one active workspace. Create a new one before removing this dimension.',
        type: 'alert',
        confirmText: 'Acknowledged'
      });
      return;
    }

    const space = spaces.find((s: Space) => s.id === id);
    if (!space) return;
    
    if (space.publishedId) {
      try { await get().unpublishSpace(id); } catch (err) { console.warn('Unpublish failed', err); }
    }
    
    const authStore = useAuthStore.getState();
    
    // SOFT DELETE: Mark everything as deleted
    const now = Date.now();
    try {
      await db.transaction('rw', [db.spaces, db.thoughts, db.stacks], async () => {
        await db.spaces.update(id, { 
          deletedAt: now, 
          updatedAt: now, 
          syncStatus: 'local' 
        });
        
        await db.thoughts.where('spaceId').equals(id).modify({ 
          deletedAt: now, 
          updatedAt: now, 
          syncStatus: 'local' 
        });
        
        await db.stacks.where('spaceId').equals(id).modify({ 
          deletedAt: now, 
          updatedAt: now, 
          syncStatus: 'local' 
        });
      });

      // Update store immediately to reflect disappearance in UI
      await get().refreshSpaces();
      
      // Switch to another space if we deleted the active one
      const freshSpaces = get().spaces;
      if (id === activeSpaceId && freshSpaces.length > 0) {
        await get().setActiveSpace(freshSpaces[Math.max(0, freshSpaces.length - 1)].id);
      }

      if (authStore.status === 'authenticated') {
        await syncOrchestrator.triggerSync();
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
      syncStatus: 'local' 
    })));
    await get().refreshSpaces();
    
    const authStore = useAuthStore.getState();
    if (authStore.status === 'authenticated') {
      await syncOrchestrator.triggerSync();
    }
  },

  saveSpaceTransform: async (id: string, transform: { x: number; y: number; scale: number }) => {
    const { spaces } = get();
    const space = spaces.find((s: Space) => s.id === id);
    if (!space || space.mode !== 'spatial') return;
    
    const now = Date.now();
    await db.spaces.update(id, { 
      transformX: transform.x, 
      transformY: transform.y, 
      transformScale: transform.scale,
      updatedAt: now,
      syncStatus: 'local'
    });
    
    const index = spaces.findIndex((s: Space) => s.id === id);
    if (index !== -1) {
      const newSpaces = [...spaces];
      newSpaces[index] = { 
        ...newSpaces[index], 
        transformX: transform.x, 
        transformY: transform.y, 
        transformScale: transform.scale 
      };
      set({ spaces: newSpaces });
    }
    
    const authStore = useAuthStore.getState();
    if (authStore.status === 'authenticated') {
      await syncOrchestrator.triggerSync();
    }
  },

  publishSpace: async (spaceId: string) => {
    const { spaces, thoughts, stacks } = get();
    const space = spaces.find((s: Space) => s.id === spaceId);
    if (!space) return;

    const authStore = useAuthStore.getState();
    const user = authStore.user;
    if (authStore.status !== 'authenticated' || !user) {
      useModalStore.getState().openModal({
        title: 'Authentication Required',
        description: 'You must be signed in to publish a space.',
        type: 'alert',
        confirmText: 'Okay'
      });
      return;
    }

    const creatorName = user.name.split(' ')[0];

    try {
      const spaceThoughts = thoughts.filter((t: any) => t.spaceId === spaceId);
      const spaceStacks = stacks.filter((s: any) => s.spaceId === spaceId);
      const currentTheme = get().theme;
      const currentCustomBg = get().customBg;

      const res = await fetch('/api/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authStore.accessToken}`
        },
        body: JSON.stringify({
          space: { ...space, theme: currentTheme, customBg: currentCustomBg },
          thoughts: spaceThoughts,
          stacks: spaceStacks,
          publishedId: space.publishedId,
          creatorName
        })
      });

      if (!res.ok) throw new Error('Publish failed');
      const data = await res.json();

      const now = Date.now();
      await get().updateSpace(spaceId, {
        publishedId: data.publishedId,
        lastPublished: new Date().toISOString(),
        updatedAt: now
      });

      return data.publishedId;
    } catch (err) {
      console.error('Publish error:', err);
      throw err;
    }
  },

  unpublishSpace: async (spaceId: string) => {
    const { spaces } = get();
    const space = spaces.find((s: Space) => s.id === spaceId);
    if (!space || !space.publishedId) return;

    const authStore = useAuthStore.getState();

    try {
      const res = await fetch(`/api/publish?id=${space.publishedId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authStore.accessToken}`
        }
      });

      if (!res.ok) throw new Error('Unpublish failed');

      await get().updateSpace(spaceId, {
        publishedId: null,
        lastPublished: null
      });
    } catch (err) {
      console.error('Unpublish error:', err);
      throw err;
    }
  },

  importFullState: async (data: any) => {
    if (get().isReadOnly) return;
    try {
      await db.transaction('rw', db.spaces, db.thoughts, db.stacks, async () => {
        if (data.spaces && data.spaces.length > 0) {
          await db.spaces.clear();
          await db.spaces.bulkPut(data.spaces);
        }
        if (data.thoughts && data.thoughts.length > 0) {
          await db.thoughts.clear();
          await db.thoughts.bulkPut(data.thoughts);
        }
        if (data.stacks && data.stacks.length > 0) {
          await db.stacks.clear();
          await db.stacks.bulkPut(data.stacks);
        }
      });

      if (data.activeSpaceId) {
        localStorage.setItem('cyberia-active-space-id', data.activeSpaceId);
      }
      
      await get().refreshSpaces();
      await get().refreshTotalThoughtCount();
      await get().cleanupTrash();
      
      const { spaces } = get();
      if (spaces.length > 0) {
        const targetId = data.activeSpaceId || spaces[0].id;
        await get().setActiveSpace(targetId);
      }
    } catch (err) {
      console.error('Full state import failed', err);
    }
  }
});
