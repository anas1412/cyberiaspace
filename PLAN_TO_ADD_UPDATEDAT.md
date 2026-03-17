>  **Roadmap Reference:** The exhaustive technical specification and edge-case handling for this strategy are documented in [SYNC_LOGIC.md](./SYNC_LOGIC.md).

###  Egress Reduction & Incremental Sync Strategy (V2)

#### Phase 1: Local Mutation Tracking (ASAP)
- **Goal:** Ensure every change is "tagged" for the next sync.
- **Status Simplification:** The `syncStatus: 'pending'` state is removed as redundant.
- **Simplified State Machine:**
    - `local`: New or modified item.
    - `syncing`: Currently in an active API request.
    - `synced`: Matches the cloud state exactly.
    - `error`: Failed sync/upload attempt.
- **Steps:**
  1. **Store Slices:** Modify `thoughtSlice.ts`, `spaceSlice.ts`, and `stackSlice.ts` to ALWAYS update `updatedAt: Date.now()` and `syncStatus: 'local'` in IndexedDB on every mutation (create, update, delete).
  2. **Stack Schema:** Add `updatedAt` field to the `Stack` interface in `src/db.ts` and index it.
  3. **Auto-Migration:** Add a script to `initAuth` that assigns `updatedAt = Date.now()` to any existing record where it is missing, ensuring they get synced once.

####  Priority 2: Supabase & API Optimization
- **Goal:** Stop over-fetching and eliminate response bloat.
- **Steps:**
  1. **Selective Selects:** Update `supabaseSync.ts` fetchers to allow a `columns` parameter (e.g., `.select('id, local_id, updated_at')`).
  2. **Minimal Upserts:** Remove `.select()` or change to `.select('id')` on all `upsert`, `update`, and `insert` calls to Supabase. This eliminates the "Double Egress" where the database sends back the full object we just sent it.
  3. **Schema Sync:** Ensure the `stacks` table in Supabase has an `updated_at` column.

####  Priority 3: Refactor Sync Orchestrator
- **Goal:** Switch from "Brute Force" to "Delta Sync".
- **Steps:**
  1. **Metadata Comparison:** Step 2 of `deltaSync` should only fetch metadata (`id, updated_at`) from Supabase for comparison, not the full objects.
  2. **Push Deltas Only:** Filter local records to only push those where `syncStatus !== 'synced'` or `updatedAt > lastSyncTime`.
  3. **LastSync State:** Persist the timestamp of the last successful sync in `localStorage` and the `users` table.

####  Priority 4: Verification & UI Re-activation [OPTIONAL / NEEDS TESTING]
- **Goal:** Safely bring sync back online.
- **Steps:**
  1. **Egress Monitoring:** Use the Supabase dashboard to verify that egress per sync cycle is in the KB range, not MB/GB.
  2. **UI Restore:** Re-enable the Sync buttons and Auto-Sync toggle in `SystemTray.tsx`.

> **Note:** UI buttons should remain disabled until manual verification of egress reduction is confirmed in the Supabase dashboard.

####  Sync Trigger & Debounce Logic
- **Goal:** Prevent API hammering during active editing.
- **Logic:** Implement a 10-second debounce timer (`SYNC_DEBOUN_MS = 10000`).
- **Behavior:**
    - Any local mutation (Thought move, text edit, Space rename) resets the timer.
    - Sync only fires once the user stops interacting for 10 seconds.
    - If a sync is already in progress, queue the next one to start after the current one finishes + the debounce period.

####  Multi-Device / Login Conflict Resolution
- **Goal:** Handle "Local vs Cloud" state when a user first logs in.
- **Scenario: Fresh Login (Empty Local):** Proactively download all cloud data into IndexedDB.
- **Scenario: Existing Local + Cloud Match:** Use `updated_at` (Last Write Wins) to merge records.
- **Scenario: Manual "Sync to Cloud" (Overwrite):** Provide a hidden or internal utility to force-push local state to cloud, overwriting Supabase (useful for recovery).

