import { type StateCreator } from 'zustand';
import { type CyberiaState } from '../types';
import { db, type Thought } from '../../db';
import { syncOrchestrator } from '../../services/sync/syncOrchestrator';
import { useModalStore } from '../useModalStore';
import { sanitizeDate } from '../../utils/date';



export const createThoughtSlice: StateCreator<CyberiaState, [], [], any> = (set, get) => ({
  thoughts: [],
  totalThoughtCount: 0,
  selectedThoughtId: null,
  selectedThoughtIds: [],
  activeFocusId: null,
  focusType: null as 'text' | 'table' | 'paint' | 'tasks' | 'embed' | 'file' | null,
  deletingThoughtIds: [] as number[],

  addThought: async (partialThought: Partial<Thought>) => {
    const { activeSpaceId, totalThoughtCount, isReadOnly } = get();
    if (isReadOnly) return -1;
    if (!activeSpaceId) return -1;

    if (totalThoughtCount >= 1000) {
      useModalStore.getState().openModal({
        title: 'Workspace Saturation',
        description: 'You have reached the maximum storage capacity for this dimension.',
        type: 'alert',
        confirmText: 'Acknowledged'
      });
      return -1;
    }

    const thoughtType = partialThought.type || 'label';
    
    // Dynamic import to break circular dependency with ThoughtRegistry
    const { getThoughtConfig } = await import('../../components/thought/registry');
    const config = getThoughtConfig(thoughtType);
    const payload = config?.createPayload();

    const isBlobType = partialThought.type === 'file';
    
    // Get autoSync status from AuthStore
    const { useAuthStore } = await import('../useAuthStore');
    const autoSync = useAuthStore.getState().autoSync;

    const authStatus = useAuthStore.getState().status;

    const thought = {
      spaceId: activeSpaceId,
      stackId: null,
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      vx: 0,
      vy: 0,
      text: '',
      description: '',
      type: 'label',
      status: 'none',
      priority: 'none',
      size: 1,
      order: Date.now(),
      layer: 0,
      author: '',
      syncStatus: (isBlobType && autoSync && authStatus === 'authenticated') ? 'pending' : 'local',
      ...partialThought,
      date: partialThought.date ? sanitizeDate(partialThought.date) : '',
      data: partialThought.data || payload
    } as Thought;

    const result = await db.thoughts.add(thought);
    if (result) {
      await get().refreshThoughts();
      await get().refreshTotalThoughtCount();
      get().pushHistory();
      
      const authStore = useAuthStore.getState();
      if (authStore.status === 'authenticated') {
        await syncOrchestrator.triggerSync();
      }
    }
    return result as number;
  },

  updateThought: async (id: number, updates: Partial<Thought>, options?: { skipSync?: boolean }) => {
    const { thoughts, activeSpaceId, isReadOnly } = get();
    const thought = thoughts.find((t: Thought) => t.id === id);
    const isBlobType = thought?.type === 'file' || updates.type === 'file';
    
    // Sanitize date if present
    if (updates.date) {
      updates.date = sanitizeDate(updates.date);
    }

    if (!(Object.keys(updates).length <= 4 && !updates.data) && !isBlobType) {
      if (JSON.stringify(updates).length > 2 * 1024 * 1024) {
        useModalStore.getState().openModal({ title: 'Payload Reached', description: 'Thought > 2MB.', type: 'alert', confirmText: 'Okay' });
        return;
      }
    }

    const index = thoughts.findIndex((t: Thought) => t.id === id);
    if (index !== -1) {
      const newThoughts = [...thoughts];
      newThoughts[index] = { ...newThoughts[index], ...updates };
      set({ thoughts: newThoughts } as Partial<CyberiaState>);
    }

    if (isReadOnly || get().isDemo) return;
    if (activeSpaceId) get().updateSpace(activeSpaceId, { updatedAt: new Date().toISOString() }, options);

    const saveTimers = (window as any)._cyberia_save_timers || {};
    if (saveTimers[id]) clearTimeout(saveTimers[id]);
    saveTimers[id] = setTimeout(async () => {
      await db.thoughts.update(id, updates);
      delete saveTimers[id];
      get().pushHistory();
      
      const { useAuthStore } = await import('../useAuthStore');
      const authStore = useAuthStore.getState();
      if (authStore.status === 'authenticated' && !options?.skipSync) {
        await syncOrchestrator.triggerSync();
      }
    }, 500);
    (window as any)._cyberia_save_timers = saveTimers;
  },

  updateThoughts: async (ids: number[], updates: Partial<Thought>, options?: { skipSync?: boolean }) => {
    if (get().isReadOnly) return;
    const { thoughts, activeSpaceId } = get();
    if (activeSpaceId) get().updateSpace(activeSpaceId, { updatedAt: new Date().toISOString() }, options);

    // Sanitize date if present
    if (updates.date) {
      updates.date = sanitizeDate(updates.date);
    }

    set({ thoughts: thoughts.map((t: Thought) => ids.includes(t.id) ? { ...t, ...updates } : t) } as Partial<CyberiaState>);
    await db.thoughts.where('id').anyOf(ids).modify(updates);
    get().pushHistory();
    
    const { useAuthStore } = await import('../useAuthStore');
    const authStore = useAuthStore.getState();
    if (authStore.autoSync && authStore.status === 'authenticated' && !options?.skipSync) {
      await syncOrchestrator.triggerSync();
    }
  },

  bulkUpdateThoughts: async (updates: { id: number; updates: Partial<Thought> }[], options?: { skipSync?: boolean }) => {
    if (get().isReadOnly || !updates.length) return;
    const { thoughts, activeSpaceId } = get();

    // 1. Store Update (One set() call)
    const updateMap = new Map(updates.map(u => [u.id, u.updates]));
    const nextThoughts = thoughts.map(t => {
      const u = updateMap.get(t.id);
      return u ? { ...t, ...u } : t;
    });
    set({ thoughts: nextThoughts } as Partial<CyberiaState>);

    // 2. Dexie Transaction
    await db.transaction('rw', db.thoughts, async () => {
      for (const { id, updates: u } of updates) {
        // Sanitize date if present
        if (u.date) {
          u.date = sanitizeDate(u.date);
        }
        await db.thoughts.update(id, u);
      }
    });

    if (activeSpaceId) get().updateSpace(activeSpaceId, { updatedAt: new Date().toISOString() }, options);
    get().pushHistory();

    const { useAuthStore } = await import('../useAuthStore');
    const authStore = useAuthStore.getState();
    if (authStore.autoSync && authStore.status === 'authenticated' && !options?.skipSync) {
      await syncOrchestrator.triggerSync();
    }
  },

  deleteThought: async (id: number) => {
    if (get().isReadOnly || get().isDemo) return;
    const thought = get().thoughts.find((t: Thought) => t.id === id);
    const affectedStackId = thought?.stackId;
    const { useAuthStore } = await import('../useAuthStore');
    const authStore = useAuthStore.getState();
    
    set((state: CyberiaState) => ({ deletingThoughtIds: [...state.deletingThoughtIds, id] } as Partial<CyberiaState>));
    
    if (thought) {
      await get().updateSpace(thought.spaceId, { updatedAt: new Date().toISOString() });
      if (authStore.status === 'authenticated') {
        await authStore.deleteServiceContent(thought);
      }
      
      await db.thoughts.update(id, { 
        deletedAt: Date.now(),
        storageUrl: undefined,
        storagePath: undefined,
        syncStatus: 'local'
      });
    }

    await get().refreshThoughts();
    await get().refreshTotalThoughtCount();
    if (affectedStackId) await get().cleanupStacks();
    
    if (get().selectedThoughtId === id) {
      set({ selectedThoughtId: null, isInspectorOpen: false } as Partial<CyberiaState>);
    }
    
    if (get().selectedThoughtIds.includes(id)) {
      set((state: CyberiaState) => ({ selectedThoughtIds: state.selectedThoughtIds.filter((tid: number) => tid !== id) } as Partial<CyberiaState>));
    }
    
    set((state: CyberiaState) => ({ deletingThoughtIds: state.deletingThoughtIds.filter((tid: number) => tid !== id) } as Partial<CyberiaState>));
    get().pushHistory();
    
    if (authStore.status === 'authenticated') {
      setTimeout(() => syncOrchestrator.triggerSync(), 50);
    }
  },

  deleteThoughts: async (ids: number[]) => {
    if (get().isReadOnly || !ids.length) return;
    const { thoughts } = get();
    const { useAuthStore } = await import('../useAuthStore');
    const authStore = useAuthStore.getState();
    
    set((state: CyberiaState) => ({ deletingThoughtIds: [...state.deletingThoughtIds, ...ids] } as Partial<CyberiaState>));
    
    const affectedStackIds = Array.from(new Set(thoughts.filter((t: Thought) => ids.includes(t.id)).map((t: Thought) => t.stackId).filter(Boolean))) as string[];
    
    if (authStore.status === 'authenticated') {
      for (const t of thoughts.filter((t: Thought) => ids.includes(t.id))) {
        try { await authStore.deleteServiceContent(t); } catch (e) { console.warn('Delete failed', e); }
      }
    }

    await db.thoughts.where('id').anyOf(ids).modify({ 
      deletedAt: Date.now(),
      storageUrl: undefined,
      storagePath: undefined,
      syncStatus: 'local'
    });

    await get().refreshThoughts();
    await get().refreshTotalThoughtCount();
    if (affectedStackIds.length > 0) await get().cleanupStacks();
    
    set((state: CyberiaState) => ({ 
      selectedThoughtId: ids.includes(state.selectedThoughtId as number) ? null : state.selectedThoughtId,
      selectedThoughtIds: state.selectedThoughtIds.filter((tid: number) => !ids.includes(tid)),
      deletingThoughtIds: state.deletingThoughtIds.filter((tid: number) => !ids.includes(tid))
    } as Partial<CyberiaState>));
    
    get().pushHistory();
    
    if (authStore.status === 'authenticated') {
      setTimeout(() => syncOrchestrator.triggerSync(), 50);
    }
  },

  refreshThoughts: async (spaceId?: string) => {
    const targetId = spaceId || get().activeSpaceId;
    if (!targetId) return;
    const thoughts = await db.thoughts
      .where('spaceId')
      .equals(targetId)
      .and(t => !t.deletedAt)
      .toArray();
    
    // Only update if it's still the active space or if we are refreshing for initial load
    if (!spaceId || targetId === get().activeSpaceId) {
      set({ thoughts: thoughts.sort((a, b) => (a.order || 0) - (b.order || 0)) } as Partial<CyberiaState>);
    }
  },

  refreshTotalThoughtCount: async () => {
    const count = await db.thoughts.filter(t => !t.deletedAt).count();
    set({ totalThoughtCount: count } as Partial<CyberiaState>);
  },

  setActiveFocus: (id: number | null, type: 'text' | 'table' | 'paint' | 'tasks' | 'embed' | 'file' | null) => {
    set({ activeFocusId: id, focusType: type } as Partial<CyberiaState>);
  },

  bringToFront: async (id: number) => {
    const { thoughts } = get();
    const maxLayer = Math.max(...thoughts.map(t => t.layer || 0), 0);
    await get().updateThought(id, { layer: maxLayer + 1 });
    set({ layerActionTrigger: { id, time: Date.now() } } as Partial<CyberiaState>);
  },

  sendToBack: async (id: number) => {
    const { thoughts } = get();
    const minLayer = Math.min(...thoughts.map(t => t.layer || 0), 0);
    await get().updateThought(id, { layer: minLayer - 1 });
    set({ layerActionTrigger: { id, time: Date.now() } } as Partial<CyberiaState>);
  },

  setSelectedThoughtId: (id: number | null) => {
    set({ 
      selectedThoughtId: id,
      selectedThoughtIds: id ? [id] : []
    } as Partial<CyberiaState>);
  },
  
  setSelectedThoughtIds: (ids: number[]) => set({ selectedThoughtIds: ids } as Partial<CyberiaState>),
  
  toggleThoughtSelection: (id: number) => {
    const { selectedThoughtIds } = get();
    let nextIds: number[];
    if (selectedThoughtIds.includes(id)) {
      nextIds = selectedThoughtIds.filter(tid => tid !== id);
    } else {
      nextIds = [...selectedThoughtIds, id];
    }
    
    set({ 
      selectedThoughtIds: nextIds,
      selectedThoughtId: nextIds.length === 1 ? nextIds[0] : null
    } as Partial<CyberiaState>);
  },

  clearSelection: () => set({ selectedThoughtId: null, selectedThoughtIds: [] } as Partial<CyberiaState>),

  deleteSelectedThoughts: async () => {
    const { selectedThoughtIds } = get();
    if (selectedThoughtIds.length === 0) return;
    await get().deleteThoughts(selectedThoughtIds);
    get().clearSelection();
  },

  linkSelectedThoughts: async (name?: string) => {
    const { selectedThoughtIds, activeSpaceId, stacks } = get();
    if (selectedThoughtIds.length < 2 || !activeSpaceId) return;

    const trimmedName = name?.trim() || 'New Collection';
    const existingStack = stacks.find((s: any) => s.name.toLowerCase() === trimmedName.toLowerCase() && s.spaceId === activeSpaceId);
    
    const { useAuthStore } = await import('../useAuthStore');
    const authStore = useAuthStore.getState();

    let targetStackId: string;

    if (existingStack) {
      targetStackId = existingStack.id;
    } else {
      targetStackId = String(Date.now());
      await db.stacks.add({ 
        id: targetStackId, 
        name: trimmedName, 
        color: `hsla(${Math.floor(Math.random() * 360)}, 70%, 50%, 1)`, 
        spaceId: activeSpaceId 
      });
    }

    await db.thoughts.where('id').anyOf(selectedThoughtIds).modify({ stackId: targetStackId });
    await get().refreshThoughts();
    await get().refreshStacks();
    get().pushHistory();

    if (authStore.status === 'authenticated') {
      await syncOrchestrator.triggerSync();
    }
  },

  unlinkSelectedThoughts: async () => {
    const { selectedThoughtIds } = get();
    if (selectedThoughtIds.length === 0) return;

    const thoughtsToUnlink = get().thoughts.filter(t => selectedThoughtIds.includes(t.id));
    const affectedStackIds = Array.from(new Set(thoughtsToUnlink.map(t => t.stackId).filter(Boolean))) as string[];

    await db.thoughts.where('id').anyOf(selectedThoughtIds).modify({ stackId: null });
    await get().refreshThoughts();
    
    for (const _sid of affectedStackIds) {
      await get().cleanupStacks();
    }

    get().pushHistory();
    
    const { useAuthStore } = await import('../useAuthStore');
    const authStore = useAuthStore.getState();
    if (authStore.status === 'authenticated') {
      await syncOrchestrator.triggerSync();
    }
  }
});
