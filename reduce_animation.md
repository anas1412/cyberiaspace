# Animation & Performance Analysis: Cyberia Media Interference Investigation

**Document Status:** Investigation in Progress  
**Date:** 2026-03-20  
**Issue:** Opening Cyberia web app causes videos on other browser tabs/monitors to stop working

---

## Executive Summary

When the Cyberia web application is opened, it monopolizes browser resources in ways that interfere with video playback in **other browser tabs**. This document provides a detailed technical analysis of all animation systems, resource consumption patterns, and potential causes.

---

## 1. Primary Animation Loops (Critical Priority)

### 1.1 Main Physics Loop - `src/hooks/usePhysics.ts`

**Location:** Lines 709-712

```typescript
useEffect(() => {
  const animate = () => { loop(); requestRef.current = requestAnimationFrame(animate); };
  requestRef.current = requestAnimationFrame(animate); 
  return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
}, [loop]);
```

**Characteristics:**
- Runs at **~60fps** (every ~16.67ms)
- **Never pauses** - continues running even when tab is not visible
- Executes the entire `loop()` function every frame

**What happens inside `loop()` (Lines 342-705):**

| Operation | Lines | Description | Complexity |
|-----------|-------|-------------|------------|
| Delta time calculation | 343-349 | Calculates timeScale normalized to 60fps | O(1) |
| DOMMatrix creation | 351 | `getGlobalScale()` creates new DOMMatrix every frame | O(1) |
| Transform update | 379-385 | Updates `#world` and `.dot-grid` transform via direct DOM | O(1) |
| Layout context build | 398-485 | Creates Maps for kanban/calendar columns, dates | O(N) |
| Element height cache | 436-438 | Queries `offsetHeight` for every thought | O(N) |
| Calendar cell mapping | 444-461 | Queries all `.cal-cell` elements, gets bounding rects | O(N) |
| Physics calculations | 495-540 | `applyForces()` on every thought pair | **O(N²)** |
| Canvas 2D clear | 549-554 | Clears the connection canvas | O(1) |
| Stack connection drawing | 577-629 | Draws lines for stack members with shadowBlur | O(N²) worst |
| Linking line drawing | 632-658 | Draws dashed line from selected to cursor | O(1) |
| DOM transform updates | 661-705 | Updates `style.transform` for every thought | O(N) |

**Total worst-case per frame:** O(N²) + O(N) DOM queries

**Why this causes media issues:**
1. **Main thread blocking**: The physics loop performs O(N²) repulsion calculations. With 100 thoughts, that's ~10,000 calculations per frame
2. **DOM thrashing**: Every frame queries `offsetHeight` and `getBoundingClientRect()` on potentially hundreds of elements
3. **Canvas operations**: Clears and redraws canvas with shadow effects every frame
4. **No throttling**: Runs at full 60fps regardless of user activity or tab visibility

**Key code sections:**

```typescript
// Line 71-74: DOMMatrix created every frame
const getGlobalScale = useCallback(() => {
  const body = document.querySelector('.app-body') || document.body;
  return new DOMMatrix(window.getComputedStyle(body).transform).a || 1;
}, []);

// Line 438: offsetHeight queried every frame for EVERY thought
ids.forEach(id => elementHeights.set(id, elements.current.get(id)?.offsetHeight || 120));

// Line 445-461: getBoundingClientRect called on calendar cells
const cells = document.querySelectorAll('.cal-cell');
cells.forEach((cell) => {
  const rect = cell.getBoundingClientRect();
  // ...
});
```

---

### 1.2 Background Starfield Animation - `src/components/background/layers/Starfield.tsx`

**Location:** Lines 170-185

```typescript
const animate = () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  mousePos.current.x += (mousePos.current.targetX - mousePos.current.x) * 0.05;
  mousePos.current.y += (mousePos.current.targetY - mousePos.current.y) * 0.05;

  starsRef.current.forEach((star) => {
    if (!performanceMode) star.update(theme);
    star.draw(ctx, mousePos.current.x, mousePos.current.y, theme);
  });

  requestRef.current = requestAnimationFrame(animate);
};
```

