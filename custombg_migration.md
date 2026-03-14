# Custom Background Migration Plan
## From: Base64 Strings in Database → Supabase Storage Files

**Date:** 2026-03-14  
**Status:** Planned  
**Priority:** High  

---

## Overview

Custom backgrounds (`customBg`) are currently stored as Base64-encoded data URL strings directly in the `custom_bg TEXT` column of the `spaces` table in Supabase Postgres, and mirrored in the local IndexedDB `spaces` table.

This migration moves backgrounds to **Supabase Storage** (`user-files` bucket), with `customBg` becoming a **public storage URL** instead of an inline Base64 string. The database column retains its `TEXT` type — it just stores a URL instead of a data blob.

### Why Migrate?

| Problem | Impact |
|---|---|
| A 2MB Base64 image is ~2.7MB of text in the database | Bloats Postgres row size, slows queries |
| Every space sync sends the full Base64 string | Large payloads, slow sync, higher bandwidth cost |
| 100 users × 3 spaces = potentially 800MB+ in Postgres | Scaling cost grows fast |
| Base64 strings cannot be CDN-cached or compressed efficiently | Poor delivery performance |
| Supabase Storage is purpose-built for binary data | CDN delivery, better compression, cheaper |

---

## Storage Protocol

**Bucket:** `user-files` (existing, public)  
**Path:** `${userId}/backgrounds/bg_${spaceId}`  
**File naming:** Always named `bg_${spaceId}` — no extension, no timestamp. This ensures:
- One background file per space, ever.
- Uploading a new background automatically overwrites the old one (upsert).
- Deletion is deterministic: we always know the exact path.

**Example paths:**
```
user_abc123/backgrounds/bg_01HXYZ...ULID
user_abc123/backgrounds/bg_01HABC...ULID
```

---

## Current State Analysis

### What `customBg` is today
- A `string | null` field on the `Space` interface (`src/db.ts:53`)
- Stored as `custom_bg TEXT` in Supabase (`supabase/schema.sql:35`)
- Set via `setCustomBg(bg: string | null)` in `src/store/slices/uiSlice.ts:37`
- Rendered in `BackgroundEngine` as a CSS `backgroundImage` URL (`src/components/background/BackgroundEngine.tsx:46`)
- Uploaded by the user via `SystemTray.tsx` — converted to Base64 via `FileReader.readAsDataURL()`
- Synced as plain text through `toSnakeCase`/`toCamelCase` boundary translation

### What `customBg` will become
- A **public Supabase Storage URL** string (e.g. `https://xxx.supabase.co/storage/v1/object/public/user-files/userId/backgrounds/bg_spaceId`)
- Or `null` if no background is set
- The `BackgroundEngine` requires **zero changes** — it already accepts any URL string
- The database column type stays `TEXT` — no schema migration needed

---

## Complete Risk Audit

The following 17 code paths were identified as requiring changes or close attention.

### CRITICAL — Will Definitely Create Orphans

#### C1. `syncOrchestrator.deltaSync` — Push Deletions
**File:** `src/services/sync/syncOrchestrator.ts:414-422`

```typescript
// CURRENT (missing cleanup):
for (const space of localSpaces.filter(s => s.deletedAt)) {
  await supabaseSync.deleteSpace(space.id, userId);
  await db.spaces.delete(space.id);
}

// REQUIRED (with cleanup):
for (const space of localSpaces.filter(s => s.deletedAt)) {
  // Delete background file from storage before removing the DB record
  if (space.customBg && space.customBg.startsWith('http')) {
    try {
      await supabaseStorage.deleteSpaceBackground(userId, space.id);
    } catch (e) {
      console.warn('[Sync] Background cleanup failed for space:', space.id, e);
    }
  }
  await supabaseSync.deleteSpace(space.id, userId);
  await db.spaces.delete(space.id);
}
```