####  Robust Space Deletion
- **Goal:** Prevent orphaned data and storage bloat.
- **Logic:** When a Space is deleted:
    1.  **Local:** Recursively mark all associated Thoughts and Stacks as `deletedAt = Date.now()` and `syncStatus = 'local'`.
    2.  **Cloud:** Ensure `deltaSync` detects these `deletedAt` flags.
    3.  **Storage:** Explicitly trigger `supabaseStorage.deleteAllUserFiles(userId, spaceId)` (if applicable) or ensure the orphan cleanup handles all associated `storagePath` entries for that space's thoughts.

---
 **Bottom Line:** By switching to metadata-only comparison and removing redundant upsert responses, we will reduce egress by over 95% for active users.

###  Multi-Device Sync & Conflict Resolution Logic

#### 1. The "Absence = Deletion" Rule
- **Goal:** Sync deletions across multiple devices without downloading full data.
- **Logic:** 
    - When a device (Device B) fetches the **Metadata List** (IDs + updated_at) from Supabase:
    - If a `localId` exists in Device B's IndexedDB but is **MISSING** from the Supabase metadata list, Device B assumes it was deleted on another device.
    - **Action:** Device B recursively deletes that Space/Thought/Stack from its local IndexedDB to match the cloud state.

#### 2. Last-Write-Wins (LWW) Conflict Resolution
- **Goal:** Deterministically resolve conflicts when two devices edit the same item offline.
- **Logic:**
    - Comparison: `if (cloud.updatedAt > local.updatedAt)`
    - **Action (Cloud is Newer):** Device B downloads the full object from Supabase and updates its local IndexedDB.
    - **Action (Local is Newer):** Device B pushes its local version to Supabase (marking it `syncStatus = 'synced'` after success).
    - **Note:** This ensures that the version with the most recent `Date.now()` timestamp always becomes the global source of truth.

#### 3. Initial "Hydration" (Fresh Login)
- **Goal:** Efficiently populate a new device.
- **Logic:**
    - On login, if the local database is empty:
    - Fetch the full Metadata List from Supabase.
    - Download all entities in batches (to respect egress/performance) and save them locally.
    - Set `lastSyncTime = Date.now()` once complete.

---
*This logic ensures that even if a user switches between a laptop and mobile, their workspace remains perfectly mirrored with minimal bandwidth usage.*

###  Phase 0: ID Stabilization (ULIDs)

#### 1. Why ULIDs?
- **Universal Uniqueness:** Prevents ID collisions when multiple devices (Phone/Laptop) create thoughts offline.
- **Lexicographical Sorting:** ULIDs are sortable by time, maintaining the natural order of thoughts without extra overhead.
- **Sync Reliability:** Eliminates the "Integer ID" conflict in Supabase and Dexie.

#### 2. Implementation Steps
- **Schema Update (`src/db.ts`):** 
    - Change `Thought.id` from `number` to `string`.
    - Change `LocalBlob.thoughtId` and `PendingBlob.thoughtId` from `number` to `string`.
- **Dexie Store Config:** Remove `++id` (auto-increment) for the `thoughts` table; use `id` (primary key string).
- **ID Generation:** Use a ULID library (e.g., `ulid`) to generate IDs on the client-side during `addThought`.

#### 3. Addressing Breaking Changes
- **Data Wipe (Fresh Start):** Since we are opting for a fresh database, we will increment the Dexie version to trigger a clean slate for all users, avoiding legacy data migration complexity.
- **Code Refactor:** 
    - Remove all `parseInt(id, 10)` logic in `supabaseSync.ts`.
    - Update all store slices (`thoughtSlice.ts`, etc.) and components to treat `thoughtId` as a `string`.
    - Update Prop types and selection state (`selectedThoughtId`, `selectedThoughtIds`) to support string IDs.

