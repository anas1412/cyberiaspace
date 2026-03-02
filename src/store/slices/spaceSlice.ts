import { type StateCreator } from 'zustand';
import { db } from '../../db';
import { useAuthStore } from '../useAuthStore';
import { useModalStore } from '../useModalStore';
import { syncOrchestrator } from '../../services/sync/syncOrchestrator';
import { type CyberiaState } from '../types';

export const createSpaceSlice: StateCreator<CyberiaState, [], [], any> = (set, get, _api) => ({
  activeSpaceId: null,
  spaces: [],
  isSpaceLoading: typeof window !== 'undefined' ? (window.location.hostname !== 'cyberia.tn' && window.location.hostname !== 'www.cyberia.tn') : true,
  isReadOnly: false,
  creatorName: null,
  lastUpdated: null,

  setActiveSpace: (id: string) => {
    localStorage.setItem('cyberia-active-space-id', id);
    const space = get().spaces.find((s: any) => s.id === id);
    const updates: any = { activeSpaceId: id, thoughts: [], stacks: [], isSpaceLoading: true, history: [], historyIndex: -1, layerActionTrigger: null };
    if (space) {
      updates.transform = space.mode === 'spatial' ? { x: space.transformX ?? 0, y: space.transformY ?? 0, scale: space.transformScale ?? 1 } : { x: 0, y: 0, scale: 1 };
      if (space.theme) { updates.theme = space.theme; document.body.setAttribute('data-theme', space.theme); }
      updates.customBg = space.customBg || null;
    }
    set(updates);
    get().refreshThoughts(id);
    get().refreshStacks(id);
  },

  refreshSpaces: async () => {
    const spaces = await db.spaces.orderBy('order').toArray();
    set({ spaces });
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
    const id = 's' + Date.now();
    await db.spaces.add({ id, name, mode: 'spatial', physics: true, order: spaces.length });
    await get().refreshSpaces();
    get().setActiveSpace(id);
    
    const authStore = useAuthStore.getState();
    if (authStore.status === 'authenticated') {
      await syncOrchestrator.triggerSync();
    }
  },

  updateSpace: async (id: string, updates: any) => {
    const { spaces } = get();
    const index = spaces.findIndex((s: any) => s.id === id);
    if (index !== -1) {
      const newSpaces = [...spaces];
      newSpaces[index] = { ...newSpaces[index], ...updates };
      set({ spaces: newSpaces });
    }
    if (get().isReadOnly || get().isDemo) return;
    await db.spaces.update(id, updates);
    await get().refreshSpaces();
    
    const authStore = useAuthStore.getState();
    if (authStore.status === 'authenticated') {
      await syncOrchestrator.triggerSync();
    }
  },

  deleteSpace: async (id: string) => {
    if (get().isReadOnly || get().isDemo) return;
    const { spaces, activeSpaceId } = get();
    const space = spaces.find((s: any) => s.id === id);
    const deleteIndex = spaces.findIndex((s: any) => s.id === id);
    if (space?.publishedId) {
      try { await get().unpublishSpace(id); } catch (err) { console.warn('Unpublish failed', err); }
    }
    const thoughtsInSpace = await db.thoughts.where('spaceId').equals(id).toArray();
    const authStore = useAuthStore.getState();
    for (const t of thoughtsInSpace) { if (t.storageUrl || t.storagePath) await authStore.deleteServiceContent(t); }
    
    if (authStore.status === 'authenticated') {
      await syncOrchestrator.triggerSync();
    }
    
    await db.spaces.delete(id);
    await db.thoughts.where('spaceId').equals(id).delete();
    await db.stacks.where('spaceId').equals(id).delete();
    await get().refreshSpaces();
    const updatedSpaces = get().spaces;
    if (updatedSpaces.length > 0) {
      if (id === activeSpaceId) get().setActiveSpace(updatedSpaces[Math.max(0, deleteIndex - 1)].id);
    } else {
      localStorage.removeItem('cyberia-active-space-id');
      set({ activeSpaceId: null, thoughts: [], stacks: [] });
    }
  },

  reorderSpaces: async (newSpaces: any[]) => {
    if (get().isReadOnly) return;
    await Promise.all(newSpaces.map((s, i) => db.spaces.update(s.id, { order: i })));
    await get().refreshSpaces();
    
    const authStore = useAuthStore.getState();
    if (authStore.status === 'authenticated') {
      await syncOrchestrator.triggerSync();
    }
  },

  saveSpaceTransform: async (id: string, transform: any) => {
    const { spaces } = get();
    const space = spaces.find((s: any) => s.id === id);
    if (!space || space.mode !== 'spatial') return;
    await db.spaces.update(id, { transformX: transform.x, transformY: transform.y, transformScale: transform.scale });
    const index = spaces.findIndex((s: any) => s.id === id);
    if (index !== -1) {
      const newSpaces = [...spaces];
      newSpaces[index] = { ...newSpaces[index], ...transform };
      set({ spaces: newSpaces });
    }
    
    const authStore = useAuthStore.getState();
    if (authStore.status === 'authenticated') {
      await syncOrchestrator.triggerSync();
    }
  },

  publishSpace: async (spaceId: string) => {
    const { spaces, thoughts, stacks } = get();
    const space = spaces.find((s: any) => s.id === spaceId);
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

      const now = new Date().toISOString();
      await get().updateSpace(spaceId, {
        publishedId: data.publishedId,
        lastPublished: data.lastPublished || now,
        updatedAt: data.lastPublished || now
      });

      return data.publishedId;
    } catch (err) {
      console.error('Publish error:', err);
      throw err;
    }
  },

  unpublishSpace: async (spaceId: string) => {
    const { spaces } = get();
    const space = spaces.find((s: any) => s.id === spaceId);
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
});