**Why CRITICAL:** This is the terminal point of space deletion in the sync cycle. Thoughts explicitly call `supabaseStorage.deleteFile(thought.storagePath)` here (lines 380-388). The exact same pattern is absent for `space.customBg`. Every deleted space with a background will orphan a file here.

---

#### C2. `supabaseSync.deleteSpace` — Cloud Hard Delete
**File:** `src/services/supabaseSync.ts:254-265`

This function performs a raw Postgres DELETE. It has no awareness of storage files. The fix is **not** here — it should remain a pure DB operation. The cleanup is handled at the orchestrator level (C1 above). Documented here for completeness.

---

### HIGH — Will Frequently Create Orphans

#### H1. `setCustomBg` — Changing or Removing a Background
**File:** `src/store/slices/uiSlice.ts:37-50`

**Trigger:** User uploads a new image, or clicks "Remove Background".

```typescript
// CURRENT (overwrites old value, no cleanup):
setCustomBg: async (bg: string | null) => {
  set({ customBg: bg });
  await db.spaces.update(activeSpaceId, { customBg: bg });
  // triggers sync...
}

// REQUIRED:
setCustomBg: async (bg: string | null) => {
  const { activeSpaceId, spaces } = get();
  if (!activeSpaceId) return;

  // 1. Read the OLD value before overwriting
  const currentSpace = spaces.find(s => s.id === activeSpaceId);
  const oldBg = currentSpace?.customBg;

  // 2. Delete the old storage file if it was a storage URL
  if (oldBg && isStorageUrl(oldBg)) {
    const { useAuthStore } = await import('../useAuthStore');
    const { user } = useAuthStore.getState();
    if (user) {
      try {
        await supabaseStorage.deleteSpaceBackground(user.id, activeSpaceId);
      } catch (e) {
        console.warn('[BG] Failed to delete old background:', e);
      }
    }
  }

  // 3. Set the new value
  set({ customBg: bg });
  await db.spaces.update(activeSpaceId, { customBg: bg });
  await syncOrchestrator.triggerSync();
}
```

**Helper needed:** `isStorageUrl(url: string): boolean` — checks if a string is a Supabase storage URL (not a Base64 data URL, not a local blob URL).

---

#### H2. `deleteSpace` — Single Space Deletion
**File:** `src/store/slices/spaceSlice.ts:132-195`

`deleteSpace` performs a **soft delete** — it sets `deletedAt` but doesn't immediately hit storage. The actual storage cleanup happens later in the sync orchestrator (C1). No direct changes needed here.

However, we must ensure the `space.customBg` value is **preserved** in the tombstone record so the sync orchestrator can read it during cleanup. Currently it is, since we only set `deletedAt` and `syncStatus`.

**Action:** No code change needed. The existing soft-delete correctly preserves `customBg` in the tombstone.

---

#### H3. `replaceCloudSpace` — Replace a Cloud Space
**File:** `src/store/slices/spaceSlice.ts:422-457`

Calls `deleteSpace(targetSpaceIdToReplace)` internally. The background cleanup will flow through the same tombstone → sync orchestrator path (C1). No additional changes needed here, since H2 and C1 cover it.

---

#### H4. `importData` — JSON Backup Restore
**File:** `src/store/slices/dataSlice.ts:358-394`

**Trigger:** User uploads a `.json` backup file.

```typescript
// CURRENT (clears local DB without any cloud cleanup):
await db.transaction('rw', db.spaces, db.thoughts, db.stacks, db.blobs, async () => {
  await db.spaces.clear(); // <-- destroys all customBg references
  // ...
});

// REQUIRED:
// Before clearing, read all spaces with storage-backed backgrounds
// and queue their deletion from cloud storage.
const existingSpaces = await db.spaces.toArray();
const bgPathsToDelete = existingSpaces
  .filter(s => s.customBg && isStorageUrl(s.customBg))
  .map(s => getBackgroundStoragePath(userId, s.id));

// Then proceed with the import as normal
await db.transaction(...);

// After import, delete orphaned background files
// (fire-and-forget, non-blocking)
for (const path of bgPathsToDelete) {
  supabaseStorage.deleteFile(path).catch(e =>
    console.warn('[Import] Background cleanup failed:', path, e)
  );
}
```

