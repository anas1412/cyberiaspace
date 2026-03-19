import { type StateCreator } from 'zustand';
import { db, type Stack } from '../../db';
import { useAuthStore } from '../useAuthStore';
import { syncOrchestrator } from '../../services/sync/syncOrchestrator';
import { type CyberiaState } from '../types';
import { ulid } from 'ulid';

export const createStackSlice: StateCreator<CyberiaState, [], [], any> = (set, get, _api) => ({
  stacks: [],

  refreshStacks: async (spaceId?: string) => {
    const targetId = spaceId || get().activeSpaceId;
    if (!targetId) return;
    
    const currentUserId = useAuthStore.getState().user?.id ?? 'guest';
    const stacks = await db.stacks.filter((s: any) => s.spaceId === targetId && s.userId === currentUserId && !s.deletedAt).toArray();
    
    // Only update if it's still the active space or if we are refreshing for initial load
    if (!spaceId || targetId === get().activeSpaceId) {
      set({ stacks });
    }
  },

  createStack: async (name: string, thoughtId: string) => {
    if (get().isDemo) return;
    const { activeSpaceId, stacks } = get();
    if (!activeSpaceId) return;
    const trimmedName = name?.trim();
    // Only search for existing stacks if a name was explicitly provided
    const existingStack = trimmedName 
      ? stacks.find((s: Stack) => s.name.toLowerCase() === trimmedName.toLowerCase() && s.spaceId === activeSpaceId)
      : null;
    
    const finalName = trimmedName || 'New Collection';
    const authStore = useAuthStore.getState();
    const now = Date.now();
    
    if (existingStack) {
      await db.thoughts.update(thoughtId, { 
        stackId: existingStack.id,
        updatedAt: now,
        syncStatus: 'local'
      });
      await get().refreshThoughts();
      
      if (authStore.status === 'authenticated') {
        await syncOrchestrator.triggerSync();
      }
      return;
    }
    
    const newStackId = ulid();
    const currentUserId = useAuthStore.getState().user?.id ?? 'guest';
    await db.stacks.add({ 
      id: newStackId, 
      userId: currentUserId,
      name: finalName, 
      color: `hsla(${Math.floor(Math.random() * 360)}, 70%, 50%, 1)`, 
      spaceId: activeSpaceId,
      updatedAt: now,
      syncStatus: 'local'
    });
    await db.thoughts.update(thoughtId, { 
      stackId: newStackId,
      updatedAt: now,
      syncStatus: 'local'
    });
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
    
    const now = Date.now();
    await db.stacks.update(id, {
      ...updates,
      updatedAt: now,
      syncStatus: 'local'
    });
    await get().refreshStacks();
    
    const authStore = useAuthStore.getState();
    if (authStore.status === 'authenticated') {
      await syncOrchestrator.triggerSync();
    }
  },

  deleteStack: async (id: string) => {
    if (get().isReadOnly || get().isDemo) return;
    const now = Date.now();
    await db.transaction('rw', db.thoughts, db.stacks, async () => {
      await db.thoughts.where('stackId').equals(id).modify({ 
        stackId: null,
        updatedAt: now,
        syncStatus: 'local'
      });
      await db.stacks.update(id, {
        deletedAt: now,
        updatedAt: now,
        syncStatus: 'local'
      });
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
    let wasModified = false;
    const now = Date.now();
    
    await db.transaction('rw', db.thoughts, db.stacks, async () => {
      const allThoughts = await db.thoughts.where('spaceId').equals(activeSpaceId).toArray();
      const allStacks = await db.stacks.where('spaceId').equals(activeSpaceId).toArray();
      for (const stack of allStacks) {
        if (stack.deletedAt) continue;
        const stackThoughts = allThoughts.filter(t => t.stackId === stack.id && !t.deletedAt);
        if (stackThoughts.length < 2) {
          wasModified = true;
          if (stackThoughts.length === 1) {
            await db.thoughts.update(stackThoughts[0].id, { 
              stackId: null,
              updatedAt: now,
              syncStatus: 'local'
            });
          }
          await db.stacks.update(stack.id, {
            deletedAt: now,
            updatedAt: now,
            syncStatus: 'local'
          });
        }
      }
    });
    await get().refreshThoughts();
    await get().refreshStacks();
    
    if (authStore.status === 'authenticated' && wasModified) {
      await syncOrchestrator.triggerSync();
    }
  },
});
