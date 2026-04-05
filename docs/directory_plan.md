# Proposal: Directory View Mode (List-Based Grouping)

## 1. Overview

The Directory view introduces a document-oriented, list-based grouping mode — a structured alternative to the spatial/physics canvas. It follows the **same sidebar + main content pattern** already used by Kanban and Calendar modes, minimizing architectural disruption.

**Key difference from Kanban/Calendar:** Instead of physics-positioned ThoughtNodes, the Directory renders a **React list** of thoughts grouped by virtual folders (stacks, status, date, priority, or type). The right panel hosts an **inline Focus Editor** instead of a modal.

---

## 2. Core Interaction Model

The mode uses a **two-panel layout** (sidebar + inline editor), consistent with existing Kanban/Calendar patterns:

```
┌──────────────────────────────────────────────────────┐
│  Toolbar (mode-aware, unchanged structure)            │
├──────────────────────────────────────────────────────┤
│                                                       │
│  ┌──────────────┐   ┌─────────────────────────────┐   │
│  │  DIRECTORY    │   │  INLINE FOCUS EDITOR        │   │
│  │  SIDEBAR      │   │                             │   │
│  │  (260px)      │   │  [Title]                    │   │
│  │               │   │  [Description]              │   │
│  │ Group By: ▼   │   │  [Content editor area]      │   │
│  │ [▾ Stacks]    │   │  [Status / Priority badges] │   │
│  │               │   │  [Action buttons]           │   │
│  │ 📁 Stack A    │   │                             │   │
│  │   • thought   │   │  OR (nothing selected):     │   │
│  │   • thought   │   │  "Select a thought          │   │
│  │               │   │   to edit"                  │   │
│  │ 📁 Stack B    │   │                             │   │
│  │   • thought   │   │                             │   │
│  │               │   │                             │   │
│  │ ⚡ Todo       │   │                             │   │
│  │   • thought   │   │                             │   │
│  │   • thought   │   │                             │   │
│  │               │   │                             │   │
│  │ 📅 Apr 2026   │   │                             │   │
│  │   • thought   │   │                             │   │
│  └──────────────┘   └─────────────────────────────┘   │
│                                                       │
│  (Inspector floats on right as overlay — unchanged)   │
│  (ChatOverlay floats on left as overlay — unchanged)  │
└──────────────────────────────────────────────────────┘
```

### Panel Responsibilities

| Panel | Role | Behavior |
|-------|------|----------|
| **Directory Sidebar** | Navigation & grouping | Lists thoughts grouped by selected criterion. Click to select. |
| **Inline Focus Editor** | Content editing | Shows selected thought's content inline. Replaces modal FocusEditor in this mode. |
| **Inspector** (existing) | Metadata editing | Floats as overlay on right. Unchanged — provides status, priority, stack assignment. |
| **ChatOverlay** (existing) | AI chat | Floats as overlay on left. Unchanged. |

---

## 3. Data Hierarchy & Transformations

The Directory view uses a **flat grouping** model (no parent/child nesting). A `treeTransformation` utility projects flat `thoughts` and `stacks` into grouped sections:

### Grouping Modes

| Group By | Structure | Fields Used | Notes |
|----------|-----------|-------------|-------|
| **Stack** | `Stack → Thoughts[]` | `thought.stackId`, `stacks` | Most natural grouping. Unstacked thoughts go to "Unfiled" group. |
| **Status** | `Status → Thoughts[]` | `thought.status` | Groups: Todo, Doing, Done, None. |
| **Date** | `Month (YYYY-MM) → Thoughts[]` | `thought.createdAt` | Flat month groups (not nested Year→Month). Sorted newest first. |
| **Priority** | `Priority → Thoughts[]` | `thought.priority` | Groups: Urgent, High, Medium, Low, None. |
| **Type** | `Type → Thoughts[]` | `thought.type` | Groups: Text, Tasks, File, Table, Paint, Embed. |

### Sorting Within Groups

- Default: `order` field (explicit sort order), then `createdAt` descending
- User-selectable: Alphabetical (A-Z / Z-A), Date (newest/oldest), Manual

### Transformation Utility Signature

