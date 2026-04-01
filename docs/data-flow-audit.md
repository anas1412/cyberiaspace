# Data Flow Architecture - Detailed Audit

## Overview

The app uses a Three-Layer Architecture:
1. **Zustand** - Source of Truth for UI (in-memory)
2. **IndexedDB** - Local persistence (write-behind cache)
3. **Supabase** - Cloud backup (source of truth for sync)

---

## 1. LOCAL SAVE FLOW (User Action → Cloud)

### 1.1 Simple Text/Metadata Changes

```
User types/edits → Zustand (instant) → IndexedDB (debounced 500ms) → Cloud (debounced 2.5s)
```

**Step 1: Zustand (Immediate)**
```typescript
// thoughtSlice.ts - updateThought()
set({
  thoughts: thoughts.map(t => 
    t.id === id ? { ...t, ...updates, updatedAt: Date.now(), syncStatus: 'local' } : t
  )
});
```

**Step 2: IndexedDB (Debounced 500ms)**
```typescript
// thoughtSlice.ts - updateThought()
if (!syncOrchestrator.isEditing(id)) {
  saveTimers[id] = setTimeout(async () => {
    const thought = get().thoughts.find(t => t.id === id);
    await db.thoughts.put(thought);  // Write to IndexedDB
  }, 500);
}
```

**Step 3: Cloud (Debounced 2.5s)**
```typescript
// syncOrchestrator.ts - triggerSync()
outgoingSyncDebounceTimer = setTimeout(async () => {
  await syncOrchestrator.deltaSync(false);
}, 2500);
```

---

### 1.2 File/Blob Uploads

```
User selects file → IndexedDB (blob) → Zustand (metadata) → Cloud upload → syncStatus update
```

**Step 1: Store Blob in IndexedDB (Direct - NO Zustand)**
```typescript
// FileFocusEditor.tsx - handleFileSelect()
await db.blobs.put({
  id: thought.id,
  thoughtId: thought.id,
  blob: file,
  name: file.name,
  type: file.type,
  userId: user.id
});
```

**Step 2: Update Metadata in Zustand**
```typescript
await updateThought(thought.id, { 
  text: file.name,
  type: 'file',
  data: { url: thumbnail, name: file.name, size: file.size }
});
```

**Step 3: Upload to Cloud (Background)**
```typescript
// storageSlice.ts - uploadThoughtBlob()
// Set syncing status
store.patchThought(thoughtId, { syncStatus: 'syncing' });

// Upload to Supabase
const result = await supabaseStorage.uploadFile(user.id, blobEntry.blob, blobEntry.name, thoughtId);

// Update with cloud URLs
await db.thoughts.update(thoughtId, { 
  storageUrl: result.url, 
  storagePath: result.path 
});
store.patchThought(thoughtId, { storageUrl: result.url, storagePath: result.path });

// Trigger immediate sync
syncOrchestrator.triggerSync(true);
```

**Key Point:** Blobs stay in IndexedDB ONLY, never in Zustand (too large for memory)

---

### 1.3 Stack/Link Operations

```
User links thoughts → Zustand (immediate) → IndexedDB (immediate) → Cloud (debounced)
```

```typescript
// thoughtSlice.ts - linkSelectedThoughts()

// 1. Zustand FIRST
set({
  thoughts: thoughts.map(t => 
    idsToLink.includes(t.id) ? { ...t, stackId: targetStackId, syncStatus: 'local' } : t
  ),
  stacks: newStack ? [...stacks, newStack] : stacks
});

// 2. IndexedDB SECOND
await db.transaction('rw', [db.thoughts, db.stacks], async () => {
  if (newStack) await db.stacks.add(newStack);
  await db.thoughts.where('id').anyOf(idsToLink).modify({ stackId: targetStackId });
});

// 3. Cloud (via triggerSync in addThought/updateThought)
```

---

## 2. LOAD FLOW (App Start / Refresh)

```
IndexedDB → Zustand → UI
```

**Step 1: Hydrate from IndexedDB**
```typescript
// dataSlice.ts - init()
const localThoughts = await db.thoughts.filter(t => !t.deletedAt).toArray();
const localSpaces = await db.spaces.filter(s => !s.deletedAt).toArray();
const localStacks = await db.stacks.filter(s => !s.deletedAt).toArray();

set({ thoughts: localThoughts, spaces: localSpaces, stacks: localStacks });
```

**Step 2: Sync with Cloud (if authenticated)**
```typescript
// If first sync or needs reconciliation
await syncOrchestrator.deltaSync(true);
```

---

## 3. CLOUD DOWNLOAD FLOW (Cloud → Local)

```
Cloud fetch → IndexedDB → Zustand → UI
```

**Via Realtime (instant)**
```typescript
// syncOrchestrator.ts - handleRemoteChange()
const [cloudSpaces, cloudStacks, cloudThoughts] = await Promise.all([
  supabaseSync.getSpaces(userId),
  supabaseSync.getStacks(userId),
  supabaseSync.getThoughts(userId)
]);

// Merge to IndexedDB
await db.thoughts.put({ ...incoming, syncStatus: 'synced' });

// Update Zustand
await store.refreshThoughts();
```

