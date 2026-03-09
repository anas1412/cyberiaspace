import { type StateCreator } from 'zustand';
import type { CyberiaState } from '../types';

export const createCanvasSlice: StateCreator<CyberiaState, [], [], any> = (set, get, _api) => ({
  performanceMode: typeof window !== 'undefined' ? (window.innerWidth < 763) : false,
  setPerformanceMode: (performanceMode: boolean) => {
    set({ performanceMode });
    if (performanceMode) document.body.classList.add('low-perf');
    else document.body.classList.remove('low-perf');
  },
  transform: { x: 0, y: 0, scale: 1 },
  setTransform: (transform: { x: number; y: number; scale: number }) => set({ transform }),
  resetTransform: () => set({ transform: { x: 0, y: 0, scale: 1 } }),
  zoomIn: () => {
    const { transform } = get();
    const newScale = Math.min(transform.scale * 1.2, 2);
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const wx = (centerX - transform.x) / transform.scale;
    const wy = (centerY - transform.y) / transform.scale;
    set({ transform: { x: centerX - wx * newScale, y: centerY - wy * newScale, scale: newScale } });
  },
  zoomOut: () => {
    const { transform } = get();
    const newScale = Math.max(transform.scale / 1.2, 0.1);
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const wx = (centerX - transform.x) / transform.scale;
    const wy = (centerY - transform.y) / transform.scale;
    set({ transform: { x: centerX - wx * newScale, y: centerY - wy * newScale, scale: newScale } });
  },
  isLightboxOpen: false,
  lightboxImage: null,
  lightboxThoughtId: null,
  openLightbox: (image: string, thoughtId: string) => set({ isLightboxOpen: true, lightboxImage: image, lightboxThoughtId: thoughtId }),
  closeLightbox: () => set({ isLightboxOpen: false, lightboxImage: null, lightboxThoughtId: null }),
});