**Caveat:** `importData` is a local-only operation. Cloud cleanup only makes sense for authenticated users. Gate the cleanup behind an `authStore.status === 'authenticated'` check.

---

#### H5. `publishSpace` — Publishing a Snapshot
**File:** `src/store/slices/spaceSlice.ts:245-300`

**Current behavior:** Embeds the full `customBg` value inline in the snapshot JSON (line 277). With Base64, this means a ~2.7MB string in the published JSONB blob.

**After migration:** `customBg` will be a public storage URL. The snapshot will automatically become much smaller. The URL will be embedded directly.

**Risk:** If the source space is later deleted, the background file will be cleaned up (via C1), which would break the published snapshot's background display.

**Decision Options:**
- **Option A (Simple):** Accept the breakage. Published spaces are ephemeral by nature.
- **Option B (Safe):** During publish, copy the background file to a publish-safe path (e.g., `userId/published/bg_publishedId`) that is NOT cleaned up during space deletion.

**Recommendation: Option A for now.** Published spaces already expire (30-day TTL). A broken background image is a minor UX issue vs. the complexity of managing a separate copy.

**Action:** No code change needed for the migration itself. The snapshot will just embed the URL.

---

### MEDIUM — Edge Cases That Could Create Orphans

#### M1. `importFullState` — Overwrite Mode
**File:** `src/store/slices/dataSlice.ts:267-310` and `spaceSlice.ts:330-367`

**Trigger:** Post-auth sync on a fresh device (`merge=false`), or `restoreFromCloud`.

When `merge=false`, calls `db.spaces.clear()` before writing cloud data. If local spaces had storage-backed backgrounds that are **not** in the incoming cloud data, those files become orphaned.

**Reality check:** In practice, if the user is logging into a new device with an empty local workspace, they won't have any local background files to lose. The migration risk here is LOW.

**Action:** Add a guard: before `db.spaces.clear()`, check if any local space has a storage-backed `customBg`. If so, and if the user is authenticated, queue those for deletion.

```typescript
// Before the clear() call:
const localSpaces = await db.spaces.toArray();
const orphanBgPaths = localSpaces
  .filter(s => s.customBg && isStorageUrl(s.customBg) && !incomingSpaceIds.has(s.id))
  .map(s => getBackgroundStoragePath(userId, s.id));

// After the put() call, fire-and-forget cleanup:
orphanBgPaths.forEach(path => 
  supabaseStorage.deleteFile(path).catch(() => {})
);
```

---

#### M2. `deleteCloudData` — User-Initiated Cloud Wipe
**File:** `src/store/slices/authSlice.ts:391-424`

**Current behavior:** Resets `storageUrl` and `storagePath` on thoughts (lines 406-410) but does NOT clear `customBg` on spaces. After the cloud wipe, local spaces still reference old (now-deleted) storage URLs. On the next sync, these stale URLs would be pushed to cloud.

**Fix:** Add `customBg: null` to the space modification loop after the cloud wipe.

```typescript
// CURRENT (lines ~406-411):
await db.thoughts.toCollection().modify(t => {
  t.storageUrl = undefined;
  t.storagePath = undefined;
  t.syncStatus = 'local';
});

// ADD THIS:
await db.spaces.toCollection().modify(s => {
  if (s.customBg && isStorageUrl(s.customBg)) {
    s.customBg = null; // Clear stale storage reference
  }
  s.syncStatus = 'local';
});
```

**Note:** `deleteCloudContent` already calls `deleteAllUserFiles(userId)` which blanket-wipes the entire user folder including backgrounds. So the files ARE deleted. The fix here is just to clean up the stale local references so they don't get re-pushed.

---

#### M3. `mergeGuestSpace` — Merging Guest Work
**File:** `src/store/slices/spaceSlice.ts:369-419`

