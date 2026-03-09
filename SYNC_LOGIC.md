#  Cyberia Synchronization Engine: Core Logic & Edge Cases

This document serves as the technical specification for the Cyberia synchronization engine. It defines how data flows between the local IndexedDB (Dexie) and the cloud (Supabase) using ULIDs, `updatedAt` timestamps, and an incremental Delta Sync model.

---

##  Core Principles

1. **ULIDs (Universally Unique Lexicographically Sortable Identifier):**
   - All entities (`Space`, `Thought`, `Stack`) use a 26-character string ULID.
   - Generated on the client-side at creation.
   - Collision-proof across multiple offline devices.
   - Naturally sortable by time.

2. **Last-Write-Wins (LWW) via `updatedAt`:**
   - Every mutation (even `deletedAt`) updates a Unix timestamp (`updatedAt`).
   - Comparison: `if (cloud.updatedAt > local.updatedAt)` download; else push.

3. **Incremental Delta Sync:**
   - The engine fetches a **Metadata List** (IDs + `updatedAt`) from Supabase.
   - It only downloads/uploads the specific records that have changed.

4. **10s Debounce:**
   - `SYNC_DEBOUNCE_MS = 10000`.
   - Any local mutation resets the timer to prevent API hammering.

---

##  Entity States (`syncStatus`)

- `local`: New or modified item. Needs to be pushed to Supabase.
- `syncing`: In-flight API request. Protected from concurrent sync attempts.
- `synced`: Matches the cloud exactly. Subject to the "Absence = Deletion" rule.
- `error`: Failed sync/upload. Retried during the next sync cycle.

---

##  Case 1: Creation & Update Flow (Mutation Lifecycle)

### 1.1 New Local Entity Creation
- **Happy Path:**
    1. User creates a Thought/Space.
    2. ULID is generated; `updatedAt` = `Date.now()`; `syncStatus` = `local`.
    3. 10s debounce finishes → `fullPushSync` triggers.
    4. Supabase `upsert` succeeds.
    5. Local `syncStatus` = `synced`.
- **Edge Case: App Close during Debounce**
    - **Logic:** On next boot, `initAuth` finds items with `syncStatus: 'local'` and triggers a sync.

### 1.2 Local Update to Synced Entity
- **Happy Path:**
    1. User moves a Thought ($x, y$).
    2. `updatedAt` = `Date.now()`; `syncStatus` = `local`.
    3. Debounce triggers → `fullPushSync` sends the delta.
    4. Local `syncStatus` = `synced`.
- **Edge Case: Network Drop during Push**
    - **Logic:** `syncStatus` remains `local` (or transitions to `error`). The record is re-pushed during the next successful sync cycle.

### 1.3 High-Frequency Local Mutations
- **Happy Path:**
    1. User drags a Thought for 5 seconds.
    2. Debounce resets with every movement.
    3. Sync only fires 10s after the *last* movement.
- **Edge Case: Concurrent Property Changes**
    - **Logic:** The sync payload merges all local changes (e.g., text, position, color) that occurred during the debounce period.

---

##  Case 2: Deletion Lifecycle (Tombstoning & Acks)

### 2.1 Local Initiation (Soft Delete)
- **Happy Path:**
    1. User deletes a Thought.
    2. `deletedAt` = `Date.now()`; `syncStatus` = `local`.
    3. Sync Engine sees the tombstone → calls `supabaseSync.deleteThought`.
    4. Supabase confirms deletion → **Item is permanently purged from local Dexie.**
- **Edge Case: Network Failure during Cloud Deletion**
    - **Logic:** The record remains in Dexie with `deletedAt`. It is retried until Supabase "Ack" (Acknowledgment) is received.

### 2.2 Remote Deletion (Absence Check)
- **Happy Path:**
    1. Device A deletes a Thought; cloud is purged.
    2. Device B fetches Metadata List (IDs).
    3. Device B sees ID `123` is locally `synced` but MISSING from the cloud list.
    4. Device B realizes it was deleted elsewhere → **Device B purges ID `123` locally.**
- **Edge Case: Missing 'Local' Item**
    - **Logic:** If an ID is missing from the cloud but is locally `syncStatus: 'local'`, **DO NOT DELETE**. This is a new item that hasn't synced yet.

