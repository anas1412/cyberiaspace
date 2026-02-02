# Cyberia V10 Blueprint (Migration Ready)

## 1. Project Identity
**Cyberia** is a spatial productivity tool designed for kinetic information architecture. It treats thoughts as physical objects in an infinite workspace.

## 2. Core Physics Engine (The "Vibe")
The spatial mode is driven by a constant `requestAnimationFrame` loop using the following physics constants:
- **Damping:** 0.88 (Friction/Air resistance)
- **Repulsion:** 100,000 (Inverse-square force between nodes)
- **Attraction:** 0.02 (Spring force for shared tags)
- **Gravity:** 0.004 (Gentle pull toward the center of the viewport)
- **Collision Radius:** Dynamic, based on element height (`offsetHeight / 2`) with a 10% safety buffer.
- **Priority Weighting:**
    - `urgent`: 4
    - `high`: 3
    - `medium`: 2
    - `low`: 1
    - `none`: 0
- **Priority Logic:** Higher priority nodes have stronger gravity (centering) and larger scale (1.05x - 1.2x).

## 3. Data Schema (The `Thought` Model)
Each node in the workspace follows this structure:
```typescript
interface Thought {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  text: string;
  description: string;
  type: 'text' | 'tasks' | 'paint' | 'table' | 'image';
  content: string; // Markdown/Rich text
  image: string | null; // Base64 or URL
  drawing: string | null; // Base64 from Canvas
  tags: string[];
  status: 'todo' | 'doing' | 'done';
  tasks: { text: string; done: boolean }[];
  table: string[][]; // 2D array [row][col]
  date: string; // YYYY-MM-DD
  priority: 'none' | 'low' | 'medium' | 'high' | 'urgent';
  order: number; // For Kanban/Calendar stacking
}
```

## 4. Interaction Patterns
- **Triple-View Morphing:** 
    - **Spatial:** Physics-driven.
    - **Kanban:** Columnar stacking (33%/50%/84% width triggers).
    - **Calendar:** Stacking on date-grid cells (Deck of Cards offset).
- **Drag & Drop:** 5px threshold to distinguish between "click to edit" and "drag to move".
- **Paste Logic:** 
    1. Check for `image/` files (Priority 1).
    2. Fallback to `text/plain` (Priority 2).
- **Viewport Logic:**
    - **Panning (Spatial Mode):**
        - **Triggers:** `Middle-click` (button 1) OR `Alt + Left-click`.
        - **Excluded Targets:** Buttons, inputs, textareas, thoughts, and inspector.
        - **Formula:** `transform.x += (clientX - lastX)`, `transform.y += (clientY - lastY)`.
    - **Zooming (Anchor-Based):**
        - **Clamps:** `0.1` to `2.0`.
        - **Zoom Factor:** `delta = -wheelDeltaY * 0.001`.
        - **Anchor Math:** 
            1. `worldX = (clientX - transform.x) / transform.scale`
            2. `newScale = clamp(transform.scale + delta)`
            3. `transform.x = clientX - worldX * newScale`
    - **View Specific Scrolling:**
        - **Kanban:** `transform.y -= deltaY`, clamped at `y = 0` (top). `x` and `scale` are locked.
        - **Calendar:** Wheel event scrolls the `.cal-sidebar-content` via `scrollTop`.

## 5. Visual Standards (CSS Reference)
- **Font:** 'Plus Jakarta Sans'
- **Background:** Radial gradient `#0f172a` to `#020408`.
- **Glassmorphism:** `rgba(10, 10, 15, 0.85)` with `backdrop-filter: blur(24px)`.
- **Accent Color:** `#6366f1` (Indigo 500).
- **Custom Scrollbars:** 4px width, Indigo/Transparent.

## 6. Advanced Technical Nuances

### 6.1. Connection Canvas (The "Brain" Lines)
- **Target:** Shared tags.
- **Visual:** `strokeStyle = 'rgba(99, 102, 241, 0.15)'`.
- **Implementation:** Draws a line between nodes `n` and `other` if they share at least one tag. Lines are redrawn every frame in the physics loop.