The source space is soft-deleted. Its `customBg` file (if it exists) will be cleaned up via the tombstone → sync orchestrator path (C1). No additional changes needed.

**Caveat:** Guest spaces typically haven't synced yet (`syncStatus: 'local'`), so the background file may not exist in cloud storage. The cleanup will gracefully handle a 404.

---

#### M4. `deltaSync` — Incoming Space Updates (Cloud is Newer)
**File:** `src/services/sync/syncOrchestrator.ts:273-295`

When the cloud has a newer version of a space, the local record is overwritten via `db.spaces.put()`. If the local space had a different `customBg` (a storage URL) and the incoming cloud version has a different one, the old URL is silently overwritten.

**Reality check:** Since `customBg` is stored as a URL in both local and cloud, and LWW (Last-Write-Wins) is applied via `updatedAt`, this should rarely cause orphans. The file at the path `userId/backgrounds/bg_spaceId` is always the canonical background. Even if the URL reference changes, the file at the canonical path is always overwritten by the next upload.

**Action:** No change needed. The canonical path protocol (`bg_${spaceId}`) prevents this scenario because there's always exactly one file per space.

---

### LOW / No Risk

#### L1. `clearWorkspace` — Nuclear Wipe
**File:** `src/store/slices/dataSlice.ts:215-265`

Calls `deleteCloudData` which calls `deleteCloudContent` which calls `supabaseStorage.deleteAllUserFiles(userId)`. The `backgrounds/` folder is under `userId/` so it WILL be wiped. **Safe.**

#### L2. `clearLocalData` — Factory Reset
**File:** `src/store/slices/dataSlice.ts:313-341`

Local-only. Cloud data is intentionally preserved for re-hydration. **Safe by design.**

#### L3. `handlePostAuthSync` — Post-Auth Hydration
**File:** `src/store/slices/syncSlice.ts:81-164`

Only runs on fresh logins against an empty local workspace. **Negligible risk.**

#### L4. `discardGuestSpace`
**File:** `src/store/slices/spaceSlice.ts:460-495`

Guest backgrounds rarely reach cloud storage. Cleanup flows via C1. **Low risk.**

#### L5. `deleteCloudContent` — Cloud Content Wipe
**File:** `src/services/sync/syncOrchestrator.ts:578-597`

Uses `deleteAllUserFiles` as blanket wipe. **Safe.**

---

### INVERTED RISK — Would Delete Valid Files

#### I1. `cleanupOrphanedFiles`
**File:** `src/services/supabaseStorage.ts:225-332`

**Current behavior:** Accepts a `Set<string>` of `validPaths` and deletes everything in the user's storage folder NOT in that set. The `validPaths` set is currently built from thought `storagePath` values only.

**After migration:** Background files stored at `userId/backgrounds/bg_spaceId` would NOT be in the `validPaths` set (because they come from spaces, not thoughts). The function would **actively delete valid, in-use background files** as "orphans."

**Fix:** When building the `validPaths` set (wherever this is called), also include all active space background paths.

```typescript
// When constructing validPaths, include background paths:
const activeSpaces = await db.spaces.filter(s => !s.deletedAt).toArray();
const bgPaths = activeSpaces
  .filter(s => s.customBg && isStorageUrl(s.customBg))
  .map(s => getBackgroundStoragePath(userId, s.id));

bgPaths.forEach(p => validPaths.add(p));
```

**NOTE:** `cleanupOrphanedFiles` is not currently called in any production code path. But this fix must be in place before it ever is.

---

## Implementation Plan

### Phase 0: Utility Helpers

**File:** `src/services/supabaseStorage.ts`

Add two new methods and two utility functions:

