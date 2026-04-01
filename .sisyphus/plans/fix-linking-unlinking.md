# Plan: Fix linking and unlinking (Zustand-first)

## TL;DR
> **Quick Summary**: Refactor the stack linking/unlinking logic to strictly follow the "Zustand as Source of Truth" principle, resolving race conditions where orphaned thoughts remain linked.
> 
> **Deliverables**:
> - Refactored `unlinkSelectedThoughts` in `thoughtSlice.ts`
> - Refactored `cleanupStacks` in `stackSlice.ts`
> - Refactored `deleteStack` in `stackSlice.ts`
> - Enhanced deletion safety in `syncOrchestrator.ts`
> 
> **Estimated Effort**: Short
> **Parallel Execution**: YES - 2 waves
> **Critical Path**: Task 1 → Task 2 → Task 3 → Task 4

---

## Context

### Original Request
The user reported that unlinking a thought from a 2-thought stack correctly unlinks the target but leaves the other thought linked, and the stack remains alive (violating the "2+ thoughts per stack" rule).

### Interview Summary
**Key Discussions**:
- Confirmed race condition between Zustand store updates and IndexedDB transactions in `cleanupStacks`.
- Identified that `cleanupStacks` uses DB transactions which might not see immediate updates from `unlinkSelectedThoughts`.
- Decided to move to a "Zustand-first" update pattern where the store is updated immediately, then persisted to DB.

### Metis Review
**Identified Gaps** (addressed):
- **Stale State Capture**: Found that `unlinkSelectedThoughts` captures `thoughts` at function start, violating `AGENTS.md` guidelines.
- **Split-Phase Updates**: `cleanupStacks` had a confusing 3-phase update (DB -> Zustand -> Refresh) which invited race conditions.
- **Deletion Safety**: Found that `deltaSync` could delete thoughts from IndexedDB even if they are in the active editing registry.

---

## Work Objectives

### Core Objective
Ensure that unlinking a thought from a 2-thought stack always results in BOTH thoughts being unlinked and the stack being deleted, with ZERO UI lag or state flickering.

### Concrete Deliverables
- `src/store/slices/thoughtSlice.ts`: Refactored `unlinkSelectedThoughts`
- `src/store/slices/stackSlice.ts`: Refactored `cleanupStacks` and `deleteStack`
- `src/services/sync/syncOrchestrator.ts`: Added `isEditing` check to deletion loop

### Definition of Done
- [ ] Unlinking one thought from a 2-thought stack deletes the stack and unlinks both thoughts.
- [ ] No stale state capture bugs in the modified functions.
- [ ] All tests pass and build succeeds.

### Must Have
- Single Source of Truth (Zustand updated first).
- No redundant `refreshThoughts` calls after local operations.
- Protection for editing thoughts during cloud-triggered deletions.

### Must NOT Have (Guardrails)
- No new UI indicators or toast notifications.
- No changes to `mergeThoughts` algorithm itself.
- No destructuring of state at function start for async functions.

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: NO
- **Automated tests**: None (Agent QA only)
- **Framework**: none

### QA Policy
Every task includes agent-executed QA scenarios using `Playwright` for UI verification and `Bash/curl` for API/DB verification. Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — logic refactor):
├── Task 1: Refactor unlinkSelectedThoughts [quick]
├── Task 2: Refactor cleanupStacks (Zustand-first) [quick]
└── Task 3: Refactor deleteStack (Zustand-first) [quick]

Wave 2 (After Wave 1 — safety + cleanup):
├── Task 4: Add editing registry protection to deletion [quick]
└── Task 5: Final build + cross-operation verification [quick]

