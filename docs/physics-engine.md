# Cyberia Physics Engine: Principles & Practices

This document outlines the core architecture, coordinate systems, and engineering best practices used in the Cyberia spatial-thinking engine.

---

## 1. The Anchoring System (Top-Left Origin)

The most fundamental rule of the Cyberia engine is the **Top-Left Anchoring System**.

*   **Principle:** All interactive elements (`ThoughtNode`) use `transform-origin: 0 0`.
*   **Why:** Scaling from the center (the default) causes "Coordinate Drift." When an element scales down, its corners pull away from the anchor point. By pinning the top-left corner, scaling and height changes (due to content expansion) only affect the bottom and right edges, leaving the "starting position" perfectly stable.
*   **Practice:** Always ensure the `.thought-bulb` container includes the `origin-top-left` Tailwind class.

---

## 2. Coordinate Mapping & Rendering

The physics engine calculates positions in a virtual space, which are then mapped to screen pixels.

### Render Contract (`usePhysics.ts`)
The rendering loop in `usePhysics.ts` follows a strict contract:
*   **Input:** The raw `p.x` and `p.y` from the physics state.
*   **Output:** `translate3d(p.x, p.y, 0)`.
*   **Constraint:** No hardcoded offsets (like `-140px`) are allowed in the final render loop. If a mode needs an element centered, the **Strategy** must calculate the top-left coordinate that results in a centered appearance.

### Mode-Specific Strategies
1.  **Spatial Mode:** Targets `x - 140` and `y - h/2`. This maintains the "Center-Based" feel users expect while adhering to the Top-Left rendering contract.
2.  **Kanban Mode:** Targets `(Col_Width - Card_Width) / 2` for horizontal alignment and a cumulative `yOffset` for vertical stacking.
3.  **Calendar Mode:** Targets the exact `left` and `top` coordinates of the date cells.

---

## 3. DOM-Synchronized Alignment (Calendar)

For complex grids where browser pixel rounding can cause drift, Cyberia uses **DOM Tethering**.

*   **Practice:** In Calendar mode, the engine queries the actual rendered `.cal-cell` elements via `getBoundingClientRect()`. 
*   **Benefit:** This creates a 1:1 mapping between the visual grid lines and the physics engine. It eliminates the "Discrete Drift" bug where floating-point math in JS differs from integer-rounded pixels in the browser's CSS Grid.
*   **Drag-and-Drop:** Dropping a thought uses a **Hit-Test** against these real DOM rectangles, ensuring perfect accuracy regardless of screen size or header height.

---

## 4. Physics vs. Persistence

To maintain high performance (60FPS+), Cyberia strictly decouples physics calculation from data persistence.

*   **The Save Storm Rule:** Never trigger database writes during high-frequency events (mousemove, wheel, zoom, or every frame of physics).
*   **Discrete Persistence:** Physical positions are only "baked" into the database during discrete transitions:
    1.  When a user manually finishes a drag operation.
    2.  When a user switches away from Spatial mode (saving the physics equilibrium).
    3.  When a user changes workspace.
*   **Implementation:** Persistence logic resides in isolated `useEffect` hooks that only monitor `activeSpace.mode` and `activeSpaceId`.

---

## 5. Transition Smoothness (Spatial Flight)

Cyberia is known for its fluid "flight" between views. This is achieved through three techniques:

1.  **Effective Transform Tracking:** Transition calculations use the **Effective Transform** (what the user actually sees) as the starting point, not the hidden store state.
2.  **Camera Lerping:** The camera (`visualTransformRef`) uses Linear Interpolation (`lerp`) to smoothly follow the target transform.
3.  **Glide-to-Intent:** When returning to Spatial mode, elements glide toward their stored coordinates using the same top-left math as the final layout, preventing "snapping" at the end of the animation.

---

## 6. Force Equilibrium

Spatial mode uses a custom physics solver for repulsion and gravity.
*   **Collision:** Repulsion forces are calculated from the **centers** of the elements to ensure natural bouncing, even though they are rendered from the top-left.
*   **Gravity:** A subtle pull towards the screen center keeps the workspace from drifting into infinity.
*   **Stacking:** Elements in the same stack experience an attraction force when they drift beyond their "comfort zone."