```typescript
// Path protocol: always deterministic
const getBackgroundPath = (userId: string, spaceId: string): string =>
  `${userId}/backgrounds/bg_${spaceId}`;

// Detect if a customBg value is a storage URL vs Base64 vs blob URL
export const isStorageUrl = (value: string): boolean =>
  value.startsWith('https://') || value.startsWith('http://');

// Upload or overwrite a space background
async uploadSpaceBackground(
  userId: string,
  spaceId: string,
  file: File | Blob,
  mimeType: string
): Promise<{ url: string; path: string }> {
  const path = getBackgroundPath(userId, spaceId);
  const { error } = await storageClient.storage.from(BUCKET_NAME).upload(path, file, {
    cacheControl: '3600',
    upsert: true, // always overwrite
    contentType: mimeType || 'image/jpeg',
  });
  if (error) throw new Error(`Background upload failed: ${error.message}`);
  const { data } = storageClient.storage.from(BUCKET_NAME).getPublicUrl(path);
  return { url: data.publicUrl, path };
},

// Delete a space background (safe: ignores 404)
async deleteSpaceBackground(userId: string, spaceId: string): Promise<void> {
  const path = getBackgroundPath(userId, spaceId);
  const { error } = await storageClient.storage.from(BUCKET_NAME).remove([path]);
  if (error && !error.message.includes('404') && !error.message.includes('not found')) {
    console.warn('[Storage] Background delete warning:', error.message);
  }
  console.log('[Storage] Background deleted (or did not exist):', path);
},
```

---

### Phase 1: Upload Flow

**File:** `src/components/toolbar/SystemTray.tsx`

Replace the `FileReader.readAsDataURL()` approach with direct `File` object handling.

```typescript
// CURRENT:
const reader = new FileReader();
reader.onload = (ev) => {
  setCustomBg(ev.target?.result as string); // Base64 string
};
reader.readAsDataURL(file);

// NEW:
// Pass the raw File object to setCustomBg
// setCustomBg will handle local preview + upload
await setCustomBg(file); // File object, not Base64
```

**File:** `src/store/slices/uiSlice.ts`

Update `setCustomBg` signature to accept `File | string | null`:

```typescript
setCustomBg: async (bg: File | string | null) => {
  const { activeSpaceId, spaces, isReadOnly } = get();
  if (isReadOnly || !activeSpaceId) return;

  // 1. Clean up the old background file if it was a storage URL
  const currentSpace = spaces.find(s => s.id === activeSpaceId);
  const oldBg = currentSpace?.customBg;
  const { useAuthStore } = await import('../useAuthStore');
  const { user } = useAuthStore.getState();

  if (oldBg && isStorageUrl(oldBg) && user) {
    supabaseStorage.deleteSpaceBackground(user.id, activeSpaceId)
      .catch(e => console.warn('[BG] Old background cleanup failed:', e));
  }

  // 2a. If null, clear the background
  if (bg === null) {
    set({ customBg: null });
    const updatedSpaces = spaces.map(s => s.id === activeSpaceId ? { ...s, customBg: null } : s);
    set({ spaces: updatedSpaces });
    await db.spaces.update(activeSpaceId, { customBg: null, updatedAt: Date.now(), syncStatus: 'local' });
    if (user) await syncOrchestrator.triggerSync();
    return;
  }

  // 2b. If it's already a URL string (e.g. from sync), use it directly
  if (typeof bg === 'string' && isStorageUrl(bg)) {
    set({ customBg: bg });
    const updatedSpaces = spaces.map(s => s.id === activeSpaceId ? { ...s, customBg: bg } : s);
    set({ spaces: updatedSpaces });
    await db.spaces.update(activeSpaceId, { customBg: bg, updatedAt: Date.now(), syncStatus: 'local' });
    if (user) await syncOrchestrator.triggerSync();
    return;
  }

  // 2c. It's a File object — local preview first, then upload
  const file = bg as File;

  // Instant local preview via object URL
  const localPreviewUrl = URL.createObjectURL(file);
  set({ customBg: localPreviewUrl });
  const updatedSpaces = spaces.map(s => s.id === activeSpaceId ? { ...s, customBg: localPreviewUrl } : s);
  set({ spaces: updatedSpaces });

  // If not authenticated, store as Base64 for local-only use
  if (!user) {
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      set({ customBg: base64 });
      await db.spaces.update(activeSpaceId, { customBg: base64, updatedAt: Date.now(), syncStatus: 'local' });
    };
    reader.readAsDataURL(file);
    return;
  }

  // Upload to storage
  try {
    const { url } = await supabaseStorage.uploadSpaceBackground(user.id, activeSpaceId, file, file.type);

    // Revoke the temporary object URL
    URL.revokeObjectURL(localPreviewUrl);

    // Update with the real storage URL
    set({ customBg: url });
    const finalSpaces = get().spaces.map(s => s.id === activeSpaceId ? { ...s, customBg: url } : s);
    set({ spaces: finalSpaces });
    await db.spaces.update(activeSpaceId, { customBg: url, updatedAt: Date.now(), syncStatus: 'local' });
    await syncOrchestrator.triggerSync();
  } catch (e) {
    console.error('[BG] Upload failed, keeping local preview:', e);
    // Store as Base64 fallback if upload fails
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      URL.revokeObjectURL(localPreviewUrl);
      set({ customBg: base64 });
      await db.spaces.update(activeSpaceId, { customBg: base64, updatedAt: Date.now(), syncStatus: 'local' });
    };
    reader.readAsDataURL(file);
  }
},
```