### 2.3 The "Resurrection" Conflict
- **Happy Path:** Device A deletes an item; Device B updates the same item while offline.
- **Logic:** 
    - If `B.updatedAt > A.deletedAt`, the item is "resurrected" in the cloud.
    - If `A.deletedAt > B.updatedAt`, Device B accepts the deletion and wipes the item.

---

##  Case 3: Media & Binary Sync (The Blob Shield)

### 3.1 New Media Attachment
- **Happy Path:**
    1. User adds an image.
    2. Blob stored locally in Dexie; `type: file`; `updatedAt` = `Date.now()`.
    3. Metadata syncs first (`syncStatus: local` → `synced`).
    4. Background uploader pushes Blob to `${userId}/${thoughtId}/${fileName}`.
    5. Success: `storagePath` updated in Dexie.
- **Edge Case: Meta Sync Success, Blob Fail**
    - **Logic:** `storagePath` remains empty. On next sync, the engine sees `type: file` + `blob` + `no storagePath` and retries the upload.

### 3.2 Remote Asset "Healing"
- **Happy Path:**
    1. Device B syncs a Thought with `storagePath` but no local Blob.
    2. Background downloader fetches file from Supabase.
    3. Success: Blob stored in local Dexie.
- **Edge Case: Cache Clear**
    - **Logic:** If the user clears browser cache, the "Healing" rule re-downloads all missing blobs for `synced` thoughts.

### 3.3 Orphaned Blob Cleanup (Safe Maintenance)
- **Happy Path:** 
    1. A Thought is permanently deleted (after cloud Ack).
    2. Associated local Blob is purged from Dexie immediately OR after 30 days (TTL).
- **Edge Case: Race during Upload**
    - **Logic:** Media sweep is blocked if `isSyncBlocked === true` or `syncStatus === 'syncing'`.

---

##  Case 4: Initialization & Hydration (Egress Optimization)

### 4.1 Fresh Login (Cold Boot)
- **Happy Path:**
    1. User logs in; local DB is empty.
    2. Engine fetches **ALL** Space/Stack metadata (Names, IDs).
    3. **LAZY LOAD:** Thoughts are NOT downloaded yet.
    4. UI renders the space list instantly.

### 4.2 Space "Waking" (Hydration)
- **Happy Path:**
    1. User clicks a Space.
    2. Engine fetches all Thoughts/Stacks for that `spaceId`.
    3. Space is "woken" and rendered.
- **Edge Case: Rapid Space Switching**
    - **Logic:** Engine cancels pending hydration requests for "sleeping" spaces to save bandwidth.

---

##  Case 5: Space Management & Recursion

### 5.1 Recursive Space Deletion
- **Happy Path:**
    1. User deletes a Space.
    2. Local engine marks Space + all child Thoughts/Stacks as `deletedAt`.
    3. `fullPushSync` propagates the mass-tombstone.
    4. Supabase confirms deletion; local IndexedDB is purged.

---

##  Implementation Checklist (The Case-by-Case Todo)

###  Phase 0: Foundations
- [ ] Implement ULID generator for all entities.
- [ ] Change all `id` fields in `src/db.ts` to `string`.
- [ ] Remove `++id` (auto-increment) from all Dexie stores.
- [ ] Increment Dexie version to force fresh DB start.

###  Phase 1: Tracking & Debounce
- [ ] Update all store slices to set `updatedAt: Date.now()` and `syncStatus: 'local'`.
- [ ] Implement `SYNC_DEBOUNCE_MS = 10000` (10s) in `syncOrchestrator.ts`.
- [ ] Implement `isSyncBlocked` toggle for batch operations.

###  Phase 2: Delta Sync Refactor
- [ ] Update `supabaseSync.ts` to support selective column fetching (`id, local_id, updated_at`).
- [ ] Refactor `fullPushSync` to compare metadata BEFORE downloading/uploading.
- [ ] Implement "Absence = Deletion" rule for `synced` items.
- [ ] Implement Ack-based permanent deletion from local DB.

###  Phase 3: Hydration & Healing
- [ ] Implement Lazy Loading (Metadata-first, Thoughts on-demand).
- [ ] Implement "Healing" rule for missing local blobs.
- [ ] Add 30-day TTL for soft-deleted items during app init.

---
*This logic ensures that Cyberia remains fast, efficient, and collision-free across all user devices.*
