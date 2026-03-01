import { type StateCreator } from 'zustand';
import { db } from '../../db';
import { type CyberiaState } from '../types';

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
    const { history, historyIndex, activeSpaceId } = get();
    if (historyIndex <= 0 || !activeSpaceId) return;
    
    const newIndex = historyIndex - 1;
    const prevThoughts = history[newIndex];
    
    await db.transaction('rw', db.thoughts, async () => {
      await db.thoughts.where('spaceId').equals(activeSpaceId).delete();
      await db.thoughts.bulkAdd(prevThoughts);
    });
    
    set({ thoughts: prevThoughts, historyIndex: newIndex });
  },

  redo: async () => {
    const { history, historyIndex, activeSpaceId } = get();
    if (historyIndex >= history.length - 1 || !activeSpaceId) return;
    
    const newIndex = historyIndex + 1;
    const nextThoughts = history[newIndex];
    
    await db.transaction('rw', db.thoughts, async () => {
      await db.thoughts.where('spaceId').equals(activeSpaceId).delete();
      await db.thoughts.bulkAdd(nextThoughts);
    });
    
    set({ thoughts: nextThoughts, historyIndex: newIndex });
  },
});