---

### Phase 2: Deletion Cleanup in Sync Orchestrator

**File:** `src/services/sync/syncOrchestrator.ts:414-422`

```typescript
// Push soft-deleted spaces to cloud, then hard-delete
for (const space of localSpaces.filter(s => s.deletedAt)) {
  // ADDED: Clean up background file from storage before DB deletion
  if (space.customBg && isStorageUrl(space.customBg)) {
    try {
      await supabaseStorage.deleteSpaceBackground(userId, space.id);
    } catch (e) {
      // Non-fatal: log and continue. File may not exist (guest space, not yet uploaded)
      console.warn('[Sync] Background cleanup failed for space:', space.id);
    }
  }
  try {
    await supabaseSync.deleteSpace(space.id, userId);
    await db.spaces.delete(space.id);
  } catch (e: any) {
    if (e.status === 404 || e.message?.includes('not found')) await db.spaces.delete(space.id);
    else console.warn('[Sync] Space deletion failed:', e);
  }
}
```

---

### Phase 3: Fix `deleteCloudData` Stale Reference

**File:** `src/store/slices/authSlice.ts`

After calling `deleteCloudContent()`, clear stale `customBg` references on local spaces:

```typescript
// After the existing thought modification:
await db.thoughts.toCollection().modify(t => {
  t.storageUrl = undefined;
  t.storagePath = undefined;
  t.syncStatus = 'local';
});

// ADD: Clear stale background references on spaces
await db.spaces.toCollection().modify(s => {
  if (s.customBg && isStorageUrl(s.customBg)) {
    s.customBg = null;
  }
  s.syncStatus = 'local';
});
```

---

### Phase 4: Fix `importData` Pre-Wipe Cleanup

**File:** `src/store/slices/dataSlice.ts:358-394`

```typescript
importData: async (data: any) => {
  // ...existing validation...

  // ADDED: Before wiping local DB, collect background paths to clean up
  const { useAuthStore } = await import('../useAuthStore');
  const authStore = useAuthStore.getState();
  let bgPathsToClean: string[] = [];

  if (authStore.status === 'authenticated' && authStore.user) {
    const existingSpaces = await db.spaces.filter(s => !s.deletedAt).toArray();
    bgPathsToClean = existingSpaces
      .filter(s => s.customBg && isStorageUrl(s.customBg))
      .map(s => `${authStore.user!.id}/backgrounds/bg_${s.id}`);
  }

  // Existing wipe + import logic...
  await db.transaction('rw', db.spaces, db.thoughts, db.stacks, db.blobs, async () => {
    await db.spaces.clear();
    // ...etc
  });

  // Fire-and-forget cleanup (non-blocking)
  if (bgPathsToClean.length > 0) {
    bgPathsToClean.forEach(path =>
      supabaseStorage.deleteFile(path).catch(e =>
        console.warn('[Import] Background cleanup failed:', path, e)
      )
    );
  }

  // ...rest of importData...
}
```

