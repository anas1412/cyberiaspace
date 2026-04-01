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
    const { activeSpaceId, stacks, thoughts } = get();
    if (!activeSpaceId) return;
    const trimmedName = name?.trim();
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
      set({
        thoughts: thoughts.map(t => 
          t.id === thoughtId ? { ...t, stackId: existingStack.id, updatedAt: now, syncStatus: 'local' as const } : t
        )
      });
      await db.thoughts.update(thoughtId, { 
        stackId: existingStack.id,
        updatedAt: now,
        syncStatus: 'local'
      });
      if (authStore.status === 'authenticated') {
        await syncOrchestrator.triggerSync();
      }
      return;
    }
    
    const newStackId = ulid();
    const currentUserId = useAuthStore.getState().user?.id ?? 'guest';
    const isGuest = currentUserId === 'guest';
    
    const newStack: Stack = { 
      id: newStackId, 
      userId: currentUserId,
      name: finalName, 
      color: `hsla(${Math.floor(Math.random() * 360)}, 70%, 50%, 1)`, 
      spaceId: activeSpaceId,
      updatedAt: now,
      syncStatus: isGuest ? undefined : 'local'
    };
    
    set({
      thoughts: thoughts.map(t => 
        t.id === thoughtId ? { ...t, stackId: newStackId, updatedAt: now, syncStatus: isGuest ? undefined : 'local' as const } : t
      ),
      stacks: [...stacks, newStack]
    });
    
    await db.stacks.add(newStack);
    await db.thoughts.update(thoughtId, { 
      stackId: newStackId,
      updatedAt: now,
      syncStatus: isGuest ? undefined : 'local'
    });
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
    const freshThoughts = get().thoughts;
    const freshStacks = get().stacks;
    
    set({
      thoughts: freshThoughts.map(t => 
        t.stackId === id ? { ...t, stackId: null, updatedAt: now, syncStatus: 'local' as const } : t
      ),
      stacks: freshStacks.map(s => 
        s.id === id ? { ...s, deletedAt: now, updatedAt: now, syncStatus: 'local' as const } : s
      )
    });
    
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
    
    get().pushHistory();
    
    const authStore = useAuthStore.getState();
    if (authStore.status === 'authenticated') {
      await syncOrchestrator.triggerSync();
    }
  },

  cleanupStacks: async () => {
    const { activeSpaceId } = get();
    if (!activeSpaceId) return;
    
    const freshThoughts = get().thoughts;
    const freshStacks = get().stacks;
    const authStore = useAuthStore.getState();
    const now = Date.now();
    
    const thoughtsToUnlink: string[] = [];
    const stacksToDelete: string[] = [];
    
    for (const stack of freshStacks) {
      if (stack.deletedAt || stack.spaceId !== activeSpaceId) continue;
      const stackThoughts = freshThoughts.filter(t => t.stackId === stack.id && !t.deletedAt);
      if (stackThoughts.length < 2) {
        stacksToDelete.push(stack.id);
        if (stackThoughts.length === 1) {
          thoughtsToUnlink.push(stackThoughts[0].id);
        }
      }
    }
    
    if (stacksToDelete.length === 0) return;
    
    set({
      thoughts: freshThoughts.map(t => 
        thoughtsToUnlink.includes(t.id) 
          ? { ...t, stackId: null, updatedAt: now, syncStatus: 'local' as const }
          : t
      ),
      stacks: freshStacks.map(s => 
        stacksToDelete.includes(s.id)
          ? { ...s, deletedAt: now, updatedAt: now, syncStatus: 'local' as const }
          : s
      )
    });
    
    await db.transaction('rw', [db.thoughts, db.stacks], async () => {
      if (thoughtsToUnlink.length > 0) {
        await db.thoughts.where('id').anyOf(thoughtsToUnlink).modify({
          stackId: null,
          updatedAt: now,
          syncStatus: 'local'
        });
      }
      if (stacksToDelete.length > 0) {
        await db.stacks.where('id').anyOf(stacksToDelete).modify({
          deletedAt: now,
          updatedAt: now,
          syncStatus: 'local'
        });
      }
    });
    
    if (authStore.status === 'authenticated') {
      await syncOrchestrator.triggerSync();
    }
  },
});
