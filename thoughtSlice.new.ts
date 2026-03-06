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