**Characteristics:**
- Runs at **~60fps** continuously
- Canvas resolution: `(width * 1.2) x (height * 1.2)` (120% viewport)
- Number of particles: `(width * height) / 1000` (adjusts with viewport)
- **Partial visibility check**: Only calls `star.update()` when `!performanceMode`
- **Does NOT pause when tab is hidden**

**Particle behavior by theme:**
| Theme | Particle Type | Update Speed | Draw Complexity |
|-------|--------------|-------------|----------------|
| `cyberia` | Circles | Slow drift | Simple arc |
| `sea` | Circles with glow | Slow drift | Stroke with opacity |
| `forest` | Small circles | Slow drift | Simple fill |
| `rain` | Diagonal lines | **Fast: 15px/frame** | Line stroke |

**Why rain theme is heavier:**
```typescript
// Line 41: Rain particles move 15 * (z * 0.4) pixels per frame
this.y += 15 * (this.z * 0.4);
```

**Memory allocation issues:**
```typescript
// Line 147: New Star array created on resize
const numStars = Math.floor((w * h) / 1000); 
starsRef.current = Array.from({ length: numStars }, () => new Star(w, h));
```

---

## 2. CSS Animations (High Priority)

### 2.1 CSS Scale Transform - `src/index.css`

**Location:** Lines 131-187

```css
.app-body {
  overflow: hidden;
  width: 111.111vw;
  height: 111.111dvh;
  transform: scale(0.9);
  transform-origin: 0 0;
  position: fixed;
  /* ... */
}
```

**Scaling by viewport:**
| Viewport | Scale Factor | Width | Height |
|----------|-------------|-------|--------|
| Default (>1600px) | 0.9 | 111.111vw | 111.111dvh |
| ≤1600px or ≤900px | 0.85 | 117.647vw | 117.647dvh |
| ≤1366px or ≤800px | 0.8 | 125vw | 125dvh |
| ≤768px | 0.7 | 142.857vw | 142.857dvh |
| ≤480px | 0.6 | 166.667vw | 166.667dvh |

**Why this causes GPU pressure:**
1. The entire app content must be scaled up and composited by the GPU
2. On smaller screens, the GPU must handle up to **1.67x** the viewport size
3. Forces the browser to keep the entire Cyberia tab composited and active
4. Competes with other tabs' video decoders for GPU resources

**Related CSS properties:**
```css
/* Lines 359-366: will-change hints */
#world, .dot-grid {
  will-change: transform;
}

#connection-canvas {
  will-change: transform;
  z-index: 5;
}
```

### 2.2 CSS Keyframe Animations - `src/index.css`

**Location:** Lines 207-228

```css
@keyframes float-slow {
  0% { transform: translate(0, 0) scale(1); }
  100% { transform: translate(5%, 10%) scale(1.1); }
}
@keyframes float-reverse {
  0% { transform: translate(0, 0) scale(1); }
  100% { transform: translate(-8%, -5%) scale(1.05); }
}

.animate-float-slow { animation: float-slow 25s ease-in-out infinite alternate; }
.animate-float-reverse { animation: float-reverse 30s ease-in-out infinite alternate-reverse; }
```

**Used in Atmosphere component (`src/components/background/layers/Atmosphere.tsx`):**
```tsx
// Lines 11-18
<div className={`... ${!performanceMode ? 'animate-float-slow' : ''}`} />
<div className={`... ${!performanceMode ? 'animate-float-reverse' : ''}`} />
```

**Characteristics:**
- Runs on **large elements** (150% and 160% of viewport)
- Uses `mix-blend-mode: screen` which requires compositing
- 25-30 second cycles (relatively slow)
- **Disabled when `performanceMode` is true**

### 2.3 Other CSS Animations

