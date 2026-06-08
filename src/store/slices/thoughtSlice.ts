import { type StateCreator } from 'zustand';
import { type CyberiaState } from '../types';
import { db, type Thought, type Stack, TYPE_BASE_LAYERS } from '../../db';
import { useModalStore } from '../useModalStore';
import { sanitizeStatus, sanitizePriority } from '../../utils/thought';
import { ulid } from 'ulid';
import { getThoughtConfig } from '../../components/thought/registry';
import { checkStackLimit, showStackLimitModal, MAX_THOUGHTS_PER_STACK } from './stackSlice';

export const createThoughtSlice: StateCreator<CyberiaState, [], [], any> = (set, get) => ({
  thoughts: [],
  totalThoughtCount: 0,
  selectedThoughtId: null,
  selectedThoughtIds: [],
  activeFocusId: null,
  focusType: null as 'text' | 'table' | 'paint' | 'tasks' | 'embed' | 'file' | null,
  deletingThoughtIds: [] as string[],
  isDraggingThought: false,
  setDraggingThought: (isDragging: boolean) => set({ isDraggingThought: isDragging }),
  isOverDeleteZone: false,
  setOverDeleteZone: (isOver: boolean) => set({ isOverDeleteZone: isOver }),

  addThought: async (partialThought: Partial<Thought>) => {
    const { activeSpaceId, isReadOnly, transform } = get();
    if (isReadOnly) return '';
    if (!activeSpaceId) return '';

    const thoughtType = partialThought.type || 'label';

    // Get config and payload for thought type
    const config = getThoughtConfig(thoughtType);
    const payload = config?.createPayload();

    const userId = 'guest';
    const thoughtId = ulid();
    const thought = {
      id: thoughtId,
      spaceId: activeSpaceId,
      userId: userId,
      stackId: null,
      // Place new thoughts at the center of the viewport in world coordinates
      x: (window.innerWidth / 2 - transform.x) / transform.scale + (Math.random() - 0.5) * 60,
      y: (window.innerHeight / 2 - transform.y) / transform.scale + (Math.random() - 0.5) * 60,
      vx: 0,
      vy: 0,
      text: '',
      description: '',
      type: 'label',
      status: sanitizeStatus(partialThought.status || 'none'),
      priority: sanitizePriority(partialThought.priority || 'none'),
      size: 1,
      order: Date.now(),
      layer: TYPE_BASE_LAYERS[thoughtType] ?? 0,
      author: '',
      updatedAt: Date.now(),
      startTime: partialThought.startTime ?? null,
      endTime: partialThought.endTime ?? partialThought.startTime ?? null,
      isAllDay: partialThought.isAllDay ?? true,
      reminders: partialThought.reminders ?? [],
      recurrenceRule: partialThought.recurrenceRule ?? null,
      location: partialThought.location ?? null,
      ...partialThought,
      data: partialThought.data || payload
    } as Thought;

    // Ensure nested values win if they were explicitly provided in partialThought
    thought.status = sanitizeStatus(thought.status);
    thought.priority = sanitizePriority(thought.priority);

    const result = await db.thoughts.add(thought);
    if (result) {
      await get().refreshThoughts();
      await get().refreshTotalThoughtCount();
      get().pushHistory();
    }
    return thoughtId;
  },

  addThoughts: async (partialThoughts: Partial<Thought>[]) => {
    const { activeSpaceId, isReadOnly, transform } = get();
    if (isReadOnly || !activeSpaceId || !partialThoughts.length) return [];

    const userId = 'guest';
    const newThoughtIds: string[] = [];
    const thoughtsToAdd: Thought[] = [];

    for (let i = 0; i < partialThoughts.length; i++) {
      const partial = partialThoughts[i];
      const thoughtId = ulid();
      newThoughtIds.push(thoughtId);

      const thoughtType = partial.type || 'label';
      const config = getThoughtConfig(thoughtType);
      const payload = config?.createPayload();

      const jitterX = partialThoughts.length > 1 ? (Math.random() - 0.5) * 20 : 0;
      const jitterY = partialThoughts.length > 1 ? (Math.random() - 0.5) * 20 : 0;

      const thought = {
        id: thoughtId,
        spaceId: activeSpaceId,
        userId,
        stackId: null,
        x: (window.innerWidth / 2 - transform.x) / transform.scale + jitterX,
        y: (window.innerHeight / 2 - transform.y) / transform.scale + jitterY,
        vx: 0,
        vy: 0,
        text: '',
        description: '',
        type: 'label',
        status: sanitizeStatus(partial.status || 'none'),
        priority: sanitizePriority(partial.priority || 'none'),
        size: 1,
        order: Date.now() + i,
        layer: TYPE_BASE_LAYERS[thoughtType] ?? 0,
        author: '',
        updatedAt: Date.now(),
        startTime: partial.startTime ?? null,
        endTime: partial.endTime ?? partial.startTime ?? null,
        isAllDay: partial.isAllDay ?? true,
        reminders: partial.reminders ?? [],
        recurrenceRule: partial.recurrenceRule ?? null,
        location: partial.location ?? null,
        ...partial,
        data: partial.data || payload
      } as Thought;

      thought.status = sanitizeStatus(thought.status);
      thought.priority = sanitizePriority(thought.priority);

      thoughtsToAdd.push(thought);
    }

    await db.transaction('rw', db.thoughts, async () => {
      await db.thoughts.bulkAdd(thoughtsToAdd);
    });

    await get().refreshThoughts();
    await get().refreshTotalThoughtCount();
    get().pushHistory();

    return newThoughtIds;
  },

  updateThought: async (id: string, updates: Partial<Thought>) => {
    const { thoughts, activeSpaceId, isReadOnly } = get();
    const thought = thoughts.find((t: Thought) => t.id === id);
    if (!thought) return;
    const isBlobType = thought.type === 'file' || updates.type === 'file';

    if (updates.status) updates.status = sanitizeStatus(updates.status);
    if (updates.priority) updates.priority = sanitizePriority(updates.priority);

    if (updates.type && updates.type !== thought.type) {
      updates.layer = TYPE_BASE_LAYERS[updates.type] ?? 0;
    }

    if (!(Object.keys(updates).length <= 4 && !updates.data) && !isBlobType) {
      if (JSON.stringify(updates).length > 2 * 1024 * 1024) {
        useModalStore.getState().openModal({ title: 'Payload Reached', description: 'Thought > 2MB.', type: 'alert', confirmText: 'Okay' });
        return;
      }
    }

    // Check stack limit when moving a thought to a stack
    if (updates.stackId != null && updates.stackId !== thought.stackId) {
      const { stacks } = get();
      const targetStack = stacks.find((s: Stack) => s.id === updates.stackId);
      const { allowed } = await checkStackLimit(updates.stackId);
      if (!allowed) {
        showStackLimitModal(targetStack?.name);
        return;
      }
    }

    const index = thoughts.findIndex((t: Thought) => t.id === id);
    if (index !== -1) {
      const newThoughts = [...thoughts];
      newThoughts[index] = {
        ...newThoughts[index],
        ...updates,
        updatedAt: Date.now(),
      };
      set({ thoughts: newThoughts } as Partial<CyberiaState>);
    }

    if (isReadOnly || get().isDemo) return;
    if (activeSpaceId) get().updateSpace(activeSpaceId, { updatedAt: Date.now() });

    // Push undo history for non-position changes (ignore drag movement)
    const POSITION_FIELDS = new Set(['x', 'y', 'vx', 'vy']);
    if (Object.keys(updates).some(k => !POSITION_FIELDS.has(k))) {
      get().pushHistory();
    }

    const saveTimers = (window as any)._cyberia_save_timers || {};
    if (saveTimers[id]) clearTimeout(saveTimers[id]);
    saveTimers[id] = setTimeout(async () => {
      const thoughtToSave = get().thoughts.find((t: Thought) => t.id === id);
      if (thoughtToSave) {
        await db.thoughts.put(thoughtToSave);
      }
    }, 500);
    (window as any)._cyberia_save_timers = saveTimers;
  },

  updateThoughts: async (ids: string[], updates: Partial<Thought>) => {
    if (get().isReadOnly) return;
    const { thoughts, activeSpaceId, stacks } = get();
    if (activeSpaceId) get().updateSpace(activeSpaceId, { updatedAt: Date.now() });

    if (updates.status) updates.status = sanitizeStatus(updates.status);
    if (updates.priority) updates.priority = sanitizePriority(updates.priority);

    if (updates.type) {
      updates.layer = TYPE_BASE_LAYERS[updates.type] ?? 0;
    }

    // Check stack limit when moving multiple thoughts to a stack
    if (updates.stackId != null) {
      const targetStack = stacks.find((s: Stack) => s.id === updates.stackId);
      const additionalCount = thoughts.filter(
        (t: Thought) => ids.includes(t.id) && t.stackId !== updates.stackId
      ).length;
      if (additionalCount > 0) {
        const { allowed } = await checkStackLimit(updates.stackId, additionalCount);
        if (!allowed) {
          showStackLimitModal(targetStack?.name);
          return;
        }
      }
    }

    const finalUpdates = {
      ...updates,
      updatedAt: Date.now(),
    };

    set({ thoughts: thoughts.map((t: Thought) => ids.includes(t.id) ? { ...t, ...updates } : t) } as Partial<CyberiaState>);

    await db.thoughts.where('id').anyOf(ids).modify(finalUpdates);

    get().pushHistory();
  },

  bulkUpdateThoughts: async (updates: { id: string; updates: Partial<Thought> }[]) => {
    if (get().isReadOnly || !updates.length) return;
    const { thoughts, activeSpaceId } = get();

    const updateMap = new Map(updates.map(u => [u.id, u.updates]));
    const nextThoughts = thoughts.map(t => {
      const u = updateMap.get(t.id);
      return u ? { ...t, ...u } : t;
    });
    set({ thoughts: nextThoughts } as Partial<CyberiaState>);

    await db.transaction('rw', db.thoughts, async () => {
      for (const { id, updates: u } of updates) {
        if (u.status) u.status = sanitizeStatus(u.status);
        if (u.priority) u.priority = sanitizePriority(u.priority);
        await db.thoughts.update(id, {
          ...u,
          updatedAt: Date.now(),
        });
      }
    });

    if (activeSpaceId) get().updateSpace(activeSpaceId, { updatedAt: Date.now() });
    get().pushHistory();
  },

  patchThought: (id: string, updates: Partial<Thought>) => {
    const { thoughts } = get();
    const index = thoughts.findIndex(t => t.id === id);
    if (index !== -1) {
      const nextThoughts = [...thoughts];
      nextThoughts[index] = { ...nextThoughts[index], ...updates };
      set({ thoughts: nextThoughts });
    }
  },

  deleteThought: async (id: string) => {
    if (get().isReadOnly) return;
    const thought = get().thoughts.find((t: Thought) => t.id === id);
    const affectedStackId = thought?.stackId;

    set((state: CyberiaState) => ({ deletingThoughtIds: [...state.deletingThoughtIds, id] } as Partial<CyberiaState>));

    if (thought) {
      await get().updateSpace(thought.spaceId, { updatedAt: Date.now() });

      await db.thoughts.update(id, {
        deletedAt: Date.now(),
        updatedAt: Date.now(),
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
  },

  deleteThoughts: async (ids: string[]) => {
    if (get().isReadOnly || !ids.length) return;
    const { thoughts } = get();

    set((state: CyberiaState) => ({ deletingThoughtIds: [...state.deletingThoughtIds, ...ids] } as Partial<CyberiaState>));

    const affectedStackIds = Array.from(new Set(thoughts.filter((t: Thought) => ids.includes(t.id)).map((t: Thought) => t.stackId).filter(Boolean))) as string[];

    await db.thoughts.where('id').anyOf(ids).modify({
      deletedAt: Date.now(),
      updatedAt: Date.now(),
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
  },

  archiveThought: async (id: string) => {
    if (get().isReadOnly) return;
    const thought = get().thoughts.find((t: Thought) => t.id === id);
    const affectedStackId = thought?.stackId;

    set((state: CyberiaState) => ({
      thoughts: state.thoughts.map(t => t.id === id ? { ...t, archivedAt: Date.now(), updatedAt: Date.now() } : t)
    } as Partial<CyberiaState>));

    await db.thoughts.update(id, {
      archivedAt: Date.now(),
      updatedAt: Date.now(),
    });

    await get().refreshTotalThoughtCount();
    if (affectedStackId) await get().cleanupStacks();

    if (get().selectedThoughtId === id) {
      set({ selectedThoughtId: null, isInspectorOpen: false } as Partial<CyberiaState>);
    }
    if (get().selectedThoughtIds.includes(id)) {
      set((state: CyberiaState) => ({ selectedThoughtIds: state.selectedThoughtIds.filter((tid: string) => tid !== id) } as Partial<CyberiaState>));
    }

    get().pushHistory();
  },

  archiveThoughts: async (ids: string[]) => {
    if (get().isReadOnly || !ids.length) return;
    const { thoughts } = get();

    const affectedStackIds = Array.from(new Set(thoughts.filter((t: Thought) => ids.includes(t.id)).map((t: Thought) => t.stackId).filter(Boolean))) as string[];

    set((state: CyberiaState) => ({
      thoughts: state.thoughts.map(t => ids.includes(t.id) ? { ...t, archivedAt: Date.now(), updatedAt: Date.now() } : t)
    } as Partial<CyberiaState>));

    await db.thoughts.where('id').anyOf(ids).modify({
      archivedAt: Date.now(),
      updatedAt: Date.now()
    });

    await get().refreshTotalThoughtCount();
    if (affectedStackIds.length > 0) await get().cleanupStacks();

    set((state: CyberiaState) => ({
      selectedThoughtId: ids.includes(state.selectedThoughtId as string) ? null : state.selectedThoughtId,
      selectedThoughtIds: state.selectedThoughtIds.filter((tid: string) => !ids.includes(tid))
    } as Partial<CyberiaState>));

    get().pushHistory();
  },

  unarchiveThought: async (id: string) => {
    if (get().isReadOnly) return;

    set((state: CyberiaState) => ({
      thoughts: state.thoughts.map(t => t.id === id ? { ...t, archivedAt: null, updatedAt: Date.now() } : t)
    } as Partial<CyberiaState>));

    await db.thoughts.update(id, {
      archivedAt: null,
      updatedAt: Date.now()
    });

    await get().refreshThoughts();
    await get().refreshTotalThoughtCount();
    get().pushHistory();
  },

  unarchiveThoughts: async (ids: string[]) => {
    if (get().isReadOnly || !ids.length) return;

    set((state: CyberiaState) => ({
      thoughts: state.thoughts.map(t => ids.includes(t.id) ? { ...t, archivedAt: null, updatedAt: Date.now() } : t)
    } as Partial<CyberiaState>));

    await db.thoughts.where('id').anyOf(ids).modify({
      archivedAt: null,
      updatedAt: Date.now()
    });

    await get().refreshThoughts();
    await get().refreshTotalThoughtCount();
    get().pushHistory();
  },

  refreshThoughts: async (spaceId?: string) => {
    if (get().isReadOnly || get().isDemo) return;
    const targetId = spaceId || get().activeSpaceId;
    if (!targetId) return;
    const currentUserId = 'guest';
    const incomingThoughts = await db.thoughts
      .filter((t: any) => t.spaceId === targetId && t.userId === currentUserId && !t.deletedAt)
      .toArray();

    if (!spaceId || targetId === get().activeSpaceId) {
      set({ thoughts: incomingThoughts } as Partial<CyberiaState>);
    }
  },

  refreshTotalThoughtCount: async () => {
    const currentUserId = 'guest';
    const count = await db.thoughts.filter(t => !t.deletedAt && !t.archivedAt && t.userId === currentUserId).count();
    set({ totalThoughtCount: count } as Partial<CyberiaState>);
  },

  setActiveFocus: async (id: string | null, type: 'text' | 'table' | 'paint' | 'tasks' | 'embed' | 'file' | null) => {
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

  setSelectedThoughtIds: (ids: string[]) => {
    set({
      selectedThoughtIds: ids,
      selectedThoughtId: ids.length === 1 ? ids[0] : null
    } as Partial<CyberiaState>);
  },

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

  linkSelectedThoughts: async (name?: string, targetIds?: string[]) => {
    const idsToLink = targetIds || get().selectedThoughtIds;
    const { activeSpaceId, thoughts, stacks } = get();
    if (idsToLink.length < 2 || !activeSpaceId) return;

    const now = Date.now();

    let targetStackId = '';
    let newStack: Stack | null = null;
    const stacksToDelete: string[] = [];

    if (name) {
      const trimmedName = name.trim().toLowerCase();
      const existingByName = stacks.find(
        (s: any) => s.name.toLowerCase() === trimmedName && s.spaceId === activeSpaceId && !s.deletedAt
      );
      if (existingByName) {
        targetStackId = existingByName.id;
      }
    }

    if (!targetStackId) {
      // If any of the linked thoughts already belongs to a stack, join it instead of creating a new one
      const existingStackId = thoughts.find(t => idsToLink.includes(t.id) && t.stackId)?.stackId;
      if (existingStackId) {
        targetStackId = existingStackId;
      } else {
        targetStackId = ulid();
        const trimmedName = name?.trim();
        const finalName = trimmedName || 'New Collection';
        newStack = {
          id: targetStackId,
          userId: 'guest',
          name: finalName,
          color: `hsla(${Math.floor(Math.random() * 360)}, 70%, 50%, 1)`,
          spaceId: activeSpaceId,
          updatedAt: now,
        };
      }
    }

    // Check stack limit
    if (newStack) {
      if (idsToLink.length > MAX_THOUGHTS_PER_STACK) {
        showStackLimitModal(newStack.name);
        return;
      }
    } else {
      const { allowed } = await checkStackLimit(targetStackId);
      if (!allowed) {
        const targetStack = stacks.find((s: Stack) => s.id === targetStackId);
        showStackLimitModal(targetStack?.name);
        return;
      }
    }

    set({
      thoughts: thoughts.map(t => {
        if (idsToLink.includes(t.id)) {
          return { ...t, stackId: targetStackId, updatedAt: now };
        }
        if (t.stackId && stacksToDelete.includes(t.stackId)) {
          return { ...t, stackId: targetStackId, updatedAt: now };
        }
        return t;
      }),
      stacks: newStack
        ? [...stacks, newStack]
        : stacks
    } as Partial<CyberiaState>);

    await db.transaction('rw', [db.thoughts, db.stacks], async () => {
      if (newStack) {
        await db.stacks.add(newStack);
      }
      if (stacksToDelete.length > 0) {
        await db.stacks.where('id').anyOf(stacksToDelete).modify({
          deletedAt: now,
          updatedAt: now,
        });
      }
      await db.thoughts.where('id').anyOf(idsToLink).modify({
        stackId: targetStackId,
        updatedAt: now,
      });
    });

    get().pushHistory();
  },

  unlinkSelectedThoughts: async () => {
    const { selectedThoughtIds } = get();
    if (selectedThoughtIds.length === 0) return;

    const freshThoughts = get().thoughts;
    const thoughtsToUnlink = freshThoughts.filter(t => selectedThoughtIds.includes(t.id));
    const affectedStackIds = Array.from(new Set(thoughtsToUnlink.map(t => t.stackId).filter(Boolean))) as string[];

    const now = Date.now();
    set({
      thoughts: freshThoughts.map(t =>
        selectedThoughtIds.includes(t.id) ? { ...t, stackId: null, updatedAt: now } : t
      )
    } as Partial<CyberiaState>);

    await db.thoughts.where('id').anyOf(selectedThoughtIds).modify({
      stackId: null,
      updatedAt: now,
    });

    if (affectedStackIds.length > 0) {
      await get().cleanupStacks();
    }

    get().pushHistory();
  },

});
