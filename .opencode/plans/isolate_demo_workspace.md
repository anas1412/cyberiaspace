# Plan: Isolate Demo Workspace (Memory-Only)

Isolate the landing page demo from the main application database to prevent "Demo Workspace" from appearing in the user's real space list.

## Proposed Changes

### Store Logic (`src/store/useStore.ts`)

1.  **State Extension**:
    *   Add `_savedUserState` to `CyberiaState` interface to store real user data during demo sessions.
2.  **Refactor `loadOnboardingData`**:
    *   Change signature to `loadOnboardingData(options?: { persist?: boolean })`.
    *   Wrap database transactions in a conditional check: `if (options?.persist !== false)`.
3.  **Update `setDemoMode`**:
    *   **Enable**: Capture current `spaces`, `thoughts`, `stacks`, and `activeSpaceId` into `_savedUserState`. Call `loadOnboardingData({ persist: false })`.
    *   **Disable**: Restore state from `_savedUserState`. Trigger `refreshSpaces()`, `refreshThoughts()`, and `refreshStacks()` from the database to guarantee clean state.
4.  **Write Protection**:
    *   Add `if (get().isDemo) return;` to:
        *   `addThought`
        *   `updateThought`
        *   `deleteThought`
        *   `createStack`
        *   `updateSpace`
        *   `syncOrchestrator.triggerSync` calls

### Component Logic (`src/components/demo/DemoWorkspace.tsx`)

1.  Ensure the `useEffect` cleanup correctly calls `setDemoMode(false)` when the landing page is unmounted.

## Verification Plan

### Automated Tests
*   N/A (Manual verification required for IndexedDB behavior).

### Manual Verification
1.  Open landing page (cyberia.tn).
2.  Verify "Demo Workspace" is interactive.
3.  Open the app (app.cyberia.tn).
4.  Check the Space Switcher:
    *   Verify "Demo Workspace" is **NOT** in the list.
    *   Verify your real spaces are intact.
5.  Check browser DevTools (Application -> IndexedDB -> CyberiaDB):
    *   Verify no entries with `spaceId: 'demo-space'` exist.