####  Universal ULID Adoption
- **Scope:** Every entity in the Cyberia ecosystem will move to a string-based ULID as its primary local handle.
    - **Spaces:** Change `id` from `string` (timestamp-based) to `ULID`.
    - **Stacks:** Change `id` from `string` (timestamp-based) to `ULID`.
    - **Thoughts:** Change `id` from `number` to `ULID`.
    - **Blobs/Pending Tables:** Update all foreign key references (e.g., `thoughtId`, `spaceId`) to `string`.
- **User IDs:** Maintain the Google `sub` (string) as the primary user identifier, but ensure all child entities (Spaces/Thoughts/Stacks) use ULIDs for their `id` and reference `user_id`.

####  Updated implementation Strategy:
1. **Global Type Refactor:** Standardize all ID types in `src/db.ts` to `string`.
2. **Remove Incrementors:** Eliminate `++id` from all Dexie store definitions.
3. **Primary Key Consistency:** Ensure `local_id` in Supabase (Postgres) always maps to the local ULID, and the Postgres `id` (UUID) remains the internal cloud primary key.
4. **Relationship Integrity:** Update `spaceId` and `stackId` references in the `Thought` entity to ensure they are always strings.

---
*By stabilizing IDs with ULIDs before implementing Delta Sync, we ensure the foundation of the synchronization engine is collision-proof.*

###  Sync Status Guards (The "Safety First" Rule)

#### 1. Protecting Local-Only Work
- **Rule:** The "Absence = Deletion" logic must **NEVER** delete an item that has `syncStatus: 'local'`, `syncStatus: 'syncing'`, or `syncStatus: 'error'`.
- **Logic:** 
    - If an item exists locally but is missing from the Supabase metadata list:
    - **Check `syncStatus`:** 
        - If `local`, `syncing`, or `error`, it is a new creation or local modification. **DO NOT DELETE**. Instead, push it to the cloud.
        - If `synced`, it was previously on the server but is now gone. **DELETE LOCALLY** (it was deleted on another device).

#### 2. Soft-Delete Reconciliation
- **Rule:** Local soft-deletes (`deletedAt` is set) take precedence over cloud existence.
- **Logic:**
    - If an item exists in the Supabase metadata list but has `deletedAt` set locally:
    - **Action:** Send a `DELETE` request to Supabase. Once the server confirms, permanently remove the item from the local IndexedDB.

###  Updated File Sync Logic
- **Goal:** Ensure binary assets are uploaded correctly regardless of metadata sync status.
- **Rule:** For `type === 'file'` thoughts, the need for upload is determined by the presence of a local blob **AND** the absence of `storagePath`, regardless of the `syncStatus` (as long as it is not `synced`).
- **Action:** If `blob` exists but `storagePath` is missing, trigger upload to Supabase Storage before/during the next sync cycle.

###  Lazy Loading & Hydration (Egress Optimization)

#### 1. Metadata-First Hydration (Fresh Login)
- **Goal:** Get the user into their workspace instantly without downloading gigabytes of data.
- **Logic:**
    - On fresh login, the app first downloads **ONLY** the metadata for all Spaces and Stacks (IDs, Names, Order).
    - Thoughts are **NOT** downloaded yet.

#### 2. On-Demand Space "Waking"
- **Goal:** Only pay the egress cost for data the user is actually looking at.
- **Logic:**
    - When a user clicks to open a Space:
    - **Check Local Cache:** If the Space has no local thoughts (or if `lastSyncTime` is old):
    - **Action:** Fetch all Thoughts and Stacks for **ONLY that specific `spaceId`**.
    - **Background Sync:** Continue to sync other spaces in the background only when the app is idle.

#### 3. Efficient Batching
- **Logic:** All cloud-to-local downloads should be performed in batches (e.g., 50 thoughts at a time) to prevent UI jank and allow the user to cancel/pause if they lose connection.

---
*This multi-layered approach ensures that local work is never lost, and cloud data is only downloaded when it is strictly necessary for the user's current view.*

###  Phase 4: Synchronized Tombstones & Garbage Collection

