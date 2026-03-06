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