| Animation | Duration | Used In | Purpose |
|-----------|----------|---------|---------|
| `space-drift` | ? | ? | Background drift |
| `bubble-rise` | ? | ? | Silt/bubble effects |
| `caustic-shimmer` | ? | ? | Water caustics |
| `canopy-drift` | ? | ? | Forest theme |
| `god-ray-shift` | ? | ? | Light rays |
| `firefly-sway` | ? | ? | Firefly particles |
| `rain-fall` | ? | ? | Rain background |
| `nebula-float` | ? | ? | Nebula opacity |
| `twinkle` | ? | ? | Star twinkle |

---

## 3. Framer Motion Springs - `src/hooks/useCamera.ts`

**Location:** Lines 31-34

```typescript
const springConfig = { damping: 35, stiffness: 250, mass: 1, restDelta: 0.001, restSpeed: 0.001 };
const springX = useSpring(x, springConfig);
const springY = useSpring(y, springConfig);
const springScale = useSpring(scale, springConfig);
```

**Characteristics:**
- Uses `useSpring` from Framer Motion
- Springs run at **requestAnimationFrame** internally
- Three separate springs (x, y, scale) each running independently
- `damping: 35` - relatively low damping (more oscillation)
- `stiffness: 250` - moderate stiffness

**Impact:**
- Framer Motion's springs use `requestAnimationFrame` internally
- Each spring can trigger style updates at 60fps during motion
- Contributes to overall animation frame budget consumption

---

## 4. Demo Page Animations (Medium Priority)

These only run on the homepage/demo pages, but contribute to resource usage during demo viewing.

### 4.1 SpatialThinkingVisual - `src/components/demo/SpatialThinkingVisual.tsx`

**Location:** Lines 119-175

```typescript
const loop = () => {
  time += 0.016;
  if (nodes.length > 0) {
    nodes.forEach((n, i) => {
      // Physics: attraction, gravity, drift, repulsion
      n.vx = (n.vx + ax) * 0.95;
      n.vy = (n.vy + ay) * 0.95;
      n.x.set(nx + n.vx);
      n.y.set(ny + n.vy);
    });
  }
  raf = requestAnimationFrame(loop);
};
raf = requestAnimationFrame(loop);
```

**Characteristics:**
- Runs separate physics loop (O(N²) repulsion)
- Uses Framer Motion `motionValue` for position updates
- Animation sequence uses `animate()` from Framer Motion
- 6-9 nodes per demo (fewer than main app)

### 4.2 InteractiveDemo - `src/components/demo/InteractiveDemo.tsx`

**Location:** Lines 129-173

```typescript
const loop = () => {
  time += 0.016;
  if ((viewMode === 'spatial' && physicsEnabled) || dragTargetRef.current) {
    nodes.forEach(n => {
      // Physics calculations
      n.vx = (n.vx + ax) * 0.96; 
      n.vy = (n.vy + ay) * 0.96;
      n.x.set(nx + n.vx); n.y.set(ny + n.vy);
    });
  }
  raf = requestAnimationFrame(loop);
};
```

**Characteristics:**
- Separate physics loop for demo
- Uses Framer Motion springs for layout transitions
- ~27 nodes per demo space
- Can be toggled via UI button

---

## 5. Sync & Background Operations

### 5.1 Realtime Sync Listener - `src/services/sync/syncOrchestrator.ts`

**Location:** Lines 63-163

```typescript
const handleRemoteChange = async (payload: any, table: string) => {
  // ...
  if (remoteSyncDebounceTimer) clearTimeout(remoteSyncDebounceTimer);
  remoteSyncDebounceTimer = setTimeout(() => {
    this.triggerSync(true);
  }, 500);
};
```

**Characteristics:**
- Supabase Realtime subscription is always active when authenticated
- 500ms debounce for remote change handling
- Can trigger `deltaSync()` which does heavy IndexedDB operations

### 5.2 Auth Heartbeat - `src/store/slices/authSlice.ts`