Wave FINAL (After ALL tasks — 4 parallel reviews):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high)
└── Task F4: Scope fidelity check (deep)
```

### Dependency Matrix
- **1-3**: — — 4, 5
- **4**: — — 5
- **5**: 1, 2, 3, 4 — F1-F4

---

## TODOs

- [ ] 1. Refactor `unlinkSelectedThoughts` in `thoughtSlice.ts`

  **What to do**:
  - Refactor `unlinkSelectedThoughts` to update Zustand immediately using `set()`.
  - Do NOT destructure `thoughts` at function start; call `get().thoughts` fresh.
  - Remove redundant `refreshThoughts()` calls.
  - Ensure `cleanupStacks()` is called AFTER the Zustand update.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`react-doctor`]

  **Parallelization**: Wave 1
  - **Blocks**: Task 5
  - **Blocked By**: None

  **References**:
  - `src/store/slices/thoughtSlice.ts:672` - Current implementation

  **QA Scenarios**:
  \`\`\`
  Scenario: Unlink from 2-thought stack
    Tool: Playwright
    Preconditions: Stack S with thoughts A and B.
    Steps:
      1. Open app, select thought A.
      2. Trigger unlink action.
      3. Assert thought A stackId is null in Zustand.
      4. Assert cleanupStacks is triggered.
    Expected Result: Thought A is unlinked instantly in UI.
    Evidence: .sisyphus/evidence/task-1-unlink-ui.png
  \`\`\`

- [ ] 2. Refactor `cleanupStacks` in `stackSlice.ts` (Zustand-first)

  **What to do**:
  - Refactor `cleanupStacks` to be Zustand-first:
    1. Read `thoughts` and `stacks` from `get()`.
    2. Identify stacks with < 2 thoughts.
    3. Update Zustand store for orphaned thoughts and empty stacks in one `set()` call.
    4. Persist those specific changes to IndexedDB in the background.
  - Remove all `refreshThoughts()` and `refreshStacks()` calls inside this function.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`react-doctor`]

  **Parallelization**: Wave 1
  - **Blocks**: Task 5
  - **Blocked By**: None

  **References**:
  - `src/store/slices/stackSlice.ts:144` - Current implementation

  **QA Scenarios**:
  \`\`\`
  Scenario: Automated cleanup of orphaned thought
    Tool: Playwright
    Preconditions: Stack S with thoughts A and B.
    Steps:
      1. Manually set A.stackId = null in Zustand.
      2. Call cleanupStacks().
      3. Assert B.stackId is null in Zustand.
      4. Assert Stack S is marked as deleted in Zustand.
    Expected Result: Both thoughts unlinked, stack deleted.
    Evidence: .sisyphus/evidence/task-2-cleanup-logic.png
  \`\`\`

- [ ] 3. Refactor `deleteStack` in `stackSlice.ts` (Zustand-first)

  **What to do**:
  - Apply the same Zustand-first pattern to `deleteStack`:
    1. Update Zustand store (unlink all thoughts, delete stack) in one `set()` call.
    2. Persist to IndexedDB in background.
  - Remove redundant `refreshThoughts()` and `refreshStacks()` calls.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`react-doctor`]

  **Parallelization**: Wave 1
  - **Blocks**: Task 5
  - **Blocked By**: None

  **References**:
  - `src/store/slices/stackSlice.ts:112` - Current implementation

- [ ] 4. Add editing registry protection to deletion in `syncOrchestrator.ts`

  **What to do**:
  - In `src/services/sync/syncOrchestrator.ts`, locate the deletion loop in `deltaSync` (absence rule).
  - Add a check to skip deletion of any thought currently in `editingThoughtIds`.
  - Log a warning when a deletion is skipped for this reason.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**: Wave 2
  - **Blocks**: Task 5
  - **Blocked By**: None

  **References**:
  - `src/services/sync/syncOrchestrator.ts:361` - Absence rule deletion loop

- [ ] 5. Final build + cross-operation verification

  **What to do**:
  - Run `npm run build` to ensure no type errors.
  - Verify that linking/unlinking works correctly from both ThoughtNode and Inspector.
  - Verify that rapid unlinking doesn't cause race conditions.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: [`react-doctor`]

  **Parallelization**: Wave 2 (Integration)
  - **Blocks**: F1-F4
  - **Blocked By**: 1, 2, 3, 4

---

## Final Verification Wave

- [ ] F1. **Plan Compliance Audit** — `oracle`
- [ ] F2. **Code Quality Review** — `unspecified-high`
- [ ] F3. **Real Manual QA** — `unspecified-high`
- [ ] F4. **Scope Fidelity Check** — `deep`

---

## Commit Strategy
- **1**: `refactor(store): zustand-first unlink logic` — thoughtSlice.ts, stackSlice.ts
- **2**: `fix(sync): protect editing thoughts from deletion` — syncOrchestrator.ts

---

## Success Criteria

### Verification Commands
```bash
npm run build  # Expected: success
```

### Final Checklist
- [ ] Unlinking correctly cleans up stacks
- [ ] No state flickering
- [ ] AGENTS.md guidelines followed (no stale state capture)