### 6.2. Priority-Driven Physics
- **Gravity Multiplier:** `1 + (priorityLevel * 0.5)`. High-priority items stay closer to the center.
- **Scale Multiplier:** `1 + (priorityLevel * 0.05)`.
- **Repulsion Power:** `REPULSION * (1 + combinedPriority * 0.1)`. Nodes of higher importance push harder against others.
- **Layering:** `zIndex` is dynamically calculated as `20 + priorityWeight`.

### 6.3. View-Specific Stacking Algorithms
- **Kanban:** Vertical padding of `24px`. Logic sorts by `priority` first, then `order`.
- **Calendar (The Deck):** 
    - Unscheduled items use `0.75x` scale.
    - Scheduled items use a "Sticker" scale: `Math.min((cellWidth - 20) / 280, 0.45)`.
    - Stacking uses a 20px vertical offset (`startY + (index * 20)`) to create a "spread deck" effect.

### 6.4. UX Micro-interactions
- **Chalk Path Animation:** SVG `stroke-dasharray: 800` with a 2s CSS animation for the "Empty State" guide.
- **Neon Chalk Paint:** `shadowBlur: 2`, `shadowColor: white`, `lineWidth: 4` for a "glowing" effect on the paint canvas.
- **Clipboard Priority:** Explicitly loops through `clipboardData.items`. If an `image` type is found, it spawns an image thought and *terminates* the listener to prevent duplicate text spawns of the same image data.

### 6.5. Space Management
- **Slots:** Max 8 spaces.
- **Persistence:** Key `cyberia_MASTER_ULTIMATE_STABLE_V1000`.
- **Import/Export:** Full JSON state backup/restore with `location.reload()` trigger.

### 6.6. The "Secret Sauce" (Magic Numbers)
- **Transition Lerp Speeds:**
    - **Kanban movement:** `0.15` (Smooth centering).
    - **Calendar movement:** `0.2` (Snappier for grid snapping).
    - **Scaling:** `0.1` (Very gradual size changes).
- **Tag Hashing Algorithm:** 
    ```javascript
    h = tag.charCodeAt(i) + ((h<<5)-h); 
    hue = Math.abs(h * 137.5) % 360;
    // result: hsla(hue, 70%, 50%, 0.15)
    ```
- **Preview Logic thresholds:**
    - **Text:** "Read more..." appears if `content.length > 200`. Uses a `max-h-[120px]` mask.
    - **Table:** Preview is capped at `maxCols: 3` and `maxRows: 4`. Shows `... and X more rows` if exceeded.
    - **Physics Cap:** Repulsion force is strictly capped at `60` to prevent "explosions" when nodes overlap.

### 6.7. Workspace Setup
- **Canvas Size:** Fixed at `5000px x 5000px` on load.
- **Hit Detection:** Calendar use a cached `calCells` array generated via `getBoundingClientRect()` inside a `setTimeout(..., 100)` to ensure layout is painted before coordinates are stored.
- **Drag Threshold:** Exactly `5px` movement required to flag an interaction as a "drag" rather than a "click."

### 6.8. Invisible Architecture (Edge Cases)
- **The Drag-Click Collision:**
    - A `this.dragged` boolean is set if movement > `5px`.
    - The `click` listener checks `if (this.dragged) return;`. This prevents the Inspector from accidentally opening at the end of a drag.
- **Scroll Hijack Prevention:**
    - `passive: false` is used on the workspace wheel listener.
    - Logic checks `if (e.target.closest('#inspector', '#text-focus-overlay', '#table-focus-overlay')) return;`. This prevents the workspace from zooming while you are trying to scroll inside an editor.
- **Storage Safety:**
    - Explicitly catches `QuotaExceededError` and `NS_ERROR_DOM_QUOTA_REACHED`.
    - Warns user to remove "large images or sketches" specifically.
- **Calendar Layout Stability:**
    - The `cal-sidebar-spacer` height is dynamically set to `currentY + 40` to ensure the "Unscheduled" list remains scrollable as items are added.
- **Z-Index Hierarchy (Strict):**
    - `0`: Body Background
    - `1`: Connection Lines (Canvas)
    - `5`: Calendar Grid / Empty Guide
    - `10`: Viewport/World
    - `20+`: Thoughts (Based on Priority)
    - `50`: Kanban Overlay
    - `1000`: Dragging Node
    - `9999`: UI Overlays (Toolbar, Tabs)
    - `10000`: Modals / Lightbox
    - `10001`: Focus Editors (Highest)

