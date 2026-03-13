import { useMotionValue, useSpring, useMotionValueEvent, type MotionValue } from 'framer-motion';
import { useCallback, useEffect, useRef, useMemo } from 'react';
import { useStore } from '../store/useStore';

export interface Camera {
  x: MotionValue<number>;
  y: MotionValue<number>;
  scale: MotionValue<number>;
  springX: MotionValue<number>;
  springY: MotionValue<number>;
  springScale: MotionValue<number>;
  moveBy: (dx: number, dy: number) => void;
  pan: (dx: number, dy: number) => void;
  zoomAt: (newScale: number, lx: number, ly: number) => void;
  snapTo: (x: number, y: number, scale: number) => void;
  set: (x: number, y: number, scale: number) => void;
}

export const useCamera = (activeSpaceMode: string | undefined): Camera => {
  const storeTransform = useStore((state) => state.transform);
  const setTransform = useStore((state) => state.setTransform);
  const saveSpaceTransform = useStore((state) => state.saveSpaceTransform);
  const activeSpaceId = useStore((state) => state.activeSpaceId);

  // The "Target" values - what the user/gestures want
  const x = useMotionValue(storeTransform.x);
  const y = useMotionValue(storeTransform.y);
  const scale = useMotionValue(storeTransform.scale);

  // The "Visual" values - smoothed via spring for buttery 60fps
  const springConfig = { damping: 35, stiffness: 250, mass: 1, restDelta: 0.001, restSpeed: 0.001 };
  const springX = useSpring(x, springConfig);
  const springY = useSpring(y, springConfig);
  const springScale = useSpring(scale, springConfig);

  // Sync to store transform on space/mode change
  const lastActiveSpaceId = useRef(activeSpaceId);
  const lastActiveMode = useRef(activeSpaceMode);

  useEffect(() => {
    if (activeSpaceId !== lastActiveSpaceId.current || activeSpaceMode !== lastActiveMode.current) {
      x.set(storeTransform.x);
      y.set(storeTransform.y);
      scale.set(storeTransform.scale);
      
      // Snap springs to avoid initial jump on space entry
      springX.jump(storeTransform.x);
      springY.jump(storeTransform.y);
      springScale.jump(storeTransform.scale);
      
      lastActiveSpaceId.current = activeSpaceId;
      lastActiveMode.current = activeSpaceMode;
    }
  }, [activeSpaceId, activeSpaceMode, storeTransform.x, storeTransform.y, storeTransform.scale, x, y, scale, springX, springY, springScale]);

  const moveBy = useCallback((dx: number, dy: number) => {
    x.set(x.get() + dx);
    y.set(y.get() + dy);
  }, [x, y]);

  const pan = useCallback((dx: number, dy: number) => {
    // Panning is similar to moveBy but we use visuals for better "stickiness" during animations
    const currentX = x.get();
    const currentY = y.get();
    x.set(currentX + dx);
    y.set(currentY + dy);
  }, [x, y]);

  const zoomAt = useCallback((newScale: number, lx: number, ly: number) => {
    const currentScale = scale.get();
    const currentX = x.get();
    const currentY = y.get();

    // Map screen point to world point based on CURRENT target
    const wx = (lx - currentX) / currentScale;
    const wy = (ly - currentY) / currentScale;

    // Update targets
    x.set(lx - wx * newScale);
    y.set(ly - wy * newScale);
    scale.set(newScale);
  }, [x, y, scale]);

  const snapTo = useCallback((newX: number, newY: number, newScale: number) => {
    x.set(newX);
    y.set(newY);
    scale.set(newScale);
    springX.jump(newX);
    springY.jump(newY);
    springScale.jump(newScale);
  }, [x, y, scale, springX, springY, springScale]);

  const set = useCallback((newX: number, newY: number, newScale: number) => {
    x.set(newX);
    y.set(newY);
    scale.set(newScale);
  }, [x, y, scale]);

  // Sync back to store on "rest" using a debounced mechanism
  const syncTimeout = useRef<ReturnType<typeof setTimeout>>(null);
  
  const handleRest = useCallback(() => {
    if (syncTimeout.current) clearTimeout(syncTimeout.current);
    syncTimeout.current = setTimeout(() => {
      // Only sync if we've actually moved meaningfully from the store's perspective
      const cx = x.get();
      const cy = y.get();
      const cs = scale.get();
      
      const dx = Math.abs(cx - storeTransform.x);
      const dy = Math.abs(cy - storeTransform.y);
      const ds = Math.abs(cs - storeTransform.scale);
      
      if (dx > 0.1 || dy > 0.1 || ds > 0.001) {
        setTransform({ x: cx, y: cy, scale: cs });
        if (activeSpaceId && activeSpaceMode === 'spatial') {
          saveSpaceTransform(activeSpaceId, { x: cx, y: cy, scale: cs });
        }
      }
    }, 500); 
  }, [x, y, scale, setTransform, storeTransform, activeSpaceId, activeSpaceMode, saveSpaceTransform]);

  useMotionValueEvent(x, "change", handleRest);
  useMotionValueEvent(y, "change", handleRest);
  useMotionValueEvent(scale, "change", handleRest);

    return useMemo(() => ({ 
    x, y, scale, 
    springX, springY, springScale, 
    moveBy, pan, zoomAt, snapTo, set 
  }), [x, y, scale, springX, springY, springScale, moveBy, pan, zoomAt, snapTo, set]);
};
