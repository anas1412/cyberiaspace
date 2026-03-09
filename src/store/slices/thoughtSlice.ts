import { type StateCreator } from 'zustand';
import { type CyberiaState } from '../types';
import { db, type Thought } from '../../db';
import { syncOrchestrator } from '../../services/sync/syncOrchestrator';
import { useModalStore } from '../useModalStore';
import { sanitizeDate } from '../../utils/date';
import { ulid } from 'ulid';

export const createThoughtSlice: StateCreator<CyberiaState, [], [], any> = (set, get) => ({
  thoughts: [],
  totalThoughtCount: 0,
  selectedThoughtId: null,
  selectedThoughtIds: [],
  activeFocusId: null,
  focusType: null as 'text' | 'table' | 'paint' | 'tasks' | 'embed' | 'file' | null,
  deletingThoughtIds: [] as string[],

  addThought: async (partialThought: Partial<Thought>) => {
    const { activeSpaceId, totalThoughtCount, isReadOnly } = get();
    if (isReadOnly) return '';
    if (!activeSpaceId) return '';

    if (totalThoughtCount >= 1000) {
      useModalStore.getState().openModal({
        title: 'Workspace Saturation',
        description: 'You have reached the maximum storage capacity for this dimension.',
        type: 'alert',
        confirmText: 'Acknowledged'
      });
      return '';
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

    const thoughtId = ulid();
    const thought = {
      id: thoughtId,
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
      syncStatus: (isBlobType && autoSync && authStatus === 'authenticated') ? 'local' : 'local',
      updatedAt: Date.now(),
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
    return thoughtId;
  },

  updateThought: async (id: string, updates: Partial<Thought>, options?: { skipSync?: boolean }) => {
    const { thoughts, activeSpaceId, isReadOnly } = get();
    const thought = thoughts.find((t: Thought) => t.id === id);
    if (!thought) return;
    const isBlobType = thought.type === 'file' || updates.type === 'file';
    
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
    if (activeSpaceId) get().updateSpace(activeSpaceId, { updatedAt: Date.now() }, options);

    const saveTimers = (window as any)._cyberia_save_timers || {};
    if (saveTimers[id]) clearTimeout(saveTimers[id]);
    saveTimers[id] = setTimeout(async () => {
      const finalUpdates = {
        ...updates,
        updatedAt: Date.now(),
        syncStatus: 'local' as const
      };
      await db.thoughts.update(id, finalUpdates);
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

  updateThoughts: async (ids: string[], updates: Partial<Thought>, options?: { skipSync?: boolean }) => {
    if (get().isReadOnly) return;
    const { thoughts, activeSpaceId } = get();
    if (activeSpaceId) get().updateSpace(activeSpaceId, { updatedAt: Date.now() }, options);

    // Sanitize date if present
    if (updates.date) {
      updates.date = sanitizeDate(updates.date);
    }

    const finalUpdates = {
      ...updates,
      updatedAt: Date.now(),
      syncStatus: 'local' as const
    };

    set({ thoughts: thoughts.map((t: Thought) => ids.includes(t.id) ? { ...t, ...updates } : t) } as Partial<CyberiaState>);
    await db.thoughts.where('id').anyOf(ids).modify(finalUpdates);
    get().pushHistory();
    
    const { useAuthStore } = await import('../useAuthStore');
    const authStore = useAuthStore.getState();
    if (authStore.autoSync && authStore.status === 'authenticated' && !options?.skipSync) {
      await syncOrchestrator.triggerSync();
    }
  },

  bulkUpdateThoughts: async (updates: { id: string; updates: Partial<Thought> }[], options?: { skipSync?: boolean }) => {
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
        const finalUpdates = {
          ...u,
          updatedAt: Date.now(),
          syncStatus: 'local' as const
        };
        await db.thoughts.update(id, finalUpdates);
      }
    });

    if (activeSpaceId) get().updateSpace(activeSpaceId, { updatedAt: Date.now() }, options);
    get().pushHistory();

    const { useAuthStore } = await import('../useAuthStore');
    const authStore = useAuthStore.getState();
    if (authStore.autoSync && authStore.status === 'authenticated' && !options?.skipSync) {
      await syncOrchestrator.triggerSync();
    }
  },

  deleteThought: async (id: string) => {
    if (get().isReadOnly || get().isDemo) return;
    const thought = get().thoughts.find((t: Thought) => t.id === id);
    const affectedStackId = thought?.stackId;
    const { useAuthStore } = await import('../useAuthStore');
    const authStore = useAuthStore.getState();
    
    set((state: CyberiaState) => ({ deletingThoughtIds: [...state.deletingThoughtIds, id] } as Partial<CyberiaState>));
    
    if (thought) {
      await get().updateSpace(thought.spaceId, { updatedAt: Date.now() });
      if (authStore.status === 'authenticated') {
        await authStore.deleteServiceContent(thought);
      }
      
      await db.thoughts.update(id, { 
        deletedAt: Date.now(),
        updatedAt: Date.now(),
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
      set((state: CyberiaState) => ({ selectedThoughtIds: state.selectedThoughtIds.filter((tid: string) => tid !== id) } as Partial<CyberiaState>));
    }
    
    set((state: CyberiaState) => ({ deletingThoughtIds: state.deletingThoughtIds.filter((tid: string) => tid !== id) } as Partial<CyberiaState>));
    get().pushHistory();
    
    if (authStore.status === 'authenticated') {
      setTimeout(() => syncOrchestrator.triggerSync(), 50);
    }
  },

  deleteThoughts: async (ids: string[]) => {
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
      updatedAt: Date.now(),
      storageUrl: undefined,
      storagePath: undefined,
      syncStatus: 'local'
    });

    await get().refreshThoughts();
    await get().refreshTotalThoughtCount();
    if (affectedStackIds.length > 0) await get().cleanupStacks();
    
    set((state: CyberiaState) => ({ 
      selectedThoughtId: ids.includes(state.selectedThoughtId as string) ? null : state.selectedThoughtId,
      selectedThoughtIds: state.selectedThoughtIds.filter((tid: string) => !ids.includes(tid)),
      deletingThoughtIds: state.deletingThoughtIds.filter((tid: string) => !ids.includes(tid))
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

  setActiveFocus: (id: string | null, type: 'text' | 'table' | 'paint' | 'tasks' | 'embed' | 'file' | null) => {
    set({ activeFocusId: id, focusType: type } as Partial<CyberiaState>);
  },

  bringToFront: async (id: string) => {
    const { thoughts } = get();
    const maxLayer = Math.max(...thoughts.map(t => t.layer || 0), 0);
    await get().updateThought(id, { layer: maxLayer + 1 });
    set({ layerActionTrigger: { id, time: Date.now() } } as Partial<CyberiaState>);
  },

  sendToBack: async (id: string) => {
    const { thoughts } = get();
    const minLayer = Math.min(...thoughts.map(t => t.layer || 0), 0);
    await get().updateThought(id, { layer: minLayer - 1 });
    set({ layerActionTrigger: { id, time: Date.now() } } as Partial<CyberiaState>);
  },

  setSelectedThoughtId: (id: string | null) => {
    set({ 
      selectedThoughtId: id,
      selectedThoughtIds: id ? [id] : []
    } as Partial<CyberiaState>);
  },
  
  setSelectedThoughtIds: (ids: string[]) => set({ selectedThoughtIds: ids } as Partial<CyberiaState>),
  
  toggleThoughtSelection: (id: string) => {
    const { selectedThoughtIds } = get();
    let nextIds: string[];
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
    const { selectedThoughtIds, activeSpaceId, thoughts } = get();
    if (selectedThoughtIds.length < 2 || !activeSpaceId) return;

    const selectedThoughts = thoughts.filter(t => selectedThoughtIds.includes(t.id));
    // Find all unique existing stacks among the selected thoughts
    const existingStackIds = Array.from(new Set(selectedThoughts.map(t => t.stackId).filter(Boolean))) as string[];
    
    const { useAuthStore } = await import('../useAuthStore');
    const authStore = useAuthStore.getState();

    let targetStackId: string;

    if (existingStackIds.length > 0) {
      // Logic: Join existing stack. If multiple exist (merging), pick the first one.
      targetStackId = existingStackIds[0];
      
      if (existingStackIds.length > 1) {
        const otherStackIds = existingStackIds.slice(1);
        const now = Date.now();
        // Move all thoughts from other stacks to the primary one
        await db.thoughts.where('stackId').anyOf(otherStackIds).modify({ 
          stackId: targetStackId,
          updatedAt: now,
          syncStatus: 'local'
        });
        // Delete the now empty stacks
        await db.stacks.where('id').anyOf(otherStackIds).modify({
          deletedAt: now,
          updatedAt: now,
          syncStatus: 'local'
        });
      }
    } else {
      // Logic: Create new unique stack
      targetStackId = ulid();
      const trimmedName = name?.trim();
      const finalName = trimmedName || 'New Collection';
      
      await db.stacks.add({ 
        id: targetStackId, 
        name: finalName, 
        color: `hsla(${Math.floor(Math.random() * 360)}, 70%, 50%, 1)`, 
        spaceId: activeSpaceId,
        updatedAt: Date.now(),
        syncStatus: 'local'
      });
    }

    // Assign all selected thoughts to the target stack
    await db.thoughts.where('id').anyOf(selectedThoughtIds).modify({ 
      stackId: targetStackId,
      updatedAt: Date.now(),
      syncStatus: 'local'
    });

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

    await db.thoughts.where('id').anyOf(selectedThoughtIds).modify({ 
      stackId: null,
      updatedAt: Date.now(),
      syncStatus: 'local'
    });
    await get().refreshThoughts();
    
    if (affectedStackIds.length > 0) {
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
