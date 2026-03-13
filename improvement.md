# Cyberia Workspace Performance Improvement Plan

## Goal
Achieve locked 60fps performance with **Zero Visual Drift** and **Zero Input Latency** using a Unified World Coordinate System and complete Framer Motion integration.

## Phase 1: Physical Coordinate Locking (Status: Completed)
- **Problem:** Canvas and HTML nodes live in different containers, leading to misalignment.
- **Solution:** 
    - Moved `<canvas>` inside the `#world` motion container.
    - Synchronized coordinates so lines and nodes share the same parent and origin.

## Phase 2: Hardware-Accelerated Camera (Status: Completed)
- **Problem:** React state updates and manual lerps cause "rubber-banding" and input delay.
- **Solution:**
    - Migrated camera transform (`x, y, scale`) to Framer Motion `useMotionValue`.
    - Achieved **1:1 mouse-to-canvas tracking** during active interaction.

## Phase 3: Deep Motion Migration (Status: In Progress)
- **Problem:** Individual thought nodes are still moved via manual DOM style manipulation in a 60fps loop, and transitions between views (Spatial/Kanban/Calendar) are manual lerps.
- **Solution:**
    - Migrate individual Thought Node positions to Framer Motion `MotionValue`s.
    - Use `useSpring` or `layout` props for premium physical feel and "morphing" transitions between views.
    - Modularize node motion logic into a reusable hook.

## Phase 4: Physics Complexity Reduction ($O(N^2) \to O(N)$) (Status: Completed)
- **Problem:** Exponential math overhead for large workspaces.
- **Solution:**
    - Implemented "Spatial Cutoff" at 1000px in `spatialStrategy.ts`.
