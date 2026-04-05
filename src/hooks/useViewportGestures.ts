import { useRef, useCallback } from 'react';
import { type Camera } from './useCamera';

interface GestureConfig {
  activeSpaceMode: string | undefined;
  camera: Camera;
  kanbanHeight: number;
  getGlobalScale: () => number;
  isDemo?: boolean;
  isInteracting?: boolean;
  kanbanColumnScrollRef?: React.MutableRefObject<number>;
  kanbanColumnMaxScrollRef?: React.MutableRefObject<number>;
}

export const useViewportGestures = (config: GestureConfig) => {
  const { 
    activeSpaceMode, camera, kanbanHeight, 
    getGlobalScale, isDemo, isInteracting,
    kanbanColumnScrollRef,
    kanbanColumnMaxScrollRef
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
    if (target.closest('#inspector, #text-focus-overlay, #table-focus-overlay, #chat-overlay, .focus-box, #space-switcher-menu, .filter-panel-container')) return;

    const isSidebar = target.closest('#cal-sidebar-content');

    // For Demo: Allow zoom/scroll if mouse is over the demo container OR the viewport
    if (isDemo && !target.closest('[data-demo-workspace="true"], #viewport')) return;


    // ===== KANBAN COLUMN SCROLL HANDLING (PRIORITY for Kanban) =====
    // Check position-based for physics-positioned column thoughts FIRST
    if (activeSpaceMode === 'kanban') {
      const kanbanColContent = document.getElementById('kanban-column-content');
      const kanbanColRect = kanbanColContent?.getBoundingClientRect();
      const isOverKanbanColumns = kanbanColRect && (
        e.clientX >= kanbanColRect.left && e.clientX <= kanbanColRect.right &&
        e.clientY >= kanbanColRect.top && e.clientY <= kanbanColRect.bottom
      );

      if (isOverKanbanColumns) {
        // Update the physics engine's scroll tracking instead of scrolling an empty container
        if (kanbanColumnScrollRef) {
          // Use maxScroll if set, otherwise don't scroll at all (prevents infinity)
          const maxScroll = kanbanColumnMaxScrollRef?.current ?? 0;
          if (maxScroll > 0) {
            kanbanColumnScrollRef.current += e.deltaY;
            // Clamp to valid range [0, maxScroll]
            kanbanColumnScrollRef.current = Math.max(0, Math.min(kanbanColumnScrollRef.current, maxScroll));
          }
        }
        e.preventDefault();
        return;
      }
    }

    // ===== SIDEBAR SCROLL HANDLING (Calendar & Kanban only) =====
    // Only check unscheduled nodes in Calendar mode (all spatial thoughts have data-unscheduled="true")
    const isUnscheduledNode = activeSpaceMode === 'calendar' && target.closest('[data-unscheduled="true"]');
    
    // Check both DOM hierarchy (for native scroll elements) and position-based (for physics-positioned thoughts)
    const sbContent = document.getElementById('cal-sidebar-content');
    const sbRect = sbContent?.getBoundingClientRect();
    const isOverSidebar = sbRect && (
      e.clientX >= sbRect.left && e.clientX <= sbRect.right &&
      e.clientY >= sbRect.top && e.clientY <= sbRect.bottom
    );

    if (isUnscheduledNode || isSidebar || isOverSidebar) {
      if (sbContent) {
        sbContent.scrollTop += e.deltaY;
      }
      e.preventDefault();
      return;
    }

    // ===== CALENDAR GRID SCROLL HANDLING =====
    if (activeSpaceMode === 'calendar') {
      const calGrid = target.closest('.cal-grid');
      if (calGrid) {
        (calGrid as HTMLElement).scrollTop += e.deltaY;
        e.preventDefault();
        return;
      }
      // Outside sidebar and grid in calendar → do nothing
      return;
    }

    // ===== KANBAN: Outside columns and sidebar → do nothing =====
    if (activeSpaceMode === 'kanban') {
      return;
    }

    // ===== DIRECTORY: Let native scroll work =====
    if (activeSpaceMode === 'directory') {
      return;
    }

    e.preventDefault();
    const s = getGlobalScale();
    const lx = e.clientX / s;
    const ly = e.clientY / s;

    const currentScale = camera.scale.get();
    const currentX = camera.x.get();
    const currentY = camera.y.get();

    let newTransform = { x: currentX, y: currentY, scale: currentScale };

    if (activeSpaceMode === 'spatial') {
      // Spatial Mode: Zoom via Wheel (Standard Cyberia behavior)
      const delta = -e.deltaY;
      // Smoother zoom speed: 0.001 for mouse, potentially 0.002 for trackpad pinch (ctrlKey)
      const zoomSpeed = e.ctrlKey ? 0.002 : 0.001;
      
      // Optimization: Deactivate zooming in demo mode
      const newScale = isDemo ? currentScale : Math.min(Math.max(0.1, currentScale + delta * zoomSpeed * currentScale), 2);
      
      const wx = (lx - currentX) / currentScale;
      const wy = (ly - currentY) / currentScale;
      
      newTransform = {
        x: lx - wx * newScale,
        y: ly - wy * newScale,
        scale: newScale,
      };
    }
    
    const constrained = applyConstraints(newTransform);
    camera.set(constrained.x, constrained.y, constrained.scale);
  }, [activeSpaceMode, camera, applyConstraints, getGlobalScale, isDemo, isInteracting]);


  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isPanningRef.current) return false;

    const s = getGlobalScale();
    const currentScale = camera.scale.get();
    const currentX = camera.x.get();
    const currentY = camera.y.get();

    const dx = (e.clientX - lastMousePos.current.rawX) / (s * currentScale);
    const dy = (e.clientY - lastMousePos.current.rawY) / (s * currentScale);

    const newTransform = {
      x: currentX + dx,
      y: currentY + dy,
      scale: currentScale,
    };

    const constrained = applyConstraints(newTransform);
    camera.pan(constrained.x - currentX, constrained.y - currentY);
    
    lastMousePos.current = { rawX: e.clientX, rawY: e.clientY };
    return true;
  }, [camera, activeSpaceMode, applyConstraints, getGlobalScale]);

  const handleTouchStart = useCallback((e: TouchEvent) => {

    if (isDemo && !isInteracting) return;
    const target = e.target as HTMLElement;

    
    // For Demo: Stop the whole page from scrolling when interacting with the engine
    if (isDemo && target.closest('[data-demo-workspace="true"]')) {
      e.preventDefault();
    }

    if (isDemo && !target.closest('[data-demo-workspace="true"]')) return;
    if (target.closest('button, input, textarea, .thought-bulb, #inspector, .ui-layer, .expand-img, #chat-overlay, .focus-box, #space-switcher-menu')) return;


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
      const currentScale = camera.scale.get();
      const currentX = camera.x.get();
      const currentY = camera.y.get();

      initialTouchDistance.current = dist;
      initialTouchScale.current = currentScale;
      
      const midX = (t1.clientX + t2.clientX) / 2 / s;
      const midY = (t1.clientY + t2.clientY) / 2 / s;
      
      lastTouchMidpoint.current = { x: midX, y: midY };
      initialMidpointWorld.current = {
        x: (midX - currentX) / currentScale,
        y: (midY - currentY) / currentScale
      };
    }
  }, [getGlobalScale, camera, activeSpaceMode, isDemo, isInteracting]);

  const handleTouchMove = useCallback((e: TouchEvent) => {

    if (isDemo && !isInteracting) return;
    if (isDemo && (e.target as HTMLElement).closest('[data-demo-workspace="true"]')) {

      e.preventDefault();
    }
    if (!isTouchingRef.current) return;
    const s = getGlobalScale();

    const currentScale = camera.scale.get();
    const currentX = camera.x.get();
    const currentY = camera.y.get();

    if (e.touches.length === 1 && isPanningRef.current) {
      const touch = e.touches[0];
      const dx = (touch.clientX - lastMousePos.current.rawX) / (s * currentScale);
      const dy = (touch.clientY - lastMousePos.current.rawY) / (s * currentScale);

      const constrained = applyConstraints({
        x: currentX + dx,
        y: currentY + dy,
        scale: currentScale
      });
      
      camera.pan(constrained.x - currentX, constrained.y - currentY);
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
      const newScale = isDemo ? currentScale : Math.min(Math.max(0.1, initialTouchScale.current * scaleFactor), 2);

      const newTransform = {
        x: currentMidpoint.x - initialMidpointWorld.current.x * newScale,
        y: currentMidpoint.y - initialMidpointWorld.current.y * newScale,
        scale: newScale
      };
      
      const constrained = applyConstraints(newTransform);
      camera.set(constrained.x, constrained.y, constrained.scale);
      lastTouchMidpoint.current = currentMidpoint;
    }
  }, [camera, applyConstraints, getGlobalScale, activeSpaceMode, isDemo, isInteracting]);

  const handleTouchEnd = useCallback(() => {

    isTouchingRef.current = false;
    isPanningRef.current = false;
    initialTouchDistance.current = null;
    lastTouchMidpoint.current = null;
    initialMidpointWorld.current = null;
  }, []);

  return {
    handleWheel,
    handleMouseMove,
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