---

### Phase 5: Guard `cleanupOrphanedFiles`

**File:** `src/services/supabaseStorage.ts:225-332` (and wherever `validPaths` is built)

**Before any call to `cleanupOrphanedFiles`, ensure background paths are included:**

```typescript
// Build validPaths set for orphan cleanup
const validPaths = new Set<string>();

// Include thought storage paths
const thoughts = await db.thoughts.filter(t => !t.deletedAt && t.storagePath).toArray();
thoughts.forEach(t => { if (t.storagePath) validPaths.add(t.storagePath); });

// ADDED: Include space background paths
const spaces = await db.spaces.filter(s => !s.deletedAt).toArray();
spaces.forEach(s => {
  if (s.customBg && isStorageUrl(s.customBg)) {
    validPaths.add(`${userId}/backgrounds/bg_${s.id}`);
  }
});

await supabaseStorage.cleanupOrphanedFiles(userId, validPaths);
```

---

### Phase 6: Seamless Migration for Existing Base64 Backgrounds

Users with existing Base64 backgrounds should be migrated automatically — not forcibly on a schedule, but opportunistically when they interact with the background.

**Trigger:** When the app detects `customBg` is a Base64 string (starts with `data:`), it:
1. Converts the Base64 to a `Blob`
2. Uploads it to storage
3. Replaces the local `customBg` with the new storage URL

**Where to run:** In `setActiveSpace` (`spaceSlice.ts:17-62`), after the space loads, if the user is authenticated:

```typescript
// After setting customBg from the space record:
set({ customBg: space.customBg || null });

// ADDED: Migrate Base64 backgrounds to storage (opportunistic)
if (space.customBg && space.customBg.startsWith('data:') && user) {
  migrateBase64Background(space.id, space.customBg, user.id).catch(console.warn);
}
```

```typescript
// Helper function:
async function migrateBase64Background(spaceId: string, base64: string, userId: string) {
  console.log('[BG] Migrating Base64 background for space:', spaceId);
  // Convert Base64 to Blob
  const response = await fetch(base64);
  const blob = await response.blob();

  // Upload to storage
  const { url } = await supabaseStorage.uploadSpaceBackground(userId, spaceId, blob, blob.type);

  // Update local DB and sync
  await db.spaces.update(spaceId, { customBg: url, updatedAt: Date.now(), syncStatus: 'local' });
  const { useStore } = await import('../store/useStore');
  useStore.setState({ customBg: url });
  await syncOrchestrator.triggerSync();
  console.log('[BG] Migration complete for space:', spaceId);
}
```

---

## Files to Change (Summary)

| File | Change Type | Details |
|---|---|---|
| `src/services/supabaseStorage.ts` | **ADD** | `uploadSpaceBackground()`, `deleteSpaceBackground()`, `isStorageUrl()` helper |
| `src/store/slices/uiSlice.ts` | **MODIFY** | `setCustomBg` — accept `File`, handle upload, cleanup old file |
| `src/components/toolbar/SystemTray.tsx` | **MODIFY** | Pass raw `File` to `setCustomBg` instead of Base64 |
| `src/services/sync/syncOrchestrator.ts` | **MODIFY** | Push deletion loop — add `deleteSpaceBackground` call before `deleteSpace` |
| `src/store/slices/authSlice.ts` | **MODIFY** | `deleteCloudData` — clear stale `customBg` on local spaces after wipe |
| `src/store/slices/dataSlice.ts` | **MODIFY** | `importData` — collect and clean up background paths before wipe |
| `src/store/slices/spaceSlice.ts` | **MODIFY** | `setActiveSpace` — trigger opportunistic Base64 migration |
| `src/store/types.ts` | **MODIFY** | Update `setCustomBg` type signature to `(bg: File \| string \| null) => Promise<void>` |

