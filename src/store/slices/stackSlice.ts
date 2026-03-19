import { type StateCreator } from 'zustand';
import { db, type Stack } from '../../db';
import { useAuthStore } from '../useAuthStore';
import { useModalStore } from '../useModalStore';
import { syncOrchestrator } from '../../services/sync/syncOrchestrator';
import { type CyberiaState } from '../types';
import { ulid } from 'ulid';
import { MAX_THOUGHTS_PER_STACK } from '../../constants';

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
      const currentUserId = useAuthStore.getState().user?.id ?? 'guest';
      const count = await db.thoughts.filter((t: any) => t.stackId === existingStack.id && !t.deletedAt && t.userId === currentUserId).count();
      if (count >= MAX_THOUGHTS_PER_STACK) {
        useModalStore.getState().openModal({
          title: 'Stack Limit Reached',
          description: `A stack can only hold ${MAX_THOUGHTS_PER_STACK} thoughts.`,
          type: 'alert',
          confirmText: 'OK',
        });
        return;
      }
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
    const currentUserId = useAuthStore.getState().user?.id ?? 'guest';
    await db.transaction('rw', db.thoughts, db.stacks, async () => {
      await db.thoughts.where('stackId').equals(id).and(t => t.userId === currentUserId).modify({ 
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
    const currentUserId = authStore.user?.id ?? 'guest';
    let wasModified = false;
    const now = Date.now();
    
    await db.transaction('rw', db.thoughts, db.stacks, async () => {
      const allThoughts = await db.thoughts.filter(t => t.spaceId === activeSpaceId && t.userId === currentUserId && !t.deletedAt).toArray();
      const allStacks = await db.stacks.filter(s => s.spaceId === activeSpaceId && s.userId === currentUserId && !s.deletedAt).toArray();
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