**File Blobs (on-demand)**
```typescript
// storageSlice.ts - downloadSingleBlob()
const res = await fetch(thought.storageUrl);
const blob = await res.blob();

await db.blobs.put({
  id: thoughtId,
  thoughtId: thoughtId,
  blob: blob,
  name: thought.text || 'asset',
  type: blob.type,
  userId: currentUserId
});
```

---

## 4. EDITING REGISTRY (Sync Protection)

Purpose: Prevent sync from overwriting edits in progress

### Registration
```typescript
// Focus editors - on mount
syncOrchestrator.setFocusEditing(true, thought.id);

// MultiSelectionMenu - on selection change
selectedThoughtIds.forEach(id => syncOrchestrator.startEditing(id));
```

### Protection in deltaSync
```typescript
// Skip thoughts being edited when pushing to cloud
const thoughtsToPush = localThoughts.filter(t => 
  !t.deletedAt && 
  !syncOrchestrator.isEditing(t.id)
);

// Skip deletion of editing thoughts
if (syncOrchestrator.isEditing(t.id)) {
  continue; // Don't delete
}
```

### Flush on Close
```typescript
// syncOrchestrator.ts - setFocusEditing(false)
if (!editing && thoughtId) {
  editingThoughtIds.delete(thoughtId);
  this.flushThought(thoughtId);  // Persist to IndexedDB
}
```

---

## 5. KEY FUNCTIONS &Their ROLES

| Function | Layer | Purpose |
|----------|-------|---------|
| `updateThought()` | Zustand → IndexedDB | Save metadata changes |
| `patchThought()` | Zustand only | Immediate UI update without debounce |
| `db.blobs.put()` | IndexedDB only | Store file blobs |
| `uploadThoughtBlob()` | IndexedDB → Cloud | Upload blob to Supabase |
| `downloadSingleBlob()` | Cloud → IndexedDB | Download blob on-demand |
| `triggerSync()` | Zustand → Cloud | Push local changes |
| `deltaSync()` | Cloud ↔ Local | Full reconciliation |
| `refreshThoughts()` | IndexedDB → Zustand | Reload from IndexedDB |
| `flushThought()` | Zustand → IndexedDB | Persist editing changes |
| `setFocusEditing()` | Registry | Register/unregister editing |

---

## 6. SYNC STATUS MEANINGS

| Status | Meaning |
|--------|---------|
| `local` | Created/modified locally, not yet synced to cloud |
| `syncing` | File upload in progress (prevents flush from overwriting) |
| `synced` | Successfully synced to cloud |
| `error` | Sync failed (will retry) |

---

## 7. IMPORTANT ARCHITECTURE RULES

### ✅ CORRECT PATTERNS

1. **Blobs stay out of Zustand**
   ```typescript
   // CORRECT - Direct to IndexedDB
   await db.blobs.put({ blob, thoughtId, ... });
   
   // WRONG - Don't put blobs in Zustand (memory issues)
   updateThought({ blob }); // ❌
   ```

2. **Zustand FIRST, then IndexedDB**
   ```typescript
   // CORRECT
   set({ thoughts: updated });      // 1. Zustand
   await db.thoughts.put(updated);   // 2. IndexedDB
   
   // WRONG
   await db.thoughts.put(updated); // 1. IndexedDB
   set({ thoughts: updated });      // 2. Zustand - ❌
   ```

3. **flushThought does NOT trigger sync**
   ```typescript
   // CORRECT - Just persist
   await db.thoughts.put(thought);
   
   // WRONG - Causes race conditions
   await db.thoughts.put(thought);
   await triggerSync(); // ❌
   ```

4. **Editing registry skips sync, not persistence**
   ```typescript
   // deltaSync skips editing thoughts
   const thoughtsToPush = thoughts.filter(t => !isEditing(t.id));
   
   // BUT flushThought still persists them to IndexedDB
   ```

### ❌ ANTI-PATTERNS TO AVOID

1. Direct `useStore.setState()` - Use slice functions
2. Direct `db.thoughts.put()` before Zustand update
3. `flushThought` triggering sync
4. Storing blobs in Zustand
5. Reading from IndexedDB for UI state (use Zustand)

---

## 8. TIMING SUMMARY

| Action | Zustand | IndexedDB | Cloud |
|--------|---------|-----------|-------|
| Type text | Immediate (debounced 500ms) | After 500ms | After 2.5s |
| Upload file | After upload | Immediate | After upload completes |
| Delete thought | Immediate | Immediate | After 2.5s |
| Close focus editor | N/A | Immediate (flushThought) | After 2.5s |
| Cloud change | N/A | Before sync | N/A |

---

## 9. CURRENT ISSUES & NOTES

1. **flushThought race condition** - Fixed by not triggering sync in flush
2. **Blob userId mismatch** - Fixed by using consistent userId from authStore
3. **Deleted thought flush** - Fixed by checking if thought exists before flushing
4. **Editing registry prevents sync overwrites** but NOT local persistence