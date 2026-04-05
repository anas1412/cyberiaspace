import { useEffect, useRef, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { type Thought } from '../db';
import { getStrategist, getPhysicsConfig, type LayoutContext, type PhysicsPoint } from './physics';
import { type Camera } from './useCamera';
import { sanitizeDate } from '../utils/date';

const PRIORITY_WEIGHT = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
  none: 0
};

export const usePhysics = (
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  camera: Camera
) => {
  const thoughts = useStore((state) => state.thoughts);
  const spaces = useStore((state) => state.spaces);
  const stacks = useStore((state) => state.stacks);
  const activeSpaceId = useStore((state) => state.activeSpaceId);
  const activeSpace = spaces.find((s) => s.id === activeSpaceId);
  const updateThought = useStore((state) => state.updateThought);
  const selectedThoughtId = useStore((state) => state.selectedThoughtId);
  const calendarViewDate = useStore((state) => state.calendarViewDate);
  const hoveredCalDate = useStore((state) => state.hoveredCalDate);
  const calendarSearchQuery = useStore((state) => state.calendarSearchQuery);
  const calendarStackFilter = useStore((state) => state.calendarStackFilter);
  const calendarStatusFilter = useStore((state) => state.calendarStatusFilter);
  const calendarTypeFilter = useStore((state) => state.calendarTypeFilter);
  const kanbanSearchQuery = useStore((state) => state.kanbanSearchQuery);
  const kanbanStackFilter = useStore((state) => state.kanbanStackFilter);
  const kanbanStatusFilter = useStore((state) => state.kanbanStatusFilter);
  const kanbanDateFilter = useStore((state) => state.kanbanDateFilter);
  const kanbanTypeFilter = useStore((state) => state.kanbanTypeFilter);
  const spatialSearchQuery = useStore((state) => state.spatialSearchQuery);
  const spatialStackFilter = useStore((state) => state.spatialStackFilter);
  const spatialStatusFilter = useStore((state) => state.spatialStatusFilter);
  const spatialDateFilter = useStore((state) => state.spatialDateFilter);
  const spatialTypeFilter = useStore((state) => state.spatialTypeFilter);
  const linkingSourceId = useStore((state) => state.linkingSourceId);
  const physicsIntensity = useStore((state) => state.physicsIntensity);

  const physicsState = useRef<Map<string, PhysicsPoint>>(new Map());
  const lastAppliedStyles = useRef<Map<string, { x: number; y: number; scale: number; rotation: number }>>(new Map());
  const elementHeightsRef = useRef<Map<string, number>>(new Map());
  const frameCount = useRef(0);
  const elements = useRef<Map<string, HTMLDivElement>>(new Map());
  const worldRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const mousePosRef = useRef({ x: 0, y: 0 });
  const sbHeight = useRef(0);
  const kMaxHeight = useRef(0);
  const viewportWidthRef = useRef(window.innerWidth);
  const viewportHeightRef = useRef(window.innerHeight);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const requestRef = useRef<number | null>(null);
  const prevModeRef = useRef<string | null>(null);
  const prevSpaceIdRef = useRef<string | null>(null);
  const lastLoopSpaceId = useRef<string | null>(null);
  const snapNextFrame = useRef(false);
  const prevTransformRef = useRef({ x: camera.x.get(), y: camera.y.get(), scale: camera.scale.get() });
  const isReturningHome = useRef(false);
  const lastTimeRef = useRef<number>(performance.now());
  const prevNonSpatialMode = useRef<string | null>(null); // Track previous non-spatial mode for Option A
  const justChangedMode = useRef(false); // Flag to prevent snap during mode transition

  const thoughtMap = useRef<Map<string, Thought>>(new Map());
  const layoutCacheRef = useRef<Map<string, any>>(new Map()); // Cache for layout results
  const kanbanColumnScrollRef = useRef(0); // Manual scroll tracking for kanban columns
  const kanbanColumnMaxScrollRef = useRef(0); // Max scroll based on content height
  const dragRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    moved: boolean;
    lastMouseX: number;
    lastMouseY: number;
    initialPositions: Map<string, { x: number, y: number }>;
    cellRectMap?: Map<string, DOMRect>;
  } | null>(null);

  // --- HELPERS ---

  const getGlobalScale = useCallback(() => {
    const body = document.querySelector('.app-body') || document.body;
    return new DOMMatrix(window.getComputedStyle(body).transform).a || 1;
  }, []);

  const applyHomeReturn = useCallback((timeScale: number) => {
    let allSettled = true;
    physicsState.current.forEach((p, id) => {
      const t = thoughtMap.current.get(id); if (!t) return;
      const h = elementHeightsRef.current.get(id) || 120;
      const targetX = t.x - 140;
      const targetY = t.y - h / 2;
      const dx = targetX - p.x;
      const dy = targetY - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const targetScale = (1 + (PRIORITY_WEIGHT[t.priority] || 0) * 0.05) * (t.size || 1);
      if (dist > 1) {
        const lerpFactor = 1 - Math.pow(1 - 0.12, timeScale);
        p.x += dx * lerpFactor;
        p.y += dy * lerpFactor;
        allSettled = false;
      } else {
        p.x = targetX;
        p.y = targetY;
      }
      p.scale += (targetScale - p.scale) * (1 - Math.pow(1 - 0.12, timeScale));
      p.vx = 0;
      p.vy = 0;
    });
    if (allSettled) isReturningHome.current = false;
  }, []);

  // --- MAIN HANDLERS ---

  useEffect(() => {
    const handleMouseGlobal = (e: MouseEvent) => {
      const s = getGlobalScale(); mousePosRef.current = { x: e.clientX / s, y: e.clientY / s };
    };
    window.addEventListener('mousemove', handleMouseGlobal); return () => window.removeEventListener('mousemove', handleMouseGlobal);
  }, [getGlobalScale]);

  // Cache viewport dimensions to avoid per-frame layout thrashing
  useEffect(() => {
    const handleResize = () => {
      viewportWidthRef.current = window.innerWidth;
      viewportHeightRef.current = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ResizeObserver to cache element heights (avoids per-frame offsetHeight reads)
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        const id = entry.target.getAttribute('data-physics-id');
        if (id) {
          elementHeightsRef.current.set(id, entry.contentRect.height);
        }
      });
    });
    resizeObserverRef.current = observer;

    // Observe any elements already registered
    elements.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  const lastThoughtIds = useRef<string>('');
  const lastInitMode = useRef<string | null>(null);

  // --- PERSISTENCE (Fixes "Save Storm") ---
  useEffect(() => {
    const mode = activeSpace?.mode || 'spatial';
    const physics = physicsState.current;
    const thoughtsCache = thoughtMap.current;
    const els = elements.current;

    return () => {
      // If we are leaving a spatial mode (via mode switch or space switch), save positions
      if (mode === 'spatial') {
        const store = useStore.getState();

        // Capture heights immediately before updates
        const heights = new Map<string, number>();
        physics.forEach((_, id) => {
          heights.set(id, els.get(id)?.offsetHeight || 120);
        });

        const updates: { id: string; updates: Partial<Thought> }[] = [];
        physics.forEach((p, id) => {
          const t = thoughtsCache.get(id);
          if (t) {
            const h = heights.get(id) || 120;
            const newX = p.x + 140;
            const newY = p.y + h / 2;
            
            // Only update if movement is meaningful (> 0.5px) to prevent "Blue Flicker" on space switch
            const hasMoved = Math.abs(t.x - newX) > 0.5 || Math.abs(t.y - newY) > 0.5;
            
            if (hasMoved) {
              updates.push({ id, updates: { x: newX, y: newY } });
            }
          }
        });

        if (updates.length > 0) {
          store.bulkUpdateThoughts(updates);
        }
      }
    };
  }, [activeSpace?.mode, activeSpaceId]);


  // --- INITIALIZATION ---
  useEffect(() => {
    const physics = physicsState.current;
    const thoughtsCache = thoughtMap.current;
    const els = elements.current;
    const mode = activeSpace?.mode || 'spatial';
    
    // Always keep cache fresh for physics loop
    thoughts.forEach((t) => thoughtsCache.set(t.id, { ...t }));

    // Only re-initialize structural state if IDs change or mode switches
    const currentIds = thoughts.map(t => t.id).join(',');
    const modeChanged = mode !== lastInitMode.current;
    
    if (currentIds !== lastThoughtIds.current || modeChanged) {
      lastThoughtIds.current = currentIds;
      lastInitMode.current = mode;
      
      thoughts.forEach((t) => {
        if (!physics.has(t.id)) {
          const h = els.get(t.id)?.offsetHeight || 120;
          const initialX = mode === 'spatial' ? t.x - 140 : t.x;
          const initialY = mode === 'spatial' ? t.y - h / 2 : t.y;
          physics.set(t.id, { 
            x: initialX, 
            y: initialY, 
            vx: 0, 
            vy: 0, 
            scale: mode === 'spatial' ? 1 : 0.1 
          });
        }
      });

      const idsSet = new Set(thoughts.map(t => t.id));
      for (const id of physics.keys()) {
        if (!idsSet.has(id)) {
          physics.delete(id);
          els.delete(id);
          thoughtsCache.delete(id);
          lastAppliedStyles.current.delete(id);
        }
      }
      
      // Clear all caches on mode/space switch to ensure fresh calculations
      if (modeChanged) {
        lastAppliedStyles.current.clear();
        layoutCacheRef.current?.clear();
      }
    }
  }, [thoughts, activeSpace?.mode]);

  useEffect(() => {
    const currentMode = activeSpace?.mode || 'spatial'; const currentSpaceId = activeSpaceId;
    const targetX = camera.x.get();
    const targetY = camera.y.get();
    const targetScale = camera.scale.get();

    if (currentSpaceId !== prevSpaceIdRef.current) {
      prevSpaceIdRef.current = currentSpaceId || null; prevModeRef.current = currentMode; prevTransformRef.current = { x: targetX, y: targetY, scale: targetScale }; return;
    }
    if (currentMode === 'spatial' && prevModeRef.current !== 'spatial' && prevModeRef.current !== null) {
      isReturningHome.current = true;
      const oldMode = prevModeRef.current;
      const oldT = (oldMode === 'calendar') ? { x: 0, y: 0, scale: 1 } : 
                   (oldMode === 'kanban' ? { x: 0, y: prevTransformRef.current.y, scale: 1 } : prevTransformRef.current);
      const newT = { x: targetX, y: targetY, scale: targetScale };
      physicsState.current.forEach((p) => {
        const oldScreenX = p.x * oldT.scale + oldT.x;
        const oldScreenY = p.y * oldT.scale + oldT.y;
        p.x = (oldScreenX - newT.x) / newT.scale;
        p.y = (oldScreenY - newT.y) / newT.scale;
        p.scale = (p.scale * oldT.scale) / newT.scale;
        p.vx = 0; p.vy = 0;
      });
    }
    prevModeRef.current = currentMode; prevTransformRef.current = { x: targetX, y: targetY, scale: targetScale };
  }, [activeSpace?.mode, activeSpaceId, thoughts, camera]);

  // Force snap when showArchived changes - clear cache so strategy recalculates
  // Option A: Only snap when toggling within same non-spatial mode
  // When transitioning FROM spatial, let the lerp animate naturally
  const showArchived = useStore((state) => state.showArchived);
  const currentMode = activeSpace?.mode || 'spatial';
  
  // Separate effect for mode changes
  useEffect(() => {
    if (currentMode !== 'spatial') {
      // Coming from spatial → animate (don't snap)
      // Coming from another non-spatial mode → also animate for now (Option A)
      prevNonSpatialMode.current = currentMode;
      layoutCacheRef.current?.clear();
      justChangedMode.current = true; // Prevent showArchived effect from snapping immediately
    } else {
      // Moving to spatial mode - reset tracking
      prevNonSpatialMode.current = null;
    }
  }, [currentMode]); // Only track mode changes
  
  // Separate effect for showArchived toggles within same mode
  useEffect(() => {
    if (currentMode !== 'spatial') {
      // Skip snap if we just changed modes - let lerp animate
      if (!justChangedMode.current) {
        snapNextFrame.current = true;
      }
      justChangedMode.current = false; // Reset after first check
      layoutCacheRef.current?.clear();
    }
  }, [showArchived, currentMode]);

  // Snap when spatial filters change
  useEffect(() => {
    if (currentMode === 'spatial') {
      snapNextFrame.current = true;
      layoutCacheRef.current?.clear();
    }
  }, [spatialSearchQuery, spatialStackFilter, spatialStatusFilter, spatialDateFilter, spatialTypeFilter, currentMode]);

  useEffect(() => {
    const handleMove = (clientX: number, clientY: number) => {
      if (!dragRef.current) return;
      const s = getGlobalScale(); const logicalX = clientX / s; const logicalY = clientY / s;
      dragRef.current.lastMouseX = logicalX;
      dragRef.current.lastMouseY = logicalY;
      const { startX, startY, initialPositions } = dragRef.current;
      const dx = (logicalX - startX) / camera.scale.get(); const dy = (logicalY - startY) / camera.scale.get();
      if (Math.abs(logicalX - startX) > 10 || Math.abs(logicalY - startY) > 10) {
        if (!dragRef.current.moved) useStore.getState().setDraggingThought(true);
        dragRef.current.moved = true;
      }
      if (dragRef.current.moved) initialPositions.forEach((pos, id) => {
        const p = physicsState.current.get(id); if (p) { p.x = pos.x + dx; p.y = pos.y + dy; p.vx = 0; p.vy = 0; }
      });

      // Check proximity to FAB (delete zone)
      const fabCenterX = window.innerWidth / 2;
      const fabCenterY = window.innerHeight - 72; // bottom-10 + half FAB size
      const distToFAB = Math.sqrt(Math.pow(clientX - fabCenterX, 2) + Math.pow(clientY - fabCenterY, 2));
      useStore.getState().setOverDeleteZone(distToFAB < 80);
    };
    const handleUp = (rawMouseX: number, rawMouseY: number, e: MouseEvent) => {
      if (!dragRef.current) return;
      const s = getGlobalScale(); const lastMouseX = rawMouseX / s; const lastMouseY = rawMouseY / s;
      const { id, startX, startY, moved, initialPositions } = dragRef.current;
      const dist = Math.sqrt(Math.pow(lastMouseX - startX, 2) + Math.pow(lastMouseY - startY, 2));
      const logicalWidth = worldRef.current?.clientWidth || viewportWidthRef.current;

      if (dist <= 10) {
        const store = useStore.getState();
        const target = e.target as HTMLElement;
        
        // Fix: Don't open inspector if we clicked a trigger (which opens Focus mode)
        const isTrigger = target.closest('[data-trigger]');
        const isCheckbox = target.closest('.checkbox');
        
        if (e.ctrlKey || e.metaKey) store.toggleThoughtSelection(id);
        else if (!isTrigger && !isCheckbox && !store.linkingSourceId) { 
          if (store.selectedThoughtId === id) {
            store.clearSelection();
          } else {
            store.setSelectedThoughtId(id);
            if (!store.isReadOnly && typeof store.setInspectorOpen === 'function') {
              store.setInspectorOpen(true);
            }
          }
        }
      } else if (moved) {
        const store = useStore.getState();
        const isReadOnly = store.isReadOnly && !store.isDemo;
        const mode = activeSpace?.mode || 'spatial';

        // Check if dropped on the FAB (delete zone)
        const viewportH = window.innerHeight;
        const viewportW = window.innerWidth;
        const fabSize = 64;
        const fabBottom = 40; // bottom-10 = 40px
        const fabLeft = viewportW / 2 - fabSize / 2;
        const fabRight = viewportW / 2 + fabSize / 2;
        const fabTop = viewportH - fabBottom - fabSize;
        const fabBottomY = viewportH - fabBottom;

        const droppedOnFab = rawMouseX >= fabLeft && rawMouseX <= fabRight && rawMouseY >= fabTop && rawMouseY <= fabBottomY;

        if (droppedOnFab && !isReadOnly) {
          // Delete all dragged thoughts
          initialPositions.forEach((_, draggedId) => {
            store.deleteThought(draggedId);
          });
          dragRef.current = null;
          useStore.getState().setDraggingThought(false);
          useStore.getState().setOverDeleteZone(false);
          return;
        }

        if (mode === 'kanban' && !isReadOnly) {

          const colWidth = logicalWidth / 4; let status: 'none' | 'todo' | 'doing' | 'done' = 'none';
          if (lastMouseX > colWidth && lastMouseX < colWidth * 2) status = 'todo';
          else if (lastMouseX >= colWidth * 2 && lastMouseX < colWidth * 3) status = 'doing';
          else if (lastMouseX >= colWidth * 3) status = 'done';
          const list = Array.from(thoughtMap.current.values()).filter(t => (t.id === id ? status : t.status) === status);
          const sorted = list.sort((a, b) => {
            const pA = physicsState.current.get(a.id); const pB = physicsState.current.get(b.id);
            const yA = a.id === id ? (physicsState.current.get(id)?.y || 0) : (pA?.y || 0);
            const yB = b.id === id ? (physicsState.current.get(id)?.y || 0) : (pB?.y || 0);
            return yA - yB;
          });
          sorted.forEach((t, index) => {
            if (t.id === id) updateThought(t.id, { status, order: index }); else if (t.order !== index) updateThought(t.id, { order: index });
          });
        } else if (mode === 'calendar' && !isReadOnly) {
          const sidebarWidth = 260; const gap = 20; const padding = 40; const mainLeft = padding + sidebarWidth + gap;
          if (lastMouseX < mainLeft) initialPositions.forEach((_, draggedId) => updateThought(draggedId, { startTime: null, endTime: null, isAllDay: false }));
          else if (dragRef.current?.cellRectMap) {
            const cellRectMap = dragRef.current.cellRectMap;
            let foundDate: string | null = null;
            for (const [date, rect] of cellRectMap.entries()) {
              if (rawMouseX >= rect.left && rawMouseX <= rect.right && rawMouseY >= rect.top && rawMouseY <= rect.bottom) {
                foundDate = date; break;
              }
            }
            if (foundDate) {
              const time = new Date(foundDate).getTime();
              initialPositions.forEach((_, draggedId) => updateThought(draggedId, { startTime: time, endTime: time, isAllDay: true }));
            }
          }
        } else {
          initialPositions.forEach((_, draggedId) => {
            const p = physicsState.current.get(draggedId);
            if (p) {
              const h = elements.current.get(draggedId)?.offsetHeight || 120;
              updateThought(draggedId, { x: p.x + 140, y: p.y + h / 2 });
            }
          });
        }
      }
      dragRef.current = null;
      useStore.getState().setDraggingThought(false);
      useStore.getState().setOverDeleteZone(false);
    };
    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
    const onMouseUp = (e: MouseEvent) => handleUp(e.clientX, e.clientY, e);

    const handleTouchMoveGlobal = (e: TouchEvent) => {
      const touch = e.touches[0];
      handleMove(touch.clientX, touch.clientY);
    };
    const handleTouchEndGlobal = (e: TouchEvent) => {
      const touch = e.changedTouches[0];
      handleUp(touch.clientX, touch.clientY, { ctrlKey: e.ctrlKey, metaKey: e.metaKey } as any);
    };

    window.addEventListener('mousemove', onMouseMove); 
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchmove', handleTouchMoveGlobal, { passive: false });
    window.addEventListener('touchend', handleTouchEndGlobal);

    return () => { 
      window.removeEventListener('mousemove', onMouseMove); 
      window.removeEventListener('mouseup', onMouseUp); 
      window.removeEventListener('touchmove', handleTouchMoveGlobal);
      window.removeEventListener('touchend', handleTouchEndGlobal);
    };
  }, [getGlobalScale, camera, updateThought, activeSpace, calendarViewDate]);

  const loop = useCallback(() => {
    const now = performance.now();
    const dt = now - lastTimeRef.current;
    lastTimeRef.current = now;
    
    // Normalize to 60fps (16.66ms per frame)
    // Clamp to avoid extreme jumps if tab was backgrounded (max 100ms)
    const timeScale = Math.min(6, dt / 16.666);

    const globalScale = getGlobalScale();
    const ids = Array.from(physicsState.current.keys());
    const state = physicsState.current;
    
    const logicalWidth = viewportWidthRef.current;
    const logicalHeight = viewportHeightRef.current;
    const isMobile = logicalWidth < 768;

    const currentSpaceId = activeSpaceId || 'default';
    const mode = activeSpace?.mode || 'spatial';

    // Directory mode uses React-rendered lists — no physics positioning needed
    if (mode === 'directory') return;

    if (currentSpaceId !== lastLoopSpaceId.current) {
      lastLoopSpaceId.current = currentSpaceId;
      snapNextFrame.current = true;
    }

    const vT_visual = {
      x: camera.springX.get(),
      y: camera.springY.get(),
      scale: camera.springScale.get()
    };

    const effectiveTransform = mode === 'spatial' 
      ? vT_visual 
      : (mode === 'kanban' 
          ? { x: 0, y: vT_visual.y, scale: 1 } 
          : { x: 0, y: 0, scale: 1 });

    if (worldRef.current) {
      worldRef.current.style.transform = `translate3d(${effectiveTransform.x}px, ${effectiveTransform.y}px, 0) scale(${effectiveTransform.scale})`;
    }
    if (gridRef.current) {
      gridRef.current.style.transform = `translate3d(${effectiveTransform.x}px, ${effectiveTransform.y}px, 0) scale(${effectiveTransform.scale})`;
      gridRef.current.style.opacity = mode === 'calendar' ? '0' : '0.03';
    }

    // Parallax Background Logic removed for performance optimization
    const body = document.body;
    body.style.removeProperty('--bg-px');
    body.style.removeProperty('--bg-py');
    body.style.removeProperty('--bg-zoom');

    // --- Modular Physics Engine ---
    const strategist = getStrategist(mode);
    const allThoughts = Array.from(thoughtMap.current.values());

    // Frame Pre-Processor
    const columnMap = new Map<string, Thought[]>();
    const dateMap = new Map<string, Thought[]>();

    if (mode === 'kanban') {
      const statuses: ('none' | 'todo' | 'doing' | 'done')[] = ['none', 'todo', 'doing', 'done'];
      statuses.forEach(status => {
        const list = allThoughts
          .filter(t => t.status === status)
          .filter(t => {
            const mS = !kanbanSearchQuery || 
              t.text.toLowerCase().includes(kanbanSearchQuery.toLowerCase()) || 
              (t.data?.type === 'text' ? t.data.content : ((t as any).content || '')).toLowerCase().includes(kanbanSearchQuery.toLowerCase());
            const mStack = !kanbanStackFilter || (t.stackId ? kanbanStackFilter.includes(t.stackId) : false);
            const mStatus = !kanbanStatusFilter || kanbanStatusFilter.includes(t.status as 'todo' | 'doing' | 'done');
            const mDate = !kanbanDateFilter || (t.startTime ? new Date(t.startTime).toISOString().split('T')[0] === kanbanDateFilter : false);
            const mType = !kanbanTypeFilter || kanbanTypeFilter.includes(t.type as import('../db').ThoughtType);
            return mS && mStack && mStatus && mDate && mType;
          })
          .sort((a, b) => a.order - b.order);
        columnMap.set(status, list);
      });
    } else if (mode === 'calendar') {
      allThoughts.forEach(t => {
        const dateKey = sanitizeDate(t.startTime);
        if (!dateMap.has(dateKey)) dateMap.set(dateKey, []);
        
        const matchesSearch = !calendarSearchQuery || 
          t.text.toLowerCase().includes(calendarSearchQuery.toLowerCase()) ||
          (t.data?.type === 'text' ? t.data.content : ((t as any).content || '')).toLowerCase().includes(calendarSearchQuery.toLowerCase());
        const matchesStack = !calendarStackFilter || (t.stackId ? calendarStackFilter.includes(t.stackId) : false);
        const matchesStatus = !calendarStatusFilter || calendarStatusFilter.includes(t.status as 'todo' | 'doing' | 'done');
        const matchesType = !calendarTypeFilter || calendarTypeFilter.includes(t.type as import('../db').ThoughtType);
        
        if (matchesSearch && matchesStack && matchesStatus && matchesType) {
          dateMap.get(dateKey)!.push(t);
        }
      });
      dateMap.forEach((list, key) => {
        if (key === "") list.sort((a, b) => a.order - b.order);
        else list.sort((a, b) => (a.layer || 0) - (b.layer || 0));
      });
    }

    const elementHeights = elementHeightsRef.current;

    const sbContent = document.getElementById('cal-sidebar-content');
    const sbRect = sbContent?.getBoundingClientRect();
    
    // Kanban column content scroll/position
    const kanbanColContent = document.getElementById('kanban-column-content');
    const kanbanColRect = kanbanColContent?.getBoundingClientRect();

    const calendarCellMap = new Map<string, { x: number; y: number; w: number; h: number }>();
    if (mode === 'calendar') {
      const cells = document.querySelectorAll('.cal-cell');
      const worldRect = worldRef.current?.getBoundingClientRect();
      if (worldRect) {
        cells.forEach((cell) => {
          const date = cell.getAttribute('data-date');
          if (date) {
            const rect = cell.getBoundingClientRect();
            calendarCellMap.set(date, {
              x: (rect.left - worldRect.left) / globalScale,
              y: (rect.top - worldRect.top) / globalScale,
              w: rect.width / globalScale,
              h: rect.height / globalScale,
            });
          }
        });
      }
    }

    // Build visibleIds set for spatial mode (used by physics forces + canvas drawing)
    const spatialVisibleIds = mode === 'spatial' ? new Set(ids.filter(id => {
      const t = thoughtMap.current.get(id);
      if (!t) return false;
      if (t.archivedAt && !useStore.getState().showArchived) return false;
      const matchesSearch = !spatialSearchQuery || 
        t.text.toLowerCase().includes(spatialSearchQuery.toLowerCase()) ||
        (t.data?.type === 'text' ? t.data.content : ((t as any).content || '')).toLowerCase().includes(spatialSearchQuery.toLowerCase());
      const matchesStack = !spatialStackFilter || (t.stackId ? spatialStackFilter.includes(t.stackId) : false);
      const matchesStatus = !spatialStatusFilter || spatialStatusFilter.includes(t.status as 'todo' | 'doing' | 'done');
      const matchesDate = !spatialDateFilter || (t.startTime ? new Date(t.startTime).toISOString().split('T')[0] === spatialDateFilter : false);
      const matchesType = !spatialTypeFilter || spatialTypeFilter.includes(t.type as import('../db').ThoughtType);
      return matchesSearch && matchesStack && matchesStatus && matchesDate && matchesType;
    })) : null;

    const context: LayoutContext = {
      logicalWidth,
      logicalHeight,
      globalScale,
      calendarViewDate,
      hoveredCalDate,
      calendarSearchQuery,
      calendarStackFilter,
      calendarStatusFilter,
      kanbanSearchQuery,
      kanbanStackFilter,
      kanbanStatusFilter,
      kanbanDateFilter,
      spatialSearchQuery,
      spatialStackFilter,
      spatialStatusFilter,
      spatialDateFilter,
      showArchived: useStore.getState().showArchived, // Get latest value from store
      visibleIds: spatialVisibleIds ?? undefined,
      kanbanY: vT_visual.y,
      sidebarScrollTop: sbContent?.scrollTop || 0,
      sidebarTop: sbRect ? (sbRect.top / globalScale) : 320,
      kanbanColumnScrollTop: kanbanColumnScrollRef.current,
      kanbanColumnTop: kanbanColRect ? (kanbanColRect.top / globalScale) : 320,
      isMobile,
      isReadOnly: useStore.getState().isReadOnly,
      isDemo: useStore.getState().isDemo,
      timeScale,
      transform: vT_visual,
      calendarCellMap,
      thoughtMap: thoughtMap.current,
      columnMap,
      dateMap,
      physicsConfig: getPhysicsConfig(physicsIntensity),
    };


    let maxColHeight = 0;
    let maxKanbanColumnHeight = 0; // Track column height separately for kanban
    let sidebarHeight = 0;

    frameCount.current++;
    const shouldCalculatePhysics = physicsIntensity > 0 && (activeSpace?.physics ?? true);

    // 1. Calculate Targets & Apply Forces
    // Ensure layout cache exists
    if (!layoutCacheRef.current) layoutCacheRef.current = new Map();
    ids.forEach((id) => {
      const p = state.get(id)!;
      const t = thoughtMap.current.get(id);
      if (!t) return;

      // Spatial mode filtering
      if (mode === 'spatial' && spatialVisibleIds && !spatialVisibleIds.has(id)) {
        // Hide filtered-out thoughts
        const el = elements.current.get(id);
        if (el) {
          el.style.opacity = '0';
          el.style.pointerEvents = 'none';
          el.style.visibility = 'hidden';
        }
        return;
      }

      const isDragging = dragRef.current?.initialPositions.has(id) && dragRef.current.moved;

      if (mode === 'spatial' && !isDragging && !isReturningHome.current) {
        if (snapNextFrame.current) {
          p.x = t.x; p.y = t.y; p.vx = 0; p.vy = 0;
          p.scale = (1 + (PRIORITY_WEIGHT[t.priority] || 0) * 0.05) * (t.size || 1);
          // Restore visibility for visible thoughts
          const el = elements.current.get(id);
          if (el) {
            el.style.opacity = '1';
            el.style.pointerEvents = 'auto';
            el.style.visibility = 'visible';
          }
        } else {
          if (strategist.applyForces && shouldCalculatePhysics) {
            const { vx, vy } = strategist.applyForces(id, p, state, t, allThoughts, context, elementHeights);
            p.vx += vx * timeScale; p.vy += vy * timeScale;
          }
          const physConfig = context.physicsConfig!;
          p.vx *= Math.pow(physConfig.damping, timeScale); 
          p.vy *= Math.pow(physConfig.damping, timeScale);
          
          const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
          if (speed > physConfig.maxVelocity) { p.vx = (p.vx / speed) * physConfig.maxVelocity; p.vy = (p.vy / speed) * physConfig.maxVelocity; }
          
          p.x += p.vx * timeScale; 
          p.y += p.vy * timeScale;
          
          const targetScale = (1 + (PRIORITY_WEIGHT[t.priority] || 0) * 0.05) * (t.size || 1);
          p.scale += (targetScale - p.scale) * (1 - Math.pow(1 - 0.1, timeScale));
        }
      } else if (mode === 'spatial' && isReturningHome.current) {
        // Handled by applyHomeReturn()
      } else if (!isDragging) {
        const result = strategist.calculateLayout(t, allThoughts, context, elementHeights);
        layoutCacheRef.current.set(id, result);
        if (snapNextFrame.current) {
          p.x = result.targetX; p.y = result.targetY; p.scale = result.targetScale;
        } else {
          // Faster lerp for mode transitions (~0.12 = ~0.8 second settle time)
          const speed = 0.12;
          const lerpFactor = 1 - Math.pow(1 - speed, timeScale);
          p.x += (result.targetX - p.x) * lerpFactor;
          p.y += (result.targetY - p.y) * lerpFactor;
          p.scale += (result.targetScale - p.scale) * (1 - Math.pow(1 - 0.1, timeScale));
        }
        p.vx = 0; p.vy = 0;
        if (result.columnHeight && result.columnHeight > maxColHeight) maxColHeight = result.columnHeight;
        // Track kanban column height separately (exclude sidebar for kanban)
        if (mode === 'kanban' && !result.isSidebar && result.columnHeight && result.columnHeight > maxKanbanColumnHeight) {
          maxKanbanColumnHeight = result.columnHeight;
        }
        if (result.isSidebar && result.columnHeight && result.columnHeight > sidebarHeight) sidebarHeight = result.columnHeight;
      }
    });

    if (mode === 'spatial' && isReturningHome.current) applyHomeReturn(timeScale);

    kMaxHeight.current = maxColHeight;
    sbHeight.current = sidebarHeight;
    const spacer = document.getElementById('cal-sidebar-spacer');
    if (spacer) spacer.style.height = `${sidebarHeight + 40}px`;
    
    // Kanban column spacer for scroll height
    if (mode === 'kanban') {
      const kanbanSpacer = document.getElementById('kanban-column-spacer');
      if (kanbanSpacer) kanbanSpacer.style.height = `${maxKanbanColumnHeight + 40}px`;
      
      // Calculate max scroll based on content height vs container height
      const kanbanColContent = document.getElementById('kanban-column-content');
      const containerHeight = kanbanColContent?.clientHeight || logicalHeight;
      kanbanColumnMaxScrollRef.current = Math.max(0, maxKanbanColumnHeight - containerHeight + 100);
    }

    // --- Connections & Styles ---
    const ctx = canvasRef?.current?.getContext('2d');
    if (ctx && canvasRef.current) {
      // 1. Reset & Clear the viewport-sized canvas
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

      // 2. Sync with Viewport Transform (matches #world CSS transform)
      // Senior Fix: Auto-Sensing Coordinate Alignment
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const parentRect = canvas.parentElement?.getBoundingClientRect() || rect;
      
      // Calculate how many internal pixels correspond to the CSS-defined offset
      const resScaleX = canvas.width / (rect.width || 1);
      const resScaleY = canvas.height / (rect.height || 1);
      
      const internalOffsetX = (parentRect.left - rect.left) * resScaleX;
      const internalOffsetY = (parentRect.top - rect.top) * resScaleY;

      const scale = effectiveTransform.scale;
      const tx = effectiveTransform.x + internalOffsetX;
      const ty = effectiveTransform.y + internalOffsetY;
      ctx.setTransform(scale, 0, 0, scale, tx, ty);

      const style = getComputedStyle(document.body);
      const accent = style.getPropertyValue('--accent').trim() || '#6366f1';

      if (mode === 'spatial') {
        // Use pre-computed visibleIds set (excludes archived + filtered thoughts)
        const visibleIds = spatialVisibleIds ? Array.from(spatialVisibleIds) : ids;
        
        const stackGroups = new Map<string, string[]>();
        visibleIds.forEach(id => {
          const t = thoughtMap.current.get(id);
          if (t?.stackId) {
            if (!stackGroups.has(t.stackId)) stackGroups.set(t.stackId, []);
            stackGroups.get(t.stackId)!.push(id);
          }
        });

        stackGroups.forEach((memberIds, stackId) => {
          if (memberIds.length < 2) return;
          const stack = stacks.find(s => s.id === stackId);
          const stackColor = stack?.color || accent;
          
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          
          // 1. PATH DEFINITION — Star/hub topology (all members → geometric centroid)
          // O(n): no implied sequence, just "these belong together"
          let centroidX = 0;
          let centroidY = 0;
          let validCount = 0;

          memberIds.forEach(id => {
            const p = state.get(id);
            if (!p) return;
            const h = elementHeights.get(id) || 120;
            centroidX += p.x + 140;
            centroidY += p.y + h / 2;
            validCount++;
          });

          if (validCount < 2) return;
          centroidX /= validCount;
          centroidY /= validCount;

          ctx.beginPath();
          memberIds.forEach(id => {
            const p = state.get(id);
            if (!p) return;
            const h = elementHeights.get(id) || 120;
            ctx.moveTo(p.x + 140, p.y + h / 2);
            ctx.lineTo(centroidX, centroidY);
          });

          // Enhanced glow effect for stack connections
          ctx.setLineDash([]);
          ctx.lineWidth = 1.0;
          
          const prevAlpha = ctx.globalAlpha;
          ctx.strokeStyle = stackColor;
          ctx.globalAlpha = 0.5;
          
          // Glow properties
          ctx.shadowBlur = 12;
          ctx.shadowColor = stackColor;
          
          ctx.stroke();
          
          // Reset shadow for next drawing operations
          ctx.shadowBlur = 0;
          ctx.globalAlpha = prevAlpha;
        });
      }
      
    if (linkingSourceId) {
        const pS = state.get(linkingSourceId);
        if (pS) {
          const hS = elementHeights.get(linkingSourceId) || 120;
          
          // World mouse conversion
          const worldMouseX = (mousePosRef.current.x - vT_visual.x) / vT_visual.scale;
          const worldMouseY = (mousePosRef.current.y - vT_visual.y) / vT_visual.scale;

          ctx.beginPath(); 
          ctx.setLineDash([5, 5]); 
          ctx.strokeStyle = accent.startsWith('#') ? accent + 'CC' : accent.replace('rgb', 'rgba').replace(')', ', 0.8)'); 
          ctx.lineWidth = 1.5;
          
          // Glow for the active linking line
          ctx.shadowBlur = 15;
          ctx.shadowColor = accent;
          
          ctx.moveTo(pS.x + 140, pS.y + hS / 2); 
          ctx.lineTo(worldMouseX, worldMouseY);
          ctx.stroke(); 
          
          // Reset shadow and dash
          ctx.shadowBlur = 0;
          ctx.setLineDash([]);
        }
      }
    }

    state.forEach((p, id) => {
      const el = elements.current.get(id); const t = thoughtMap.current.get(id); if (!el || !t) return;
      const h = elementHeightsRef.current.get(id) || 120;
      const isSelected = t.id === selectedThoughtId;
      const isDraggingThis = dragRef.current?.initialPositions.has(id) && dragRef.current.moved;
      
      // For spatial mode, always recalculate layout (visibleIds changes per frame)
      const useCache = mode !== 'spatial';
      const res = (useCache && layoutCacheRef.current.get(id)) || strategist.calculateLayout(t, allThoughts, context, elementHeights);
      const targetRotation = (res.rotation && !isSelected) ? res.rotation : 0;

      // --- PRECISION FILTER ---
      const last = lastAppliedStyles.current.get(id);
      const dx = last ? Math.abs(last.x - p.x) : 100;
      const dy = last ? Math.abs(last.y - p.y) : 100;
      const ds = last ? Math.abs(last.scale - p.scale) : 100;
      const dr = last ? Math.abs(last.rotation - targetRotation) : 100;
      
      // Only apply transform if move > 0.05px or scale > 0.001 or rotation > 0.1 deg
      // OR if selected/dragging/snapping (override for perfect responsiveness)
      if (dx > 0.05 || dy > 0.05 || ds > 0.001 || dr > 0.1 || isSelected || isDraggingThis || snapNextFrame.current) {
        let transformStr = `translate3d(${p.x}px, ${p.y}px, 0) scale(${p.scale})`;
        if (targetRotation !== 0) transformStr += ` rotate(${targetRotation}deg)`;
        el.style.transform = transformStr;
        lastAppliedStyles.current.set(id, { x: p.x, y: p.y, scale: p.scale, rotation: targetRotation });
      }

      el.style.opacity = (res.opacity ?? 1).toString();
      el.style.visibility = res.visibility ?? 'visible';
      el.style.pointerEvents = res.pointerEvents ?? 'auto';
      el.style.clipPath = res.clipPath ?? 'none';
      el.style.zIndex = isSelected ? '10001' : (isDraggingThis ? '1000' : (res.zIndex || (20 + (t.layer || 0)).toString()));
      
      // ===== BOUNDARY CLIPPING FOR CALENDAR & KANBAN =====
      // Prevent thoughts from visually overflowing outside their containers
      const shouldClip = !isDraggingThis && !isSelected && (
        (mode === 'calendar' && !t.startTime) || 
        (mode === 'kanban')
      );
      
      if (shouldClip) {
        let contentEl: HTMLElement | null = null;
        
        if (mode === 'kanban') {
          // Kanban: sidebar thoughts use sidebar, column thoughts use column content
          if (t.status === 'none') {
            contentEl = document.getElementById('cal-sidebar-content');
          } else {
            contentEl = document.getElementById('kanban-column-content');
          }
        } else {
          // Calendar: unscheduled thoughts use sidebar
          contentEl = document.getElementById('cal-sidebar-content');
        }
        
        const cRectRaw = contentEl?.getBoundingClientRect();
        if (cRectRaw) {
          const cRect = { top: cRectRaw.top / globalScale, bottom: cRectRaw.bottom / globalScale };
          const cardTop = (p.y * vT_visual.scale + vT_visual.y);
          const cardBottom = (p.y + h * p.scale) * vT_visual.scale + vT_visual.y;
          const topClip = Math.max(0, ((cRect.top - cardTop) / ((h * p.scale) * vT_visual.scale)) * 100);
          const bottomClip = Math.max(0, ((cardBottom - cRect.bottom) / ((h * p.scale) * vT_visual.scale)) * 100);
          el.style.clipPath = `inset(${topClip}% 0% ${bottomClip}% 0% round 16px)`;
          el.style.visibility = (topClip > 95 || bottomClip > 95) ? 'hidden' : 'visible';
          el.style.pointerEvents = (topClip > 80 || bottomClip > 80) ? 'none' : 'auto';
        }
      }
    });
    if (ids.length > 0) snapNextFrame.current = false;
  }, [activeSpace, activeSpaceId, calendarViewDate, hoveredCalDate, calendarSearchQuery, calendarStackFilter, calendarStatusFilter, calendarTypeFilter, kanbanSearchQuery, kanbanStackFilter, kanbanStatusFilter, kanbanDateFilter, kanbanTypeFilter, spatialSearchQuery, spatialStackFilter, spatialStatusFilter, spatialDateFilter, spatialTypeFilter, camera, linkingSourceId, getGlobalScale, applyHomeReturn, selectedThoughtId, physicsIntensity, stacks, canvasRef]);

  useEffect(() => {
    const animate = () => { loop(); requestRef.current = requestAnimationFrame(animate); };
    requestRef.current = requestAnimationFrame(animate); return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [loop]);

  const handleMouseDown = useCallback((id: string, e: React.MouseEvent) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('.prevent-drag')) return;
    const s = getGlobalScale(); const store = useStore.getState();
    const targets = new Set(store.selectedThoughtIds); if (!targets.has(id)) targets.add(id);
    const initialPositions = new Map();
    targets.forEach(tid => { const p = physicsState.current.get(tid); if (p) initialPositions.set(tid, { x: p.x, y: p.y }); });
    let cellRectMap: Map<string, DOMRect> | undefined;
    if (activeSpace?.mode === 'calendar') {
      cellRectMap = new Map();
      document.querySelectorAll('.cal-cell').forEach(cell => {
        const date = cell.getAttribute('data-date');
        if (date) cellRectMap!.set(date, cell.getBoundingClientRect());
      });
    }
    dragRef.current = { id, startX: e.clientX / s, startY: e.clientY / s, moved: false, lastMouseX: e.clientX / s, lastMouseY: e.clientY / s, initialPositions, cellRectMap };
  }, [getGlobalScale, activeSpace?.mode]);

  const handleTouchStart = useCallback((id: string, e: React.TouchEvent) => {
    const s = getGlobalScale(); const store = useStore.getState();
    const touch = e.touches[0];
    const targets = new Set(store.selectedThoughtIds); if (!targets.has(id)) targets.add(id);
    const initialPositions = new Map();
    targets.forEach(tid => { const p = physicsState.current.get(tid); if (p) initialPositions.set(tid, { x: p.x, y: p.y }); });
    let cellRectMap: Map<string, DOMRect> | undefined;
    if (activeSpace?.mode === 'calendar') {
      cellRectMap = new Map();
      document.querySelectorAll('.cal-cell').forEach(cell => {
        const date = cell.getAttribute('data-date');
        if (date) cellRectMap!.set(date, cell.getBoundingClientRect());
      });
    }
    dragRef.current = { id, startX: touch.clientX / s, startY: touch.clientY / s, moved: false, lastMouseX: touch.clientX / s, lastMouseY: touch.clientY / s, initialPositions, cellRectMap };
  }, [getGlobalScale, activeSpace?.mode]);

  return { 
    registerElement: (id: string, el: HTMLDivElement | null) => { 
      if (el) {
        elements.current.set(id, el);
        el.setAttribute('data-physics-id', id);
        // Also cache initial height
        elementHeightsRef.current.set(id, el.offsetHeight || 120);
        resizeObserverRef.current?.observe(el);
      } else {
        const existing = elements.current.get(id);
        if (existing && resizeObserverRef.current) {
          resizeObserverRef.current.unobserve(existing);
        }
        elements.current.delete(id);
        elementHeightsRef.current.delete(id);
      }
    }, 
    registerWorld: (el: HTMLDivElement | null) => { worldRef.current = el; }, 
    registerGrid: (el: HTMLDivElement | null) => { gridRef.current = el; }, 
    handleMouseDown: handleMouseDown as (id: string, e: React.MouseEvent) => void, 
    handleTouchStart: handleTouchStart as (id: string, e: React.TouchEvent) => void, 
    isDragging: (id: string) => !!dragRef.current?.initialPositions.has(id),
    getDragState: () => dragRef.current ? {
      isDragging: true,
      draggedIds: Array.from(dragRef.current.initialPositions.keys()),
      mouseX: dragRef.current.lastMouseX,
      mouseY: dragRef.current.lastMouseY,
    } : { isDragging: false, draggedIds: [] as string[], mouseX: 0, mouseY: 0 },
    sidebarHeight: sbHeight,
    kanbanHeight: kMaxHeight,
    physicsState,
    elements,
    elementHeights: elementHeightsRef,
    kanbanColumnScrollRef,
    kanbanColumnMaxScrollRef
  };
};