```typescript
interface DirectoryGroup {
  id: string;           // Group identifier (stack id, status string, date string, etc.)
  label: string;        // Display label (stack name, "Todo", "Apr 2026", etc.)
  icon?: LucideIcon;    // Optional icon for the group header
  color?: string;       // Optional accent color (stack color)
  thoughtIds: string[]; // Ordered list of thought IDs in this group
  collapsed?: boolean;  // UI state: is this group collapsed?
}

function buildDirectoryGroups(
  thoughts: Thought[],
  stacks: Stack[],
  groupBy: DirectoryGroupBy,
  sortBy: DirectorySortBy,
  searchQuery?: string,
  spaceId?: string,
): DirectoryGroup[];
```

---

## 4. Architectural Impact

### What Stays Unchanged

| Component | Status | Reason |
|-----------|--------|--------|
| `Inspector.tsx` | **No changes** | Already floats as overlay, works in all modes |
| `ChatOverlay.tsx` | **No changes** | Already floats as overlay, works in all modes |
| `World.tsx` | **No changes** | Still renders ThoughtNodes for spatial/kanban/calendar |
| `Toolbar.tsx` | **Minor addition** | Add directory mode button to ViewSwitcher |
| `App.tsx` | **Minor addition** | Add `<DirectoryOverlay />` alongside existing overlays |
| All FocusEditor modals | **No changes** | Still used in spatial/kanban/calendar modes |

### What's New

| Component | Purpose | Pattern |
|-----------|---------|---------|
| `DirectoryOverlay.tsx` | Sidebar + inline editor container | Follows KanbanOverlay/CalendarOverlay pattern |
| `DirectorySidebar.tsx` | Grouped list UI | React-rendered list (not physics-positioned) |
| `DirectoryInlineEditor.tsx` | Inline content editor | Reuses existing FocusEditor content components |
| `treeTransformation.ts` | Grouping utility | Pure function, memoized |

### Physics Engine Handling

**Decision: Skip the physics loop in directory mode.**

Unlike kanban/calendar (where the physics engine acts as a smooth animation engine positioning nodes), directory mode renders a React list — no ThoughtNodes need positioning.

```typescript
// In usePhysics.ts — early return for directory mode
if (mode === 'directory') return;
```

This means:
- No ThoughtNodes rendered/positioned for directory mode
- No wasted CPU cycles on physics calculations
- Clean separation: directory = React list, other modes = physics-positioned nodes

### Mode-Conditional Refactoring

Files that need `mode === 'directory'` handling:

| File | Current Checks | Directory Change |
|------|---------------|------------------|
| `src/db.ts` | Space type definition | Add `'directory'` to mode union |
| `src/components/toolbar/ViewSwitcher.tsx` | 1 check | Add directory button |
| `src/App.tsx` | 3 checks | Add `<DirectoryOverlay />` |
| `src/hooks/usePhysics.ts` | 26 checks | Early return for directory mode |
| `src/components/Viewport.tsx` | 7 checks | No ThoughtNode interaction in directory |
| `src/components/toolbar/FilterPanel.tsx` | 22 checks | Add directory-scoped filter state |
| `src/components/toolbar/StatusBar.tsx` | 2 checks | Hide physics/zoom controls in directory |
| `src/components/EmptyState.tsx` | 1 check | Return null in directory mode |
| `src/store/slices/spaceSlice.ts` | 2 checks | Handle directory mode transitions |
| `src/store/slices/dataSlice.ts` | 1 check | Include directory in export/import |

**Total: ~65 existing mode checks + ~10 new additions = ~75 total**

---

## 5. Zustand Store Additions

Following the existing mode-scoped filter pattern:

```typescript
// New state in store (following spatialSearchQuery, kanbanSearchQuery pattern)
directorySearchQuery: string;
directoryGroupBy: 'stack' | 'status' | 'date' | 'priority' | 'type';
directorySortBy: 'order' | 'alpha' | 'alpha-reverse' | 'date-newest' | 'date-oldest';
directoryCollapsedGroups: Set<string>;  // Which groups are collapsed
directorySelectedThoughtId: string | null;  // For inline editor selection
```

---

## 6. Phase Roadmap

### Phase 1: Foundation (~1 day)

**Goal:** Type system, store state, and transformation utility.

1. **Extend Space type** in `src/db.ts`:
   ```typescript
   mode: 'spatial' | 'kanban' | 'calendar' | 'directory';
   ```

2. **Add directory state** to Zustand store (new slice or extend existing):
   - `directorySearchQuery`, `directoryGroupBy`, `directorySortBy`
   - `directoryCollapsedGroups`, `directorySelectedThoughtId`
   - Setters for each

3. **Implement `treeTransformation.ts`**:
   - `buildDirectoryGroups()` pure function
   - Support all 5 grouping modes
   - Support all sort options
   - Filter by search query
   - Memoize with `useMemo` in component

