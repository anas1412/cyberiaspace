import { create } from 'zustand';
import type { SyncStatus } from '../services/sync/syncTypes';

interface SyncState {
  status: SyncStatus;
  lastSyncTime: Date | null;
  pendingCount: number;
  isSyncBlocked: boolean;
  
  setStatus: (status: SyncStatus) => void;
  setLastSyncTime: (time: Date | null) => void;
  setPendingCount: (count: number) => void;
  setSyncBlocked: (blocked: boolean) => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  status: 'idle',
  lastSyncTime: localStorage.getItem('cyberia-last-sync') 
    ? new Date(localStorage.getItem('cyberia-last-sync')!) 
    : null,
  pendingCount: 0,
  isSyncBlocked: false,
  
  setStatus: (status) => set({ status }),
  setLastSyncTime: (lastSyncTime) => set({ lastSyncTime }),
  setPendingCount: (pendingCount) => set({ pendingCount }),
  setSyncBlocked: (isSyncBlocked) => set({ isSyncBlocked }),
}));
