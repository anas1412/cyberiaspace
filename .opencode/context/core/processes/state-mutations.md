<!-- Context: core/processes/state-mutations | Priority: high | Version: 1.0 | Updated: 2026-04-03 -->
# State Mutation Patterns

**Purpose**: Decision trees for common state operations.
**Audience**: Developers choosing the right function for the task.

---

## 1. Stack Limit Enforcement

**All stack operations enforce `MAX_THOUGHTS_PER_STACK = 20`.**

### Decision Tree

```
Adding thought(s) to stack?
│
├── Single thought → createStack(name, thoughtId)
│   └── Uses checkStackLimit() internally
│
├── Multiple thoughts → linkSelectedThoughts(name?, ids?)
│   └── Enforces limit for new AND existing stacks
│
├── UI dropdown add → updateThought(id, { stackId })
│   └── Uses checkStackLimit() internally
│
└── Bulk add → updateThoughts(ids[], { stackId })
    └── Uses checkStackLimit() internally
```

### Helper Functions

```typescript
import { checkStackLimit, showStackLimitModal } from './stackSlice';

// Check if operation is allowed
const { allowed, currentCount } = await checkStackLimit(stackId);
if (!allowed) {
  showStackLimitModal(stackName);
  return;
}
```

---

## 2. Choosing Update Functions

### Decision Tree

```
Updating thoughts?
│
├── Single thought → updateThought(id, updates)
│   ├── Debounced (500ms) save to IndexedDB
│   ├── Skips sync if only spatial (x, y, vx, vy)
│   └── Respects editing registry
│
├── Multiple thoughts, same updates → updateThoughts(ids[], updates)
│   ├── Single DB transaction
│   └── Batch sync trigger
│
├── Multiple thoughts, different updates → bulkUpdateThoughts([{id, updates}...])
│   ├── Individual DB writes
│   └── Atomic transaction
│
└── Moving between stacks → linkSelectedThoughts(name?, ids?)
    └── Handles stack creation/merge
```

### When to Push History

**MANDATORY**: Call `get().pushHistory()` after any user-facing mutation to enable undo.

```typescript
// ✅ Required for mutations (user actions that change data)
await db.thoughts.put(thought);
get().pushHistory();  // Enables Ctrl+Z undo

// ❌ Don't push for read-only operations
const thoughts = await db.thoughts.toArray();  // No pushHistory

// ❌ Don't push for auto-save (debounced updates)
updateThought: async (id, updates) => {
  // This is debounced auto-save - pushHistory NOT needed
  set({ thoughts: newThoughts });
  setTimeout(() => db.thoughts.put(...), 500);
}
```

### Which Functions Need pushHistory

| Slice | Function | Need pushHistory? | Why |
|-------|----------|-------------------|-----|
| thoughtSlice | addThought | ✅ Yes | User created content |
| thoughtSlice | deleteThoughts | ✅ Yes | Destructive action |
| thoughtSlice | updateThought | ❌ No | Auto-save (debounced) |
| spaceSlice | addSpace | ✅ Yes | User created space |
| spaceSlice | deleteSpace | ✅ Yes | Destructive action |
| spaceSlice | reorderSpaces | ✅ Yes | Reorderable |
| spaceSlice | updateSpace | ❌ No | Auto-save style |
| dataSlice | clearWorkspace | ✅ Yes | Destructive/wipes data |

**Rule**: If user can "undo" it, push history. If it's automatic (save, refresh), don't.

---

## 3. Stack Operations

### Decision Tree

```
Stack operation?
│
├── Create + add thought → createStack(name, thoughtId)
│   ├── New stack OR add to existing by name
│   └── Respects limit (checkStackLimit)
│
├── Delete stack → deleteStack(id)
│   ├── Unlinks all thoughts (stackId → null)
│   ├── Marks stack as deleted (tombstone)
│   └── Triggers sync
│
├── Update stack → updateStack(id, updates)
│   └── Name, color, etc. No thought changes
│
├── Clean empty stacks → cleanupStacks()
│   └── Auto-runs after unlinks
│   └── Deletes stacks with <2 thoughts
│
└── Link selected → linkSelectedThoughts(name?, ids?)
    ├── Creates new OR uses existing
    ├── Merges multiple stacks into one
    └── Enforces limit
```

---

## 4. Sync Triggers

### API Reference

