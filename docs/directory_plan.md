# Proposal: Directory View Mode (Tree-Based Hierarchy)

## 1. Overview
The Directory view introduces a document-oriented, hierarchical tree layout, providing a structured alternative to the existing spatial/physics-based canvas.

## 2. Core Interaction Model
The mode features a fixed three-column layout:
- **Left Column:** AI Chat Overlay (persisted across views).
- **Center Column:** Hierarchical Tree List (The main interaction zone).
- **Right Column:** Inspector & Focus Editor Shell (persisted across views).

## 3. Data Hierarchy & Transformations
The Directory view requires a dynamic transformation engine to project flat `thoughts` and `stacks` into a tree structure based on user-selected grouping:

- **Group By Stack:** `Stack -> Thoughts`
- **Group By Status:** `Status (Todo/Doing/Done) -> Thoughts`
- **Group By Date:** `Year -> Month -> Day -> Thoughts`

## 4. Architectural Impact
- **Physics Engine Bypass:** Unlike the `spatial` and `kanban` modes, the Directory view bypasses the `usePhysics.ts` loop entirely.
- **Layout Engine:** Replaces `World.tsx` with a CSS Grid/Flexbox-based `DirectoryLayout.tsx`.
- **View-Dependent Logic:** Requires widespread refactoring of `activeSpace.mode` conditional checks (currently 60+ instances).

## 5. Phase Roadmap
- **Phase 1: Foundation**
    - Extend `db.ts` to include `'directory'` mode.
    - Implement the `treeTransformation` utility for grouping and sorting.
- **Phase 2: UI Scaffolding**
    - Create `DirectoryLayout.tsx` for the three-column layout.
    - Implement a recursive Tree List component.
- **Phase 3: Integration**
    - Refactor component-specific logic (toolbars, view-switchers, physics handlers) to recognize `directory` mode.
    - Implement navigation link (switching from Directory to Spatial should zoom the camera to the selected item).

## 6. Open Questions
- **Interaction Behavior:** When transitioning from Directory to Spatial, should the camera animate to the selected thought's coordinates?
- **Resizing:** Should column widths be fixed or user-resizable?
- **Hierarchy Details:** For Date grouping, should it be a nested Year/Month/Day expansion, or a simple flat list sorted by date?