---

## What Does NOT Need to Change

| Item | Reason |
|---|---|
| `BackgroundEngine.tsx` | Already accepts any URL string |
| `supabase/schema.sql` | `custom_bg TEXT` stays as TEXT — just stores a URL now |
| `toSnakeCase` / `toCamelCase` | `customBg` is not in the skip list, passes through as-is |
| `deleteSpace` soft-delete | Tombstone correctly preserves `customBg` for sync cleanup |
| `clearWorkspace` | `deleteAllUserFiles` already catches the `backgrounds/` folder |
| `BackgroundEngine` GIF performance mode | Works the same with any URL |
| `setActiveSpace` hydration | Already sets `customBg` from the space record |
| `mergeGuestSpace` / `discardGuestSpace` | Flow through sync orchestrator cleanup (C1) |

---

## Edge Cases & Special Handling

### Guest Users (Not Authenticated)
- Cannot upload to Supabase Storage (no `user.id`)
- Fall back to Base64 storage (current behavior)
- If they later sign in, the migration path (Phase 6) handles conversion

### GIF Backgrounds
- GIFs are stored as files, not data URLs, so they work identically to images
- Performance mode extracts a static frame from the URL, which works the same
- No special handling needed

### Offline / Failed Upload
- If the upload fails, fall back to Base64 (graceful degradation)
- The user still sees their background immediately via local object URL
- On reconnect, the next sync will not automatically re-attempt the upload (the fallback Base64 is stored instead)
- The Phase 6 migration would catch this on the next `setActiveSpace` call

### Published Spaces
- After migration, published snapshot JSONB will contain a URL instead of a Base64 string
- The snapshot will be significantly smaller
- If the source space is deleted, the published background URL will 404 (acceptable, TTL-based expiry)
- No special handling needed

### Cross-Device Sync
- Device A sets a background → uploads to `userId/backgrounds/bg_spaceId` → syncs URL to DB
- Device B receives URL via sync → reads from storage CDN → displays instantly
- Both devices always reference the same canonical file path
- No conflicts possible because one canonical path = one file per space

### Read-Only / Shared Spaces
- `isReadOnly` guard already exists in `setCustomBg` — no changes needed
- Shared space viewers render `customBg` from the published snapshot

---

## Testing Checklist

Before marking this migration complete, verify:

- [ ] Upload a new background → appears instantly, URL stored in DB
- [ ] Upload a second background → old file deleted from storage, new file appears
- [ ] Click "Remove Background" → file deleted from storage, `customBg = null` in DB
- [ ] Delete a space with a background → file deleted from storage during sync
- [ ] Delete a space without a background → no storage errors
- [ ] `clearWorkspace` → entire `userId/` folder wiped including `backgrounds/`
- [ ] Export backup (JSON) → `customBg` field contains the storage URL
- [ ] Import backup (JSON) → existing backgrounds cleaned up, new data imported
- [ ] Unauthenticated user sets background → Base64 fallback, no storage errors
- [ ] Base64 background (legacy) → auto-migrated to storage on next `setActiveSpace`
- [ ] `replaceCloudSpace` → replaced space's background deleted from storage
- [ ] `mergeGuestSpace` → source space's background deleted during tombstone cleanup
- [ ] `cleanupOrphanedFiles` → does NOT delete active background files

---

## Non-Goals

- **No changes to the Supabase schema** — `custom_bg TEXT` handles both Base64 strings and URLs transparently
- **No forced migration** — existing users are migrated opportunistically, not in a batch script
- **No changes to the 2MB upload limit** — the limit exists in `SystemTray.tsx` and is enforced before the upload
- **No separate bucket** — backgrounds live in the existing `user-files` bucket under the `backgrounds/` prefix

---

*End of migration plan. Implementation starts at Phase 0 (storage service helpers).*
