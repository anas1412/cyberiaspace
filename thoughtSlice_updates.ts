<<<<
  refreshTotalThoughtCount: async () => {
    const count = await db.thoughts.count();
    set(() => ({ totalThoughtCount: count }));
  },

  refreshThoughts: async (spaceId?: string) => {
    if (get().isDemo) return;
    const targetId = spaceId || get().activeSpaceId;

    if (!targetId) return;
    const thoughts = await db.thoughts.where('spaceId').equals(targetId).toArray();
    set(() => ({ thoughts, isSpaceLoading: false }));
    get().refreshTotalThoughtCount();
    if (get().history.length === 0) set(() => ({ history: [JSON.parse(JSON.stringify(thoughts))], historyIndex: 0 }));
  },
====
  refreshTotalThoughtCount: async () => {
    const count = await db.thoughts.filter(t => !t.deletedAt).count();
    set(() => ({ totalThoughtCount: count }));
  },

  refreshThoughts: async (spaceId?: string) => {
    if (get().isDemo) return;
    const targetId = spaceId || get().activeSpaceId;

    if (!targetId) return;
    // Only fetch non-deleted thoughts for the active view
    const thoughts = await db.thoughts
      .where('spaceId')
      .equals(targetId)
      .filter(t => !t.deletedAt)
      .toArray();
      
    set(() => ({ thoughts, isSpaceLoading: false }));
    get().refreshTotalThoughtCount();
    if (get().history.length === 0) set(() => ({ history: [JSON.parse(JSON.stringify(thoughts))], historyIndex: 0 }));
  },
>>>>
<<<<
  deleteThought: async (id: number) => {
    if (get().isReadOnly || get().isDemo) return;
    const thought = get().thoughts.find((t: Thought) => t.id === id);
    const affectedStackId = thought?.stackId;
    const { useAuthStore } = await import('../useAuthStore');
    const authStore = useAuthStore.getState();
    set((state: CyberiaState) => ({ deletingThoughtIds: [...state.deletingThoughtIds, id] }));
    if (thought) {
      await get().updateSpace(thought.spaceId, { updatedAt: new Date().toISOString() });
      if (authStore.status === 'authenticated') await authStore.deleteServiceContent(thought);
    }
    await db.thoughts.delete(id);
    await db.blobs.where('thoughtId').equals(id).delete();
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
    await db.thoughts.bulkDelete(ids);
    await db.blobs.where('thoughtId').anyOf(ids).delete();
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
====
  deleteThought: async (id: number) => {
    if (get().isReadOnly || get().isDemo) return;
    const thought = get().thoughts.find((t: Thought) => t.id === id);
    const affectedStackId = thought?.stackId;
    const { useAuthStore } = await import('../useAuthStore');
    const authStore = useAuthStore.getState();
    set((state: CyberiaState) => ({ deletingThoughtIds: [...state.deletingThoughtIds, id] }));
    
    if (thought) {
      await get().updateSpace(thought.spaceId, { updatedAt: new Date().toISOString() });
      // Delete from cloud immediately to free up quota
      if (authStore.status === 'authenticated') {
        await authStore.deleteServiceContent(thought);
      }
      
      // Soft-delete locally: update deletedAt and clear cloud metadata
      // We keep the blob in db.blobs for potential recovery via Undo
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
>>>>
<<<<
  deleteSelectedThoughts: async () => {
    if (get().isReadOnly || get().isDemo) return;
    const { selectedThoughtIds, thoughts } = get();
    if (selectedThoughtIds.length === 0) return;
    set((state: CyberiaState) => ({ deletingThoughtIds: [...state.deletingThoughtIds, ...selectedThoughtIds] }));
    const { useAuthStore } = await import('../useAuthStore');
    const authStore = useAuthStore.getState();
    const affectedStackIds = Array.from(new Set(thoughts.filter((t: Thought) => selectedThoughtIds.includes(t.id)).map((t: Thought) => t.stackId).filter(Boolean))) as
