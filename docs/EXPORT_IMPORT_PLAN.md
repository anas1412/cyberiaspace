# Export & Import Professional System: Cyberia Project

This document outlines the professional plan for implementing a robust, additive, and secure Export/Import system using a `.zip` bundle architecture with intelligent ID re-mapping.

## 1. Architecture Overview

### 1.1 File Format: `.cyberia.zip` (Cyberia Backup)
A standard ZIP compression will be used to encapsulate JSON metadata and binary assets (blobs).
- **Compression Library**: `jszip` (to be added to dependencies).
- **Naming Convention**: `cyberia_export_YYYY-MM-DD_HHmm.zip` (e.g., `cyberia_export_2026-03-10_1430.zip`).

### 1.2 Bundle Structure
```
/
├── manifest.json       # Metadata: version, date, space summary (name, thoughts count)
├── data/
│   ├── spaces.json     # All Space records
│   ├── stacks.json     # All Stack records
│   └── thoughts.json   # All Thought records
└── assets/
    ├── <ulid_1>.bin    # Raw blob for thought 1
    └── <ulid_2>.bin    # Raw blob for thought 2
```

---

## 2. Export Workflow

### 2.1 Space Selection UI
A new multi-selection modal will allow users to:
1.  See a list of all active (non-deleted) spaces.
2.  Toggle checkboxes to select specific spaces for export.
3.  **Constraint**: Minimum 1 space must be selected.
4.  Calculate total exported thoughts and estimated file size (based on blobs) in real-time.

### 2.2 Data Aggregation
The export engine will:
1.  Fetch selected `spaces`.
2.  Fetch all `stacks` belonging to those spaces.
3.  Fetch all `thoughts` belonging to those spaces.
4.  Fetch all `blobs` associated with those thoughts.
5.  Generate the `manifest.json` containing:
    -   `version`: Current app data version (17).
    -   `exportedAt`: ISO timestamp.
    -   `summary`: Array of `{ spaceName: string, thoughtCount: number }`.

---

## 3. Import Workflow

### 3.1 Initial Validation
When a `.zip` file is dropped or selected:
1.  **Read Manifest**: Check if the format is valid and the version is compatible.
2.  **Quota Check**:
    -   Get user's current plan from `useAuthStore`.
    -   Calculate `currentSpaceCount + incomingSpaceCount`.
    -   If total > `PLAN_CONFIG[plan].MAX_SPACES`, abort and show a "Quota Exceeded" modal.

### 3.2 Review Modal
Before committing to the database, show a professional summary:
-   "Importing **3 Spaces** containing **142 Thoughts**."
-   "Estimated storage impact: **12.4 MB**."
-   Input fields to rename spaces if a collision is detected with local names (e.g., "Workspace" -> "Workspace (Imported)").

### 3.3 Additive Import Logic
Imports are **always additive**. New entities are added, and nothing is deleted or overwritten.

---

## 4. Intelligent ID Re-mapping (Collision Prevention)

To prevent ULID collisions and ensure data integrity across different user accounts, we use a **Regeneration & Translation** strategy.

### 4.1 Re-mapping Strategy
During import, an internal translation map is maintained:
`const idMap = new Map<string, string>(); // OldULID -> NewULID`

### 4.2 Translation Steps
1.  **Spaces**:
    -   Generate `newSpaceId = ulid()`.
    -   Store `idMap.set(oldSpaceId, newSpaceId)`.
    -   Reset `syncStatus: 'local'` and `updatedAt: Date.now()`.
2.  **Stacks**:
    -   Generate `newStackId = ulid()`.
    -   Store `idMap.set(oldStackId, newStackId)`.
    -   Update `spaceId` using `idMap.get(oldSpaceId)`.
    -   Reset `syncStatus: 'local'`.
3.  **Thoughts**:
    -   Generate `newThoughtId = ulid()`.
    -   Update `spaceId` and `stackId` using the `idMap`.
    -   Reset `syncStatus: 'local'`.
    -   Update `updatedAt`.
4.  **Blobs**:
    -   Update `thoughtId` using the `idMap`.
    -   Generate a new ID for the blob entry itself to ensure uniqueness in Dexie.

---

## 5. Security & Safety

-   **Sync Guard**: The `syncOrchestrator.setSyncBlocked(true)` must be called before the import starts to prevent partial syncs during the transaction.
-   **Atomic Transaction**: Use `db.transaction('rw', ...)` to ensure that if one part of the import fails, the entire workspace remains clean.
-   **Sanitization**: All incoming text and meta-data will be sanitized to prevent injection or corruption.

## 6. Dependencies & Implementation Steps

1.  **Add `jszip`**: `npm install jszip`.
2.  **Refactor `dataSlice.ts`**:
    -   Implement `exportSpaces(spaceIds: string[])`.
    -   Implement `importCyberiaZip(file: File)`.
3.  **UI Updates**:
    -   Update `AccountMenu.tsx` with a new "Backup/Transfer" submenu.
    -   Create `SpaceSelectionModal.tsx`.
    -   Create `ImportReviewModal.tsx`.

---
*Note: This plan is designed to be developer-ready and adheres to the "Local First" architecture of Cyberia.*
