import { type StateCreator } from 'zustand';
import { db, type Thought } from '../../db';
import { useModalStore } from '../useModalStore';
import { syncOrchestrator } from '../../services/sync/syncOrchestrator';
import { type CyberiaState } from '../types';

export const createThoughtSlice: StateCreator<CyberiaState, [], [], any> = (set, get, _api) => ({
  thoughts: [] as Thought[],
  selectedThoughtId: null as number | null,
  selectedThoughtIds: [] as number[],
  isInspectorOpen: false,
  activeFocusId: null as number | null,
  focusType: null as 'text' | 'table' | 'paint' | 'tasks' | 'embed' | 'file' | 'image' | null,
  totalThoughtCount: 0,
  deletingThoughtIds: [] as number[],

  refreshTotalThoughtCount: async () => {
    const count = await db.thoughts.count();
    set(() => ({ totalThoughtCount: count }));
  },

  refreshThoughts: async (spaceId?: string) => {
    if (get().isDemo) return;
    const targetId = spaceId || get().activeSpaceId;

    if (!targetId) return;
    const thoughts = await db.thoughts.where('spaceId').equals(targetId).toArray();
    set(() => ({ thoughts, isSpaceLoading: false }));
    get().refreshTotalThoughtCount();
    if (get().history.length === 0) set(() => ({ history: [JSON.parse(JSON.stringify(thoughts))], historyIndex: 0 }));
  },

  addThought: async (partialThought: Partial<Thought>) => {
    if (get().isReadOnly) return -1;
    const { activeSpaceId } = get();
    const targetSpaceId = partialThought.spaceId || activeSpaceId;
    if (!targetSpaceId) throw new Error('No space');
    if (get().isDemo) {
      useModalStore.getState().openModal({ title: 'Demo Mode', description: 'Cannot modify in demo mode.', type: 'alert', confirmText: 'Okay' });
      return -1;
    }
    
    const limits = get().getLimits();
    const isBlobType = partialThought.type === 'file' || partialThought.type === 'image';
    if (JSON.stringify(partialThought).length > 2 * 1024 * 1024 && !isBlobType) {
      useModalStore.getState().openModal({ title: 'Buffer Overflow', description: 'Payload > 2MB.', type: 'alert', confirmText: 'Okay' });
      return -1;
    }
    const QUIRKY_TITLES = ["Name Pending", "Just Go With It", "Something Is Happening", "Trust the Process"];
    const result = await db.transaction('rw', db.thoughts, async () => {
      const currentCount = await db.thoughts.where('spaceId').equals(targetSpaceId).count();
      if (currentCount >= limits.MAX_THOUGHTS_PER_SPACE) {
        useModalStore.getState().openModal({ 
          title: 'Thinking Limit Reached', 
          description: `You’ve reached the free limit of ${limits.MAX_THOUGHTS_PER_SPACE} thoughts for this space. Upgrade to Cyberia Pro to unlock unlimited mapping and premium Oracle AI features.`, 
          type: 'limit_thought', 
          confirmText: 'Upgrade to Pro', 
          onConfirm: () => useModalStore.getState().openPricing() 
        });
        return -1;
      }
      const randomTitle = QUIRKY_TITLES[Math.floor(Math.random() * QUIRKY_TITLES.length)];
      const maxLayer = await db.thoughts.where('spaceId').equals(targetSpaceId).reverse().sortBy('layer').then(t => t[0]?.layer || 0);
      
      const thought = {
        spaceId: targetSpaceId, stackId: null, x: window.innerWidth / 2, y: window.innerHeight / 2, vx: 0, vy: 0, text: '', placeholder: randomTitle, description: '', type: 'label', content: '', image: null, drawing: null, status: 'none', tasks: [], table: [['', ''], ['', '']], date: '', priority: 'none', size: 1.0, author: '', order: currentCount, layer: maxLayer + 1, ...partialThought
      } as Thought;
      return await db.thoughts.add(thought);
    });
    if (result !== -1) {
      await get().updateSpace(targetSpaceId, { updatedAt: new Date().toISOString() });
      await get().refreshThoughts(targetSpaceId);
      await get().refreshTotalThoughtCount();
      get().pushHistory();
      
      const { useAuthStore } = await import('../useAuthStore');
      const authStore = useAuthStore.getState();
      if (authStore.status === 'authenticated') {
        await syncOrchestrator.triggerSync();
      }
    }
    return result as number;
  },

  updateThought: async (id: number, updates: Partial<Thought>) => {
    const { thoughts, activeSpaceId, isReadOnly } = get();
    const thought = thoughts.find((t: Thought) => t.id === id);
    const isBlobType = thought?.type === 'file' || updates.type === 'file' || thought?.type === 'image' || updates.type === 'image';
    if (!(Object.keys(updates).length <= 4 && !updates.content && !updates.image && !updates.drawing) && !isBlobType) {
      if (JSON.stringify(updates).length > 2 * 1024 * 1024) {
        useModalStore.getState().openModal({ title: 'Payload Reached', description: 'Thought > 2MB.', type: 'alert', confirmText: 'Okay' });
        return;
      }
    }
    const index = thoughts.findIndex((t: Thought) => t.id === id);
    if (index !== -1) {
      const newThoughts = [...thoughts];
      newThoughts[index] = { ...newThoughts[index], ...updates };
      set(() => ({ thoughts: newThoughts }));
    }
    if (isReadOnly || get().isDemo) return;
    if (activeSpaceId) get().updateSpace(activeSpaceId, { updatedAt: new Date().toISOString() });

    const saveTimers = (window as unknown as { _cyberia_save_timers: Record<number, NodeJS.Timeout> })._cyberia_save_timers || {};
    if (saveTimers[id]) clearTimeout(saveTimers[id]);
    saveTimers[id] = setTimeout(async () => {
      await db.thoughts.update(id, updates);
      delete saveTimers[id];
      get().pushHistory();
      
      const { useAuthStore } = await import('../useAuthStore');
      const authStore = useAuthStore.getState();
      if (authStore.status === 'authenticated') {
        await syncOrchestrator.triggerSync();
      }
    }, 500);
    (window as unknown as { _cyberia_save_timers: Record<number, NodeJS.Timeout> })._cyberia_save_timers = saveTimers;
  },

  updateThoughts: async (ids: number[], updates: Partial<Thought>) => {
    if (get().isReadOnly) return;
    const { thoughts, activeSpaceId } = get();
    if (activeSpaceId) get().updateSpace(activeSpaceId, { updatedAt: new Date().toISOString() });
    set(() => ({ thoughts: thoughts.map((t: Thought) => ids.includes(t.id) ? { ...t, ...updates } : t) }));
    await db.thoughts.where('id').anyOf(ids).modify(updates);
    get().pushHistory();
    const { useAuthStore } = await import('../useAuthStore');
    const authStore = useAuthStore.getState();
    if (authStore.autoSync && authStore.status === 'authenticated') {
      await syncOrchestrator.triggerSync();
    }
  },

  deleteThought: async (id: number) => {
    if (get().isReadOnly || get().isDemo) return;
    const thought = get().thoughts.find((t: Thought) => t.id === id);
    const affectedStackId = thought?.stackId;
    const { useAuthStore } = await import('../useAuthStore');
    const authStore = useAuthStore.getState();
    set((state: CyberiaState) => ({ deletingThoughtIds: [...state.deletingThoughtIds, id] }));
    if (thought) {
      await get().updateSpace(thought.spaceId, { updatedAt: new Date().toISOString() });
      if (authStore.status === 'authenticated') await authStore.deleteServiceContent(thought);
    }
    await db.thoughts.delete(id);
    await db.blobs.where('thoughtId').equals(id).delete();
    await get().refreshThoughts();
    await get().refreshTotalThoughtCount();
    if (affectedStackId) await get().cleanupStacks();
    if (get().selectedThoughtId === id) set(() => ({ selectedThoughtId: null, isInspectorOpen: false }));
    if (get().selectedThoughtIds.includes(id)) set(() => ({ selectedThoughtIds: get().selectedThoughtIds.filter((tid: number) => tid !== id) }));
    set((state: CyberiaState) => ({ deletingThoughtIds: state.deletingThoughtIds.filter((tid: number) => tid !== id) }));
    get().pushHistory();
    
    if (authStore.status === 'authenticated') {
      setTimeout(() => syncOrchestrator.triggerSync(), 50);
    }
  },

  deleteThoughts: async (ids: number[]) => {
    if (get().isReadOnly || !ids.length) return;
    const { thoughts, selectedThoughtId, selectedThoughtIds } = get();
    const { useAuthStore } = await import('../useAuthStore');
    const authStore = useAuthStore.getState();
    set((state: CyberiaState) => ({ deletingThoughtIds: [...state.deletingThoughtIds, ...ids] }));
    const affectedStackIds = Array.from(new Set(thoughts.filter((t: Thought) => ids.includes(t.id)).map((t: Thought) => t.stackId).filter(Boolean))) as string[];
    if (authStore.status === 'authenticated') {
      for (const t of thoughts.filter((t: Thought) => ids.includes(t.id))) {
        try { await authStore.deleteServiceContent(t); } catch (e) { console.warn('Delete failed', e); }
      }
    }
    await db.thoughts.bulkDelete(ids);
    await db.blobs.where('thoughtId').anyOf(ids).delete();
    await get().refreshThoughts();
    await get().refreshTotalThoughtCount();
    if (affectedStackIds.length) await get().cleanupStacks();
    if (selectedThoughtId && ids.includes(selectedThoughtId)) set(() => ({ selectedThoughtId: null, isInspectorOpen: false }));
    set(() => ({ selectedThoughtIds: selectedThoughtIds.filter((tid: number) => !ids.includes(tid)) }));
    set((state: CyberiaState) => ({ deletingThoughtIds: state.deletingThoughtIds.filter((tid: number) => !ids.includes(tid)) }));
    get().pushHistory();
    
    if (authStore.status === 'authenticated') {
      await syncOrchestrator.triggerSync();
    }
  },

  bringToFront: async (id: number) => {
    if (get().isReadOnly) return;
    const { thoughts, activeSpaceId } = get();
    if (!activeSpaceId) return;
    const sorted = [...thoughts].sort((a: Thought, b: Thought) => (a.layer || 0) - (b.layer || 0));
    const filtered = sorted.filter((t: Thought) => t.id !== id);
    const target = thoughts.find((t: Thought) => t.id === id);
    if (!target) return;
    filtered.push(target);
    await db.transaction('rw', db.thoughts, async () => {
      await Promise.all(filtered.map((t: Thought, i: number) => db.thoughts.update(t.id, { layer: i + 1 })));
    });
    set(() => ({ layerActionTrigger: { id, time: Date.now() } }));
    await get().refreshThoughts(activeSpaceId);
    
    const { useAuthStore } = await import('../useAuthStore');
    const authStore = useAuthStore.getState();
    if (authStore.status === 'authenticated') {
      await syncOrchestrator.triggerSync();
    }
  },

  sendToBack: async (id: number) => {
    if (get().isReadOnly) return;
    const { thoughts, activeSpaceId } = get();
    if (!activeSpaceId) return;
    const sorted = [...thoughts].sort((a: Thought, b: Thought) => (a.layer || 0) - (b.layer || 0));
    const filtered = sorted.filter((t: Thought) => t.id !== id);
    const target = thoughts.find((t: Thought) => t.id === id);
    if (!target) return;
    filtered.unshift(target);
    await db.transaction('rw', db.thoughts, async () => {
      await Promise.all(filtered.map((t: Thought, i: number) => db.thoughts.update(t.id, { layer: i + 1 })));
    });
    set(() => ({ layerActionTrigger: { id, time: Date.now() } }));
    await get().refreshThoughts(activeSpaceId);
    
    const { useAuthStore } = await import('../useAuthStore');
    const authStore = useAuthStore.getState();
    if (authStore.status === 'authenticated') {
      await syncOrchestrator.triggerSync();
    }
  },

  setSelectedThoughtId: (id: number | null) => set(() => ({ selectedThoughtId: id, selectedThoughtIds: id ? [id] : [] })),
  setSelectedThoughtIds: (ids: number[]) => set(() => ({ selectedThoughtIds: ids, selectedThoughtId: ids.length === 1 ? ids[0] : null, isInspectorOpen: ids.length === 1 && !get().isReadOnly })),
  toggleThoughtSelection: (id: number) => {
    const { selectedThoughtIds, selectedThoughtId } = get();
    const currentIds = [...selectedThoughtIds];
    if (selectedThoughtId && !currentIds.includes(selectedThoughtId)) currentIds.push(selectedThoughtId);
    const newIds = currentIds.includes(id) ? currentIds.filter(tid => tid !== id) : [...currentIds, id];
    set(() => ({ selectedThoughtIds: newIds, selectedThoughtId: newIds.length === 1 ? newIds[0] : null, isInspectorOpen: newIds.length === 1 && !get().isReadOnly }));
  },
  clearSelection: () => set(() => ({ selectedThoughtIds: [], selectedThoughtId: null, isInspectorOpen: false })),

  deleteSelectedThoughts: async () => {
    if (get().isReadOnly || get().isDemo) return;
    const { selectedThoughtIds, thoughts } = get();
    if (selectedThoughtIds.length === 0) return;
    set((state: CyberiaState) => ({ deletingThoughtIds: [...state.deletingThoughtIds, ...selectedThoughtIds] }));
    const { useAuthStore } = await import('../useAuthStore');
    const authStore = useAuthStore.getState();
    const affectedStackIds = Array.from(new Set(thoughts.filter((t: Thought) => selectedThoughtIds.includes(t.id)).map((t: Thought) => t.stackId).filter(Boolean))) as string[];
    if (authStore.status === 'authenticated') {
      for (const t of thoughts.filter((t: Thought) => selectedThoughtIds.includes(t.id))) {
        try { await authStore.deleteServiceContent(t); } catch (e) { console.warn('Delete failed', e); }
      }
    }
    await db.thoughts.bulkDelete(selectedThoughtIds);
    await db.blobs.where('thoughtId').anyOf(selectedThoughtIds).delete();
    await get().refreshThoughts();
    if (affectedStackIds.length > 0) await get().cleanupStacks();
    const deletedIds = [...selectedThoughtIds];
    set(() => ({ selectedThoughtIds: [], selectedThoughtId: null, isInspectorOpen: false }));
    set((state: CyberiaState) => ({ deletingThoughtIds: state.deletingThoughtIds.filter((tid: number) => !deletedIds.includes(tid)) }));
    get().pushHistory();
    
    if (authStore.status === 'authenticated') {
      await syncOrchestrator.triggerSync();
    }
  },

  linkSelectedThoughts: async (name?: string) => {
    if (get().isReadOnly || get().isDemo) return;
    const { selectedThoughtIds, thoughts, activeSpaceId } = get();
    if (selectedThoughtIds.length < 2 || !activeSpaceId) return;
    const thoughtsInSelection = thoughts.filter(t => selectedThoughtIds.includes(t.id));
    const existingStackIds = Array.from(new Set(thoughtsInSelection.map(t => t.stackId).filter(Boolean))) as string[];
    let targetStackId: string;
    
    if (existingStackIds.length > 0) {
      targetStackId = existingStackIds[0];
      await db.transaction('rw', db.thoughts, db.stacks, async () => {
        await db.thoughts.where('id').anyOf(selectedThoughtIds).modify({ stackId: targetStackId });
        if (existingStackIds.length > 1) {
          const otherStackIds = existingStackIds.slice(1);
          await db.thoughts.where('stackId').anyOf(otherStackIds).modify({ stackId: targetStackId });
          await db.stacks.where('id').anyOf(otherStackIds).delete();
        }
        if (name) await db.stacks.update(targetStackId, { name: name.trim() });
      });
    } else {
      targetStackId = 'st-' + Date.now();
      await db.stacks.add({ id: targetStackId, name: name?.trim() || 'Unnamed Stack', color: `hsla(${Math.floor(Math.random() * 360)}, 70%, 50%, 1)`, spaceId: activeSpaceId });
      await db.thoughts.where('id').anyOf(selectedThoughtIds).modify({ stackId: targetStackId });
    }
    await get().refreshThoughts();
    await get().refreshStacks();
    get().pushHistory();
    
    const { useAuthStore } = await import('../useAuthStore');
    const authStore = useAuthStore.getState();
    if (authStore.status === 'authenticated') {
      await (await import('../../services/sync/syncOrchestrator')).syncOrchestrator.triggerSync();
    }
  },

  unlinkSelectedThoughts: async () => {
    if (get().isReadOnly) return;
    const { selectedThoughtIds } = get();
    if (!selectedThoughtIds.length) return;
    await db.thoughts.where('id').anyOf(selectedThoughtIds).modify({ stackId: null });
    await get().cleanupStacks();
    await get().refreshThoughts();
    await get().refreshStacks();
    get().pushHistory();
    
    const { useAuthStore } = await import('../useAuthStore');
    const authStore = useAuthStore.getState();
    if (authStore.status === 'authenticated') {
      await (await import('../../services/sync/syncOrchestrator')).syncOrchestrator.triggerSync();
    }
  },

  setInspectorOpen: (open: boolean) => set(() => ({ isInspectorOpen: open })),
  setActiveFocus: (id: number | null, type: 'text' | 'table' | 'paint' | 'tasks' | 'embed' | 'file' | 'image' | null) => set(() => ({ activeFocusId: id, focusType: type })),
});