4. **Add to ViewSwitcher**:
   - New button: `{ id: 'directory', label: 'Directory', icon: FolderTree, accentClass: 'bg-emerald-500' }`

### Phase 2: Directory Overlay & Sidebar (~2 days)

**Goal:** Render the grouped list UI following kanban/calendar overlay pattern.

1. **Create `DirectoryOverlay.tsx`**:
   - Self-guard: `if (activeSpace?.mode !== 'directory') return null;`
   - Two-panel layout: sidebar (260px) + inline editor (flex-1)
   - Glass containers, consistent with kanban/calendar styling
   - `pointer-events-none` on wrapper, `pointer-events-auto` on panels

2. **Create `DirectorySidebar.tsx`**:
   - Group header with collapse toggle (chevron icon)
   - Grouped thought list items (compact cards showing title, type icon, status dot)
   - Click thought → set `directorySelectedThoughtId` + `selectedThoughtId` (syncs with Inspector)
   - Search input at top
   - Group By dropdown selector
   - Sort By dropdown selector
   - Drag-and-drop between groups (updates `stackId`, `status`, etc.)

3. **Style thought list items**:
   - Compact row: `[type icon] [title] [status dot] [priority badge]`
   - Hover state: subtle background highlight
   - Selected state: accent border/background
   - Follows existing design system (CSS variables, glass morphism)

### Phase 3: Inline Focus Editor (~2 days)

**Goal:** Render editor content inline instead of modal when in directory mode.

1. **Create `DirectoryInlineEditor.tsx`**:
   - Reads `directorySelectedThoughtId` from store
   - When a thought is selected: render the appropriate editor content
   - When nothing selected: show placeholder ("Select a thought to edit")
   - Reuse existing editor logic (TextFocusEditor content, TasksFocusEditor content, etc.)
   - **Key refactor:** Extract editor content from FocusEditorShell into reusable components

2. **Extract reusable editor components**:
   - `TextEditorContent.tsx` — markdown editor (extracted from TextFocusEditor)
   - `TasksEditorContent.tsx` — task list (extracted from TasksFocusEditor)
   - `FileEditorContent.tsx` — file viewer (extracted from FileFocusEditor)
   - `TableEditorContent.tsx` — table editor (extracted from TableFocusEditor)
   - Each component accepts `thoughtId` prop and manages its own state

3. **Editor registry pattern** (following existing type-specific inspector panel registry):
   ```typescript
   const EDITOR_COMPONENTS: Record<ThoughtType, React.ComponentType<{ thoughtId: string }>> = {
     text: TextEditorContent,
     tasks: TasksEditorContent,
     file: FileEditorContent,
     table: TableEditorContent,
     paint: PaintEditorContent,
     embed: EmbedEditorContent,
     label: TextEditorContent, // fallback
   };
   ```

4. **Preserve modal FocusEditor** for spatial/kanban/calendar modes — no breaking changes

### Phase 4: Integration & Polish (~1.5 days)

**Goal:** Wire up all mode-conditional logic and test transitions.

1. **Refactor mode checks** in all 10 files listed in Section 4
   - Add `directory` to conditional chains
   - Add `directorySearchQuery` etc. to FilterPanel
   - Hide physics/zoom controls in StatusBar for directory mode
   - Skip physics loop in `usePhysics.ts` for directory mode

2. **Mode transition: Directory → Spatial**:
   - When switching from directory to spatial mode:
     - If a thought is selected: animate camera to that thought's coordinates
     - Use existing `setViewMode` pattern from `Toolbar.tsx`
   - When switching from spatial to directory:
     - Reset camera transform to `{ x: 0, y: 0, scale: 1 }`

3. **Keyboard navigation**:
   - Arrow keys to navigate between thoughts in the list
   - Enter to open inline editor
   - Escape to deselect

4. **Persistence**:
   - Save `directoryGroupBy`, `directorySortBy`, `directoryCollapsedGroups` to space settings
   - Restore on space load

---

## 7. Technical Decisions & Resolved Questions

### Q: Should the physics engine run in directory mode?
**A: No.** Early return in `usePhysics.ts`. Directory renders a React list — no ThoughtNodes need positioning. This saves CPU and avoids edge cases.

### Q: Camera animation on Directory → Spatial transition?
**A: Yes.** If a thought is selected, animate the camera to that thought's `(x, y)` coordinates. Reuse the existing `setViewMode` pattern in `Toolbar.tsx` which already handles camera reset/restore on mode switches.

