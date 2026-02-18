# Cyberia: Performance & Lag Mitigation Plan

This plan addresses the stuttering and "heavy" feel of the application on mobile, tablets, and uncharged laptops. The goal is to maintain the "Kinetic Vibe" while drastically reducing CPU/GPU overhead.

## 1. Physics Engine Optimization (CPU)

### 1.1. Adaptive Tick Rate
Currently, the physics loop runs at 60fps regardless of the device.
- **Implementation:** Detect mobile devices or high-latency frames and throttle the physics calculation (repulsion/attraction) to 30fps while keeping the visual interpolation at 60fps.
- **Spatial Sleep:** Implement a "Sleep" state for nodes. If a node hasn't moved significantly for 2 seconds, stop calculating its physics until it is interacted with or a neighbor moves.

### 1.2. Spatial Hashing ($O(n^2)$ Reduction)
Instead of every node checking every other node:
- **Grid-Based Repulsion:** Divide the world into a grid. Nodes only calculate repulsion forces from other nodes in the same or adjacent grid cells. This reduces calculations from 1,600 to ~100 for a 40-node space.

## 2. Visual Level of Detail (LOD) (GPU)

### 2.1. The "Battery Saver" Aesthetic
Create a high-performance theme toggle (or auto-detect mobile):
- **Blur Removal:** Disable `backdrop-filter: blur(24px)` and replace it with a high-opacity solid color (e.g., `rgba(15, 23, 42, 0.95)`). This is the single biggest GPU save.
- **Shadow Simplification:** Replace dynamic, large blurred shadows with thin, static borders or simple 1px shadows on low-power devices.
- **Animation Culling:** Disable the "Sonar" ping and "Breathe" animations on nodes unless they are the primary selected thought.

### 2.2. CSS `will-change` Optimization
- Ensure `will-change: transform, opacity` is applied only during active movement and removed when the node is at rest to free up GPU memory.

## 3. DOM & Rendering Efficiency

### 3.1. Style Update Batching
- Instead of setting individual `el.style` properties in the loop, consolidate all transform updates into a single `requestAnimationFrame` block to minimize "Layout Thrashing."

### 3.2. Off-Screen Culling
- Nodes that are outside the current viewport zoom/pan area should have `display: none` or `visibility: hidden` applied to prevent the browser from trying to paint them at all.

## 4. Memory Management

### 4.1. Image Proxying & Thumbnailing
Referencing the **Google Drive Sync Plan**:
- Stop storing high-res Base64 images in the local database. 
- Use low-res thumbnails for the spatial view and only load the "High Fidelity" version when a node is focused or opened in the Focus Editor.

## 5. Implementation Phases

### Phase 1: Detection & Throttling
- Add a `performanceMode` state to `useStore.ts`.
- Update `usePhysics.ts` to skip repulsion math every other frame if `performanceMode` is active.

### Phase 2: Adaptive CSS
- Create a `.low-perf` class on the `body`.
- Update `index.css` to remove blurs and complex shadows when `.low-perf` is present.

### Phase 3: Spatial Hashing
- Refactor the repulsion logic in `usePhysics.ts` to use a basic grid bucket system.

## 6. Target Benchmarks
- **Mobile (iPhone/Android):** Stable 60fps for panning, 30fps for physics.
- **Desktop (Unplugged):** No noticeable stutter during multi-node drags.
- **Memory:** Total IndexedDB size for a 40-thought space under 5MB.
