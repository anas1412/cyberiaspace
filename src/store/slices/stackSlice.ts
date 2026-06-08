import { type StateCreator } from 'zustand';
import { db, type Stack } from '../../db';
import { useModalStore } from '../useModalStore';
import { type CyberiaState } from '../types';
import { ulid } from 'ulid';
import { MAX_THOUGHTS_PER_STACK } from '../../constants';
export { MAX_THOUGHTS_PER_STACK };

/**
 * Check if adding thoughts to a stack would exceed the limit.
 */
export async function checkStackLimit(
  stackId: string,
  additionalCount = 1
): Promise<{ allowed: boolean; currentCount: number }> {
  const count = await db.thoughts
    .filter((t: any) => t.stackId === stackId && !t.deletedAt && !t.archivedAt)
    .count();

  return {
    allowed: count + additionalCount <= MAX_THOUGHTS_PER_STACK,
    currentCount: count,
  };
}

/**
 * Show a modal when stack limit is reached.
 */
export function showStackLimitModal(stackName?: string): void {
  useModalStore.getState().openModal({
    title: 'Collection Full',
    description: stackName
      ? `"${stackName}" already has the maximum of ${MAX_THOUGHTS_PER_STACK} thoughts.`
      : `A collection can only hold ${MAX_THOUGHTS_PER_STACK} thoughts.`,
    type: 'alert',
    confirmText: 'OK',
  });
}

export const createStackSlice: StateCreator<CyberiaState, [], [], any> = (set, get, _api) => ({
  stacks: [],

  refreshStacks: async (spaceId?: string) => {
    const targetId = spaceId || get().activeSpaceId;
    if (!targetId) return;

    const stacks = await db.stacks.filter((s: any) => s.spaceId === targetId && !s.deletedAt).toArray();

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
    const now = Date.now();

    if (existingStack) {
      const { allowed } = await checkStackLimit(existingStack.id);
      if (!allowed) {
        showStackLimitModal(existingStack.name);
        return;
      }
      set({
        thoughts: thoughts.map(t =>
          t.id === thoughtId ? { ...t, stackId: existingStack.id, updatedAt: now } : t
        )
      });
      await db.thoughts.update(thoughtId, {
        stackId: existingStack.id,
        updatedAt: now,
      });
      return;
    }

    const newStackId = ulid();

    const newStack: Stack = {
      id: newStackId,
      name: finalName,
      color: `hsla(${Math.floor(Math.random() * 360)}, 70%, 50%, 1)`,
      spaceId: activeSpaceId,
      updatedAt: now,
    };

    set({
      thoughts: thoughts.map(t =>
        t.id === thoughtId ? { ...t, stackId: newStackId, updatedAt: now } : t
      ),
      stacks: [...stacks, newStack]
    });

    await db.stacks.add(newStack);
    await db.thoughts.update(thoughtId, {
      stackId: newStackId,
      updatedAt: now,
    });
    get().pushHistory();
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
    });
    await get().refreshStacks();
  },

  deleteStack: async (id: string) => {
    if (get().isReadOnly || get().isDemo) return;
    const now = Date.now();
    const freshThoughts = get().thoughts;
    const freshStacks = get().stacks;

    set({
      thoughts: freshThoughts.map(t =>
        t.stackId === id ? { ...t, stackId: null, updatedAt: now } : t
      ),
      stacks: freshStacks.map(s =>
        s.id === id ? { ...s, deletedAt: now, updatedAt: now } : s
      )
    });

    await db.transaction('rw', db.thoughts, db.stacks, async () => {
      await db.thoughts.where('stackId').equals(id).modify({
        stackId: null,
        updatedAt: now,
      });
      await db.stacks.update(id, {
        deletedAt: now,
        updatedAt: now,
      });
    });

    get().pushHistory();
  },

  deleteStackWithThoughts: async (id: string) => {
    if (get().isReadOnly || get().isDemo) return;
    const now = Date.now();
    const freshThoughts = get().thoughts;
    const freshStacks = get().stacks;

    set({
      thoughts: freshThoughts.map(t =>
        t.stackId === id ? { ...t, deletedAt: now, updatedAt: now } : t
      ),
      stacks: freshStacks.map(s =>
        s.id === id ? { ...s, deletedAt: now, updatedAt: now } : s
      )
    });

    await db.transaction('rw', db.thoughts, db.stacks, async () => {
      await db.thoughts.where('stackId').equals(id).modify({
        deletedAt: now,
        updatedAt: now,
      });
      await db.stacks.update(id, {
        deletedAt: now,
        updatedAt: now,
      });
    });

    get().pushHistory();
  },

  cleanupStacks: async () => {
    const { activeSpaceId } = get();
    if (!activeSpaceId) return;

    const freshThoughts = get().thoughts;
    const freshStacks = get().stacks;
    const now = Date.now();

    const thoughtsToUnlink: string[] = [];
    const stacksToDelete: string[] = [];

    for (const stack of freshStacks) {
      if (stack.deletedAt || stack.spaceId !== activeSpaceId) continue;

      const stackThoughts = freshThoughts.filter(t =>
        t.stackId === stack.id && !t.deletedAt && !t.archivedAt
      );

      if (stackThoughts.length < 2) {
        stacksToDelete.push(stack.id);

        if (stackThoughts.length === 1) {
          thoughtsToUnlink.push(stackThoughts[0].id);
        }
      }
    }

    if (stacksToDelete.length === 0) return;

    const updatedThoughts = freshThoughts.map(t =>
      thoughtsToUnlink.includes(t.id)
        ? { ...t, stackId: null, updatedAt: now }
        : t
    );

    const updatedStacks = freshStacks.map(s =>
      stacksToDelete.includes(s.id)
        ? { ...s, deletedAt: now, updatedAt: now }
        : s
    );

    set({ thoughts: updatedThoughts, stacks: updatedStacks });

    await db.transaction('rw', [db.thoughts, db.stacks], async () => {
      if (thoughtsToUnlink.length > 0) {
        await db.thoughts.where('id').anyOf(thoughtsToUnlink).modify({
          stackId: null,
          updatedAt: now,
        });
      }
      if (stacksToDelete.length > 0) {
        await db.stacks.where('id').anyOf(stacksToDelete).modify({
          deletedAt: now,
          updatedAt: now,
        });
      }
    });
  },
});
