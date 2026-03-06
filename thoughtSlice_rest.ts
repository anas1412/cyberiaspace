  deleteThought: async (id: number) => {
    if (get().isReadOnly || get().isDemo) return;
    const thought = get().thoughts.find((t: Thought) => t.id === id);
    const affectedStackId = thought?.stackId;
    const { useAuthStore } = await import('../useAuthStore');
    const authStore = useAuthStore.getState();
    set((state: CyberiaState) => ({ deletingThoughtIds: [...state.deletingThoughtIds, id] }));
    
    if (thought) {
      await get().updateSpace(thought.spaceId, { updatedAt: new Date().toISOString() });
      if (authStore.status === 'authenticated') {
        await authStore.deleteServiceContent(thought);
      }
      
      // Soft-delete: update deletedAt and reset cloud metadata locally
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

    // Bulk soft-delete
    await db.thoughts.where('id').anyOf(ids).modify({ 
      deletedAt: Date.now(),
      storageUrl: undefined,
      storagePath: undefined,
      syncStatus: 'local'
    });

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

    // Bulk soft-delete
    await db.thoughts.where('id').anyOf(selectedThoughtIds).modify({ 
      deletedAt: Date.now(),
      storageUrl: undefined,
      storagePath: undefined,
      syncStatus: 'local'
    });

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
      targetStackId
