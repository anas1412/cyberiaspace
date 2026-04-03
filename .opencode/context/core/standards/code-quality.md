<!-- Context: core/standards/code-quality | Priority: critical | Version: 1.0 | Updated: 2026-04-03 -->
# Code Quality Standards

**Purpose**: Critical patterns that prevent hard-to-debug bugs in this codebase.
**Enforcement**: Tier 1 - These rules override all other considerations.

---

## 1. Stale State Bug (MOST COMMON)

**Always use `get()` fresh. Never capture state at function start.**

```typescript
// ❌ WRONG - stale state bug
unlinkSelectedThoughts: async () => {
  const { thoughts } = get();  // Captured here
  // ...updates Zustand...
  await get().cleanupStacks();  // cleanupStacks sees OLD thoughts!
}

cleanupStacks: async () => {
  const { thoughts } = get();  // Same pattern - fresh is correct here
}
```

```typescript
// ✅ CORRECT - always call get() when you need current state
unlinkSelectedThoughts: async () => {
  // ...updates Zustand...
  await get().cleanupStacks();  // Gets fresh state
}

cleanupStacks: async () => {
  const freshThoughts = get().thoughts;  // Fresh each call
}
```

**Rule**: If function A calls function B, and both read state, function B must call `get()` itself.

---

## 2. Three-Layer Write Order (MANDATORY)

Every state mutation must follow this order:

```
User Action
     ↓
1. Zustand (source of truth) - ALWAYS FIRST
     ↓
2. IndexedDB (Dexie) - local persistence
     ↓
3. Sync (Supabase) - background cloud push
```

```typescript
// ✅ CORRECT order
updateThought: async (id, updates) => {
  // 1. Zustand FIRST
  set({ thoughts: thoughts.map(t => t.id === id ? {...t, ...updates} : t) });
  
  // 2. IndexedDB SECOND
  await db.thoughts.update(id, { ...updates, syncStatus: 'local' });
  
  // 3. Sync happens via triggerSync() (debounced)
}
```

```typescript
// ❌ WRONG - IndexedDB first
await db.thoughts.update(id, updates);  // Bad!
set({ thoughts: ... });  // UI won't update!
```

---

## 3. IndexedDB: Read for Hydration, Not UI

**UI reads ONLY from Zustand during active sessions.**

```typescript
// ❌ WRONG - reading DB for UI during active session
const thoughts = await db.thoughts.toArray();
render(thoughts);

// ✅ CORRECT - read from Zustand
const thoughts = useStore(state => state.thoughts);
```

```typescript
// ✅ CORRECT - IndexedDB read for HYDRATION only
useEffect(() => {
  const loadData = async () => {
    const localThoughts = await db.thoughts.where('spaceId').equals(spaceId).toArray();
    set({ thoughts: localThoughts });  // Hydrate Zustand ONCE
  };
  loadData();
}, []);
```

---

## 4. User Isolation (CRITICAL)

**Always filter by `userId` in IndexedDB queries.**

```typescript
// ❌ WRONG - queries ALL users' data
const thoughts = await db.thoughts.where('spaceId').equals(spaceId).toArray();

// ✅ CORRECT - filter by current user
const currentUserId = useAuthStore.getState().user?.id ?? 'guest';
const thoughts = await db.thoughts
  .filter(t => t.spaceId === spaceId && t.userId === currentUserId && !t.deletedAt)
  .toArray();
```

**Exception**: Zustand store automatically filters by userId when using `refreshThoughts()`.

---

## 5. ID Generation: ULIDs Only

**No auto-increment, no `parseInt(id, 10)`.**

```typescript
// ✅ CORRECT - use ULID for all new entities
import { ulid } from 'ulid';
const newId = ulid();

// ❌ WRONG - numeric IDs
const newId = ++lastId;
parseInt(id, 10);  // Don't do this
```

---

## 6. Editing Registry for Sync Protection

**Register active edits to prevent sync from overwriting.**

```typescript
// When user starts editing
syncOrchestrator.startEditing(thoughtId);

// When user stops editing (on blur/close)
syncOrchestrator.stopEditing(thoughtId);

// In sync logic - skip editing thoughts
if (syncOrchestrator.isEditing(thoughtId)) return;
```

---

## 📂 Codebase References

- `src/store/slices/thoughtSlice.ts` - State management patterns
- `src/store/slices/stackSlice.ts` - Stack operations
- `src/services/sync/syncOrchestrator.ts` - Sync and editing registry
- `src/db.ts` - Dexie database schema
- `docs/data-flow-audit.md` - Detailed data flow diagrams

---

## Related Files

- UI Components: `.opencode/context/core/standards/ui-components.md`
- State Mutations: `.opencode/context/core/processes/state-mutations.md`
