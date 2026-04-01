# Plan: Pause IndexedDB Writes During Focus Mode

## TL;DR

> **Quick Summary**: Add a sync block flag that pauses all IndexedDB writes while user is in focus mode editing, then flush all changes when focus mode closes. This prevents the race condition where sync overwrites local edits.
> 
> **Deliverables**: 
> - New `isFocusEditing` flag in syncOrchestrator
> - Toggle logic when focus mode opens/closes
> - Batch flush all pending changes when exiting focus mode
> 
> **Estimated Effort**: Short (2-3 files, focused change)
> **Parallel Execution**: NO - sequential due to dependency
> **Critical Path**: Add flag → Wire to focus state → Flush on close

---

## Context

### Original Problem
- User reports lag and old text reappearing when typing in TasksFocusEditor/TextFocusEditor
- Root cause: Race condition between:
  1. User types → Zustand updated via `patchThought` (instant)
  2. IndexedDB write debounced (1 second later)
  3. Any sync activity → `refreshThoughts()` reads from IndexedDB
  4. IndexedDB still has old data → overwrites Zustand → user's typing lost

### Proposed Solution
Instead of fixing the complex race condition, simply **pause ALL IndexedDB writes while in focus mode**, then flush all changes when exiting. This is a cleaner, lower-risk solution.

---

## Work Objectives

### Core Objective
Prevent IndexedDB writes (and thus sync conflicts) while user is actively editing in focus mode.

### Concrete Deliverables
1. New `isFocusEditing` boolean in syncOrchestrator
2. Set `isFocusEditing = true` when `activeFocusId` is set
3. Set `isFocusEditing = false` when `activeFocusId` becomes null
4. When `isFocusEditing = false`, flush/batch all pending changes to IndexedDB

### Definition of Done
- [ ] Focus mode open → IndexedDB writes stop immediately
- [ ] Focus mode close → All pending changes flushed to IndexedDB
- [ ] No more race condition when typing in focus mode

### Must Have
- Changes saved to Zustand immediately (UI stays responsive)
- All pending changes flushed to IndexedDB on exit
- Works for ALL focus editors (TextFocusEditor, TasksFocusEditor, TableFocusEditor, etc.)

### Must NOT Have
- Don't block sync entirely (other thoughts should still sync)
- Don't lose any user data
- Don't break non-focus-mode editing (Inspector)

### Guardrails (Critical)
- **CRASH RECOVERY**: Must have mechanism to flush pending changes before browser closes (beforeunload handler or periodic writes)
- **QUEUE BOUNDING**: Must limit pending changes queue to prevent memory issues (max ~1000 changes)
- **BLOCK SCOPE**: Only block sync for the SPECIFIC thought being edited, not all thoughts
- **RAPID TOGGLE**: Handle rapid open/close of focus mode (< 1000ms) correctly

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: NO
- **Automated tests**: NO
- **Agent-Executed QA**: YES (manual verification via UI)

### QA Policy
Every task includes agent-executed QA scenarios.

---

## Execution Strategy

### Wave 1 (Foundation)
1. Add `isFocusEditing` flag to syncOrchestrator
2. Wire `activeFocusId` state changes to syncOrchestrator
3. Modify DB write functions to check `isFocusEditing`

---

## TODOs

- [ ] 1. Add `isFocusEditing` flag to syncOrchestrator

  **What to do**:
  - Add `isFocusEditing: boolean` to syncOrchestrator module
  - Add `setFocusEditing(blocked: boolean)` function
  - When called with `true`: all IndexedDB writes should be queued/batched
  - When called with `false`: flush all queued writes to IndexedDB immediately

  **References**:
  - `src/services/sync/syncOrchestrator.ts` - Existing `isSyncBlocked` pattern to follow
  - `src/store/slices/thoughtSlice.ts:15-16` - `activeFocusId` state definition

  **Acceptance Criteria**:
  - [ ] Flag defaults to false
  - [ ] Function exists to set it

