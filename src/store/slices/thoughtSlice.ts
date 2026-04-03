import { type StateCreator } from 'zustand';
import { type CyberiaState } from '../types';
import { db, type Thought, type Stack } from '../../db';
import { useAuthStore } from '../useAuthStore';
import { syncOrchestrator } from '../../services/sync/syncOrchestrator';
import { useModalStore } from '../useModalStore';
import { sanitizeStatus, sanitizePriority } from '../../utils/thought';
import { ulid } from 'ulid';
import { getThoughtConfig } from '../../components/thought/registry';
import { checkStackLimit, showStackLimitModal, MAX_THOUGHTS_PER_STACK } from './stackSlice';

function mergeThoughts(local: Thought[], incoming: Thought[]): Thought[] {
  const editingThoughts = syncOrchestrator.getEditingThoughts();
  const localMap = new Map(local.map(t => [t.id, t]));
  
  const merged = incoming.map(incomingThought => {
    const localThought = localMap.get(incomingThought.id);
    
    if (editingThoughts.has(incomingThought.id) && localThought) {
      return localThought;
    }
    
    if (localThought && (localThought.updatedAt || 0) > (incomingThought.updatedAt || 0)) {
      return localThought;
    }
    
    return incomingThought;
  });
  
  return merged.sort((a, b) => (a.order || 0) - (b.order || 0));
}