```typescript
// Normal sync - debounced 2.5s (default for UI changes)
await syncOrchestrator.triggerSync();

// Immediate sync - bypasses debounce (for destructive operations, blobs)
await syncOrchestrator.triggerSync(true);

// After UI updates - wait briefly then sync (for delete operations)
syncOrchestrator.syncSoon();        // 50ms delay (default)
syncOrchestrator.syncSoon(100);     // custom delay
```

### When to Use Each

| Pattern | Use When | Example |
|---------|----------|---------|
| `triggerSync()` | Normal mutations | Creating thoughts, moving nodes |
| `triggerSync(true)` | Destructive/batch ops | Delete, clear, blob uploads |
| `syncSoon()` | After UI updates | Post-delete, post-unlink |

### Code Examples

```typescript
// ✅ Normal mutation - debounced
await syncOrchestrator.triggerSync();

// ✅ Destructive action - immediate
await syncOrchestrator.triggerSync(true);
await db.thoughts.delete(id);

// ✅ After UI update - wait then sync
syncOrchestrator.syncSoon();  // UI updates first, then sync

// ❌ Don't trigger during active editing
if (syncOrchestrator.isEditing(id)) return;

// ❌ Don't trigger for guests
if (authStore.status !== 'authenticated') return;
```

### Debouncing

- **Normal sync**: 2.5s debounce (prevents "save storms")
- **syncSoon()**: 50ms delay (default) for UI updates
- **Remote changes**: 500ms debounce from Realtime
- **Follow-up sync**: 500ms cooldown after deltaSync

---

## 5. Editing Registry

```typescript
// Register when opening editor
syncOrchestrator.startEditing(thoughtId);

// Unregister when closing
syncOrchestrator.stopEditing(thoughtId);

// Check before sync operations
if (syncOrchestrator.isEditing(thoughtId)) {
  // Skip this thought in sync
  return;
}

// Get all editing thoughts
const editing = syncOrchestrator.getEditingThoughts();
```

---

## 📂 Codebase References

- `src/store/slices/stackSlice.ts` - Stack operations, checkStackLimit()
- `src/store/slices/thoughtSlice.ts` - Update functions
- `src/services/sync/syncOrchestrator.ts` - Sync and editing registry
- `src/constants.ts` - MAX_THOUGHTS_PER_STACK value

---

## 6. Data Deletion

### Unified Deletion System

Use the `deleteData(mode)` function in `dataSlice.ts` for all data deletion operations.

```typescript
deleteData(mode: 'all' | 'local' | 'cloud') => Promise<void>
```

| Mode | Scope | Use Case |
|------|-------|----------|
| `'all'` | Local + Cloud | Complete reset |
| `'local'` | Local only | Clear device only |
| `'cloud'` | Cloud only | Clear backup, keep device |

### Decision Tree

```
User wants to delete data?
│
├── Everything (local + cloud) → deleteData('all')
│   └── Creates fresh workspace, deletes old data, wipes cloud
│
├── Local data only → deleteData('local')
│   └── Deletes local IndexedDB data, optionally signs out
│
└── Cloud backup only → deleteData('cloud')
    └── Deletes cloud data only, keeps local
```

### Key Features

1. **User-scoped deletion**: Always filters by `userId`, never uses `db.table.clear()`
2. **Safe UI**: Creates new workspace BEFORE deleting old data
3. **Parallel cloud deletion**: Uses `Promise.allSettled()` for faster deletion
4. **Sync blocked**: Prevents sync during deletion operations

### Old Functions (Deprecated)

```typescript
// ❌ DEPRECATED - Don't use
clearWorkspace()      // Use deleteData('all')
clearLocalData()     // Use deleteData('local')

// ✅ CORRECT
deleteData('all')    // Complete reset
deleteData('local')  // Local only
deleteData('cloud')  // Cloud backup only
```

### IndexedDB Deletion Pattern

```typescript
// ✅ CORRECT: User-scoped deletion
await db.spaces.where('userId').equals(currentUserId).delete();

// ❌ WRONG: Clears ALL users' data
await db.spaces.clear();
```

### Codebase References

- `src/store/slices/dataSlice.ts` - `deleteData()`, `getDeletionCounts()`
- `src/services/sync/syncOrchestrator.ts` - `deleteCloudContent()` with parallel deletion

---

## Related Files

- Code Quality: `.opencode/context/core/standards/code-quality.md`
- UI Components: `.opencode/context/core/standards/ui-components.md`
