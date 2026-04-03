# Task Context: Archive Feature Implementation

Session ID: 2026-04-03-archive-feature
Created: 2026-04-03T00:00:00.000Z
Status: in_progress

## Current Request
Add archive functionality to thoughts using `archivedAt` timestamp field, following the existing tombstone pattern. Must update Supabase schema via MCP server.

## Context Files (Standards to Follow)
- .opencode/context/core/standards/code-quality.md

## Reference Files (Source Material to Look At)
- src/db.ts - Thought interface
- src/store/slices/thoughtSlice.ts - Store functions
- src/services/supabaseSync.ts - Sync transforms
- src/services/sync/syncOrchestrator.ts - Sync logic
- src/hooks/usePhysics.ts - Spatial queries
- src/components/kanban/KanbanOverlay.tsx - Kanban view
- src/components/calendar/CalendarOverlay.tsx - Calendar view

## External Docs Fetched
None required for this task.

## Components
1. Database Layer - Add `archivedAt` field to Thought interface + Supabase schema
2. Store Layer - Add archive/unarchive functions to thoughtSlice
3. Sync Layer - Update transforms for `archivedAt`
4. Query Updates - Update all queries to filter archived
5. UI Layer - Context menu + filter toggle

## Constraints
- Follow existing tombstone pattern (like deletedAt)
- Use MCP supabase_apply_migration for schema changes
- All queries must exclude archived by default
- Maintain syncStatus: 'local' on archive/unarchive

## Exit Criteria
- [x] Thoughts can be archived from context menu
- [x] Archived thoughts hidden by default in all views
- [x] "Show archived" toggle in filter bar
- [x] Archived thoughts sync to cloud
- [x] Unarchive restores thought to previous state
- [x] TypeScript compiles without errors

## Implementation Complete

### Changes Made:
1. **Database Layer (src/db.ts)**: Added `archivedAt?: number | null` to Thought interface
2. **Supabase (MCP)**: Applied migration to add `archived_at` column + index
3. **Local Schema (supabase/schema.sql)**: Updated to v5 with archived_at column
4. **Sync Layer (supabaseSync.ts)**: Added archivedAt to timestamp conversion
5. **Store Types (types.ts)**: Added showArchived, setShowArchived, archive/unarchive functions
6. **Store Slice (thoughtSlice.ts)**: Added archiveThought, archiveThoughts, unarchiveThought, unarchiveThoughts
7. **UI Slice (uiSlice.ts)**: Added showArchived state and setShowArchived function
8. **Filter Bar (ViewFilterBar.tsx)**: Added show archived toggle button
9. **Kanban/Calendar Filter Bars**: Updated to use showArchived props
10. **MultiSelectionMenu.tsx**: Added Archive/Restore buttons in footer
11. **Query Updates**: All thought queries now filter archived by default

### Files Modified:
- src/db.ts
- src/store/types.ts
- src/store/slices/thoughtSlice.ts
- src/store/slices/uiSlice.ts
- src/store/slices/stackSlice.ts
- src/store/slices/spaceSlice.ts
- src/store/slices/dataSlice.ts
- src/store/slices/authSlice.ts
- src/services/supabaseSync.ts
- src/services/sync/syncOrchestrator.ts
- src/components/shared/ViewFilterBar.tsx
- src/components/kanban/KanbanFilterBar.tsx
- src/components/calendar/CalendarFilterBar.tsx
- src/components/MultiSelectionMenu.tsx
- supabase/schema.sql