### 6.9. Icon Lifecycle
- `lucide.createIcons()` is called via `refreshIcons()` after:
    - Adding/Deleting a thought.
    - Opening/Closing a modal.
    - Switching views.
    - Re-rendering the Table/Task lists.
    - *Crucial for the React migration: We will replace this with the `<LucideIcon />` component to avoid manual refreshes.*

### 6.10. Final Precision Logic
- **Monday-Start Calendar:** `firstDay = new Date(y, m, 1).getDay() || 7`. This shifts the grid to start on Monday (index 7 if 0) instead of Sunday.
- **Date String Format:** `dateObj.toLocaleDateString('en-CA')`. This is used to guarantee a `YYYY-MM-DD` format without the timezone shifting associated with `.toISOString()`.
- **UI Inversion:** `input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(1); }`. This ensures the system calendar icon is white.
- **Table Quote Escaping:** `cell.replace(/"/g, '""')` during CSV export to handle nested double quotes correctly.
- **Physics Anti-Explosion:** If `d < minDistance`, repulsion is scaled by `(minDistance / d)`, creating a "hard" physical boundary that prevents nodes from overlapping to a point of infinite force.

## 7. Style & Palette Master Reference (1:1 Replication)

### 7.1. Color Palette
- **Deep Space (BG):** `radial-gradient(circle at 50% 50%, #0f172a 0%, #020408 100%)`
- **Primary Accent:** `#6366f1` (Indigo 500)
- **Glass Surface:** `rgba(10, 10, 15, 0.85)`
- **Glass Border:** `rgba(255, 255, 255, 0.08)`
- **Text - Primary:** `#e2e8f0`
- **Text - Dimmed:** `rgba(255, 255, 255, 0.7)` (Markdown / Descs)
- **Text - Muted:** `rgba(255, 255, 255, 0.4)` (Guide / Hints)
- **Priority Tones:**
    - **None:** `rgba(255, 255, 255, 0.1)`
    - **Low:** `#3b82f6` (Blue)
    - **Medium:** `#eab308` (Yellow)
    - **High:** `#f97316` (Orange)
    - **Urgent:** `#ef4444` (Red)

### 7.2. Geometry & Spacing
- **Thought Bulbs:** `width: 280px`, `border-radius: 32px`, `padding: 24px`.
- **Inspector Panel:** `width: 320px`, `border-radius: 40px (2.5rem)`, `padding: 32px (p-8)`.
- **Focus Editors:** `max-width: 1000px`, `border-radius: 48px (3rem)`.
- **Control Modals:** `width: 420px`, `border-radius: 40px`.
- **UI Pills:** `border-radius: 12px` (Buttons) | `8px` (Tags) | `full` (Toolbar).
- **Checkboxes:** `18px x 18px`, `border-radius: 6px`, `border-width: 2px`.

### 7.3. Effects (The "Aura")
- **Glass Blur:**
    - Main UI: `blur(24px)`
    - Thought Content: `blur(20px)`
    - Focus Overlays: `blur(40px)`
- **Shadows:**
    - Default Node: `0 10px 40px rgba(0,0,0,0.5)`
    - Active Drag: `0 0 40px rgba(99, 102, 241, 0.4)`
    - Indicator Glow: `0 0 10px [priorityColor]88`
- **Transitions:** `0.4s cubic-bezier(0.16, 1, 0.3, 1)` (The "Apple" feel).

### 7.4. Typography
- **Primary Interface:** 'Plus Jakarta Sans' (Weights: 300 to 700).
- **The "Vibe" Guide:** 'Comic Sans MS', cursive (Used for the empty-state chalk notes).
- **Date Labels:** Monospace, uppercase, tracking-widest.

## Best Practices for "Vibe Coding" with Gemini
1. **Atomic Components:** Keep files small. One component per file (e.g., `ThoughtNode.tsx`).
2. **Type Safety:** Always define interfaces for props.
3. **Logic outside JSX:** Keep the physics and math in hooks or helper files.
4. **Tailwind First:** Avoid custom `<style>` blocks in components; use Tailwind utility classes.
5. **Same Design as Original:** ALways use the same design as the original original_project.html file included it should be 100% same design.
6. **Responsiveness:** ALways design the app keeping in mind responsivness secondary for mobile, primary for web
