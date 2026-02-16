# Migration Plan: Cyberia Pro (React + Vite + TS)

## Phase 1: Foundation (The Setup)
- [ ] Initialize Vite project with React + TypeScript template.
- [ ] Install dependencies:
    - `zustand` (State)
    - `dexie` & `dexie-react-hooks` (IndexedDB)
    - `lucide-react` (Icons)
    - `framer-motion` (Animations/Transitions)
    - `clsx` & `tailwind-merge` (Class management)
    - `react-markdown` (Markdown rendering)
- [ ] Port the global CSS variables and base styles (Background, Typography).

## Phase 2: Data Architecture (The Store)
- [ ] Create `db.ts` with Dexie schema (Spaces and Thoughts tables).
- [ ] Create `useStore.ts` using Zustand.
    - Implement Space management logic.
    - Implement Thought CRUD logic.
    - Implement a "Migration Hook" to pull data from LocalStorage if it exists.

## Phase 3: The Engine (Spatial Logic)
- [ ] Create a `usePhysics` custom hook.
    - Port the `requestAnimationFrame` loop.
    - Decouple physics calculations from React's render cycle (using `useRef` for position vectors).
- [ ] Create the `Viewport` and `World` container components.

## Phase 4: UI Components (The Shell)
- [ ] **ThoughtNode:** The individual bulb component (Handle types: Text, Task, Table, etc.).
- [ ] **Inspector:** The right-side editor panel.
- [ ] **FocusModes:** Full-screen Text and Table editors.
- [ ] **Toolbar/Stats:** The bottom floating UI.

## Phase 5: View Transitions (The Morph)
- [ ] Implement `ViewSwitcher` logic.
- [ ] Use `framer-motion` to smoothly transition nodes from Spatial coordinates to Kanban columns.
- [ ] Port the Calendar Grid logic into a dedicated React component.

## Phase 6: Features & Polish
- [ ] Enhanced Table Editor (Excel-like shortcuts).
- [ ] Global Search (using IndexedDB indexes).
- [ ] "Zen Mode" (Hiding UI for pure spatial focus).

## Best Practices for "Vibe Coding" with Gemini
1. **Atomic Components:** Keep files small. One component per file (e.g., `ThoughtNode.tsx`).
2. **Type Safety:** Always define interfaces for props.
3. **Logic outside JSX:** Keep the physics and math in hooks or helper files.
4. **Tailwind First:** Avoid custom `<style>` blocks in components; use Tailwind utility classes.
5. **Same Design as Original:** ALways use the same design as the original original_project.html file included it should be 100% same design.
6. **Responsiveness:** ALways design the app keeping in mind responsivness secondary for mobile, primary for web