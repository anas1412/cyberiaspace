import { useRef, useCallback } from 'react';

interface GestureConfig {
  activeSpaceMode: string | undefined;
  transform: { x: number; y: number; scale: number };
  setTransform: (t: { x: number; y: number; scale: number }) => void;
  kanbanHeight: number;
  getGlobalScale: () => number;
  isDemo?: boolean;
  isInteracting?: boolean;
}

export const useViewportGestures = (config: GestureConfig) => {
  const { 
    activeSpaceMode, transform, setTransform, kanbanHeight, 
    getGlobalScale, isDemo, isInteracting
  } = config;



  const isPanningRef = useRef(false);
  const isSelectingRef = useRef(false);
  const selectionStartRef = useRef({ rawX: 0, rawY: 0 });
  const lastMousePos = useRef({ rawX: 0, rawY: 0 });

  // Touch state
  const isTouchingRef = useRef(false);
  const initialTouchDistance = useRef<number | null>(null);
  const initialTouchScale = useRef<number>(1);
  const lastTouchMidpoint = useRef<{ x: number, y: number } | null>(null);
  const initialMidpointWorld = useRef<{ x: number, y: number } | null>(null);

  const applyConstraints = useCallback((t: { x: number; y: number; scale: number }) => {
    let { x, y, scale } = t;
    const s = getGlobalScale();
    
    if (activeSpaceMode === 'kanban') {
      scale = 1;
      x = 0; // Lock horizontal in Kanban
      if (y > 0) y = 0;
      const viewHeight = window.innerHeight / s;
      const contentHeight = kanbanHeight + 100;
      const limit = Math.min(0, viewHeight - contentHeight);
      if (y < limit) y = limit;
    } else if (activeSpaceMode === 'calendar') {
      scale = 1;
      x = 0;
      y = 0;
    }
    
    return { x, y, scale };
  }, [activeSpaceMode, kanbanHeight, getGlobalScale]);

  const handleWheel = useCallback((e: WheelEvent) => {
    if (isDemo && !isInteracting) return;
    const target = e.target as HTMLElement;


    // For Demo: Stop the whole page from scrolling when interacting with the engine
    if (isDemo && target.closest('[data-demo-workspace="true"]')) {
      e.preventDefault();
    }

    // Standard exclusions
    if (target.closest('#inspector, #text-focus-overlay, #table-focus-overlay, #chat-overlay, .focus-box, #space-switcher-list')) return;

    const isUnscheduledNode = target.closest('[data-unscheduled="true"]');
    const isSidebar = target.closest('#cal-sidebar-content');

    // For Demo: Allow zoom/scroll if mouse is over the demo container OR the viewport
    if (isDemo && !target.closest('[data-demo-workspace="true"], #viewport')) return;


    // Calendar Sidebar Scroll

    if (activeSpaceMode === 'calendar' && (isUnscheduledNode || isSidebar)) {
      const sbContent = document.getElementById('cal-sidebar-content');
      if (sbContent) {
        sbContent.scrollTop += e.deltaY;
        e.preventDefault();
        return;
      }
    }

    e.preventDefault();
    const s = getGlobalScale();
    const lx = e.clientX / s;
    const ly = e.clientY / s;

    let newTransform = { ...transform };

    if (activeSpaceMode === 'spatial') {
      // Spatial Mode: Zoom via Wheel (Standard Cyberia behavior)
      const delta = -e.deltaY;
      // Smoother zoom speed: 0.001 for mouse, potentially 0.002 for trackpad pinch (ctrlKey)
      const zoomSpeed = e.ctrlKey ? 0.002 : 0.001;
      const newScale = Math.min(Math.max(0.1, transform.scale + delta * zoomSpeed * transform.scale), 2);
      
      const wx = (lx - transform.x) / transform.scale;
      const wy = (ly - transform.y) / transform.scale;
      
      newTransform = {
        x: lx - wx * newScale,
        y: ly - wy * newScale,
        scale: newScale,
      };
    } else if (activeSpaceMode === 'kanban') {
      // Kanban: Vertical Scroll only
      newTransform = {
        ...transform,
        y: transform.y - e.deltaY / s
      };
    }
    
    setTransform(applyConstraints(newTransform));
  }, [activeSpaceMode, transform, setTransform, applyConstraints, getGlobalScale, isDemo, isInteracting]);


  const handleTouchStart = useCallback((e: TouchEvent) => {

    if (isDemo && !isInteracting) return;
    const target = e.target as HTMLElement;

    
    // For Demo: Stop the whole page from scrolling when interacting with the engine
    if (isDemo && target.closest('[data-demo-workspace="true"]')) {
      e.preventDefault();
    }

    if (isDemo && !target.closest('[data-demo-workspace="true"]')) return;
    if (target.closest('button, input, textarea, .thought-bulb, #inspector, .ui-layer, .expand-img, #chat-overlay, .focus-box')) return;


    isTouchingRef.current = true;
    const s = getGlobalScale();

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      lastMousePos.current = { rawX: touch.clientX, rawY: touch.clientY };
      isPanningRef.current = true;
    } else if (e.touches.length === 2 && activeSpaceMode === 'spatial') {
      isPanningRef.current = false;
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.sqrt(Math.pow(t2.clientX - t1.clientX, 2) + Math.pow(t2.clientY - t1.clientY, 2));
      initialTouchDistance.current = dist;
      initialTouchScale.current = transform.scale;
      
      const midX = (t1.clientX + t2.clientX) / 2 / s;
      const midY = (t1.clientY + t2.clientY) / 2 / s;
      
      lastTouchMidpoint.current = { x: midX, y: midY };
      initialMidpointWorld.current = {
        x: (midX - transform.x) / transform.scale,
        y: (midY - transform.y) / transform.scale
      };
    }
  }, [getGlobalScale, transform, activeSpaceMode, isDemo, isInteracting]);

  const handleTouchMove = useCallback((e: TouchEvent) => {

    if (isDemo && !isInteracting) return;
    if (isDemo && (e.target as HTMLElement).closest('[data-demo-workspace="true"]')) {

      e.preventDefault();
    }
    if (!isTouchingRef.current) return;
    const s = getGlobalScale();

    let newTransform = { ...transform };

    if (e.touches.length === 1 && isPanningRef.current) {
      const touch = e.touches[0];
      const dx = (touch.clientX - lastMousePos.current.rawX) / (s * transform.scale);
      const dy = (touch.clientY - lastMousePos.current.rawY) / (s * transform.scale);

      
      if (activeSpaceMode === 'spatial') {
        newTransform = {
          ...transform,
          x: transform.x + dx,
          y: transform.y + dy,
        };
      } else if (activeSpaceMode === 'kanban') {
        newTransform = {
          ...transform,
          y: transform.y + dy,
        };
      }
      lastMousePos.current = { rawX: touch.clientX, rawY: touch.clientY };
    } else if (e.touches.length === 2 && initialTouchDistance.current !== null && initialMidpointWorld.current && activeSpaceMode === 'spatial') {
      e.preventDefault();
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const currentDist = Math.sqrt(Math.pow(t2.clientX - t1.clientX, 2) + Math.pow(t2.clientY - t1.clientY, 2));
      const currentMidpoint = {
        x: (t1.clientX + t2.clientX) / 2 / s,
        y: (t1.clientY + t2.clientY) / 2 / s
      };

      const scaleFactor = currentDist / initialTouchDistance.current;
      const newScale = Math.min(Math.max(0.1, initialTouchScale.current * scaleFactor), 2);

      newTransform = {
        x: currentMidpoint.x - initialMidpointWorld.current.x * newScale,
        y: currentMidpoint.y - initialMidpointWorld.current.y * newScale,
        scale: newScale
      };
      lastTouchMidpoint.current = currentMidpoint;
    }
    
    setTransform(applyConstraints(newTransform));
  }, [transform, setTransform, applyConstraints, getGlobalScale, activeSpaceMode, isDemo, isInteracting]);

  const handleTouchEnd = useCallback(() => {

    isTouchingRef.current = false;
    isPanningRef.current = false;
    initialTouchDistance.current = null;
    lastTouchMidpoint.current = null;
    initialMidpointWorld.current = null;
  }, []);

  return {
    handleWheel,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    applyConstraints,
    isPanningRef,
    isSelectingRef,
    selectionStartRef,
    lastMousePos
  };
};