#### 1. The "Ack" Based Deletion Workflow
- **Goal:** Eliminate orphaned cloud files and redundant "media sweep" loops.
- **Logic:**
    - **Step 1 (Local):** Mark entity with `deletedAt: timestamp` and `syncStatus: 'local'`.
    - **Step 2 (Sync):** Sync engine identifies the tombstone and executes the Cloud DELETE (Database + Storage).
    - **Step 3 (Ack):** Once Supabase returns success, the item is **permanently deleted** from the local IndexedDB.
- **Why?** This ensures binary assets (blobs) are only deleted locally AFTER they have been successfully purged from the cloud, preventing sync-drift.

#### 2. Removing Redundant Infrastructure
- **Action:** Officially deprecate and remove the `pendingDeletions` table from `src/db.ts` (Phase 0).
- **Action:** Replace the aggressive `mediaSweep` with a **30-day Local Purge** that only runs on app initialization to clear expired soft-deleted items that may have failed to sync.

#### 3. Professional Binary Handling
- **Rule:** Never delete a local blob if its parent Thought still exists (even if `deletedAt` is set) until the Cloud Deletion is confirmed.
- **Safety:** If a Thought is `synced` but its local blob is missing, the system should treat this as a "Cache Miss" and re-download the blob rather than deleting the metadata.

---
*This model provides a clean, event-driven lifecycle for all data, ensuring that "Delete" means "Delete Everywhere" without expensive background scanning.*

###  Infrastructure Cleanup & Deprecation Checklist

#### 1. Redundant Database Tables (To be removed in Phase 0)
- **`pendingDeletions`**: Removed. Replaced by the `deletedAt` + `syncStatus` tombstone pattern.
- **`pendingBlobs`**: Removed. Media upload necessity is now derived directly from the `Thought` state (`type === 'file' && !storagePath`).

#### 2. Deprecated Functions & Logic
- **`mediaSweep` (Aggressive Version):** To be replaced by the **30-day Local Purge** and event-driven file deletion.
- **`handlePostAuthSync`:** The existing brute-force sync will be replaced by the **Metadata-First Hydration** logic.
- **`repairEmptyFileThoughts`:** This recovery logic is deprecated by the new "Healing Rule" (re-downloading missing blobs for synced thoughts).
- **`parseInt(id, 10)`:** All occurrences will be purged as IDs transition to ULID strings.
- **`++id` Auto-incrementors:** All Dexie stores will be converted to use explicit ULID primary keys.

#### 3. Sync Logic Consolidation
- **Debounce Timer:** Standardize on a single `SYNC_DEBOUNCE_MS = 10000` (10 seconds) across all store slices.
- **Sync Status:** Standardize on the 4-state machine (`local`, `syncing`, `synced`, `error`).

---
*By pruning these legacy systems, the codebase will become more maintainable and the synchronization process significantly more predictable.*

###  Phase 0.5: Cloud Schema & Type Harmonization

