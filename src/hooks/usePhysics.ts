import { useEffect, useRef, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { db, type Thought } from '../db';

const DAMPING = 0.88;
const REPULSION = 100000;
const ATTRACTION = 0.02;
const GRAVITY = 0.004;

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

  const physicsState = useRef<Map<number, { x: number; y: number; vx: number; vy: number; scale: number }>>(new Map());
  const elements = useRef<Map<number, HTMLDivElement>>(new Map());
  const sbHeight = useRef(0);
  const kMaxHeight = useRef(0);
  const requestRef = useRef<number>(null);
  const prevModeRef = useRef<string | null>(null);
  
  const thoughtMap = useRef<Map<number, Thought>>(new Map());
  const dragRef = useRef<{ 
    id: number; 
    startX: number; 
    startY: number; 
    nodeStartX: number; 
    nodeStartY: number; 
    moved: boolean;
    lastMouseX: number;
    lastMouseY: number;
  } | null>(null);

  useEffect(() => {
    thoughtMap.current.clear();
    thoughts.forEach((t) => {
      thoughtMap.current.set(t.id, { ...t });
      if (!physicsState.current.has(t.id)) {
        physicsState.current.set(t.id, {
          x: t.x,
          y: t.y,
          vx: t.vx || 0,
          vy: t.vy || 0,
          scale: 1
        });
      }
    });

    const thoughtIds = new Set(thoughts.map((t) => t.id));
    for (const id of physicsState.current.keys()) {
      if (!thoughtIds.has(id)) {
        physicsState.current.delete(id);
        elements.current.delete(id);
      }
    }
  }, [thoughts]);

  useEffect(() => {
    const currentMode = activeSpace?.mode || 'spatial';
    const currentSpaceId = activeSpaceId;

    if (currentMode === 'spatial' && prevModeRef.current !== 'spatial') {
      // Sync from DB to ensure we have the absolute latest positions (especially after leaving another mode)
      db.thoughts.where('spaceId').equals(currentSpaceId!).toArray().then(latestThoughts => {
        latestThoughts.forEach((t) => {
          const p = physicsState.current.get(t.id);
          if (p) {
            p.x = t.x;
            p.y = t.y;
            p.vx = 0;
            p.vy = 0;
          }
        });
      });
    }
    
    prevModeRef.current = currentMode;

    return () => {
      // Save all positions when leaving spatial mode
      if (currentMode === 'spatial' && currentSpaceId) {
        thoughts.forEach((t) => {
          const p = physicsState.current.get(t.id);
          if (p) {
            db.thoughts.update(t.id, { x: p.x, y: p.y });
          }
        });
      }
    };
  }, [activeSpace?.mode, activeSpaceId, thoughts]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      dragRef.current.lastMouseX = e.clientX;
      dragRef.current.lastMouseY = e.clientY;
      const { id, startX, startY, nodeStartX, nodeStartY } = dragRef.current;
      const dx = (e.clientX - startX) / transform.scale;
      const dy = (e.clientY - startY) / transform.scale;
      if (Math.abs(e.clientX - startX) > 5 || Math.abs(e.clientY - startY) > 5) dragRef.current.moved = true;
      const p = physicsState.current.get(id);
      if (p) { p.x = nodeStartX + dx; p.y = nodeStartY + dy; p.vx = 0; p.vy = 0; }
    };

    const handleMouseUp = () => {
      if (dragRef.current) {
        const { id, moved, lastMouseX, lastMouseY } = dragRef.current;
        if (moved) {
          const p = physicsState.current.get(id);
          const mode = activeSpace?.mode || 'spatial';
          if (mode === 'kanban') {
             const colWidth = window.innerWidth / 4;
             let status: 'none' | 'todo' | 'doing' | 'done' = 'none';
             if (lastMouseX > colWidth && lastMouseX < colWidth * 2) status = 'todo';
             else if (lastMouseX >= colWidth * 2 && lastMouseX < colWidth * 3) status = 'doing';
             else if (lastMouseX >= colWidth * 3) status = 'done';
             
             const thoughtsInStatus = Array.from(thoughtMap.current.values()).filter(t => (t.id === id ? status : t.status) === status);
             const sorted = thoughtsInStatus.sort((a, b) => {
                 const pA = physicsState.current.get(a.id); const pB = physicsState.current.get(b.id);
                 const yA = a.id === id ? (p?.y || 0) : (pA?.y || 0); const yB = b.id === id ? (p?.y || 0) : (pB?.y || 0);
                 return yA - yB;
             });
             sorted.forEach((t, index) => {
                 const mapEntry = thoughtMap.current.get(t.id);
                 if (mapEntry) { if (t.id === id) mapEntry.status = status; mapEntry.order = index; }
                 if (t.id === id) updateThought(t.id, { status, order: index });
                 else if (t.order !== index) updateThought(t.id, { order: index });
             });
          } else if (mode === 'calendar') {
             const sidebarWidth = 260; const gap = 20; const padding = 40; const topPadding = 190; const mainLeft = padding + sidebarWidth + gap;
             if (lastMouseX < mainLeft) {
                 const mapEntry = thoughtMap.current.get(id); if (mapEntry) mapEntry.date = '';
                 updateThought(id, { date: '' });
             } else {
                 const mainWidth = window.innerWidth - mainLeft - padding;
                 const cellWidth = mainWidth / 7; const cellHeight = (window.innerHeight - topPadding - padding) / 5;
                 const gridX = lastMouseX - mainLeft; const gridY = lastMouseY - topPadding;
                 if (gridX >= 0 && gridY >= 0) {
                     const col = Math.floor(gridX / cellWidth); const row = Math.floor(gridY / cellHeight);
                     if (col >= 0 && col < 7 && row >= 0 && row < 6) {
                         const year = calendarViewDate.getFullYear(); const month = calendarViewDate.getMonth();
                         const firstDay = new Date(year, month, 1).getDay() || 7;
                         const startOffset = firstDay - 1; const dayIndex = row * 7 + col - startOffset;
                         const newDate = new Date(year, month, dayIndex + 1);
                         if (newDate.getMonth() === month) {
                             const dateStr = newDate.toLocaleDateString('en-CA');
                             const mapEntry = thoughtMap.current.get(id); if (mapEntry) mapEntry.date = dateStr;
                             updateThought(id, { date: dateStr });
                         }
                     }
                 }
             }
          } else if (p) {
              updateThought(id, { x: p.x, y: p.y });
          }
        }
        dragRef.current = null;
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, [transform.scale, updateThought, activeSpace, calendarViewDate]);

  const loop = useCallback(() => {
    const state = physicsState.current;
    const ids = Array.from(state.keys());
    const mode = activeSpace?.mode || 'spatial';
    const physicsEnabled = activeSpace?.physics ?? true;

    const sbContent = document.getElementById('cal-sidebar-content');
    const sbRect = sbContent?.getBoundingClientRect();

    if (mode === 'kanban') {
       const allThoughts = Array.from(thoughtMap.current.values());
       const statuses: ('none' | 'todo' | 'doing' | 'done')[] = ['none', 'todo', 'doing', 'done'];
       let maxColHeight = 0;

       statuses.forEach((s, colIdx) => {
          const list = allThoughts.filter(t => t.status === s).sort((a, b) => a.order - b.order);
          let currentY = 280;
          list.forEach((t) => {
             const p = state.get(t.id); if (!p) return; if (dragRef.current?.id === t.id) return;
             const colWidth = window.innerWidth / 4; 
             const targetX = (colWidth * colIdx) + (colWidth / 2);
             const el = elements.current.get(t.id); const height = el?.offsetHeight || 120; const targetY = currentY + height / 2; currentY += height + 24;
             p.x += (targetX - p.x) * 0.15; p.y += (targetY - p.y) * 0.15; p.scale += (1 - p.scale) * 0.1; p.vx = 0; p.vy = 0;
          });
          if (currentY > maxColHeight) maxColHeight = currentY;
       });
       kMaxHeight.current = maxColHeight;

    } else if (mode === 'calendar') {
      const year = calendarViewDate.getFullYear(); const month = calendarViewDate.getMonth(); const firstDay = new Date(year, month, 1).getDay() || 7;
      const sidebarWidth = 260; const gap = 20; const padding = 40; const topPadding = 190; const mainLeft = padding + sidebarWidth + gap;
      const mainWidth = window.innerWidth - mainLeft - padding; const cellWidth = mainWidth / 7; const cellHeight = (window.innerHeight - topPadding - padding) / 5;
      const allThoughts = Array.from(thoughtMap.current.values());
      const scheduled = allThoughts.filter(t => !!t.date); const unscheduled = allThoughts.filter(t => !t.date).sort((a,b) => a.order - b.order);
      scheduled.forEach((t) => {
        const p = state.get(t.id); if (!p) return; if (dragRef.current?.id === t.id) return;
        let target = { x: 0, y: 0, scale: 0 };
        const tDate = new Date(t.date + 'T00:00:00');
        if (tDate.getFullYear() === year && tDate.getMonth() === month) {
            const day = tDate.getDate(); const startOffset = firstDay - 1; const cellIndex = startOffset + (day - 1); const col = cellIndex % 7; const row = Math.floor(cellIndex / 7);
            target.x = mainLeft + col * cellWidth + cellWidth / 2; target.y = topPadding + row * cellHeight + cellHeight / 2;
            target.scale = Math.min((cellWidth - 20) / 280, 0.45); const offset = (t.id % 5) * 5; target.x += offset; target.y += offset;
        } else { target.x = window.innerWidth / 2; target.y = window.innerHeight + 500; target.scale = 0; }
        p.x += (target.x - p.x) * 0.15; p.y += (target.y - p.y) * 0.15; p.scale += (target.scale - p.scale) * 0.1; p.vx = 0; p.vy = 0;
      });
      let currentSB_Y = sbRect ? sbRect.top + 20 : 200; const scrollTop = sbContent?.scrollTop || 0;
      unscheduled.forEach((t) => {
        const stateP = state.get(t.id); if (!stateP) return; if (dragRef.current?.id === t.id) return;
        const el = elements.current.get(t.id); const height = (el?.offsetHeight || 120) * 0.6;
        let target = { x: padding + sidebarWidth / 2, y: currentSB_Y - scrollTop + height / 2, scale: 0.6 };
        currentSB_Y += height + 20;
        stateP.x += (target.x - stateP.x) * 0.15; stateP.y += (target.y - stateP.y) * 0.15; stateP.scale += (target.scale - stateP.scale) * 0.1; stateP.vx = 0; stateP.vy = 0;
      });
      sbHeight.current = currentSB_Y - (sbRect?.top || 0); 
      const spacer = document.getElementById('cal-sidebar-spacer'); if (spacer) spacer.style.height = `${sbHeight.current + 40}px`;
    } else if (mode === 'spatial' && physicsEnabled) {
      ids.forEach((id) => {
        if (dragRef.current?.id === id) return; 
        const p = state.get(id)!; const t = thoughtMap.current.get(id); if (!t) return;
        const prioLevel = PRIORITY_WEIGHT[t.priority] || 0; const gravityMultiplier = 1 + prioLevel * 0.5; const targetScale = 1 + prioLevel * 0.05;
        p.vx += (window.innerWidth / 2 - p.x) * (GRAVITY * gravityMultiplier); p.vy += (window.innerHeight / 2 - p.y) * (GRAVITY * gravityMultiplier);
        const el = elements.current.get(id); const nHeight = el?.offsetHeight || 120; const nRadius = Math.max(100, nHeight / 2);
        ids.forEach((otherId) => {
          if (id === otherId) return; const otherP = state.get(otherId)!; const otherT = thoughtMap.current.get(otherId); if (!otherT) return;
          const dx = p.x - otherP.x; const dy = p.y - otherP.y; const distSq = dx * dx + dy * dy || 0.1; const d = Math.sqrt(distSq);
          const otherEl = elements.current.get(otherId); const otherHeight = otherEl?.offsetHeight || 120; const otherRadius = Math.max(100, otherHeight / 2);
          const minDistance = (nRadius + otherRadius) * 1.1; const otherPrio = PRIORITY_WEIGHT[otherT.priority] || 0; const combinedPrio = prioLevel + otherPrio; const repulsionMultiplier = 1 + combinedPrio * 0.1;
          let repulsionPower = REPULSION; if (d < minDistance) repulsionPower *= minDistance / d;
          const force = Math.min((repulsionPower * repulsionMultiplier) / distSq, 60); p.vx += (dx / d) * force; p.vy += (dy / d) * force;
          if (t.tags.some((tag) => otherT.tags.includes(tag)) && t.tags.length > 0) { p.vx -= dx * ATTRACTION; p.vy -= dy * ATTRACTION; }
        });
        p.vx *= DAMPING; p.vy *= DAMPING; p.x += p.vx; p.y += p.vy; p.scale += (targetScale - p.scale) * 0.1;
      });
    }

    const ctx = canvasRef?.current?.getContext('2d');
    if (ctx && canvasRef.current) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height); ctx.strokeStyle = 'rgba(99, 102, 241, 0.15)'; ctx.lineWidth = 1; ctx.beginPath();
      const { x: tx, y: ty, scale: s } = transform;
      for (let i = 0; i < ids.length; i++) {
        const idA = ids[i]; const tA = thoughtMap.current.get(idA); const pA = state.get(idA); if (!tA || !pA) continue;
        for (let j = i + 1; j < ids.length; j++) {
            const idB = ids[j]; const tB = thoughtMap.current.get(idB); const pB = state.get(idB); if (!tB || !pB) continue;
            const shared = tA.tags.some(tag => tB.tags.includes(tag));
            if (shared) { const x1 = pA.x * s + tx; const y1 = pA.y * s + ty; const x2 = pB.x * s + tx; const y2 = pB.y * s + ty; ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); }
        }
      }
      ctx.stroke();
    }

    ids.forEach((id) => {
      const p = state.get(id)!; const el = elements.current.get(id);
      if (el) {
        const offsetHeight = el.offsetHeight || 120;
        el.style.transform = `translate3d(${p.x - 140}px, ${p.y - offsetHeight / 2}px, 0) scale(${p.scale})`;
        const t = thoughtMap.current.get(id);
        const prioLevel = t ? (PRIORITY_WEIGHT[t.priority] || 0) : 0;
        
        const { y: ty, scale: s } = transform;
        const nodeScreenY = p.y * s + ty;
        const nodeHeightOnScreen = (offsetHeight * p.scale) * s;
        const cardTop = nodeScreenY - nodeHeightOnScreen / 2;
        const cardBottom = nodeScreenY + nodeHeightOnScreen / 2;

        const isDraggingThis = dragRef.current?.id === id;

        if (mode === 'calendar' && t && !t.date && sbRect && !isDraggingThis) {
            const buffer = 40; 
            const topOverlap = cardBottom - sbRect.top;
            const bottomOverlap = sbRect.bottom - cardTop;
            const isInsideHorizontal = (p.x * s + transform.x) > (sbRect.left - 50) && (p.x * s + transform.x) < (sbRect.right + 50);
            let opacity = 1;
            if (!isInsideHorizontal) opacity = 0;
            else {
                const topOpacity = Math.max(0, Math.min(1, topOverlap / buffer));
                const bottomOpacity = Math.max(0, Math.min(1, bottomOverlap / buffer));
                opacity = Math.min(topOpacity, bottomOpacity);
            }
            el.style.opacity = opacity.toString(); el.style.visibility = opacity === 0 ? 'hidden' : 'visible';
            el.style.pointerEvents = opacity < 0.1 ? 'none' : 'auto'; el.style.zIndex = '35';
        } else if (mode === 'kanban') {
            // Kanban Fading at Header (140px)
            const buffer = 40;
            const topOverlap = cardBottom - 140;
            const opacity = Math.max(0, Math.min(1, topOverlap / buffer));
            el.style.opacity = opacity.toString(); el.style.visibility = opacity === 0 ? 'hidden' : 'visible';
            el.style.pointerEvents = opacity < 0.1 ? 'none' : 'auto';
            el.style.zIndex = (20 + prioLevel).toString();
        } else {
            el.style.opacity = '1'; el.style.visibility = 'visible'; el.style.pointerEvents = 'auto';
            if (dragRef.current?.id === id) el.style.zIndex = '1000'; else el.style.zIndex = (20 + prioLevel).toString();
        }
      }
    });
    requestRef.current = requestAnimationFrame(loop);
  }, [activeSpace, calendarViewDate, transform]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(loop);
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [loop]);

  const registerElement = useCallback((id: number, el: HTMLDivElement | null) => { if (el) elements.current.set(id, el); else elements.current.delete(id); }, []);
  const handleMouseDown = useCallback((id: number, e: React.MouseEvent) => {
    if (e.button !== 0) return; if ((e.target as HTMLElement).closest('.prevent-drag')) return;
    const p = physicsState.current.get(id);
    if (p) { dragRef.current = { id, startX: e.clientX, startY: e.clientY, nodeStartX: p.x, nodeStartY: p.y, moved: false, lastMouseX: e.clientX, lastMouseY: e.clientY }; }
  }, []);
  const isDragging = useCallback((id: number) => dragRef.current?.id === id, []);
  return { registerElement, handleMouseDown, isDragging, sidebarHeight: sbHeight, kanbanHeight: kMaxHeight };
};
