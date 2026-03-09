import { type StateCreator } from 'zustand';
import { db } from '../../db';
import { type CyberiaState } from '../types';
import { syncOrchestrator } from '../../services/sync/syncOrchestrator';

export const createHistorySlice: StateCreator<CyberiaState, [], [], any> = (set, get, _api) => ({
  history: [],
  historyIndex: -1,

  pushHistory: () => {
    const { thoughts, history, historyIndex } = get();
    const newHistory = history.slice(0, historyIndex + 1);
    const last = newHistory[newHistory.length - 1];
    
    if (last && JSON.stringify(last) === JSON.stringify(thoughts)) return;
    
    newHistory.push(JSON.parse(JSON.stringify(thoughts)));
    if (newHistory.length > 50) newHistory.shift();
    
    set({ history: newHistory, historyIndex: newHistory.length - 1 });
  },

  undo: async () => {
    const { history, historyIndex, activeSpaceId, thoughts } = get();
    if (historyIndex <= 0 || !activeSpaceId) return;
    
    const newIndex = historyIndex - 1;
    const prevThoughts = history[newIndex] as any[];
    const now = Date.now();
    
    await db.transaction('rw', db.thoughts, async () => {
      const currentIds = new Set(thoughts.map(t => t.id));
      const prevIds = new Set(prevThoughts.map(t => t.id));
      
      // Mark as deleted items that are in current but not in previous
      for (const id of currentIds) {
        if (!prevIds.has(id)) {
          await db.thoughts.update(id, { deletedAt: now, syncStatus: 'local', updatedAt: now });
        }
      }
      
      // Restore items from snapshot with new updatedAt
      const restored = prevThoughts.map(t => ({
        ...t,
        updatedAt: now,
        syncStatus: 'local'
      }));
      
      await db.thoughts.bulkPut(restored);
    });
    
    await get().refreshThoughts();
    set({ historyIndex: newIndex });

    const { useAuthStore } = await import('../useAuthStore');
    if (useAuthStore.getState().status === 'authenticated') {
      syncOrchestrator.triggerSync();
    }
  },

  redo: async () => {
    const { history, historyIndex, activeSpaceId, thoughts } = get();
    if (historyIndex >= history.length - 1 || !activeSpaceId) return;
    
    const newIndex = historyIndex + 1;
    const nextThoughts = history[newIndex] as any[];
    const now = Date.now();
    
    await db.transaction('rw', db.thoughts, async () => {
      const currentIds = new Set(thoughts.map(t => t.id));
      const nextIds = new Set(nextThoughts.map(t => t.id));
      
      // Mark as deleted items that are in current but not in next
      for (const id of currentIds) {
        if (!nextIds.has(id)) {
          await db.thoughts.update(id, { deletedAt: now, syncStatus: 'local', updatedAt: now });
        }
      }
      
      // Restore items from snapshot with new updatedAt
      const restored = nextThoughts.map(t => ({
        ...t,
        updatedAt: now,
        syncStatus: 'local'
      }));
      
      await db.thoughts.bulkPut(restored);
    });
    
    await get().refreshThoughts();
    set({ historyIndex: newIndex });

    const { useAuthStore } = await import('../useAuthStore');
    if (useAuthStore.getState().status === 'authenticated') {
      syncOrchestrator.triggerSync();
    }
  },
});