export const createThoughtSlice: StateCreator<CyberiaState, [], [], any> = (set, get) => ({
  thoughts: [],
  totalThoughtCount: 0,
  selectedThoughtId: null,
  selectedThoughtIds: [],
  activeFocusId: null,
  focusType: null as 'text' | 'table' | 'paint' | 'tasks' | 'embed' | 'file' | null,
  deletingThoughtIds: [] as string[],

  addThought: async (partialThought: Partial<Thought>) => {
    const { activeSpaceId, isReadOnly, getLimits, transform } = get();
    if (isReadOnly) return '';
    if (!activeSpaceId) return '';

    const limits = getLimits();
    
    // STRICT ENFORCEMENT: Check thoughts in CURRENT space directly from DB for truth
    const count = await db.thoughts.where('spaceId').equals(activeSpaceId).and(t => !t.deletedAt).count();
    
    if (count >= limits.MAX_THOUGHTS_PER_SPACE) {
      const isPro = useAuthStore.getState().user?.plan === 'pro';
      
      useModalStore.getState().openModal({
        title: isPro ? 'Space Limit Reached' : 'Thinking Limit Reached',
        description: isPro 
          ? `You’ve reached the pro limit of ${limits.MAX_THOUGHTS_PER_SPACE} thoughts for this space.` 
          : `You’ve reached the free limit of ${limits.MAX_THOUGHTS_PER_SPACE} thoughts for this space. Upgrade to Cyberia Pro to unlock unlimited mapping and premium Oracle AI features.`,
        type: 'limit_thought',
        confirmText: isPro ? 'Acknowledged' : 'Upgrade to Pro',
        onConfirm: isPro ? undefined : () => window.location.href = '/pricing'
      });
      return '';
    }

    const thoughtType = partialThought.type || 'label';
    
    // Get config and payload for thought type
    const config = getThoughtConfig(thoughtType);
    const payload = config?.createPayload();
    
    // Get autoSync status from AuthStore
    const autoSync = useAuthStore.getState().autoSync;

    const authStatus = useAuthStore.getState().status;
    const userId = useAuthStore.getState().user?.id ?? 'guest';
    
    // CRITICAL: Guest data should NEVER have syncStatus: 'local'
    // Only authenticated users can have local data that needs syncing
    const isGuest = userId === 'guest';
    const shouldMarkLocal = !isGuest && autoSync && authStatus === 'authenticated';

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
      layer: 0,
      author: '',
      syncStatus: shouldMarkLocal ? 'local' : undefined,
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
      
      const authStore = useAuthStore.getState();
      if (authStore.status === 'authenticated') {
        await syncOrchestrator.triggerSync();
      }
    }
    return thoughtId;
  },

  addThoughts: async (partialThoughts: Partial<Thought>[]) => {
    const { activeSpaceId, isReadOnly, getLimits, transform } = get();
    if (isReadOnly || !activeSpaceId || !partialThoughts.length) return [];

    const limits = getLimits();
    
    // Bulk check limits
    const count = await db.thoughts.where('spaceId').equals(activeSpaceId).and(t => !t.deletedAt).count();
    
    if (count + partialThoughts.length > limits.MAX_THOUGHTS_PER_SPACE) {
      const isPro = useAuthStore.getState().user?.plan === 'pro';
      
      useModalStore.getState().openModal({
        title: isPro ? 'Space Limit Reached' : 'Thinking Limit Reached',
        description: isPro 
          ? `You’ve reached the pro limit of ${limits.MAX_THOUGHTS_PER_SPACE} thoughts for this space.` 
          : `You’ve reached the free limit of ${limits.MAX_THOUGHTS_PER_SPACE} thoughts for this space. Upgrade to Cyberia Pro to unlock unlimited mapping and premium Oracle AI features.`,
        type: 'limit_thought',
        confirmText: isPro ? 'Acknowledged' : 'Upgrade to Pro',
        onConfirm: isPro ? undefined : () => window.location.href = '/pricing'
      });
      return [];
    }

    const authStore = useAuthStore.getState();
    const userId = authStore.user?.id ?? 'guest';
    const authStatus = authStore.status;

    const newThoughtIds: string[] = [];
    const thoughtsToAdd: Thought[] = [];

    for (let i = 0; i < partialThoughts.length; i++) {
      const partial = partialThoughts[i];
      const thoughtId = ulid();
      newThoughtIds.push(thoughtId);

      const thoughtType = partial.type || 'label';
      const config = getThoughtConfig(thoughtType);
      const payload = config?.createPayload();

      // Apply jitter if multiple thoughts are added
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
        layer: 0,
        author: '',
        syncStatus: 'local',
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

    if (authStatus === 'authenticated') {
      await syncOrchestrator.triggerSync();
    }

    return newThoughtIds;
  },

  updateThought: async (id: string, updates: Partial<Thought>, options?: { skipSync?: boolean }) => {
    const { thoughts, activeSpaceId, isReadOnly } = get();
    const thought = thoughts.find((t: Thought) => t.id === id);
    if (!thought) return;
    const isBlobType = thought.type === 'file' || updates.type === 'file';
    
    if (updates.status) updates.status = sanitizeStatus(updates.status);
    if (updates.priority) updates.priority = sanitizePriority(updates.priority);

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
        syncStatus: 'local' as const
      };
      set({ thoughts: newThoughts } as Partial<CyberiaState>);
    }

    if (isReadOnly || get().isDemo) return;
    if (activeSpaceId) get().updateSpace(activeSpaceId, { updatedAt: Date.now() }, options);

    if (syncOrchestrator.isEditing(id)) return;

    const saveTimers = (window as any)._cyberia_save_timers || {};
    if (saveTimers[id]) clearTimeout(saveTimers[id]);
    saveTimers[id] = setTimeout(async () => {
      const thoughtToSave = get().thoughts.find((t: Thought) => t.id === id);
      if (thoughtToSave) {
        await db.thoughts.put(thoughtToSave);
      }

      const authStore = useAuthStore.getState();
      if (authStore.status === 'authenticated' && !options?.skipSync) {
        const spatialKeys = ['x', 'y', 'vx', 'vy'];
        const updateKeys = Object.keys(updates);
        const isSpatialOnly = updateKeys.length > 0 && updateKeys.every(k => spatialKeys.includes(k));

        if (!isSpatialOnly) {
          await syncOrchestrator.triggerSync();
        }
      }
    }, 500);
    (window as any)._cyberia_save_timers = saveTimers;
  },

  updateThoughts: async (ids: string[], updates: Partial<Thought>, options?: { skipSync?: boolean }) => {
    if (get().isReadOnly) return;
    const { thoughts, activeSpaceId, stacks } = get();
    if (activeSpaceId) get().updateSpace(activeSpaceId, { updatedAt: Date.now() }, options);

    if (updates.status) updates.status = sanitizeStatus(updates.status);
    if (updates.priority) updates.priority = sanitizePriority(updates.priority);

    // Check stack limit when moving multiple thoughts to a stack
    if (updates.stackId != null) {
      const targetStack = stacks.find((s: Stack) => s.id === updates.stackId);
      // Count how many of these thoughts are NOT already in the target stack
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
      syncStatus: 'local' as const
    };

    set({ thoughts: thoughts.map((t: Thought) => ids.includes(t.id) ? { ...t, ...updates } : t) } as Partial<CyberiaState>);

    const nonEditingIds = ids.filter(id => !syncOrchestrator.isEditing(id));
    if (nonEditingIds.length > 0) {
      await db.thoughts.where('id').anyOf(nonEditingIds).modify(finalUpdates);
    }

    get().pushHistory();
    
    const { useAuthStore } = await import('../useAuthStore');
    const authStore = useAuthStore.getState();
    if (authStore.autoSync && authStore.status === 'authenticated' && !options?.skipSync) {
      const spatialKeys = ['x', 'y', 'vx', 'vy'];
      const updateKeys = Object.keys(updates);
      const isSpatialOnly = updateKeys.length > 0 && updateKeys.every(k => spatialKeys.includes(k));

      if (!isSpatialOnly) {
        await syncOrchestrator.triggerSync();
      }
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
        if (u.status) u.status = sanitizeStatus(u.status);
        if (u.priority) u.priority = sanitizePriority(u.priority);
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

    const authStore = useAuthStore.getState();
    if (authStore.autoSync && authStore.status === 'authenticated' && !options?.skipSync) {
      const spatialKeys = ['x', 'y', 'vx', 'vy'];
      const allSpatialOnly = updates.every(u => {
        const keys = Object.keys(u.updates);
        return keys.length > 0 && keys.every(k => spatialKeys.includes(k));
      });

      if (!allSpatialOnly) {
        await syncOrchestrator.triggerSync();
      }
    }
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
    const authStore = useAuthStore.getState();
    
    set((state: CyberiaState) => ({ deletingThoughtIds: [...state.deletingThoughtIds, id] } as Partial<CyberiaState>));
    
    if (thought) {
      await get().updateSpace(thought.spaceId, { updatedAt: Date.now() });
      
      // MARK FOR DELETION: Preserve storage info so sync engine can clean up cloud assets
      await db.thoughts.update(id, { 
        deletedAt: Date.now(),
        updatedAt: Date.now(),
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
    const authStore = useAuthStore.getState();
    
    set((state: CyberiaState) => ({ deletingThoughtIds: [...state.deletingThoughtIds, ...ids] } as Partial<CyberiaState>));
    
    const affectedStackIds = Array.from(new Set(thoughts.filter((t: Thought) => ids.includes(t.id)).map((t: Thought) => t.stackId).filter(Boolean))) as string[];
    
    // MARK FOR DELETION: Preserve storage info so sync engine can clean up cloud assets
    await db.thoughts.where('id').anyOf(ids).modify({ 
      deletedAt: Date.now(),
      updatedAt: Date.now(),
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
    if (get().isReadOnly || get().isDemo) return;
    const targetId = spaceId || get().activeSpaceId;
    if (!targetId) return;
    const currentUserId = useAuthStore.getState().user?.id ?? 'guest';
    const incomingThoughts = await db.thoughts
      .filter((t: any) => t.spaceId === targetId && t.userId === currentUserId && !t.deletedAt)
      .toArray();
    
    if (!spaceId || targetId === get().activeSpaceId) {
      const { thoughts: localThoughts } = get();
      const mergedThoughts = mergeThoughts(localThoughts, incomingThoughts);
      set({ thoughts: mergedThoughts } as Partial<CyberiaState>);
    }
  },

  refreshTotalThoughtCount: async () => {
    const currentUserId = useAuthStore.getState().user?.id ?? 'guest';
    const count = await db.thoughts.filter(t => !t.deletedAt && t.userId === currentUserId).count();
    set({ totalThoughtCount: count } as Partial<CyberiaState>);
  },

  setActiveFocus: async (id: string | null, type: 'text' | 'table' | 'paint' | 'tasks' | 'embed' | 'file' | null) => {
    const wasEditing = get().activeFocusId;
    
    if (id === null && wasEditing !== null) {
      const saveTimers = (window as any)._cyberia_save_timers || {};
      if (saveTimers[wasEditing]) {
        clearTimeout(saveTimers[wasEditing]);
      }
      await syncOrchestrator.flushFocusEditingThought();
    }
    
    syncOrchestrator.setFocusEditing(id !== null, id);
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

    const selectedThoughts = thoughts.filter(t => idsToLink.includes(t.id));
    const existingStackIds = Array.from(new Set(selectedThoughts.map(t => t.stackId).filter(Boolean))) as string[];
    
    const authStore = useAuthStore.getState();
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
        if (existingStackIds.length > 1 || (existingStackIds.length === 1 && existingStackIds[0] !== targetStackId)) {
          stacksToDelete.push(...existingStackIds.filter(id => id !== targetStackId));
        }
      }
    }

    if (!targetStackId) {
      if (existingStackIds.length > 0) {
        targetStackId = existingStackIds[0];
        if (existingStackIds.length > 1) {
          stacksToDelete.push(...existingStackIds.slice(1));
        }
      } else {
        targetStackId = ulid();
        const trimmedName = name?.trim();
        const finalName = trimmedName || 'New Collection';
        newStack = {
          id: targetStackId,
          userId: authStore.user?.id ?? 'guest',
          name: finalName,
          color: `hsla(${Math.floor(Math.random() * 360)}, 70%, 50%, 1)`,
          spaceId: activeSpaceId,
          updatedAt: now,
          syncStatus: 'local'
        };
      }
    }

    // Check stack limit
    // For new stacks: verify the number of thoughts being grouped doesn't exceed limit
    // For existing stacks: verify adding to existing count doesn't exceed limit
    if (newStack) {
      // Creating a new stack - check if grouping count exceeds limit
      if (idsToLink.length > MAX_THOUGHTS_PER_STACK) {
        showStackLimitModal(newStack.name);
        return;
      }
    } else {
      // Adding to existing stack - check if current + new exceeds limit
      const targetStack = stacks.find((s: Stack) => s.id === targetStackId);
      const { allowed } = await checkStackLimit(targetStackId);
      if (!allowed) {
        showStackLimitModal(targetStack?.name);
        return;
      }
    }

    set({
      thoughts: thoughts.map(t => {
        if (idsToLink.includes(t.id)) {
          return { ...t, stackId: targetStackId, updatedAt: now, syncStatus: 'local' as const };
        }
        if (t.stackId && stacksToDelete.includes(t.stackId)) {
          return { ...t, stackId: targetStackId, updatedAt: now, syncStatus: 'local' as const };
        }
        return t;
      }),
      stacks: newStack 
        ? [...stacks, newStack]
        : stacks.map(s => stacksToDelete.includes(s.id) 
            ? { ...s, deletedAt: now, updatedAt: now, syncStatus: 'local' as const }
            : s
          )
    } as Partial<CyberiaState>);

    await db.transaction('rw', [db.thoughts, db.stacks], async () => {
      if (newStack) {
        await db.stacks.add(newStack);
      }
      if (stacksToDelete.length > 0) {
        await db.stacks.where('id').anyOf(stacksToDelete).modify({
          deletedAt: now,
          updatedAt: now,
          syncStatus: 'local'
        });
      }
      await db.thoughts.where('id').anyOf(idsToLink).modify({
        stackId: targetStackId,
        updatedAt: now,
        syncStatus: 'local'
      });
    });

    get().pushHistory();
    if (authStore.status === 'authenticated') {
      await syncOrchestrator.triggerSync();
    }
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
        selectedThoughtIds.includes(t.id) ? { ...t, stackId: null, updatedAt: now, syncStatus: 'local' as const } : t
      )
    } as Partial<CyberiaState>);

    await db.thoughts.where('id').anyOf(selectedThoughtIds).modify({ 
      stackId: null,
      updatedAt: now,
      syncStatus: 'local'
    });
    
    if (affectedStackIds.length > 0) {
      await get().cleanupStacks();
    }

    get().pushHistory();
    
    const authStore = useAuthStore.getState();
    if (authStore.status === 'authenticated') {
      await syncOrchestrator.triggerSync();
    }},
  // Scatter thoughts with small jitter to prevent overlap on load
  scatterThoughts: async (spaceId?: string) => {
    const targetId = spaceId || get().activeSpaceId;
    if (!targetId || get().isReadOnly) return;
    
    const currentUserId = useAuthStore.getState().user?.id ?? 'guest';
    const thoughts = await db.thoughts
      .filter((t: any) => t.spaceId === targetId && t.userId === currentUserId && !t.deletedAt)
      .toArray();
    
    if (thoughts.length < 2) return;
    
    const updates = thoughts.map(t => ({
      id: t.id,
      updates: {
        x: t.x + (Math.random() - 0.5) * 40,
        y: t.y + (Math.random() - 0.5) * 40,
        updatedAt: Date.now(),
        syncStatus: 'local' as const
      }
    }));
    
    await db.transaction('rw', db.thoughts, async () => {
      for (const { id, updates: u } of updates) {
        await db.thoughts.update(id, u);
      }
    });
    
    await get().refreshThoughts(targetId);
    
    if (useAuthStore.getState().status === 'authenticated') {
      await syncOrchestrator.triggerSync();
    }
  },
});