### Q: Fixed or resizable columns?
**A: Fixed.** Sidebar at `260px` (matches kanban/calendar), inline editor fills remaining space. Resizable columns can be added later if needed.

### Q: Date grouping: nested or flat?
**A: Flat month groups** (`Apr 2026`, `Mar 2026`, etc.). Nested Year→Month→Day is overkill for the initial implementation. Flat groups are simpler, faster to render, and match user mental model for recent content.

### Q: Should Inspector still work in directory mode?
**A: Yes.** Inspector floats as an overlay on the right, unchanged. It provides metadata editing (status, priority, stack assignment) while the inline editor handles content. Users can use both simultaneously.

### Q: What about drag-and-drop between groups?
**A: Yes, but scoped.** Drag a thought from one stack group to another → updates `stackId`. Drag from "Todo" to "Done" → updates `status`. Drag to "Unfiled" → clears `stackId`. Use `@dnd-kit` or native HTML5 drag events.

---

## 8. Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Inline editor refactor breaks existing modal FocusEditors | **Medium** | Extract content into shared components; modals import the same components |
| Physics engine early return breaks other modes | **Low** | Simple `if (mode === 'directory') return;` guard, well-isolated |
| Large thought lists (1000+) cause performance issues | **Medium** | Virtualize the list with `react-window` or similar; lazy-render groups |
| Drag-and-drop complexity | **Low** | Start with click-to-move (dropdown in list item), add drag later |
| Mode transition camera animation edge cases | **Low** | Thoughts without coordinates default to center viewport |

---

## 9. File Manifest

### New Files
```
src/
├── components/
│   ├── DirectoryOverlay.tsx          # Main container (sidebar + inline editor)
│   ├── DirectorySidebar.tsx          # Grouped list UI
│   └── DirectoryInlineEditor.tsx     # Inline content editor
├── utils/
│   └── treeTransformation.ts         # Grouping/sorting utility
└── store/
    └── slices/
        └── directorySlice.ts         # Directory-specific Zustand state (or extend uiSlice)
```

### Modified Files
```
src/db.ts                             # Add 'directory' to Space.mode type
src/App.tsx                           # Add <DirectoryOverlay />
src/components/toolbar/ViewSwitcher.tsx  # Add directory button
src/components/toolbar/FilterPanel.tsx   # Add directory filter state
src/components/toolbar/StatusBar.tsx     # Hide physics controls in directory
src/components/EmptyState.tsx            # Return null in directory mode
src/hooks/usePhysics.ts                  # Early return for directory mode
src/components/Viewport.tsx              # Disable gestures in directory mode
src/store/slices/spaceSlice.ts           # Handle directory mode transitions
src/store/slices/dataSlice.ts            # Include directory in export/import
src/components/editors/                  # Extract reusable content components
```

---

## 10. Estimated Effort

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Phase 1: Foundation | ~1 day | Types, store, transformation utility, ViewSwitcher |
| Phase 2: Overlay & Sidebar | ~2 days | DirectoryOverlay, DirectorySidebar, grouped list UI |
| Phase 3: Inline Editor | ~2 days | Extracted editor components, DirectoryInlineEditor |
| Phase 4: Integration | ~1.5 days | Mode checks, transitions, keyboard nav, persistence |
| Testing & Polish | ~1 day | Edge cases, performance, cross-mode testing |
| **Total** | **~7.5 days** | Production-ready Directory mode |

---

## 11. Success Criteria

- [ ] Directory mode appears in ViewSwitcher and switches correctly
- [ ] Thoughts are grouped by selected criterion (stack/status/date/priority/type)
- [ ] Clicking a thought in the sidebar loads its content in the inline editor
- [ ] Inline editor supports all thought types (text, tasks, file, table, paint, embed)
- [ ] Modal FocusEditor still works in spatial/kanban/calendar modes
- [ ] Inspector still works as floating overlay in directory mode
- [ ] ChatOverlay still works as floating overlay in directory mode
- [ ] Switching Directory → Spatial animates camera to selected thought
- [ ] Switching Spatial → Directory resets camera transform
- [ ] Search filters thoughts across all groups
- [ ] Drag-and-drop (or click-to-move) changes thought grouping
- [ ] Group collapse state persists per space
- [ ] Physics engine does not run in directory mode
- [ ] No regressions in spatial, kanban, or calendar modes
