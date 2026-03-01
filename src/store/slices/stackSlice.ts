import { type StateCreator } from 'zustand';
import { db, type Stack } from '../../db';
import { useAuthStore } from '../useAuthStore';
import { syncOrchestrator } from '../../services/sync/syncOrchestrator';
import { type CyberiaState } from '../types';

export const createStackSlice: StateCreator<CyberiaState, [], [], any> = (set, get, _api) => ({
  stacks: [],

  refreshStacks: async (spaceId?: string) => {
    if (get().isDemo) return;
    const targetId = spaceId || get().activeSpaceId;

    if (!targetId) return;
    const stacks = await db.stacks.where('spaceId').equals(targetId).toArray();
    set({ stacks });
  },

  createStack: async (name: string, thoughtId: number) => {
    if (get().isDemo) return;
    const { activeSpaceId, stacks } = get();
    if (!activeSpaceId) return;
    const trimmedName = name?.trim() || 'Unnamed Stack';
    const existingStack = stacks.find((s: Stack) => s.name.toLowerCase() === trimmedName.toLowerCase() && s.spaceId === activeSpaceId);
    const authStore = useAuthStore.getState();
    
    if (existingStack) {
      await db.thoughts.update(thoughtId, { stackId: existingStack.id });
      await get().refreshThoughts();
      
      if (authStore.status === 'authenticated') {
        await syncOrchestrator.triggerSync();
      }
      return;
    }
    
    const newStackId = 'st-' + Date.now();
    await db.stacks.add({ id: newStackId, name: trimmedName, color: `hsla(${Math.floor(Math.random() * 360)}, 70%, 50%, 1)`, spaceId: activeSpaceId });
    await db.thoughts.update(thoughtId, { stackId: newStackId });
    await get().refreshThoughts();
    await get().refreshStacks();
    get().pushHistory();
    
    if (authStore.status === 'authenticated') {
      await syncOrchestrator.triggerSync();
    }
  },

  updateStack: async (id: string, updates: Partial<Stack>) => {
    const { stacks } = get();
    const index = stacks.findIndex((s: Stack) => s.id === id);
    if (index !== -1) {
      const newStacks = [...stacks];
      newStacks[index] = { ...newStacks[index], ...updates };
      set({ stacks: newStacks });
    }
    if (get().isReadOnly || get().isDemo) return;
    await db.stacks.update(id, updates);
    await get().refreshStacks();
    
    const authStore = useAuthStore.getState();
    if (authStore.status === 'authenticated') {
      await syncOrchestrator.triggerSync();
    }
  },

  deleteStack: async (id: string) => {
    if (get().isReadOnly || get().isDemo) return;
    await db.transaction('rw', db.thoughts, db.stacks, async () => {
      await db.thoughts.where('stackId').equals(id).modify({ stackId: null });
      await db.stacks.delete(id);
    });
    await get().refreshThoughts();
    await get().refreshStacks();
    get().pushHistory();
    
    const authStore = useAuthStore.getState();
    if (authStore.status === 'authenticated') {
      await syncOrchestrator.triggerSync();
    }
  },

  cleanupStacks: async () => {
    const { activeSpaceId } = get();
    if (!activeSpaceId) return;
    const authStore = useAuthStore.getState();
    const unlinkedThoughtIds: number[] = [];
    
    await db.transaction('rw', db.thoughts, db.stacks, async () => {
      const allThoughts = await db.thoughts.where('spaceId').equals(activeSpaceId).toArray();
      const allStacks = await db.stacks.where('spaceId').equals(activeSpaceId).toArray();
      for (const stack of allStacks) {
        const stackThoughts = allThoughts.filter(t => t.stackId === stack.id);
        if (stackThoughts.length < 2) {
          if (stackThoughts.length === 1) {
            unlinkedThoughtIds.push(stackThoughts[0].id);
            await db.thoughts.update(stackThoughts[0].id, { stackId: null });
          }
          await db.stacks.delete(stack.id);
        }
      }
    });
    await get().refreshThoughts();
    await get().refreshStacks();
    
    if (authStore.status === 'authenticated' && unlinkedThoughtIds.length > 0) {
      await syncOrchestrator.triggerSync();
    }
  },
});