**Location:** Lines 476-488

```typescript
setupRefreshInterval: () => {
  refreshInterval = setInterval(() => {
    if (status === 'authenticated' && isOnline) {
      get().refreshProfile();
    }
  }, 30 * 60 * 1000); // Every 30 minutes
},
```

**Impact:** Minimal - runs every 30 minutes

### 5.3 Visibility Change Handler - `src/store/slices/authSlice.ts`

**Location:** Lines 67-72

```typescript
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && get().status === 'authenticated') {
    get().refreshProfile();
  }
});
```

**Impact:** Triggers on tab visibility change, not the cause of continuous resource drain

---

## 6. IndexedDB Operations

**Key files:** 
- `src/store/slices/dataSlice.ts`
- `src/services/sync/syncOrchestrator.ts`

**Heavy operations:**

| Operation | Location | Impact |
|-----------|----------|--------|
| Bulk import | dataSlice.ts:243-260 | Clears and repopulates all tables |
| Export | dataSlice.ts:315-320 | Reads all user data |
| Purge | dataSlice.ts:503-520 | Bulk deletes |
| Delta sync | syncOrchestrator.ts:182-588 | Complex reconciliation |

**IndexedDB vs Video Playback:**
- IndexedDB operations run on a **separate thread** (WebWorker-based in Dexie)
- However, heavy IndexedDB activity can cause **disk I/O contention**
- Browser may deprioritize video decoder I/O when DB writes are active

---

## 7. Performance Mode System

**Location:** `src/store/slices/canvasSlice.ts`

```typescript
performanceMode: typeof window !== 'undefined' ? (window.innerWidth < 763) : false,
setPerformanceMode: (performanceMode: boolean) => {
  set({ performanceMode });
  if (performanceMode) document.body.classList.add('low-perf');
}
```

**What performance mode disables:**

| Component | Effect of Performance Mode |
|-----------|---------------------------|
| Physics | Skips `applyForces()` calculations |
| Starfield | Skips particle position updates |
| Atmosphere | Disables CSS float animations |
| ThoughtNode | Disables altitude shadows/scale |
| Background | Reduces custom bg opacity |
| Backdrop filter | Disabled globally via CSS |

**Current behavior:**
- `performanceMode` is **only true on mobile** (width < 768px)
- User can toggle it via toolbar (StatusBar.tsx:104)
- **Not automatically enabled when other tabs need resources**

---

## 8. Root Cause Analysis

### Why do other tabs' videos stop?

**Primary Hypothesis: Main Thread Starvation**

1. **Continuous rAF loops** (usePhysics + Starfield) run at 60fps
2. Each frame performs O(N²) physics calculations
3. DOM operations (`offsetHeight`, `getBoundingClientRect`) force synchronous layout
4. Canvas 2D operations trigger GPU synchronization
5. When Chrome schedules frames, Cyberia dominates the main thread
6. Video decoders in other tabs don't get enough CPU time

**Secondary Hypothesis: GPU Resource Contention**

1. CSS scale transform forces entire app onto GPU compositor
2. Starfield canvas runs continuously (even when not visible)
3. Connection canvas redraws with shadow effects every frame
4. CSS animations on large elements (150%+ viewport)
5. Other tabs' video players compete for GPU resources

**Tertiary Hypothesis: Tab Visibility Priority**

1. Chrome deprioritizes background tabs' JavaScript execution
2. BUT: Chrome prioritizes visible tabs' requestAnimationFrame
3. If Cyberia is visible, it may monopolize frame budget
4. Other visible tabs with video may be starved

### Why does it affect videos specifically?

- Video decoding requires **consistent frame timing**
- Even small interruptions cause buffering
- If Cyberia blocks the main thread for >33ms, video drops frames
- Streaming services (Twitch) are especially sensitive to interruptions

---

## 9. Comparison: Other Apps' Behavior