#### 1. Supabase Schema Migration (CRITICAL)
- **Goal:** Update the Postgres database to support ULID strings.
- **Action:** 
    - Modify `supabase/schema.sql`.
    - Execute SQL: `ALTER TABLE thoughts ALTER COLUMN local_id TYPE TEXT;`
    - Ensure `stacks.local_id` and `spaces.local_id` are already `TEXT` (if not, migrate them too).
    - Ensure all tables have an `updated_at` column with `TIMESTAMPTZ` or `BIGINT` (to match the client's `Date.now()`).

#### 2. Frontend Type Harmonization
- **Goal:** Purge the `number` ID assumption from the entire React/Zustand stack.
- **Action:** 
    - Update `src/store/types.ts`: Change `selectedThoughtId`, `selectedThoughtIds`, `deletingThoughtIds`, and `activeDownloads` from `number` to `string`.
    - Update `src/utils/contextBuilder.ts` and other utility functions to accept `string[]` for IDs.
    - Update component Props (e.g., `ThoughtNode`, `ThoughtFooter`) to expect `id: string`.

#### 3. New Dependencies
- **Action:** Add the `ulid` package to `package.json` to handle time-sortable ID generation on the client.

#### 4. The "Data Wipe" Dexie Version
- **Action:** Increment `db.version(16)` in `src/db.ts`. This will automatically wipe the local database for all users, providing a clean slate for the ULID-based schema and preventing type-mismatch crashes.

---
*These steps are mandatory to prevent the application from crashing when it attempts to sync string ULIDs into the existing integer-based columns.*

####  ID Unification (Removing the Mapping Layer)
- **Goal:** Eliminate the need for `local_id` by using ULIDs as the primary key in both Dexie and Supabase.
- **Action (Supabase Migration):**
    - Change `id` column type from `UUID` to `TEXT` in all tables (`spaces`, `stacks`, `thoughts`).
    - Remove the `DEFAULT gen_random_uuid()` constraint.
    - Remove the `local_id` column from all tables.
    - Update all foreign key columns (`space_id`, `stack_id`) to `TEXT`.
- **Action (Frontend):**
    - Remove all mapping logic that looks up cloud UUIDs via `local_id`.
    - Ensure every API request sends the ULID in the `id` field.
- **Benefit:** This simplifies the Sync Engine by 50% and removes the most common cause of "ghost data" or failed relationships during sync.

---
*By unifying the ID system, we treat the local device and the cloud as a single, synchronized data space.*

###  Technical Risks & Missed Considerations (Audit Findings)

#### 1. Cascading Type Breakages (Global)
- **Problem:** IDs are currently typed as `number` or `number[]` in almost every file (`src/store/types.ts`, `src/utils/contextBuilder.ts`, etc.).
- **Action:** Perform a global search-and-replace for `number` -> `string` in the following specific state properties:
    - `selectedThoughtId`, `selectedThoughtIds`, `activeFocusId`, `linkingSourceId`, `deletingThoughtIds`, `activeDownloads`, `lightboxThoughtId`.
- **Refactor:** Update `addThought` to return `Promise<string>` and ensure all callers (Oracle, ActionFAB) are updated.

#### 2. Hardcoded Numeric Logic (Cleanup)
- **Location:** `src/store/slices/dataSlice.ts` (`loadOnboardingData`, `completeOnboarding`).
- **Action:** Replace hardcoded numeric IDs (e.g., `1001`, `10001`) and `String(Date.now())` with `ulid()`.
- **Location:** `src/utils/migrations.ts` (`migrateLegacyIds`).
- **Action:** This utility is **deprecated**. It specifically converts IDs into numeric strings, which conflicts with our ULID goal. It must be removed or rewritten for the ULID-only ecosystem.

#### 3. Sync Service Vulnerabilities (`supabaseSync.ts`)
- **Explicit Breakage:** Remove all `parseInt(id, 10)` logic in `updateThought`, `deleteThought`, and `deleteThoughts`.
- **Tombstone Sync:** The `toSnakeCase` helper currently **skips** `deletedAt`. This must be changed to **allow** `deletedAt` so that the deletion tombstone actually reaches Supabase.

#### 4. Potential Race Conditions & Infinite Loops
- **The "Media Upload Ping":** `downloadSingleBlob` currently calls `updateThought` to notify the UI.
    - **Risk:** This bumps `updatedAt`, which could trigger a new `deltaSync`, causing an infinite loop.
    - **Fix:** Ensure "UI-only" updates use a `skipSync` flag that also **prevents** bumping the `updatedAt` timestamp.
- **Concurrent Edits during Upload:** `deltaSync` is a long-running process.
    - **Risk:** If a user edits a thought while its media is uploading, the final `db.thoughts.update` call at the end of the upload could overwrite the user's recent changes.
    - **Fix:** Use atomic updates or only update the specific `storagePath` and `syncStatus` fields, preserving the `data` and `updatedAt` set by the user.

#### 5. Soft-Delete Consistency
- **Location:** `src/store/slices/stackSlice.ts` (`deleteStack`).
- **Action:** This currently uses `db.stacks.delete(id)`. It must be changed to an update with `deletedAt: Date.now()` and `syncStatus: 'local'` to support the "Absence = Deletion" sync logic.

---
*Addressing these risks during Phase 0 will prevent silent failures and ensure the synchronization engine remains atomic and reliable.*

###  Phase 5: UI/UX & Robust Loading States

#### 1. "Waking Space" Loading States
- **Goal:** Provide visual feedback during on-demand hydration.
- **Action:** 
    - Implement a glassmorphism skeleton loader or "Dimension Loading" overlay when `isSpaceLoading` is true.
    - Trigger this state whenever a "sleeping" space is opened and thoughts are being fetched from Supabase.

#### 2. Race Condition Protection (`setActiveSpace`)
- **Goal:** Prevent data from "Space A" appearing in "Space B" during rapid switching.
- **Logic:** 
    - Implement a `lastSpaceRequestId` (timestamp) in the `spaceSlice`.
    - Before updating the Zustand state with downloaded thoughts, verify that the `spaceId` of the result still matches the currently `activeSpaceId`. If not, discard the result.

#### 3. Optimistic UI & Sync Indicators
- **Goal:** Maintain the "Instant" feel of Cyberia while ensuring data safety.
- **Action:** 
    - Perform all CRUD operations locally in Dexie immediately (Optimistic UI).
    - Add a subtle "Cloud" icon or pulse effect to the Thought nodes or the Workspace header that shows the 4-state status:
        - **Pulse:** `syncing`
        - **Static:** `synced`
        - **Dot:** `local` (waiting for 10s debounce)
        - **Red Alert:** `error`

#### 4. Initialization Blocking
- **Goal:** Prevent user interaction during the Phase 0 (ULID migration/DB wipe).
- **Action:** Use the `isInitializing` flag in `dataSlice` to show a "Recalibrating Dimension" screen while the Dexie version bump and fresh database setup are in progress.

---
*These UX improvements ensure that the technical shift to Delta Sync feels seamless and polished to the end-user.*

###  Phase 6: Robust Undo/Redo Synchronization

#### 1. Preventing "Sync Stalling" after History Actions
- **Goal:** Ensure data restored via Undo/Redo is always recognized by the Sync Engine as a new change.
- **Problem:** Snapshot-based history systems can revert `updatedAt` to an older timestamp. If `revertedUpdatedAt < lastSyncTime`, the Sync Engine will ignore the change, leaving the cloud out of sync with the local state.
- **Action:**
    - Update the history restoration logic in `src/store/slices/historySlice.ts` (and related slices).
    - **Force Mutation:** Every record restored from a history snapshot MUST be immediately updated in Dexie with:
        - `updatedAt: Date.now()`
        - `syncStatus: 'local'`
- **Benefit:** This treats "Time Travel" (Undo/Redo) as a first-class mutation, ensuring that the cloud always converges to the user's latest local view of the workspace.

#### 2. Undo/Redo vs. Soft Deletes
- **Problem:** Currently, `historySlice.ts` uses `db.delete()` to wipe the current state before restoring a snapshot. This "Hard Delete" will prevent the removal of new thoughts from being synced to the cloud.
- **Action:**
    - Modify `undo` and `redo` in `src/store/slices/historySlice.ts`.
    - Instead of `db.delete()`, any item that exists in the current state but is MISSING from the snapshot being restored must be marked as `deletedAt: Date.now()` and `syncStatus: 'local'`.
    - Any item being restored from the snapshot must have its `updatedAt` set to `Date.now()` and `syncStatus` set to `'local'`.
- **Benefit:** This ensures that "Undoing" an addition correctly deletes the item from the cloud, and "Undoing" an edit correctly reverts the data in the cloud.

---
*This refinement ensures that the history system and the synchronization engine work in perfect harmony, preventing "ghost" items from persisting in the cloud after an Undo.*

---

##  Implementation TODO List

###  Phase 0: ID Stabilization (ULIDs)
- [x] Add `ulid` dependency to `package.json`.
- [x] Update `src/db.ts`: Change `Thought.id` from `number` to `string`.
- [x] Update `src/db.ts`: Change `LocalBlob.thoughtId` and `PendingBlob.thoughtId` to `string`.
- [x] Update `src/db.ts`: Remove `++id` auto-incrementor for thoughts.
- [x] Update `src/db.ts`: Increment Dexie version to `16` for a fresh DB wipe.
- [x] Remove `pendingDeletions` and `pendingBlobs` tables from `src/db.ts`.

###  Phase 0.5: Cloud Schema & Type Harmonization
- [x] **Supabase:** Migrate `thoughts.local_id` to `TEXT` (or rename/unify as planned).
- [x] **Supabase:** Remove `local_id` columns and use `id` (TEXT) as PK for `spaces`, `stacks`, `thoughts`.
- [x] **Supabase:** Update all foreign keys (`space_id`, `stack_id`) to `TEXT`.
- [x] **Supabase:** Ensure all tables have `updated_at` columns.
- [x] **Store Types:** Update `CyberiaState` and `AuthState` in `src/store/types.ts` (Global `number` -> `string` for IDs).
- [x] **Refactor:** Remove all `parseInt(id, 10)` logic from `supabaseSync.ts`.
- [x] **Refactor:** Update `addThought`, `updateThought`, `deleteThought` etc. to handle string IDs.
- [x] **Refactor:** Remove deprecated `migrateLegacyIds` from `src/utils/migrations.ts`.

###  Phase 1: Local Mutation Tracking
- [x] Update `thoughtSlice.ts`: Ensure every create/update/delete sets `updatedAt: Date.now()` and `syncStatus: 'local'`.
- [x] Update `spaceSlice.ts`: Ensure every create/update/delete sets `updatedAt: Date.now()` and `syncStatus: 'local'`.
- [x] Update `stackSlice.ts`: Add `updatedAt` field and ensure all mutations track it.
- [x] **Auto-Migration:** Add logic to `initAuth` to assign missing `updatedAt` to existing records (if any survive the wipe).

###  Phase 2: Supabase & API Optimization
- [x] Update `supabaseSync.ts`: Add `columns` parameter to fetchers for selective metadata retrieval.
- [x] Update `supabaseSync.ts`: Remove `.select()` or use `.select('id')` on all write operations to eliminate double egress.
- [x] Update `toSnakeCase` in `supabaseSync.ts` to allow `deleted_at` synchronization.

###  Phase 3: Delta Sync Orchestration
- [x] Implement `SYNC_DEBOUNCE_MS = 10000` (10s) globally.
- [x] Refactor `deltaSync`: Implement Metadata-first comparison.
- [x] Implement "Absence = Deletion" rule (restricted to `synced` items).
- [x] Implement `lastSyncTime` persistence in `localStorage` and `users` table.
- [x] Implement batching for cloud-to-local downloads.

###  Phase 4: Synchronized Tombstones & Safe GC
- [x] Implement "Ack-based" deletion (Local purge ONLY after cloud confirmation).
- [x] Implement "Healing" rule: Re-download missing blobs for `synced` thoughts.
- [x] Implement 30-day TTL local purge for soft-deleted items on app init.

###  Phase 5: UI/UX & Robust Loading States
- [x] Implement "Dimension Loading" overlay for waking spaces.
- [x] Implement `lastSpaceRequestId` logic in `setActiveSpace` to prevent switching race conditions.
- [x] Add visual sync status indicators (Pulse/Dot/Alert) to Thoughts/Header.
- [x] Use `isInitializing` to block UI during migration/setup.

###  Phase 6: Robust Undo/Redo Synchronization
- [x] Update `historySlice.ts`: Ensure restored items set fresh `updatedAt` and `syncStatus: 'local'`.
- [x] Update `historySlice.ts`: Implement soft-delete reconciliation during Undo/Redo instead of `db.delete()`.

---
*This list will be tracked sequentially to ensure a stable and egress-efficient transition.*
