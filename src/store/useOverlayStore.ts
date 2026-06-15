import { create } from 'zustand';

interface OverlayState {
  isOverlayOpen: boolean;
  setOverlayOpen: (open: boolean) => void;
}

export const useOverlayStore = create<OverlayState>((set) => ({
  isOverlayOpen: false,
  setOverlayOpen: (open) => set({ isOverlayOpen: open }),
}));