**Typical well-behaved web apps:**
- Pause animations when `document.visibilityState === 'hidden'`
- Use `will-change` strategically
- Throttle non-essential animations
- Use CSS `containment` to isolate layout

**Cyberia's current behavior:**
-  Animations continue when tab is hidden
-  No CSS containment
-  No visibility-based throttling
-  Full 60fps physics even when idle

---

## 10. Recommendations for Investigation

### High Priority (Likely Impact)

1. **Pause animations when tab is hidden**
   - Add `visibilitychange` listener to pause rAF loops
   - Use `document.visibilityState` check in animation loops

2. **Reduce physics frequency**
   - Consider 30fps for physics instead of 60fps
   - Use `timeScale` clamping more aggressively
   - Skip physics when all thoughts are at rest

3. **Use CSS `containment`**
   - Add `contain: layout style paint` to thought containers
   - Reduces DOM thrashing during layout

4. **Cache DOM measurements**
   - Avoid `offsetHeight` and `getBoundingClientRect` every frame
   - Use ResizeObserver for size changes
   - Batch DOM reads and writes

### Medium Priority

5. **Reduce CSS scale factor**
   - Investigate if 0.9 scale is necessary
   - Could use media queries to reduce on lower-end devices

6. **Pause starfield when tab hidden**
   - Similar to physics loop visibility check

7. **Add user-facing "low resource mode"**
   - Auto-detect high thought count
   - Suggest enabling performance mode

### Lower Priority

8. **Investigate canvas vs SVG for connections**
   - Canvas may have better performance characteristics

9. **Consider Web Worker for physics**
   - Move O(N²) calculations off main thread

---

## 11. File Summary Table

| File | Lines | Type | Severity | Pauses on Hidden? |
|------|-------|------|----------|-------------------|
| `usePhysics.ts` | 709-712 | rAF loop | CRITICAL | No |
| `Starfield.tsx` | 170-185 | rAF loop | HIGH | No |
| `index.css` | 131-142 | CSS transform | HIGH | No |
| `Atmosphere.tsx` | 11-18 | CSS animation | MEDIUM | No (CSS) |
| `useCamera.ts` | 31-34 | Framer Motion | MEDIUM | Partial |
| `SpatialThinkingVisual.tsx` | 119-175 | rAF loop | MEDIUM | No |
| `InteractiveDemo.tsx` | 129-173 | rAF loop | MEDIUM | No |
| `syncOrchestrator.ts` | 63-163 | Realtime | LOW | N/A |

---

## 12. Test Scenarios

To reproduce and isolate the issue:

1. **Baseline**: Open Cyberia with empty workspace, observe other tab video
2. **Physics load**: Add 100 thoughts, observe video performance
3. **Theme variation**: Test with rain theme (heavier starfield)
4. **Viewport size**: Test on smaller screens (higher scale factor)
5. **Performance mode**: Enable performance mode, observe improvement
6. **Tab visibility**: Switch away from Cyberia, observe if video recovers

---

## Appendix A: Physics Loop Complexity Analysis

For N thoughts:
- Force calculations: N × (N-1) / 2 ≈ O(N²)
- DOM updates: O(N)
- Canvas drawing: O(N²) for N thoughts in stacks

**Typical workloads:**
| Thoughts | Force Calc/frame | DOM Ops/frame | Total Work |
|----------|------------------|---------------|------------|
| 10 | 45 | 10 | 55 |
| 50 | 1,225 | 50 | 1,275 |
| 100 | 4,950 | 100 | 5,050 |
| 500 | 124,750 | 500 | 125,250 |

---

## Appendix B: Visibility API Reference

```typescript
// Detect when tab is hidden
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    // Pause animations
  } else {
    // Resume animations
  }
});

// Check visibility state directly
console.log(document.visibilityState); // 'visible' or 'hidden'

// Page Visibility API Level 2 (additional info)
console.log(document.hidden); // true if hidden
```

---

*Document created for investigation purposes. No implementation changes made.*
