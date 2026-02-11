import { useEffect, useRef, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { db, type Thought } from '../db';

const DAMPING = 0.8; // Increased friction (was 0.88)
const REPULSION = 80000; // Slightly lower repulsion
const ATTRACTION = 0.01; // Lower attraction (was 0.02)
const GRAVITY = 0.003; // Gentler gravity
const MAX_VELOCITY = 10; // Slower speed limit (was 15)
const COMFORT_ZONE = 200; // Increased comfort zone

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

  useEffect(() => {
    const handleMouseGlobal = (e: MouseEvent) => {
      const body = document.querySelector('.app-body') || document.body;
      const style = window.getComputedStyle(body);
      const m = new DOMMatrix(style.transform);
      const s = m.a || 1;
      mousePosRef.current = { x: e.clientX / s, y: e.clientY / s };
    };
    window.addEventListener('mousemove', handleMouseGlobal);
    return () => window.removeEventListener('mousemove', handleMouseGlobal);
  }, []);

  useEffect(() => {
    thoughtMap.current.clear();
    const mode = activeSpace?.mode || 'spatial';

    thoughts.forEach((t) => {
      thoughtMap.current.set(t.id, { ...t });
      if (!physicsState.current.has(t.id)) {
        // If we are in Kanban or Calendar and just switched space, 
        // we might want a hard snap. We initialize with a flag or just use t.x/y.
        physicsState.current.set(t.id, {
          x: t.x,
          y: t.y,
          vx: t.vx || 0,
          vy: t.vy || 0,
          scale: mode === 'spatial' ? 1 : 0.1 // Small scale start for non-spatial
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

    // 1. Handle Space Switch (Sync refs only, snap happens in loop)
    if (currentSpaceId !== prevSpaceIdRef.current) {
      prevSpaceIdRef.current = currentSpaceId || null;
      prevModeRef.current = currentMode;
      prevTransformRef.current = { ...transform };
      return;
    }

    // 2. Handle Mode Switch within same space (Smooth Transition)
    if (currentMode === 'spatial' && prevModeRef.current !== 'spatial' && prevModeRef.current !== null) {
      isReturningHome.current = true;

      const oldT = prevTransformRef.current;
      const newT = transform;

      physicsState.current.forEach((p) => {
        const oldScreenX = p.x * oldT.scale + oldT.x;
        const oldScreenY = p.y * oldT.scale + oldT.y;
        p.x = (oldScreenX - newT.x) / newT.scale;
        p.y = (oldScreenY - newT.y) / newT.scale;
        p.scale = (p.scale * oldT.scale) / newT.scale;
        p.vx = 0;
        p.vy = 0;
      });
    }

    prevModeRef.current = currentMode;
    prevTransformRef.current = { ...transform };

    return () => {
      // Save all positions when leaving spatial mode
      if (currentMode === 'spatial' && currentSpaceId) {
        thoughts.forEach((t) => {
          const p = physicsState.current.get(t.id);
          if (p && !useStore.getState().isReadOnly) {
            db.thoughts.update(t.id, { x: p.x, y: p.y });
          }
        });
      }
    };
  }, [activeSpace?.mode, activeSpaceId, thoughts, transform]);

  useEffect(() => {
    const getGlobalScale = () => {
      const body = document.querySelector('.app-body') || document.body;
      const style = window.getComputedStyle(body);
      const m = new DOMMatrix(style.transform);
      return m.a || 1;
    };

    const handleMove = (clientX: number, clientY: number) => {
      if (!dragRef.current) return;
      const s = getGlobalScale();
      const logicalX = clientX / s;
      const logicalY = clientY / s;

      const { startX, startY, initialPositions } = dragRef.current;
      const dx = (logicalX - startX) / transform.scale;
      const dy = (logicalY - startY) / transform.scale;

      if (Math.abs(logicalX - startX) > 5 || Math.abs(logicalY - startY) > 5) {
        dragRef.current.moved = true;
      }

      if (dragRef.current.moved) {
        initialPositions.forEach((pos, id) => {
          const p = physicsState.current.get(id);
          if (p) {
            p.x = pos.x + dx;
            p.y = pos.y + dy;
            p.vx = 0;
            p.vy = 0;
          }
        });
      }
    };

    const handleMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY);

    const logicalWidth = worldRef.current?.clientWidth || window.innerWidth;
    const logicalHeight = worldRef.current?.clientHeight || window.innerHeight;

    const handleUp = (rawMouseX: number, rawMouseY: number, e: MouseEvent) => {
      if (dragRef.current) {
        const s = getGlobalScale();
        const lastMouseX = rawMouseX / s;
        const lastMouseY = rawMouseY / s;

        const { id, moved, startX, startY } = dragRef.current;
        const dist = Math.sqrt(Math.pow(lastMouseX - startX, 2) + Math.pow(lastMouseY - startY, 2));

        if (dist <= 5) {
          // It was a click, handle selection/opening
          const store = useStore.getState();
          if (e.ctrlKey || e.metaKey) {
            store.toggleThoughtSelection(id);
          } else {
            store.setSelectedThoughtId(id);
            if (!store.isReadOnly) store.setInspectorOpen(true);
          }
        } else if (moved) {
          const isReadOnly = useStore.getState().isReadOnly;
          // It was a drag, finalize positions
          const mode = activeSpace?.mode || 'spatial';
          if (mode === 'kanban' && !isReadOnly) {
            const colWidth = logicalWidth / 4;
            let status: 'none' | 'todo' | 'doing' | 'done' = 'none';
            if (lastMouseX > colWidth && lastMouseX < colWidth * 2) status = 'todo';
            else if (lastMouseX >= colWidth * 2 && lastMouseX < colWidth * 3) status = 'doing';
            else if (lastMouseX >= colWidth * 3) status = 'done';

            const p = physicsState.current.get(id);
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
          } else if (mode === 'calendar' && !useStore.getState().isReadOnly) {
            const sidebarWidth = 260; const gap = 20; const padding = 40; const topPadding = 190; const mainLeft = padding + sidebarWidth + gap;

            if (lastMouseX < mainLeft) {
              // Unassign all selected thoughts
              dragRef.current.initialPositions.forEach((_, draggedId) => {
                updateThought(draggedId, { date: '' });
              });
            } else {
              const mainWidth = logicalWidth - mainLeft - padding;
              const mainHeight = logicalHeight - topPadding - 120; // Match the 120px bottom padding
              const cellWidth = mainWidth / 7;
              const cellHeight = mainHeight / 5;

              const gridX = lastMouseX - mainLeft;
              const gridY = lastMouseY - topPadding;

              if (gridX >= 0 && gridY >= 0) {
                const col = Math.floor(gridX / cellWidth);
                const row = Math.floor(gridY / cellHeight);

                if (col >= 0 && col < 7 && row >= 0 && row < 5) {
                  const year = calendarViewDate.getFullYear(); const month = calendarViewDate.getMonth();
                  const firstDay = new Date(year, month, 1).getDay() || 7;
                  const startOffset = firstDay - 1; const dayIndex = row * 7 + col - startOffset;
                  const newDate = new Date(year, month, dayIndex + 1);

                  if (newDate.getMonth() === month) {
                    const dateStr = newDate.toLocaleDateString('en-CA');
                    // Assign all selected thoughts to this date
                    dragRef.current.initialPositions.forEach((_, draggedId) => {
                      updateThought(draggedId, { date: dateStr });
                    });
                  }
                }
              }
            }
          } else {
            // Spatial Mode: Save all new positions
            dragRef.current.initialPositions.forEach((_, draggedId) => {
              const p = physicsState.current.get(draggedId);
              if (p) updateThought(draggedId, { x: p.x, y: p.y });
            });
          }
        }
        dragRef.current = null;
      }
    };

    const handleMouseUp = (e: MouseEvent) => handleUp(e.clientX, e.clientY, e);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [transform.scale, updateThought, activeSpace, calendarViewDate]);

  const loop = useCallback(() => {
    const state = physicsState.current;
    const ids = Array.from(state.keys());
    const mode = activeSpace?.mode || 'spatial';
    const physicsEnabled = activeSpace?.physics ?? true;
    const currentSpaceId = activeSpaceId || null;

    // Use Logical Dimensions to account for CSS Scaling
    const logicalWidth = worldRef.current?.clientWidth || window.innerWidth;
    const logicalHeight = worldRef.current?.clientHeight || window.innerHeight;

    // Detect Global Scale (from index.css rule)
    const bodyStyle = window.getComputedStyle(document.querySelector('.app-body') || document.body);
    const matrix = new DOMMatrix(bodyStyle.transform);
    const globalScale = matrix.a || 1; // matrix.a is the horizontal scale

    // --- CRITICAL: Frame-Accurate Space Snapping ---
    if (currentSpaceId !== lastLoopSpaceId.current) {
      lastLoopSpaceId.current = currentSpaceId;
      visualTransformRef.current = { ...transform }; // Snap camera
      isReturningHome.current = false;
      snapNextFrame.current = true; // Signal thoughts to snap next time they appear
    }

    // Smooth Viewport Transition (Visual Transform)
    const lerpFactor = 0.15;
    visualTransformRef.current.x += (transform.x - visualTransformRef.current.x) * lerpFactor;
    visualTransformRef.current.y += (transform.y - visualTransformRef.current.y) * lerpFactor;
    visualTransformRef.current.scale += (transform.scale - visualTransformRef.current.scale) * lerpFactor;

    const vT = visualTransformRef.current;

    // Apply smooth transform to World and Grid directly for zero-jank
    if (worldRef.current) {
      worldRef.current.style.transform = `translate(${vT.x}px, ${vT.y}px) scale(${vT.scale})`;
    }
    if (gridRef.current) {
      gridRef.current.style.transform = `translate(${vT.x}px, ${vT.y}px) scale(${vT.scale})`;
    }

    const sbContent = document.getElementById('cal-sidebar-content');
    const sidebarEl = document.querySelector('.cal-sidebar');
    const sbRect = sidebarEl?.getBoundingClientRect();

    if (mode === 'kanban') {
      const allThoughts = Array.from(thoughtMap.current.values());
      const statuses: ('none' | 'todo' | 'doing' | 'done')[] = ['none', 'todo', 'doing', 'done'];
      let maxColHeight = 0;

      statuses.forEach((s, colIdx) => {
        const list = allThoughts.filter(t => t.status === s).sort((a, b) => a.order - b.order);
        let currentY = 280;
        list.forEach((t) => {
          const p = state.get(t.id); if (!p) return;
          const isDraggingThis = dragRef.current?.initialPositions.has(t.id);

          const colWidth = logicalWidth / 4;
          const targetX = (colWidth * colIdx) + (colWidth / 2);
          const el = elements.current.get(t.id); const height = el?.offsetHeight || 120; const targetY = currentY + height / 2;

          currentY += height + 24; // Always increment Y to preserve layout space

          if (isDraggingThis) return; // Skip position update for the dragged node

          if (snapNextFrame.current) {
            p.x = targetX; p.y = targetY; p.scale = 1;
          } else {
            p.x += (targetX - p.x) * 0.15; p.y += (targetY - p.y) * 0.15; p.scale += (1 - p.scale) * 0.1;
          }
          p.vx = 0; p.vy = 0;
        });
        if (currentY > maxColHeight) maxColHeight = currentY;
      });
      kMaxHeight.current = maxColHeight;
      if (allThoughts.length > 0) snapNextFrame.current = false;

    } else if (mode === 'calendar') {
      const year = calendarViewDate.getFullYear(); const month = calendarViewDate.getMonth(); const firstDay = new Date(year, month, 1).getDay() || 7;
      const sidebarWidth = 260; const gap = 20; const padding = 40; const topPadding = 190; const mainLeft = padding + sidebarWidth + gap;
      const mainWidth = logicalWidth - mainLeft - padding; const cellWidth = mainWidth / 7; const cellHeight = (logicalHeight - topPadding - 120) / 5;
      const allThoughts = Array.from(thoughtMap.current.values());
      const scheduled = allThoughts.filter(t => !!t.date);
      const unscheduled = allThoughts.filter(t => !t.date).sort((a, b) => a.order - b.order);

      // Group by date for stacking
      const groups = new Map<string, Thought[]>();
      scheduled.forEach(t => {
        if (!groups.has(t.date)) groups.set(t.date, []);
        groups.get(t.date)!.push(t);
      });

      groups.forEach((groupThoughts, dateStr) => {
        const tDate = new Date(dateStr + 'T00:00:00');
        if (tDate.getFullYear() === year && tDate.getMonth() === month) {
          const day = tDate.getDate();
          const startOffset = firstDay - 1;
          const cellIndex = startOffset + (day - 1);
          const col = cellIndex % 7;
          const row = Math.floor(cellIndex / 7);

          const cellX = mainLeft + col * cellWidth;
          const cellY = topPadding + row * cellHeight;

          const isHovered = hoveredCalDate === dateStr;

          // Dynamic Spacing & Scaling Logic to prevent overflow
          const count = groupThoughts.length;
          const maxHSpace = cellWidth * 0.4;
          const maxVSpace = cellHeight * 0.4; // Tighter vertical space for fanning

          // Fit scale to both width and a conservative height
          const widthScale = (cellWidth - 20) / 280;
          const heightScale = (cellHeight - 60) / 250; // Assume 250px as a "tall" thought baseline
          const uniformScale = Math.min(widthScale, heightScale, 0.45);

          let hSpread = isHovered ? 20 : 8;
          let vSpread = isHovered ? 60 : 25;

          if (count > 1) {
            hSpread = Math.min(hSpread, maxHSpace / (count - 1));
            vSpread = Math.min(vSpread, maxVSpace / (count - 1));
          }

          const sortedGroup = groupThoughts.sort((a, b) => (a.layer || 0) - (b.layer || 0));

          sortedGroup.forEach((t, index) => {
            const p = state.get(t.id);
            if (!p || dragRef.current?.initialPositions.has(t.id)) return;

            const el = elements.current.get(t.id);
            const h = el?.offsetHeight || 120;

            // Refined Top-Left Anchoring: space on left, very tight on top
            const startX = cellX + 10;
            const startY = cellY + 2;

            // targetX/Y are centers in the physics engine.
            // Logical center = desired top-left + (visual size / 2)
            const targetScale = isHovered ? uniformScale * 1.05 : uniformScale;
            const targetX = startX + (index * hSpread) + (280 * targetScale) / 2;
            const targetY = startY + (index * vSpread) + (h * targetScale) / 2;

            if (snapNextFrame.current) {
              p.x = targetX; p.y = targetY; p.scale = targetScale;
            } else {
              p.x += (targetX - p.x) * 0.2;
              p.y += (targetY - p.y) * 0.2;
              p.scale += (targetScale - p.scale) * 0.1;
            }
            p.vx = 0; p.vy = 0;
          });
        } else {
          groupThoughts.forEach(t => {
            const p = state.get(t.id);
            if (!p || dragRef.current?.initialPositions.has(t.id)) return;
            p.x = logicalWidth / 2; p.y = logicalHeight + 500; p.scale = 0;
          });
        }
      });

      const contentRect = sbContent?.getBoundingClientRect();
      let currentSB_Y = contentRect ? (contentRect.top / globalScale) + 20 : 200;
      const scrollTop = sbContent?.scrollTop || 0;
      unscheduled.forEach((t) => {
        const stateP = state.get(t.id); if (!stateP) return;
        const isDraggingThis = dragRef.current?.initialPositions.has(t.id);

        const el = elements.current.get(t.id); const height = (el?.offsetHeight || 120) * 0.6;
        const target = { x: padding + sidebarWidth / 2, y: currentSB_Y - scrollTop + height / 2, scale: 0.6 };

        currentSB_Y += height + 20; // Always increment Y to preserve layout space

        if (isDraggingThis) return; // Skip position update for the dragged node

        if (snapNextFrame.current) {
          stateP.x = target.x; stateP.y = target.y; stateP.scale = target.scale;
        } else {
          stateP.x += (target.x - stateP.x) * 0.15; stateP.y += (target.y - stateP.y) * 0.15; stateP.scale += (target.scale - stateP.scale) * 0.1;
        }
        stateP.vx = 0; stateP.vy = 0;
      });
      sbHeight.current = currentSB_Y - (contentRect?.top || 0);
      const spacer = document.getElementById('cal-sidebar-spacer'); if (spacer) spacer.style.height = `${sbHeight.current + 40}px`;
      if (allThoughts.length > 0) snapNextFrame.current = false;
    } else if (mode === 'spatial' && isReturningHome.current) {
      let allSettled = true;
      ids.forEach((id) => {
        const p = state.get(id)!;
        const t = thoughtMap.current.get(id);
        if (!t) return;

        const dx = t.x - p.x;
        const dy = t.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        const prioLevel = PRIORITY_WEIGHT[t.priority] || 0;
        const targetScale = (1 + prioLevel * 0.05) * (t.size || 1);

        if (dist > 1) {
          p.x += dx * 0.12;
          p.y += dy * 0.12;
          allSettled = false;
        } else {
          p.x = t.x;
          p.y = t.y;
        }

        p.scale += (targetScale - p.scale) * 0.12;
        p.vx = 0;
        p.vy = 0;
      });

      if (allSettled) isReturningHome.current = false;

    } else if (mode === 'spatial' && physicsEnabled) {
      ids.forEach((id) => {
        if (dragRef.current?.initialPositions.has(id)) return;
        const p = state.get(id)!; const t = thoughtMap.current.get(id); if (!t) return;

        if (snapNextFrame.current) {
          p.x = t.x; p.y = t.y; p.vx = 0; p.vy = 0;
          const prioLevel = PRIORITY_WEIGHT[t.priority] || 0;
          p.scale = (1 + prioLevel * 0.05) * (t.size || 1);
          return;
        }

        const prioLevel = PRIORITY_WEIGHT[t.priority] || 0;
        const gravityMultiplier = 1 + prioLevel * 0.5;
        const targetScale = (1 + prioLevel * 0.05) * (t.size || 1);
        p.vx += (logicalWidth / 2 - p.x) * (GRAVITY * gravityMultiplier); p.vy += (logicalHeight / 2 - p.y) * (GRAVITY * gravityMultiplier);

        const el = elements.current.get(id);
        const nHeight = el?.offsetHeight || 120;
        const nRadius = Math.max(120, (nHeight / 2) * p.scale);

        ids.forEach((otherId) => {
          if (id === otherId) return; const otherP = state.get(otherId)!; const otherT = thoughtMap.current.get(otherId); if (!otherT) return;
          const dx = p.x - otherP.x; const dy = p.y - otherP.y;
          const distSq = dx * dx + dy * dy || 1;
          const d = Math.sqrt(distSq);

          const otherEl = elements.current.get(otherId);
          const otherHeight = otherEl?.offsetHeight || 120;
          const otherRadius = Math.max(120, (otherHeight / 2) * otherP.scale);
          const minDistance = (nRadius + otherRadius);

          const otherPrio = PRIORITY_WEIGHT[otherT.priority] || 0;
          const combinedPrio = prioLevel + otherPrio;
          const repulsionMultiplier = 1 + combinedPrio * 0.1;

          // Smoother Repulsion
          if (d < minDistance) {
            const force = ((minDistance - d) / minDistance) * 12; // Cap repulsion force at 12
            p.vx += (dx / d) * force;
            p.vy += (dy / d) * force;
          } else {
            const force = Math.min((REPULSION * repulsionMultiplier) / distSq, 8);
            p.vx += (dx / d) * force;
            p.vy += (dy / d) * force;
          }

          // Unique Stack Attraction
          if (t.stackId && t.stackId === otherT.stackId) {
            if (d > COMFORT_ZONE) {
              const pull = (d - COMFORT_ZONE) * ATTRACTION;
              p.vx -= (dx / d) * pull;
              p.vy -= (dy / d) * pull;
            }
          }
        });

        // Velocity clamping and damping
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (speed > MAX_VELOCITY) {
          p.vx = (p.vx / speed) * MAX_VELOCITY;
          p.vy = (p.vy / speed) * MAX_VELOCITY;
        }

        p.vx *= DAMPING;
        p.vy *= DAMPING;
        p.x += p.vx;
        p.y += p.vy;
        p.scale += (targetScale - p.scale) * 0.1;
      });
      if (ids.length > 0) snapNextFrame.current = false;
    }

    const ctx = canvasRef?.current?.getContext('2d');
    if (ctx && canvasRef.current) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height); ctx.lineWidth = 1;
      const { x: tx, y: ty, scale: s } = vT;

      const computedStyle = getComputedStyle(document.body);
      const accentColor = computedStyle.getPropertyValue('--accent').trim() || '#6366f1';
      const accentGlow = computedStyle.getPropertyValue('--accent-glow').trim() || 'rgba(99, 102, 241, 0.5)';

      // Draw Connections
      ctx.strokeStyle = accentColor.startsWith('#') ? accentColor + '1F' : accentColor.replace('rgb', 'rgba').replace(')', ', 0.12)');

      ctx.beginPath();
      for (let i = 0; i < ids.length; i++) {
        const idA = ids[i]; const tA = thoughtMap.current.get(idA); const pA = state.get(idA); if (!tA || !pA) continue;
        for (let j = i + 1; j < ids.length; j++) {
          const idB = ids[j]; const tB = thoughtMap.current.get(idB); const pB = state.get(idB); if (!tB || !pB) continue;
          const isSameStack = tA.stackId && tA.stackId === tB.stackId;
          if (isSameStack) { const x1 = pA.x * s + tx; const y1 = pA.y * s + ty; const x2 = pB.x * s + tx; const y2 = pB.y * s + ty; ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); }
        }
      }
      ctx.stroke();

      // Draw Linking Thread Preview
      if (linkingSourceId) {
        const pSource = state.get(linkingSourceId);
        if (pSource) {
          ctx.beginPath();
          ctx.setLineDash([5, 5]);
          ctx.strokeStyle = accentGlow;
          ctx.lineWidth = 2;
          const x1 = pSource.x * s + tx;
          const y1 = pSource.y * s + ty;
          ctx.moveTo(x1, y1);
          ctx.lineTo(mousePosRef.current.x, mousePosRef.current.y);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }

    ids.forEach((id) => {
      const p = state.get(id)!; const el = elements.current.get(id);
      if (el) {
        const offsetHeight = el.offsetHeight || 120;
        el.style.transform = `translate3d(${p.x - 140}px, ${p.y - offsetHeight / 2}px, 0) scale(${p.scale})`;
        const t = thoughtMap.current.get(id);
        const prioLevel = t ? (PRIORITY_WEIGHT[t.priority] || 0) : 0;

        const { y: ty, scale: s } = vT;
        const nodeScreenY = p.y * s + ty;
        const nodeHeightOnScreen = (offsetHeight * p.scale) * s;
        const cardTop = nodeScreenY - nodeHeightOnScreen / 2;
        const cardBottom = nodeScreenY + nodeHeightOnScreen / 2;

        const isDraggingThis = dragRef.current?.initialPositions.has(id);

        if (mode === 'calendar' && t && !t.date && sbRect && !isDraggingThis) {
          // Precision Clipping using the actual scrollable content rect
          const contentEl = document.getElementById('cal-sidebar-content');
          const cRectRaw = contentEl?.getBoundingClientRect();

          if (cRectRaw) {
            // Normalize physical rect to logical units
            const cRect = {
              top: cRectRaw.top / globalScale,
              bottom: cRectRaw.bottom / globalScale
            };

            const nodeHeight = (offsetHeight * p.scale) * vT.scale;
            // Calculate percentage to hide from top and bottom
            const topDiff = cRect.top - cardTop;
            const bottomDiff = cardBottom - cRect.bottom;

            const topClip = Math.max(0, (topDiff / nodeHeight) * 100);
            const bottomClip = Math.max(0, (bottomDiff / nodeHeight) * 100);

            el.style.clipPath = `inset(${topClip}% 0% ${bottomClip}% 0%)`;
            el.style.opacity = '1';
            el.style.visibility = (topClip > 95 || bottomClip > 95) ? 'hidden' : 'visible';
            el.style.pointerEvents = (topClip > 80 || bottomClip > 80) ? 'none' : 'auto';
          } else {
            el.style.clipPath = 'none';
          }
          el.style.zIndex = '35';
        } else if (mode === 'kanban') {
          el.style.clipPath = 'none'; // Ensure no clipping in other modes
          // Kanban Fading Logic: Hide cards as they go behind headers
          const isMobile = window.innerWidth < 768;
          const headerBottom = isMobile ? 170 : 200;
          const buffer = 60;

          const opacity = Math.max(0, Math.min(1, (cardBottom - headerBottom) / buffer));

          el.style.opacity = opacity.toString();
          el.style.visibility = opacity === 0 ? 'hidden' : 'visible';
          el.style.pointerEvents = opacity < 0.1 ? 'none' : 'auto';
          el.style.zIndex = (20 + prioLevel).toString();
        } else if (mode === 'calendar') {
          const isHovered = t?.date === hoveredCalDate;
          const isDraggingThis = dragRef.current?.initialPositions.has(id);

          if (t?.date && !isDraggingThis) {
            // Determine if this is the top card of its stack
            const dateThoughts = Array.from(thoughtMap.current.values())
              .filter(th => th.date === t.date)
              .sort((a, b) => (a.layer || 0) - (b.layer || 0));
            const isTopCard = dateThoughts.length > 0 && dateThoughts[dateThoughts.length - 1].id === t.id;

            if (isHovered || isTopCard) {
              el.style.clipPath = 'none';
            } else {
              // Fixed header height clip for the "Filing Cabinet" tab look
              // Shows exactly 70px of the card's top regardless of its total height
              el.style.clipPath = 'inset(0px 0px calc(100% - 70px) 0px)';
            }

            // Add a slight "deck" rotation for tactile feel
            const rot = ((t.layer || 0) % 2 === 0 ? 0.8 : -0.8);
            el.style.transform += ` rotate(${rot}deg)`;
          } else {
            el.style.clipPath = 'none';
          }

          el.style.opacity = '1'; el.style.visibility = 'visible'; el.style.pointerEvents = 'auto';
          if (isDraggingThis) {
            el.style.zIndex = '1000';
          } else {
            // Use global layer for zIndex
            el.style.zIndex = (30 + (t?.layer || 0)).toString();
          }
        } else {
          el.style.clipPath = 'none';
          el.style.opacity = '1'; el.style.visibility = 'visible'; el.style.pointerEvents = 'auto';
          if (dragRef.current?.initialPositions.has(id)) {
            el.style.zIndex = '1000';
          } else {
            // Strict Ordinal Layering
            // layer 1 = bottom, layer N = top
            el.style.zIndex = (20 + (t?.layer || 0)).toString();
          }
        }
      }
    });
  }, [activeSpace, calendarViewDate, transform, linkingSourceId, canvasRef]);

  useEffect(() => {
    const animate = () => {
      loop();
      requestRef.current = requestAnimationFrame(animate);
    };
    requestRef.current = requestAnimationFrame(animate);
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [loop]);

  const registerElement = useCallback((id: number, el: HTMLDivElement | null) => { if (el) elements.current.set(id, el); else elements.current.delete(id); }, []);
  const registerWorld = useCallback((el: HTMLDivElement | null) => { worldRef.current = el; }, []);
  const registerGrid = useCallback((el: HTMLDivElement | null) => { gridRef.current = el; }, []);

  const handleMouseDown = useCallback((id: number, e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('.prevent-drag')) return;

    const body = document.querySelector('.app-body') || document.body;
    const style = window.getComputedStyle(body);
    const m = new DOMMatrix(style.transform);
    const s = m.a || 1;

    const clientX = e.clientX / s;
    const clientY = e.clientY / s;

    const store = useStore.getState();
    // Remove the early return for read-only mode to allow selection clicks
    // Dragging will still be restricted by logic in handleUp and move handlers

    const currentSelectedIds = store.selectedThoughtIds;
    let targets = new Set(currentSelectedIds);
    if (!targets.has(id)) targets.add(id);

    const initialPositions = new Map();
    targets.forEach(tid => {
      const p = physicsState.current.get(tid);
      if (p) initialPositions.set(tid, { x: p.x, y: p.y });
    });

    dragRef.current = {
      id,
      startX: clientX,
      startY: clientY,
      moved: false,
      lastMouseX: clientX,
      lastMouseY: clientY,
      initialPositions
    };
  }, [activeSpace]);

  const isDragging = useCallback((id: number) => !!dragRef.current?.initialPositions.has(id), []);
  return {
    registerElement,
    registerWorld,
    registerGrid,
    handleMouseDown: handleMouseDown as (id: number, e: React.MouseEvent) => void,
    isDragging,
    sidebarHeight: sbHeight,
    kanbanHeight: kMaxHeight
  };
};