- [ ] 2. Wire focus mode state to syncOrchestrator

  **What to do**:
  - In thoughtSlice, listen to `activeFocusId` changes
  - When `activeFocusId` is set (non-null): call `setFocusEditing(true)`
  - When `activeFocusId` becomes null: call `setFocusEditing(false)`
  - This should happen in the `setActiveFocus` action

  **References**:
  - `src/store/slices/thoughtSlice.ts` - `setActiveFocus` function around line 450
  - Pattern from how `setSyncBlocked` is called in dataSlice

  **Acceptance Criteria**:
  - [ ] Opening any focus editor sets `isFocusEditing = true`
  - [ ] Closing any focus editor sets `isFocusEditing = false`

- [ ] 3. Modify DB writes to respect focus editing flag

  **What to do**:
  - In syncOrchestrator, wrap IndexedDB write operations
  - When `isFocusEditing = true`: queue writes instead of executing
  - When `isFocusEditing = false`: execute all queued writes
  - Or: use the existing `isSyncBlocked` mechanism but scope it to specific thought being edited

  **Alternative (Simpler)**:
  - Use existing `patchThought` path that writes directly to DB
  - Instead of writing immediately, add to a per-thought pending queue
  - On focus close, flush the queue

  **References**:
  - `src/components/editors/TasksFocusEditor.tsx:148-164` - Current manual debounce
  - `src/components/editors/TextFocusEditor.tsx` - Same pattern

  **Acceptance Criteria**:
  - [ ] IndexedDB writes pause when focus mode active
  - [ ] All changes saved to IndexedDB when focus mode closes

- [ ] 4. Add crash recovery mechanism

  **What to do**:
  - Add `beforeunload` event handler to flush pending changes before browser closes
  - OR: Add periodic flush (every 30s) to persist data during long focus sessions
  - This ensures no data loss if browser crashes or is closed unexpectedly

  **References**:
  - `src/components/editors/TasksFocusEditor.tsx` - Existing debounce pattern
  - MDN: beforeunload event

  **Acceptance Criteria**:
  - [ ] beforeunload handler flushes pending changes
  - [ ] Periodic flush prevents data loss during long sessions

- [ ] 5. Add queue bounding

  **What to do**:
  - Limit pending changes queue to prevent memory issues
  - If queue exceeds limit, flush oldest changes to IndexedDB

  **Acceptance Criteria**:
  - [ ] Queue bounded to ~1000 changes or 5MB
  - [ ] No memory leaks during long focus sessions

- [ ] 7. QA: Verify race condition is fixed

  **QA Scenarios**:

  Scenario: Typing in TasksFocusEditor
    Tool: Playwright
    Steps:
      1. Open a tasks thought in focus mode
      2. Type multiple tasks rapidly (within 1 second)
      3. Close focus mode
      4. Reopen the thought
    Expected Result: All typed tasks are present, no lost data

  Scenario: Focus mode + other sync activity
    Tool: Playwright
    Steps:
      1. Open focus mode on thought A
      2. Edit thought A (don't close)
      3. Make another change elsewhere that triggers sync
      4. Close focus mode on thought A
    Expected Result: Thought A edits are preserved, no race condition

  Scenario: Multiple focus editors
    Tool: Playwright
    Steps:
      1. Open TextFocusEditor
      2. While open, open TasksFocusEditor (different thought)
      3. Close both
    Expected Result: Both thoughts have their edits saved

  Scenario: Crash recovery (browser close during focus mode)
    Tool: Playwright
    Preconditions: User has unsaved edits in focus mode
    Steps:
      1. Open focus mode on a thought
      2. Make edits (don't close focus mode)
      3. Simulate browser close or page unload
      4. Reopen app
    Expected Result: Edits are preserved (via beforeunload or periodic flush)

  Scenario: Rapid toggle (< 1 second)
    Tool: Playwright
    Steps:
      1. Open focus mode
      2. Make an edit
      3. Close focus mode immediately (< 1000ms)
      4. Reopen focus mode
    Expected Result: Edits are saved despite rapid toggle

  Scenario: Network reconnection during focus mode
    Tool: Playwright
    Steps:
      1. Go offline
      2. Open focus mode, make edits
      3. Come back online (while still in focus mode)
      4. Close focus mode
    Expected Result: Edits sync correctly without conflict

---

## Commit Strategy

- **1**: `feat(sync): pause DB writes during focus mode` — syncOrchestrator.ts, thoughtSlice.ts
