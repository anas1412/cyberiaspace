import { useEffect, useRef, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { type Thought } from '../db';
import { getStrategist, type LayoutContext, type PhysicsPoint } from './physics';

const DAMPING = 0.8;
const MAX_VELOCITY = 10;

const PRIORITY_WEIGHT = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
  none: 0
};

export const usePhysics = (
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  transform: { x: number; y: number; scale: number }
) => {
  const thoughts = useStore((state) => state.thoughts);
  const spaces = useStore((state) => state.spaces);
  const activeSpaceId = useStore((state) => state.activeSpaceId);
  const activeSpace = spaces.find((s) => s.id === activeSpaceId);
  const updateThought = useStore((state) => state.updateThought);
  const selectedThoughtId = useStore((state) => state.selectedThoughtId);
  const calendarViewDate = useStore((state) => state.calendarViewDate);
  const hoveredCalDate = useStore((state) => state.hoveredCalDate);
  const calendarSearchQuery = useStore((state) => state.calendarSearchQuery);
  const calendarStackFilter = useStore((state) => state.calendarStackFilter);
  const kanbanSearchQuery = useStore((state) => state.kanbanSearchQuery);
  const kanbanStackFilter = useStore((state) => state.kanbanStackFilter);
  const linkingSourceId = useStore((state) => state.linkingSourceId);
  const performanceMode = useStore((state) => state.performanceMode);

  const physicsState = useRef<Map<number, PhysicsPoint>>(new Map());
  const frameCount = useRef(0);
  const elements = useRef<Map<number, HTMLDivElement>>(new Map());
  const worldRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const mousePosRef = useRef({ x: 0, y: 0 });
  const sbHeight = useRef(0);
  const kMaxHeight = useRef(0);
  const requestRef = useRef<number | null>(null);
  const prevModeRef = useRef<string | null>(null);
  const prevSpaceIdRef = useRef<string | null>(null);
  const lastLoopSpaceId = useRef<string | null>(null);
  const snapNextFrame = useRef(false);
  const prevTransformRef = useRef(transform);
  const visualTransformRef = useRef(transform);
  const isReturningHome = useRef(false);

  const thoughtMap = useRef<Map<number, Thought>>(new Map());
  const dragRef = useRef<{
    id: number;
    startX: number;
    startY: number;
    moved: boolean;
    lastMouseX: number;
    lastMouseY: number;
    initialPositions: Map<number, { x: number, y: number }>;
    cellRectMap?: Map<string, DOMRect>;
  } | null>(null);

  // --- HELPERS ---

  const getGlobalScale = useCallback(() => {
    const body = document.querySelector('.app-body') || document.body;
    return new DOMMatrix(window.getComputedStyle(body).transform).a || 1;
  }, []);

  const applyHomeReturn = useCallback(() => {
    let allSettled = true;
    physicsState.current.forEach((p, id) => {
      const t = thoughtMap.current.get(id); if (!t) return;
      const dx = t.x - p.x; const dy = t.y - p.y; const dist = Math.sqrt(dx * dx + dy * dy);
      const targetScale = (1 + (PRIORITY_WEIGHT[t.priority] || 0) * 0.05) * (t.size || 1);
      if (dist > 1) { p.x += dx * 0.12; p.y += dy * 0.12; allSettled = false; } else { p.x = t.x; p.y = t.y; }
      p.scale += (targetScale - p.scale) * 0.12; p.vx = 0; p.vy = 0;
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

  useEffect(() => {
    thoughtMap.current.clear(); const mode = activeSpace?.mode || 'spatial';
    thoughts.forEach((t) => {
      thoughtMap.current.set(t.id, { ...t });
      if (!physicsState.current.has(t.id)) {
        const initialX = mode === 'spatial' ? t.x - 140 : t.x;
        const initialY = mode === 'spatial' ? t.y - 60 : t.y;
        physicsState.current.set(t.id, { x: initialX, y: initialY, vx: 0, vy: 0, scale: mode === 'spatial' ? 1 : 0.1 });
      }
    });
    const ids = new Set(thoughts.map(t => t.id));
    for (const id of physicsState.current.keys()) if (!ids.has(id)) { physicsState.current.delete(id); elements.current.delete(id); }
  }, [thoughts, activeSpace?.mode]);

  useEffect(() => {
    const currentMode = activeSpace?.mode || 'spatial'; const currentSpaceId = activeSpaceId;
    if (currentSpaceId !== prevSpaceIdRef.current) {
      prevSpaceIdRef.current = currentSpaceId || null; prevModeRef.current = currentMode; prevTransformRef.current = { ...transform }; return;
    }
    if (currentMode === 'spatial' && prevModeRef.current !== 'spatial' && prevModeRef.current !== null) {
      isReturningHome.current = true; const oldT = prevTransformRef.current; const newT = transform;
      physicsState.current.forEach((p) => {
        const oldScreenX = p.x * oldT.scale + oldT.x; const oldScreenY = p.y * oldT.scale + oldT.y;
        p.x = (oldScreenX - newT.x) / newT.scale; p.y = (oldScreenY - newT.y) / newT.scale;
        p.scale = (p.scale * oldT.scale) / newT.scale; p.vx = 0; p.vy = 0;
      });
    }
    prevModeRef.current = currentMode; prevTransformRef.current = { ...transform };
    return () => {
      if (currentMode === 'spatial' && currentSpaceId) {
        thoughts.forEach((t) => {
          const p = physicsState.current.get(t.id);
          if (p && !useStore.getState().isReadOnly) {
            import('../db').then(({ db }) => {
              db.thoughts.update(t.id, { x: p.x, y: p.y });
            });
          }
        });
      }
    };
  }, [activeSpace?.mode, activeSpaceId, thoughts, transform]);

  useEffect(() => {
    const handleMove = (clientX: number, clientY: number) => {
      if (!dragRef.current) return;
      const s = getGlobalScale(); const logicalX = clientX / s; const logicalY = clientY / s;
      const { startX, startY, initialPositions } = dragRef.current;
      const dx = (logicalX - startX) / transform.scale; const dy = (logicalY - startY) / transform.scale;
      if (Math.abs(logicalX - startX) > 10 || Math.abs(logicalY - startY) > 10) dragRef.current.moved = true;
      if (dragRef.current.moved) initialPositions.forEach((pos, id) => {
        const p = physicsState.current.get(id); if (p) { p.x = pos.x + dx; p.y = pos.y + dy; p.vx = 0; p.vy = 0; }
      });
    };
    const handleUp = (rawMouseX: number, rawMouseY: number, e: MouseEvent) => {
      if (!dragRef.current) return;
      const s = getGlobalScale(); const lastMouseX = rawMouseX / s; const lastMouseY = rawMouseY / s;
      const { id, startX, startY, moved, initialPositions } = dragRef.current;
      const dist = Math.sqrt(Math.pow(lastMouseX - startX, 2) + Math.pow(lastMouseY - startY, 2));
      const logicalWidth = worldRef.current?.clientWidth || window.innerWidth;

      if (dist <= 10) {
        const store = useStore.getState();
        if (e.ctrlKey || e.metaKey) store.toggleThoughtSelection(id);
        else { 
          if (store.selectedThoughtId === id) {
            store.clearSelection();
          } else {
            store.setSelectedThoughtId(id);
            if (!store.isReadOnly) store.setInspectorOpen(true);
          }
        }
      } else if (moved) {
        const store = useStore.getState();
        const isReadOnly = store.isReadOnly && !store.isDemo;
        const mode = activeSpace?.mode || 'spatial';
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
          if (lastMouseX < mainLeft) initialPositions.forEach((_, draggedId) => updateThought(draggedId, { date: '' }));
          else if (dragRef.current?.cellRectMap) {
            const cellRectMap = dragRef.current.cellRectMap;
            let foundDate: string | null = null;
            for (const [date, rect] of cellRectMap.entries()) {
              if (rawMouseX >= rect.left && rawMouseX <= rect.right && rawMouseY >= rect.top && rawMouseY <= rect.bottom) {
                foundDate = date; break;
              }
            }
            if (foundDate) initialPositions.forEach((_, draggedId) => updateThought(draggedId, { date: foundDate! }));
          }
        } else initialPositions.forEach((_, draggedId) => { const p = physicsState.current.get(draggedId); if (p) updateThought(draggedId, { x: p.x, y: p.y }); });
      }
      dragRef.current = null;
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
  }, [getGlobalScale, transform.scale, updateThought, activeSpace, calendarViewDate]);

  const loop = useCallback(() => {
    const state = physicsState.current;
    const ids = Array.from(state.keys());
    const mode = activeSpace?.mode || 'spatial';
    const currentSpaceId = activeSpaceId || null;
    const globalScale = getGlobalScale();
    const logicalWidth = worldRef.current?.clientWidth || window.innerWidth;
    const logicalHeight = worldRef.current?.clientHeight || window.innerHeight;
    const isMobile = window.innerWidth < 768;

    if (currentSpaceId !== lastLoopSpaceId.current) {
      lastLoopSpaceId.current = currentSpaceId;
      visualTransformRef.current = { ...transform };
      snapNextFrame.current = true;
    }

    const lerpFactor = 0.15;
    visualTransformRef.current.x += (transform.x - visualTransformRef.current.x) * lerpFactor;
    visualTransformRef.current.y += (transform.y - visualTransformRef.current.y) * lerpFactor;
    visualTransformRef.current.scale += (transform.scale - visualTransformRef.current.scale) * lerpFactor;

    const vT = visualTransformRef.current;
    const isCalendar = mode === 'calendar';
    const isKanban = mode === 'kanban';
    const effectiveTransform = isCalendar ? { x: 0, y: 0, scale: 1 } : (isKanban ? { x: 0, y: vT.y, scale: 1 } : vT);

    if (worldRef.current) {
      worldRef.current.style.transform = `translate(${effectiveTransform.x}px, ${effectiveTransform.y}px) scale(${effectiveTransform.scale})`;
    }
    if (gridRef.current) {
      gridRef.current.style.transform = `translate(${effectiveTransform.x}px, ${effectiveTransform.y}px) scale(${effectiveTransform.scale})`;
      gridRef.current.style.opacity = isCalendar ? '0' : '0.03';
    }


    // --- Modular Physics Engine ---
    const strategist = getStrategist(mode);
    const allThoughts = Array.from(thoughtMap.current.values());
    const elementHeights = new Map<number, number>();
    ids.forEach(id => elementHeights.set(id, elements.current.get(id)?.offsetHeight || 120));

    const sbContent = document.getElementById('cal-sidebar-content');
    const sbRect = sbContent?.getBoundingClientRect();

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

    const context: LayoutContext = {
      logicalWidth,
      logicalHeight,
      globalScale,
      calendarViewDate,
      hoveredCalDate,
      calendarSearchQuery,
      calendarStackFilter,
      kanbanSearchQuery,
      kanbanStackFilter,
      kanbanY: vT.y,
      sidebarScrollTop: sbContent?.scrollTop || 0,
      sidebarTop: sbRect ? (sbRect.top / globalScale) : 320,
      isMobile,
      isReadOnly: useStore.getState().isReadOnly,
      calendarCellMap
    };


    let maxColHeight = 0;
    let sidebarHeight = 0;

    frameCount.current++;
    // Physics is disabled in performanceMode unless we are explicitly returning home or dragging
    const shouldCalculatePhysics = !performanceMode && (activeSpace?.physics ?? true);

    // 1. Calculate Targets & Apply Forces
    ids.forEach((id) => {
      const p = state.get(id)!;
      const t = thoughtMap.current.get(id);
      if (!t) return;

      const isDragging = dragRef.current?.initialPositions.has(id) && dragRef.current.moved;

      if (mode === 'spatial' && !isDragging && !isReturningHome.current) {
        if (snapNextFrame.current) {
          p.x = t.x; p.y = t.y; p.vx = 0; p.vy = 0;
          p.scale = (1 + (PRIORITY_WEIGHT[t.priority] || 0) * 0.05) * (t.size || 1);
        } else {
          if (strategist.applyForces && shouldCalculatePhysics) {
            const { vx, vy } = strategist.applyForces(id, p, state, t, allThoughts, context, elementHeights);
            p.vx += vx; p.vy += vy;
          }
          p.vx *= DAMPING; p.vy *= DAMPING;
          const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
          if (speed > MAX_VELOCITY) { p.vx = (p.vx / speed) * MAX_VELOCITY; p.vy = (p.vy / speed) * MAX_VELOCITY; }
          p.x += p.vx; p.y += p.vy;
          const targetScale = (1 + (PRIORITY_WEIGHT[t.priority] || 0) * 0.05) * (t.size || 1);
          p.scale += (targetScale - p.scale) * 0.1;
        }
      } else if (mode === 'spatial' && isReturningHome.current) {
        // Handled by applyHomeReturn() below for simplicity, or we could inline it
      } else if (!isDragging) {
        // Structured Layouts (Kanban, Calendar)
        const result = strategist.calculateLayout(t, allThoughts, context, elementHeights);
        
        if (snapNextFrame.current) {
          p.x = result.targetX; p.y = result.targetY; p.scale = result.targetScale;
        } else {
          const speed = mode === 'calendar' ? 0.2 : 0.15;
          p.x += (result.targetX - p.x) * speed;
          p.y += (result.targetY - p.y) * speed;
          p.scale += (result.targetScale - p.scale) * 0.1;
        }
        p.vx = 0; p.vy = 0;

        // Metadata Tracking
        if (result.columnHeight && result.columnHeight > maxColHeight) maxColHeight = result.columnHeight;
        if (result.isSidebar && result.columnHeight && result.columnHeight > sidebarHeight) sidebarHeight = result.columnHeight;
      }
    });

    if (mode === 'spatial' && isReturningHome.current) applyHomeReturn();

    // Update global measurements
    kMaxHeight.current = maxColHeight;
    sbHeight.current = sidebarHeight;
    const spacer = document.getElementById('cal-sidebar-spacer');
    if (spacer) spacer.style.height = `${sidebarHeight + 40}px`;

    // --- Connections & Styles (Unchanged logic) ---
    const ctx = canvasRef?.current?.getContext('2d');
    if (ctx && canvasRef.current) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      if (mode === 'spatial') {
        const { x: tx, y: ty, scale: s } = vT;
        const style = getComputedStyle(document.body);
        const accent = style.getPropertyValue('--accent').trim() || '#6366f1';
        ctx.strokeStyle = accent.startsWith('#') ? accent + '1F' : accent.replace('rgb', 'rgba').replace(')', ', 0.12)');
        ctx.beginPath();
        for (let i = 0; i < ids.length; i++) {
          const tA = thoughtMap.current.get(ids[i]); const pA = state.get(ids[i]); if (!tA?.stackId || !pA) continue;
          const hA = elementHeights.get(ids[i]) || 120;
          for (let j = i + 1; j < ids.length; j++) {
            const tB = thoughtMap.current.get(ids[j]); const pB = state.get(ids[j]); 
            if (tB && tA.stackId === tB.stackId && pB) {
              const hB = elementHeights.get(ids[j]) || 120;
              ctx.moveTo((pA.x + 140) * s + tx, (pA.y + hA / 2) * s + ty); 
              ctx.lineTo((pB.x + 140) * s + tx, (pB.y + hB / 2) * s + ty);
            }
          }
        }
        ctx.stroke();
      }
      if (linkingSourceId) {
        const pS = state.get(linkingSourceId);
        if (pS) {
          const hS = elementHeights.get(linkingSourceId) || 120;
          ctx.beginPath(); ctx.setLineDash([5, 5]); ctx.strokeStyle = 'rgba(99, 102, 241, 0.5)'; ctx.lineWidth = 2;
          ctx.moveTo((pS.x + 140) * vT.scale + vT.x, (pS.y + hS / 2) * vT.scale + vT.y); ctx.lineTo(mousePosRef.current.x, mousePosRef.current.y);
          ctx.stroke(); ctx.setLineDash([]);
        }
      }
    }

    state.forEach((p, id) => {
      const el = elements.current.get(id); const t = thoughtMap.current.get(id); if (!el || !t) return;
      const h = el.offsetHeight || 120;
      el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) scale(${p.scale})`;
      
      const isSelected = t.id === selectedThoughtId;
      const isDraggingThis = dragRef.current?.initialPositions.has(id) && dragRef.current.moved;


      // Re-calculate layout results for styling (clipPath, etc)
      const res = strategist.calculateLayout(t, allThoughts, context, elementHeights);

      el.style.opacity = (res.opacity ?? 1).toString();
      el.style.visibility = res.visibility ?? 'visible';
      el.style.pointerEvents = res.pointerEvents ?? 'auto';
      el.style.clipPath = res.clipPath ?? 'none';
      el.style.zIndex = isSelected ? '10001' : (isDraggingThis ? '1000' : (res.zIndex || (20 + (t.layer || 0)).toString()));

      if (res.rotation && !isSelected) el.style.transform += ` rotate(${res.rotation}deg)`;
      
      // Special Sidebar Clipping override (needs global context)
      if (mode === 'calendar' && !t.date && !isDraggingThis && !isSelected) {
        const contentEl = document.getElementById('cal-sidebar-content');
        const cRectRaw = contentEl?.getBoundingClientRect();
        if (cRectRaw) {
          const cRect = { top: cRectRaw.top / globalScale, bottom: cRectRaw.bottom / globalScale };
          const cardTop = (p.y * vT.scale + vT.y);
          const cardBottom = (p.y + h * p.scale) * vT.scale + vT.y;
          const topClip = Math.max(0, ((cRect.top - cardTop) / ((h * p.scale) * vT.scale)) * 100);
          const bottomClip = Math.max(0, ((cardBottom - cRect.bottom) / ((h * p.scale) * vT.scale)) * 100);
          el.style.clipPath = `inset(${topClip}% 0% ${bottomClip}% 0% round 32px)`;
          el.style.visibility = (topClip > 95 || bottomClip > 95) ? 'hidden' : 'visible';

          el.style.pointerEvents = (topClip > 80 || bottomClip > 80) ? 'none' : 'auto';
        }
      }
    });
    if (ids.length > 0) snapNextFrame.current = false;
  }, [activeSpace, activeSpaceId, calendarViewDate, hoveredCalDate, calendarSearchQuery, calendarStackFilter, kanbanSearchQuery, kanbanStackFilter, transform, linkingSourceId, getGlobalScale, applyHomeReturn, selectedThoughtId, performanceMode]);

  useEffect(() => {
    const animate = () => { loop(); requestRef.current = requestAnimationFrame(animate); };
    requestRef.current = requestAnimationFrame(animate); return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [loop]);

  const handleMouseDown = useCallback((id: number, e: React.MouseEvent) => {
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

  const handleTouchStart = useCallback((id: number, e: React.TouchEvent) => {
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

  return { registerElement: (id: number, el: HTMLDivElement | null) => { if (el) elements.current.set(id, el); else elements.current.delete(id); }, registerWorld: (el: HTMLDivElement | null) => { worldRef.current = el; }, registerGrid: (el: HTMLDivElement | null) => { gridRef.current = el; }, handleMouseDown: handleMouseDown as (id: number, e: React.MouseEvent) => void, handleTouchStart: handleTouchStart as (id: number, e: React.TouchEvent) => void, isDragging: (id: number) => !!dragRef.current?.initialPositions.has(id), sidebarHeight: sbHeight, kanbanHeight: kMaxHeight };
};
