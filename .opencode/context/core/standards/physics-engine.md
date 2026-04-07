<!-- Context: physics-engine | Priority: high | Version: 1.0 | Updated: 2026-04-07 -->
# Physics Engine Context

**Purpose**: Spatial thinking engine architecture, mode transitions, and rendering system.

---

## Core Architecture

The physics engine is a custom-built spatial simulation system that:
- Positions thoughts as physical entities with `x, y` (position) and `vx, vy` (velocity)
- Runs at 60fps via `requestAnimationFrame` in `usePhysics.ts`
- Uses direct DOM manipulation (not React) for performance
- Manages three view modes: **Spatial**, **Kanban**, **Calendar**

### Physics Files

| File | Purpose |
|------|---------|
| `src/hooks/usePhysics.ts` | Main physics loop, initialization, mode transitions |
| `src/hooks/physics/index.ts` | Strategist factory (`getStrategist`) |
| `src/hooks/physics/spatialStrategy.ts` | Spatial mode layout + repulsion forces |
| `src/hooks/physics/kanbanStrategy.ts` | Kanban column layout |
| `src/hooks/physics/calendarStrategy.ts` | Calendar date-based layout |
| `src/hooks/physics/types.ts` | `LayoutStrategist` interface |
| `src/hooks/useCamera.ts` | Smooth camera system (framer-motion springs) |

---

## Mode Transitions

### Animation System (`modeTransitionRef`)

When switching modes, the engine activates a **500ms transition period**:

```typescript
modeTransitionRef.current = { active: true, startTime: performance.now(), enteringScale: 0 };

// In the loop - faster lerp during transition
const isTransitioning = modeTransitionRef.current.active && 
  (performance.now() - modeTransitionRef.current.startTime < 500);
const speed = isTransitioning ? 0.25 : 0.08; // Fast → normal
```

**Launch Effect**: Thoughts scale up slightly (1.15x) during entry, then settle.

**Anti-Patterns:**
- ❌ DON'T force `snapNextFrame.current = true` on mode switch — breaks animation
- ✅ DO let `modeTransitionRef` handle smooth transitions

### Ghost Thought Fix (Origin Hiding)

When switching to Kanban/Calendar, thoughts at position `(0,0)` are hidden until layout calculates their correct position. This prevents the "ghost in top-left corner" flash:

```typescript
const isAtOrigin = Math.abs(p.x) < 1 && Math.abs(p.y) < 1;
const shouldHide = mode !== 'spatial' && isAtOrigin && !isDraggingThis && !isSelected;

el.style.opacity = shouldHide ? '0' : (res.opacity ?? 1).toString();
el.style.visibility = shouldHide ? 'hidden' : (res.visibility ?? 'visible');
```

---

## Loading State Guard

When switching spaces, `isSpaceLoading: true` pauses the physics loop. Without this guard, thoughts collapse to center (0,0) before heights are captured:

```typescript
// Guard at start of loop
if (isSpaceLoading) return;

// Guard in initialization useEffect
useEffect(() => {
  if (isSpaceLoading) return;
  // ... initialize physics state
}, [thoughts, activeSpace?.mode, isSpaceLoading]);
```

---

## Layer Shadow Mode Awareness

Thought node shadows differ by mode:

| Mode | Layer Shadow | Notes |
|------|-------------|-------|
| **Spatial** | ✅ Applied | 3D stacking via `altitudeStyles` |
| **Kanban** | ❌ Disabled | Flat layout |
| **Calendar** | ❌ Disabled | Flat layout |

**Implementation in `ThoughtNode.tsx`:**
```typescript
const useLayerShadow = isSpatial && thought.layer && thought.layer > 0;
```

In non-spatial modes, only the base CSS shadow (`shadow-[0_10px_40px_rgba(0,0,0,0.5)]`) applies.

---

## Position Persistence

```
Spatial Mode → Move thoughts (physics stores positions in memory)
    → Switch to Kanban → Cleanup effect fires → bulkUpdateThoughts() saves to IndexedDB
    → Switch back to Spatial → Initialization effect reads saved x,y → Thoughts restored
```

**Anti-Patterns:**
- ❌ DON'T call `refreshThoughts()` after local mutations — Zustand already correct
- ❌ DON'T write directly to IndexedDB for UI state — use Zustand first
- ❌ DON'T use `scatterThoughts()` on space load — overwrites saved positions

---

## Rendering System

### World (`World.tsx`)

Renders all `ThoughtNode` components inside `#world` div. Physics loop applies transforms directly via DOM:

```typescript
el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) scale(${p.scale})`;
el.style.zIndex = isSelected ? '10001' : (res.zIndex || (20 + (t.layer || 0)).toString());
```

### Canvas (`connection-canvas`)

Draws stack connection lines and linking preview in **spatial mode only**. Uses 2D canvas context synchronized with `#world` CSS transform.

---

## Key Refs

- `src/components/ThoughtNode.tsx` — Node rendering with altitude styles
- `src/components/World.tsx` — World container + canvas
- `src/components/KanbanOverlay.tsx` — Kanban UI chrome
- `docs/physics-engine.md` — Detailed physics principles
