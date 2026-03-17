# Feature Re-enablement Guide

This document lists all the temporary changes made to disable **Cloud Synchronization** and **Oracle AI** features. To restore these features, follow the instructions for each file below.

## 1. Cloud Synchronization Re-enablement

### `src/components/toolbar/SystemTray.tsx`
*   **Search for:** `{/* Cloud Sync disabled */}` and `{false && (`
*   **Action:** Remove the `false && (` wrapper and its closing `)` around the following sections:
    *   Cloud Sync status div (approx lines 292-326)
    *   Restore Backup button (approx lines 329-341)
    *   Auto-Sync toggle button (approx lines 344-366)
    *   Clear Cloud Data button (approx lines 390-399)
*   **Text Restoration:** Change "Unlock More Spaces & Assets" back to "Unlock Oracle & More Spaces" (approx line 283).

### `src/store/slices/authSlice.ts`
*   **Initial State:** In `getInitialUser` (line 27) and `setAuthenticatedUser` (line 93), change `autoSync: false` back to `autoSync: user.settings?.autoSync ?? true`.
*   **Profile Refresh:** In `refreshProfile` (approx lines 275-292):
    *   Uncomment the `cloudAutoSync` declaration.
    *   Change `autoSync: false` to `autoSync: cloudAutoSync !== undefined ? cloudAutoSync : user.settings?.autoSync`.
    *   Uncomment the block that updates the `autoSync` state from the cloud.
*   **Settings Update:** In `updateSettings` (approx lines 312-315), uncomment the lines that set the `autoSync` state and save to `localStorage`.

### `src/components/editors/FileFocusEditor.tsx`
*   **Search for:** `{/* Sync status badges disabled */}` and `{/* Sync actions disabled */}`
*   **Action:** Remove the `false && (` wrappers and their closing `)` around:
    *   The status badges in `headerActions` (approx lines 432-445).
    *   The sync/remove buttons in `footerActions` (approx lines 465-487).

---

## 2. Oracle AI Re-enablement

### `src/components/toolbar/SystemTray.tsx`
*   **Search for:** `{/* Ask Oracle disabled */}`
*   **Action:** Remove the `false &&` prefix from the condition (approx line 175).

### `src/components/ChatOverlay.tsx`
*   **Action:** Remove the line `if (true) return null;` at the beginning of the component logic (approx line 608).

### `src/store/slices/uiSlice.ts`
*   **Action:** In `toggleOracleMode`, uncomment the logic that checks for a user and sets `oracleMode: true`.

### `src/components/PricingModal.tsx`
*   **Action:** Restore the "Premium Oracle AI" and "Advanced Functionalities" items in the features array (approx lines 280-284).

### `src/store/slices/dataSlice.ts`
*   **Action:** Restore the "Oracle AI" name and AI-related content in the onboarding/demo data (approx lines 138, 148, 149, 472, 482, 483).

---

*Note: After re-enabling, run `npm run lint` and `npm run build` to ensure everything is connected correctly.*
