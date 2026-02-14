import { useEffect, useRef, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { db, type Thought } from '../db';

const DAMPING = 0.8;
const REPULSION = 80000;
const ATTRACTION = 0.01;
const GRAVITY = 0.003;
const MAX_VELOCITY = 10;
const COMFORT_ZONE = 200;

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
  const calendarViewDate = useStore((state) => state.calendarViewDate);
  const hoveredCalDate = useStore((state) => state.hoveredCalDate);
  const linkingSourceId = useStore((state) => state.linkingSourceId);

  const physicsState = useRef<Map<number, { x: number; y: number; vx: number; vy: number; scale: number }>>(new Map());
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
  } | null>(null);

  const getGlobalScale = useCallback(() => {
    const body = document.querySelector('.app-body') || document.body;
    return new DOMMatrix(window.getComputedStyle(body).transform).a || 1;
  }, []);

  const applyKanbanLayout = useCallback((logicalWidth: number) => {
    const allThoughts = Array.from(thoughtMap.current.values());
    const statuses: ('none' | 'todo' | 'doing' | 'done')[] = ['none', 'todo', 'doing', 'done'];
    let maxColHeight = 0;

    statuses.forEach((s, colIdx) => {
      const list = allThoughts.filter(t => t.status === s).sort((a, b) => a.order - b.order);
      let currentY = 280;
      list.forEach((t) => {
        const p = physicsState.current.get(t.id); if (!p) return;
        if (dragRef.current?.initialPositions.has(t.id)) return;

        const colWidth = logicalWidth / 4;
        const targetX = (colWidth * colIdx) + (colWidth / 2);
        const el = elements.current.get(t.id); 
        const height = el?.offsetHeight || 120; 
        const targetY = currentY + height / 2;

        currentY += height + 24;

        if (snapNextFrame.current) { p.x = targetX; p.y = targetY; p.scale = 1; } 
        else { p.x += (targetX - p.x) * 0.15; p.y += (targetY - p.y) * 0.15; p.scale += (1 - p.scale) * 0.1; }
        p.vx = 0; p.vy = 0;
      });
      if (currentY > maxColHeight) maxColHeight = currentY;
    });
    kMaxHeight.current = maxColHeight;
  }, []);

  const applyCalendarLayout = useCallback((logicalWidth: number, logicalHeight: number, globalScale: number) => {
    const year = calendarViewDate.getFullYear(); const month = calendarViewDate.getMonth(); const firstDay = new Date(year, month, 1).getDay() || 7;
    const sidebarWidth = 260; const gap = 20; const padding = 40; const topPadding = 190; const mainLeft = padding + sidebarWidth + gap;
    const mainWidth = logicalWidth - mainLeft - padding; const cellWidth = mainWidth / 7; const cellHeight = (logicalHeight - topPadding - 120) / 5;
    const allThoughts = Array.from(thoughtMap.current.values());
    const scheduled = allThoughts.filter(t => !!t.date);
    const unscheduled = allThoughts.filter(t => !t.date).sort((a, b) => a.order - b.order);

    const groups = new Map<string, Thought[]>();
    scheduled.forEach(t => { if (!groups.has(t.date)) groups.set(t.date, []); groups.get(t.date)!.push(t); });

    groups.forEach((groupThoughts, dateStr) => {
      const tDate = new Date(dateStr + 'T00:00:00');
      if (tDate.getFullYear() === year && tDate.getMonth() === month) {
        const day = tDate.getDate(); const startOffset = firstDay - 1; const cellIndex = startOffset + (day - 1);
        const col = cellIndex % 7; const row = Math.floor(cellIndex / 7);
        const cellX = mainLeft + col * cellWidth; const cellY = topPadding + row * cellHeight;
        const isHovered = hoveredCalDate === dateStr;

        const count = groupThoughts.length;
        const widthScale = (cellWidth - 20) / 280;
        const heightScale = (cellHeight - 60) / 250;
        const uniformScale = Math.min(widthScale, heightScale, 0.45);

        // Tighten the spread when not hovered for a cleaner tab look
        let hSpread = isHovered ? 20 : 10;
        let vSpread = isHovered ? 60 : 15;
        if (count > 1) {
          hSpread = Math.min(hSpread, (cellWidth * 0.4) / (count - 1));
          vSpread = Math.min(vSpread, (cellHeight * 0.4) / (count - 1));
        }

        const sortedGroup = groupThoughts.sort((a, b) => (a.layer || 0) - (b.layer || 0));
        sortedGroup.forEach((t, index) => {
          const p = physicsState.current.get(t.id);
          if (!p || dragRef.current?.initialPositions.has(t.id)) return;
          const h = elements.current.get(t.id)?.offsetHeight || 120;
          const targetScale = isHovered ? uniformScale * 1.05 : uniformScale;
          const targetX = cellX + 10 + (index * hSpread) + (280 * targetScale) / 2;
          
          // Align by TOP
          const targetY = cellY + 2 + (index * vSpread) + (h * targetScale) / 2;

          if (snapNextFrame.current) { p.x = targetX; p.y = targetY; p.scale = targetScale; } 
          else { p.x += (targetX - p.x) * 0.2; p.y += (targetY - p.y) * 0.2; p.scale += (targetScale - p.scale) * 0.1; }
          p.vx = 0; p.vy = 0;
        });
      } else {
        groupThoughts.forEach(t => {
          const p = physicsState.current.get(t.id);
          if (p && !dragRef.current?.initialPositions.has(t.id)) { p.x = logicalWidth / 2; p.y = logicalHeight + 500; p.scale = 0; }
        });
      }
    });

    const sbContent = document.getElementById('cal-sidebar-content');
    const contentRect = sbContent?.getBoundingClientRect();
    let currentSB_Y = contentRect ? (contentRect.top / globalScale) + 20 : 200;
    const scrollTop = sbContent?.scrollTop || 0;
    unscheduled.forEach((t) => {
      const stateP = physicsState.current.get(t.id); if (!stateP) return;
      if (dragRef.current?.initialPositions.has(t.id)) return;
      const height = (elements.current.get(t.id)?.offsetHeight || 120) * 0.6;
      const target = { x: padding + sidebarWidth / 2, y: currentSB_Y - scrollTop + height / 2, scale: 0.6 };
      currentSB_Y += height + 20;
      if (snapNextFrame.current) { stateP.x = target.x; stateP.y = target.y; stateP.scale = target.scale; } 
      else { stateP.x += (target.x - stateP.x) * 0.15; stateP.y += (target.y - stateP.y) * 0.15; stateP.scale += (target.scale - stateP.scale) * 0.1; }
      stateP.vx = 0; stateP.vy = 0;
    });
    sbHeight.current = currentSB_Y - (contentRect?.top || 0);
    const spacer = document.getElementById('cal-sidebar-spacer'); if (spacer) spacer.style.height = `${sbHeight.current + 40}px`;
  }, [calendarViewDate, hoveredCalDate]);

  const applySpatialPhysics = useCallback((logicalWidth: number, logicalHeight: number) => {
    const ids = Array.from(physicsState.current.keys());
    ids.forEach((id) => {
      if (dragRef.current?.initialPositions.has(id)) return;
      const p = physicsState.current.get(id)!; const t = thoughtMap.current.get(id); if (!t) return;

      if (snapNextFrame.current) {
        p.x = t.x; p.y = t.y; p.vx = 0; p.vy = 0;
        p.scale = (1 + (PRIORITY_WEIGHT[t.priority] || 0) * 0.05) * (t.size || 1);
        return;
      }

      const prioLevel = PRIORITY_WEIGHT[t.priority] || 0;
      const targetScale = (1 + prioLevel * 0.05) * (t.size || 1);
      p.vx += (logicalWidth / 2 - p.x) * (GRAVITY * (1 + prioLevel * 0.5)); 
      p.vy += (logicalHeight / 2 - p.y) * (GRAVITY * (1 + prioLevel * 0.5));

      const nRadius = Math.max(120, ((elements.current.get(id)?.offsetHeight || 120) / 2) * p.scale);

      ids.forEach((otherId) => {
        if (id === otherId) return; const otherP = physicsState.current.get(otherId)!; const otherT = thoughtMap.current.get(otherId); if (!otherT) return;
        const dx = p.x - otherP.x; const dy = p.y - otherP.y;
        const distSq = dx * dx + dy * dy || 1; const d = Math.sqrt(distSq);
        const otherRadius = Math.max(120, ((elements.current.get(otherId)?.offsetHeight || 120) / 2) * otherP.scale);
        const minDistance = (nRadius + otherRadius);
        const repulsionMultiplier = 1 + (prioLevel + (PRIORITY_WEIGHT[otherT.priority] || 0)) * 0.1;

        if (d < minDistance) {
          const force = ((minDistance - d) / minDistance) * 12; p.vx += (dx / d) * force; p.vy += (dy / d) * force;
        } else {
          const force = Math.min((REPULSION * repulsionMultiplier) / distSq, 8); p.vx += (dx / d) * force; p.vy += (dy / d) * force;
        }

        if (t.stackId && t.stackId === otherT.stackId && d > COMFORT_ZONE) {
          const pull = (d - COMFORT_ZONE) * ATTRACTION; p.vx -= (dx / d) * pull; p.vy -= (dy / d) * pull;
        }
      });

      p.vx *= DAMPING; p.vy *= DAMPING;
      const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      if (speed > MAX_VELOCITY) { p.vx = (p.vx / speed) * MAX_VELOCITY; p.vy = (p.vy / speed) * MAX_VELOCITY; }
      p.x += p.vx; p.y += p.vy;
      p.scale += (targetScale - p.scale) * 0.1;
    });
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
      if (!physicsState.current.has(t.id)) physicsState.current.set(t.id, { x: t.x, y: t.y, vx: 0, vy: 0, scale: mode === 'spatial' ? 1 : 0.1 });
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
          if (p && !useStore.getState().isReadOnly) db.thoughts.update(t.id, { x: p.x, y: p.y });
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
      if (Math.abs(logicalX - startX) > 5 || Math.abs(logicalY - startY) > 5) dragRef.current.moved = true;
      if (dragRef.current.moved) initialPositions.forEach((pos, id) => {
        const p = physicsState.current.get(id); if (p) { p.x = pos.x + dx; p.y = pos.y + dy; p.vx = 0; p.vy = 0; }
      });
    };
    const handleUp = (rawMouseX: number, rawMouseY: number, e: MouseEvent) => {
      if (!dragRef.current) return;
      const s = getGlobalScale(); const lastMouseX = rawMouseX / s; const lastMouseY = rawMouseY / s;
      const { id, moved, initialPositions } = dragRef.current;
      const logicalWidth = worldRef.current?.clientWidth || window.innerWidth;
      const logicalHeight = worldRef.current?.clientHeight || window.innerHeight;
      if (!moved) {
        const store = useStore.getState();
        if (e.ctrlKey || e.metaKey) store.toggleThoughtSelection(id);
        else { store.setSelectedThoughtId(id); if (!store.isReadOnly) store.setInspectorOpen(true); }
      } else {
        const isReadOnly = useStore.getState().isReadOnly; const mode = activeSpace?.mode || 'spatial';
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
          const sidebarWidth = 260; const gap = 20; const padding = 40; const topPadding = 190; const mainLeft = padding + sidebarWidth + gap;
          if (lastMouseX < mainLeft) initialPositions.forEach((_, draggedId) => updateThought(draggedId, { date: '' }));
          else {
            const mainWidth = logicalWidth - mainLeft - padding; const cellWidth = mainWidth / 7; const cellHeight = (logicalHeight - topPadding - 120) / 5;
            const gridX = lastMouseX - mainLeft; const gridY = lastMouseY - topPadding;
            if (gridX >= 0 && gridY >= 0) {
              const col = Math.floor(gridX / cellWidth); const row = Math.floor(gridY / cellHeight);
              if (col >= 0 && col < 7 && row >= 0 && row < 5) {
                const year = calendarViewDate.getFullYear(); const month = calendarViewDate.getMonth();
                const firstDay = new Date(year, month, 1).getDay() || 7;
                const startOffset = firstDay - 1; const dayIndex = row * 7 + col - startOffset;
                const newDate = new Date(year, month, dayIndex + 1);
                if (newDate.getMonth() === month) initialPositions.forEach((_, draggedId) => updateThought(draggedId, { date: newDate.toLocaleDateString('en-CA') }));
              }
            }
          }
        } else initialPositions.forEach((_, draggedId) => { const p = physicsState.current.get(draggedId); if (p) updateThought(draggedId, { x: p.x, y: p.y }); });
      }
      dragRef.current = null;
    };
    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
    const onMouseUp = (e: MouseEvent) => handleUp(e.clientX, e.clientY, e);
    window.addEventListener('mousemove', onMouseMove); window.addEventListener('mouseup', onMouseUp);
    return () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp); };
  }, [getGlobalScale, transform.scale, updateThought, activeSpace, calendarViewDate]);

  const loop = useCallback(() => {
    const state = physicsState.current; const ids = Array.from(state.keys());
    const mode = activeSpace?.mode || 'spatial'; const currentSpaceId = activeSpaceId || null;
    const globalScale = getGlobalScale();
    const logicalWidth = worldRef.current?.clientWidth || window.innerWidth;
    const logicalHeight = worldRef.current?.clientHeight || window.innerHeight;

    if (currentSpaceId !== lastLoopSpaceId.current) {
      lastLoopSpaceId.current = currentSpaceId; visualTransformRef.current = { ...transform }; snapNextFrame.current = true;
    }

    const lerpFactor = 0.15;
    visualTransformRef.current.x += (transform.x - visualTransformRef.current.x) * lerpFactor;
    visualTransformRef.current.y += (transform.y - visualTransformRef.current.y) * lerpFactor;
    visualTransformRef.current.scale += (transform.scale - visualTransformRef.current.scale) * lerpFactor;

    const vT = visualTransformRef.current;
    if (worldRef.current) worldRef.current.style.transform = `translate(${vT.x}px, ${vT.y}px) scale(${vT.scale})`;
    if (gridRef.current) gridRef.current.style.transform = `translate(${vT.x}px, ${vT.y}px) scale(${vT.scale})`;

    // Apply Layouts
    if (mode === 'kanban') applyKanbanLayout(logicalWidth);
    else if (mode === 'calendar') applyCalendarLayout(logicalWidth, logicalHeight, globalScale);
    else if (mode === 'spatial' && isReturningHome.current) applyHomeReturn();
    else if (mode === 'spatial' && (activeSpace?.physics ?? true)) applySpatialPhysics(logicalWidth, logicalHeight);

    // Canvas Connections
    const ctx = canvasRef?.current?.getContext('2d');
    if (ctx && canvasRef.current) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      if (mode === 'spatial') {
        const { x: tx, y: ty, scale: s } = vT; const style = getComputedStyle(document.body);
        const accent = style.getPropertyValue('--accent').trim() || '#6366f1';
        ctx.strokeStyle = accent.startsWith('#') ? accent + '1F' : accent.replace('rgb', 'rgba').replace(')', ', 0.12)');
        ctx.beginPath();
        for (let i = 0; i < ids.length; i++) {
          const tA = thoughtMap.current.get(ids[i]); const pA = state.get(ids[i]); if (!tA?.stackId || !pA) continue;
          for (let j = i + 1; j < ids.length; j++) {
            const tB = thoughtMap.current.get(ids[j]); const pB = state.get(ids[j]); if (tB && tA.stackId === tB.stackId && pB) {
              ctx.moveTo(pA.x * s + tx, pA.y * s + ty); ctx.lineTo(pB.x * s + tx, pB.y * s + ty);
            }
          }
        }
        ctx.stroke();
      }
      if (linkingSourceId) {
        const pS = state.get(linkingSourceId);
        if (pS) {
          ctx.beginPath(); ctx.setLineDash([5, 5]); ctx.strokeStyle = 'rgba(99, 102, 241, 0.5)'; ctx.lineWidth = 2;
          ctx.moveTo(pS.x * vT.scale + vT.x, pS.y * vT.scale + vT.y); ctx.lineTo(mousePosRef.current.x, mousePosRef.current.y);
          ctx.stroke(); ctx.setLineDash([]);
        }
      }
    }

    // Apply styles
    state.forEach((p, id) => {
      const el = elements.current.get(id); const t = thoughtMap.current.get(id); if (!el || !t) return;
      const h = el.offsetHeight || 120;
      el.style.transform = `translate3d(${p.x - 140}px, ${p.y - h / 2}px, 0) scale(${p.scale})`;
      el.style.clipPath = 'none'; el.style.opacity = '1'; el.style.visibility = 'visible';
      el.style.pointerEvents = 'auto'; el.style.zIndex = (20 + (t.layer || 0)).toString();

      if (mode === 'kanban') {
        const cardBottom = (p.y * vT.scale + vT.y) + ((h * p.scale) * vT.scale) / 2;
        const opacity = Math.max(0, Math.min(1, (cardBottom - (window.innerWidth < 768 ? 170 : 200)) / 60));
        el.style.opacity = opacity.toString(); el.style.visibility = opacity === 0 ? 'hidden' : 'visible'; el.style.pointerEvents = opacity < 0.1 ? 'none' : 'auto';
      } else if (mode === 'calendar' && t.date) {
        const isH = t.date === hoveredCalDate;
        const dateThoughts = Array.from(thoughtMap.current.values()).filter(th => th.date === t.date).sort((a, b) => (a.layer || 0) - (b.layer || 0));
        const isTop = dateThoughts[dateThoughts.length - 1]?.id === t.id;
        if (!isH && !isTop) el.style.clipPath = 'inset(0px 0px calc(100% - 70px) 0px)';
        el.style.pointerEvents = (isH || isTop) ? 'auto' : 'none';
        el.style.transform += ` rotate(${(t.layer || 0) % 2 === 0 ? 0.8 : -0.8}deg)`;
        el.style.zIndex = (30 + (t.layer || 0)).toString();
      } else if (mode === 'calendar' && !t.date) {
        // Precision Clipping for Sidebar
        const contentEl = document.getElementById('cal-sidebar-content');
        const cRectRaw = contentEl?.getBoundingClientRect();
        if (cRectRaw && !dragRef.current?.initialPositions.has(id)) {
          const cRect = { top: cRectRaw.top / globalScale, bottom: cRectRaw.bottom / globalScale };
          const nodeScreenY = p.y * vT.scale + vT.y;
          const nodeHeightOnScreen = (h * p.scale) * vT.scale;
          const cardTop = nodeScreenY - nodeHeightOnScreen / 2;
          const cardBottom = nodeScreenY + nodeHeightOnScreen / 2;

          const topClip = Math.max(0, ((cRect.top - cardTop) / nodeHeightOnScreen) * 100);
          const bottomClip = Math.max(0, ((cardBottom - cRect.bottom) / nodeHeightOnScreen) * 100);

          el.style.clipPath = `inset(${topClip}% 0% ${bottomClip}% 0%)`;
          el.style.visibility = (topClip > 95 || bottomClip > 95) ? 'hidden' : 'visible';
          el.style.pointerEvents = (topClip > 80 || bottomClip > 80) ? 'none' : 'auto';
        }
        el.style.zIndex = '35';
      }
    });
    if (ids.length > 0) snapNextFrame.current = false;
  }, [activeSpace, activeSpaceId, calendarViewDate, hoveredCalDate, transform, linkingSourceId, getGlobalScale]);

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
    dragRef.current = { id, startX: e.clientX / s, startY: e.clientY / s, moved: false, lastMouseX: e.clientX / s, lastMouseY: e.clientY / s, initialPositions };
  }, [getGlobalScale]);

  return { registerElement: (id: number, el: HTMLDivElement | null) => { if (el) elements.current.set(id, el); else elements.current.delete(id); }, registerWorld: (el: HTMLDivElement | null) => { worldRef.current = el; }, registerGrid: (el: HTMLDivElement | null) => { gridRef.current = el; }, handleMouseDown: handleMouseDown as (id: number, e: React.MouseEvent) => void, isDragging: (id: number) => !!dragRef.current?.initialPositions.has(id), sidebarHeight: sbHeight, kanbanHeight: kMaxHeight };
};
