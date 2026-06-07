# Agent Guidelines: Cyberia Project

Welcome to the Cyberia codebase! This project is a modern, high-performance spatial-thinking tool built with React 19, TypeScript, and Vite. It utilizes IndexedDB for local persistence (via Dexie) and Supabase for cloud synchronization and authentication.

##  Commands

### Build & Lint
- **Build:** `npm run build` (Runs TypeScript type-checking followed by Vite build)
- **Lint:** `npm run lint` (Uses ESLint with TypeScript and React Refresh rules)
- **Dev:** `npm run dev` (Starts the Vite development server)

### Testing
- No standard test suite (Jest/Vitest) is currently configured.
- **Experimental Scripts:** Located in `scripts/` (e.g., `node scripts/test-tavily.cjs`).
- When adding new functionality, it's highly recommended to add self-verifying logic or console logs since there is no automated test harness.

---

##  Authentication (Supabase Auth)

The app uses **Supabase Auth** for all authentication. Both Google OAuth and Email Magic Link are supported.

### Auth Flow

```
LoginPage.tsx
    │
    ├── Google OAuth: supabase.auth.signInWithOAuth({ provider: 'google' })
    │
    └── Email Magic Link: supabase.auth.signInWithOtp({ email })
            │
            ▼
    Supabase handles session (autoRefreshToken, persistSession)
            │
            ▼
    handleSupabaseSession() → setAuthenticatedUser() → runAuthenticationFlow()
```

### Key Patterns

- **Token Management:** Supabase client manages tokens automatically. Use `authStore.getSessionToken()` or `authStore.getOrRefreshToken()` to get the current access token for API calls.
- **Session Persistence:** `autoRefreshToken: true` and `persistSession: true` in `src/services/supabase.ts` ensure sessions persist across browser restarts.
- **Auth State Changes:** Listen via `supabase.auth.onAuthStateChange()` - handled in `initAuth()`.
- **API Calls:** All API endpoints verify Supabase JWT via `api/utils/auth.ts` → `verifyAuth()`.

### localStorage Keys (Auth-Related)

| Key | Purpose | Managed By |
|-----|---------|------------|
| `cyberia-user` | User profile (plan, usage, settings) | App (authSlice) |
| `cyberia-theme` | Theme preference (dark/light) | App (persists across logout) |
| `cyberia-active-space-id` | Current active space | App |
| `cyberia-last-sync` | Last sync timestamp | Sync orchestrator |

### localStorage Keys (Customization)

| Key | Purpose | Managed By |
|-----|---------|------------|
| `cyberia-node-bg` | Custom node background color | Settings → Customization |
| `cyberia-accent` | Custom primary accent color | Settings → Customization |
| `cyberia-secondary` | Custom secondary color | Settings → Customization |

**Deprecated Keys (cleaned up on signOut):** `cyberia-token`, `cyberia-token-expiry`, `cyberia-refresh-secret`, `cyberia-scopes`

### Backend Auth Files

| File | Purpose |
|------|---------|
| `api/auth.ts` | Admin login only (POST) |
| `api/utils/auth.ts` | Supabase JWT verification for all API endpoints |

---


- **handlePostAuthSync:** Not deprecated. It remains as part of the auth flow for initial hydration; must be awaited during `init()` on fresh logins to ensure cloud data resolution before the loading screen fades.
- **isLocalWorkspaceEmpty:** Standard utility to distinguish between fresh devices (overwrite) and guest sessions (merge).
- **Synchronized Tombstones:** Standardized on using `timestamp = Date.now()` for both `updatedAt` and `deletedAt` within transactions to ensure atomic cloud reconciliation.

##  Core Architecture

###  Data Flow & Synchronization

####  The Three-Layer Architecture

The app uses a **strict hierarchical data flow** where each layer has a specific role:

| Layer | Role | Access Pattern |
|-------|------|----------------|
| **Zustand** | Source of Truth for UI | Read: Always. Write: First. |
| **IndexedDB** | Local Persistence (Write-Behind Cache) | Read: On load only. Write: After Zustand update. |
| **Supabase** | Cloud Backup | Read: On sync only. Write: After IndexedDB persist. |

```
┌─────────────────────────────────────────────────────────────┐
│                         UI / React                          │
│                    Reads from Zustand ONLY                   │
└─────────────────────────────────────────────────────────────┘
                              ↑ WRITE
                              │
┌─────────────────────────────────────────────────────────────┐
│                      Zustand Store                          │
│            (Source of Truth for ALL UI State)              │
│                                                              │
│  Rules:                                                      │
│  • ALWAYS update Zustand FIRST before any other operation    │
│  • NEVER read from IndexedDB to populate UI state           │
│  • All mutations go through store slice functions           │
└─────────────────────────────────────────────────────────────┘
                              ↑ PERSIST
                              │
┌─────────────────────────────────────────────────────────────┐
│                       IndexedDB                             │
│                   (Dexie Local Database)                    │
│                                                              │
│  Rules:                                                      │
│  • Written to AFTER Zustand is updated                      │
│  • Used for app load hydration                              │
│  • NOT used for UI reads during active sessions            │
│  • Contains tombstones for soft-delete                     │
└─────────────────────────────────────────────────────────────┘
                              ↑ SYNC
                              │
┌─────────────────────────────────────────────────────────────┐
│                        Supabase                             │
│                      (Cloud Backup)                         │
│                                                              │
│  Rules:                                                      │
│  • Written to after IndexedDB persist                       │
│  • Read during delta sync to reconcile                      │
│  • Uses LWW (Last-Write-Wins) based on updatedAt          │
└─────────────────────────────────────────────────────────────┘
```

####  Write Flow (MANDATORY)

For **ANY** state mutation, follow this exact order:

```
User Action
     ↓
1. Update Zustand (source of truth)
     ↓
2. Persist to IndexedDB (local backup)
     ↓
3. Sync to cloud (background)
```

**Example - Correct:**
```typescript
// CORRECT: Zustand first, then IndexedDB, then sync
updateThought: async (id, updates) => {
  // 1. Zustand FIRST
  set({ thoughts: thoughts.map(t => t.id === id ? {...t, ...updates} : t) });
  
  // 2. IndexedDB SECOND  
  await db.thoughts.update(id, { ...updates, syncStatus: 'local' });
  
  // 3. Sync happens via triggerSync() (debounced)
}
```

**Example - WRONG (Anti-pattern):**
```typescript
// WRONG: IndexedDB first, or bypassing Zustand
updateThought: async (id, updates) => {
  // BAD: Writing to IndexedDB first
  await db.thoughts.update(id, updates);
  
  // BAD: Not updating Zustand at all
  // The UI will not reflect this change!
}
```

####  Read Flow

- **During Active Sessions:** UI components read **ONLY from Zustand**
- **On App Load:** Read from IndexedDB, hydrate Zustand, then render
- **During Sync:** Merge cloud data with local using `mergeThoughts()` for thoughts, respecting editing registry

####  Why This Architecture?

1. **Instant Feedback:** UI updates immediately without waiting for DB
2. **Offline-First:** All changes persist locally, sync happens in background
3. **Conflict Resolution:** LWW via `updatedAt` timestamp prevents data loss
4. **Edit Protection:** Editing registry prevents sync from overwriting unsaved edits

For detailed data flow diagrams and timing, see [`docs/data-flow-audit.md`](./docs/data-flow-audit.md).

####  Blobs/Files Stay Out of Zustand

Blobs (file data) are stored directly in IndexedDB, never in Zustand. This is because:
- Files can be large (up to 50MB)
- Zustand is in-memory, too expensive for large files
- IndexedDB is designed for binary data

**Correct Pattern:**
```typescript
// CORRECT: Direct to IndexedDB, metadata to Zustand
await db.blobs.put({ id, blob, thoughtId, userId });  // Blob to IndexedDB
await updateThought(id, { text: file.name, data: {...} });  // Metadata to Zustand
uploadThoughtBlob(id);  // Background upload to cloud
```

**For File Uploads:**
1. Store blob in IndexedDB (`db.blobs.put`)
2. Update metadata in Zustand (`updateThought`)
3. Upload to cloud in background (`uploadThoughtBlob`)

####  flushThought Does NOT Trigger Sync

The `flushThought()` function persists edits to IndexedDB but does NOT trigger sync. This prevents race conditions where:
1. File upload sets `syncStatus: 'syncing'`
2. flushThought runs and was overwriting back to `'local'`
3. Causing infinite sync loops

Now flushThought preserves `'syncing'` status and sync is handled by:
- `uploadThoughtBlob()` after file upload completes
- `deltaSync()` periodically for metadata changes

####  Key Anti-Patterns (BLOCKING)

```typescript
// ❌ NEVER: Direct IndexedDB write without Zustand update
await db.thoughts.update(id, { name: 'new' });
// UI won't update!

// ❌ NEVER: Reading from IndexedDB for UI state  
const thoughts = await db.thoughts.toArray(); // Don't do this for rendering!
render(thoughts); // Should use useStore(state => state.thoughts)

// ❌ NEVER: Calling refreshThoughts() after local mutations
// refreshThoughts() is for SYNC, not for local operations
// After a local update, Zustand is already correct!
```

####  When to Use `refreshThoughts()` / `refreshStacks()`

| Scenario | Use refresh? |
|----------|--------------|
| After cloud sync (reconciliation) | ✅ YES |
| On app load | ✅ YES |
| After local mutation | ❌ NO - Zustand already correct |
| After merge from cloud | ✅ YES |

###  Old Documentation (Historical Reference)

The sections below describe implementation details that are now governed by the Three-Layer Architecture above:

1.  **Local First:** All user data (Spaces, Thoughts, Stacks) is stored in **IndexedDB** using **Dexie**. This ensures offline functionality and low latency.
1.5 ** IndexedDB is User-Scoped (CRITICAL):** IndexedDB stores data for ALL users in a single database. Unlike cloud storage, IndexedDB does NOT automatically filter by user. You MUST always filter by `userId` when querying `db.thoughts`, `db.stacks`, or `db.spaces` directly. Always get the current user's ID from `useAuthStore.getState().user?.id ?? 'guest'` and include it in your queries. The Zustand store automatically filters by userId when using `refreshThoughts()` or `refreshStacks()`, but direct DB queries must include `userId` explicitly.
2.  **Local-First Priority:** The UI must always prioritize local Blobs over cloud URLs. Assets should be rendered from local storage whenever available to ensure instant feedback and offline reliability.
3.  **The Sync Shield:** Large data operations (like imports) are protected by `isSyncBlocked` in the auth store. This prevents race conditions and sync conflicts by pausing background synchronization during heavy write operations.
4.  **Synchronized Tombstones:** Deletion follows a soft-delete pattern using the `deletedAt` timestamp. Local records are only permanently purged from IndexedDB after a Supabase "Ack" (Acknowledgment) confirms the cloud deletion. Direct `db.delete()` is FORBIDDEN for synced entities; always use `deletedAt` + `updatedAt` + `syncStatus: 'local'`.
5.  **Cloud Sync:** Synchronization with Supabase is managed by `src/services/sync/syncOrchestrator.ts`.
6.  **Handshake Sequence:** On fresh logins (`authenticated` + `!lastSync`), the `init()` function MUST await `handlePostAuthSync()` before setting `isInitializing: false`. This prevents the UI from landing in an empty local state while cloud data is still resolving.
7.  **Smart Hydration:** `handlePostAuthSync` employs `isLocalWorkspaceEmpty()` to decide:
    *   **Overwrite:** If local is empty, replace with cloud data to prevent clutter.
    *   **Merge:** If local has guest work, merge with cloud data to preserve user progress.
8.  **Backend Services:**
    *   **Vercel Serverless Functions:** Primary API layer located in `api/` (e.g., `api/feedback.ts`, `api/publish.ts`), keep in mind that we are using hobby ter 12 functions max. These are the source of truth for custom backend functionality.
    *   **Supabase:** Acts as a "Backend-as-a-Service" (BaaS) for:
        *   **PostgreSQL Database:** Cloud storage for synced Dexie data.
        *   **Storage (Buckets):** Storage for binary assets like images and files.
7.  **Sync State Machine:** Synchronization follows a 4-state machine (`local`, `syncing`, `synced`, `error`). It uses **Supabase Realtime** for instant cross-device updates and immediate delta synchronization upon local mutations.
8.  **Boundary Translation:** The application strictly enforces `camelCase` in the frontend (JS/TS/Dexie) and `snake_case` in the backend (Postgres). All data crossing this boundary MUST be translated using `toCamelCase` (incoming) or `toSnakeCase` (outgoing) utilities from `src/services/supabaseSync.ts`. This prevents property mismatches and ensures standard naming conventions in both environments.
9.  **Online/Offline Sync:** When the browser fires the `online` event, `processOfflineChanges()` is triggered which calls `deltaSync()` to push queued local changes to the cloud. When `offline`, all changes are saved locally and queued for the next sync. Supabase Realtime listeners are set up via `syncOrchestrator.setupRealtimeListener(userId)` to instantly receive cross-device changes.
10. **Sync Debounce Behavior:** Local user changes are debounced (2.5s) before triggering `deltaSync()` to prevent "save storms" during active editing. Remote changes from Supabase Realtime are debounced (500ms) to handle bursts efficiently. A `syncRequestedDuringActiveSync` flag queues a follow-up sync if changes arrive while a sync is already running.
11. **Echo Filter:** The realtime listener compares incoming cloud `updated_at` with local `updatedAt`. If local data is newer or equal, the change is ignored to prevent infinite self-broadcast loops.
12. **Atomic Sync Marking:** When pushing changes to cloud, timestamps are captured before upload. Records are only marked `syncStatus: 'synced'` in the finally block if their `updatedAt` hasn't changed during the push, preventing overwriting newer local edits with older cloud data.
13. **Absence Rule (Grace Period):** When cloud data is missing locally, a 30-second grace period is applied before permanent deletion. This prevents accidental data loss from cloud replication lag.

###  Editing Session Protection (Active Editing Registry)

To prevent data loss when sync operations occur during active editing, the application implements an **Editing Session Registry** pattern:

####  Architecture Principles

1.  **Single Source of Truth:** **Zustand store is the source of truth.** IndexedDB is a write-behind cache. Cloud is backup. The UI never reads from IndexedDB during active editing sessions.

2.  **Merge-Based Sync:** `refreshThoughts()` uses `mergeThoughts()` instead of replacing all thoughts. This preserves actively edited thoughts and uses timestamp-based conflict resolution (`updatedAt`).

3.  **Editing Session Registry:** All editors register their active thought IDs:
    - **Focus Editors:** Register when opened, unregister on close
    - **Inspector:** Registers when `selectedThoughtId` changes
    - **MultiSelectionMenu:** Registers all `selectedThoughtIds`

####  Implementation Details

**Registration API (syncOrchestrator.ts):**
```typescript
// Start editing session
syncOrchestrator.startEditing(thoughtId)

// End editing session (flushes to IndexedDB)
syncOrchestrator.stopEditing(thoughtId)

// Check if editing
syncOrchestrator.isEditing(thoughtId): boolean
```

**Write Flow:**
```
User types in editor
        ↓
Zustand updated immediately (source of truth)
        ↓
500ms debounce timer starts
        ↓
If typing continues → timer resets (no IndexedDB write)
        ↓
If paused for 500ms → write to IndexedDB
        ↓
If sync triggers → deltaSync() skips editing thoughts
        ↓
Editor closes → flushThought() saves to IndexedDB
        ↓
Next deltaSync() pushes to cloud (excluding editing thoughts)
```

**Key Files:**
- `src/services/sync/syncOrchestrator.ts` - Editing registry (`editingThoughtIds` Set)
- `src/store/slices/thoughtSlice.ts` - `mergeThoughts()` function
- All editors in `src/components/editors/` and `src/components/Inspector.tsx`

**Important:** The 500ms debounce means **IndexedDB is NOT written while actively typing** - only when the user pauses. This prevents "save storms" during rapid editing while ensuring data persists.

####  CRITICAL: Always Get Fresh State

When a function is called by another function that has already updated Zustand, you MUST NOT use captured state variables. Always call `get()` fresh to get the current state.

**WRONG (stale state bug):**
```typescript
unlinkSelectedThoughts: async () => {
  const { thoughts } = get();  // Captured at call time
  // ...updates Zustand...
  
  // Later calls another function that uses stale thoughts variable!
  await get().cleanupStacks();  
}

cleanupStacks: async () => {
  const { thoughts } = get();  // This gets stale state if called from unlinkSelectedThoughts
  // Bug: This won't see the updates from unlinkSelectedThoughts
}
```

**CORRECT (fresh state):**
```typescript
unlinkSelectedThoughts: async () => {
  const { thoughts } = get();
  // ...updates Zustand...
  
  await get().cleanupStacks();
}

cleanupStacks: async () => {
  // ALWAYS get fresh state - do NOT destructure at function start
  const currentThoughts = get().thoughts;
  // Now currentThoughts has the latest updates
}
```

This principle applies to ALL store functions that call other store functions. If you capture state at the start of a function, and then call another function that also reads state, the inner function will see stale data.

####  Known Limitations

**File Upload Race Condition (`storageSlice.ts`):**
When a file is uploading, the `uploadBlob()` function fetches `thought.data` at upload start time. If the user edits the thought's title/text during upload, those changes could be lost because the upload completion merges with the stale `currentData`.

This is a low-risk edge case because:
- File uploads are typically one-time actions, not continuous editing
- Users rarely rename thoughts while uploads are in progress
- The conflict only affects `text` field, not actual file content

Future improvement: Check `syncOrchestrator.isEditing(thoughtId)` before upload and queue the update until editing ends.

###  Spatial Thinking Engine

- Thoughts are not just static entries; they are physical entities with `x, y` (position) and `vx, vy` (velocity) properties.
- The canvas uses a custom physics engine for interactions, including "stacks" where nodes orbit each other.
- **Performance Optimization:** 
    *   **Frame Pre-Processor:** Collision detection and spatial indexing use an optimized $O(N^2)$ pre-processor to manage entity interactions without jitter.
    *   **Selfish Selectors:** React components use highly granular "selfish selectors" to minimize re-renders, ensuring only the specific properties needed by a component (e.g., just `x` and `y`) trigger updates.
- **Physics Architecture:** Detailed principles regarding Top-Left Anchoring, DOM Synchronization, and Persistence are documented in [docs/physics-engine.md](./docs/physics-engine.md).
- **Canvas Scaling:** Managed via `DOMMatrix` transforms.
- **Smooth Camera System (`useCamera.ts`):** The spatial viewport uses a modular camera system powered by `framer-motion` springs. This decouples visual "flight" (zooming/panning) from React's render cycle, achieving 60fps performance by bypassing React reconciliation for high-frequency transforms.
- **Direct Motion Injection:** Gesture handlers in `useViewportGestures.ts` push updates directly to the camera's motion values. The physics loop in `usePhysics.ts` reads these values to synchronize the `#world` and `.dot-grid` DOM elements directly via direct DOM manipulation.
- **Persistence:** Camera movements are synchronized back to the Zustand store and cloud storage using an "on rest" or debounced mechanism to ensure data consistency without impacting UI responsiveness.

### Physics Engine - Loading State Guard

**The Problem:** When switching spaces, the app sets `isSpaceLoading: true` and fetches new thoughts. The physics engine runs immediately on these new thoughts, but they haven't been rendered yet (hidden behind the loading overlay). Without element heights, the repulsion forces fail and all thoughts collapse to the center of the screen, forming a vertical stack.

**The Fix:** The physics engine (`usePhysics.ts`) now checks `isSpaceLoading` before running:

1. **Loop Freeze:** The physics calculation loop completely pauses while `isSpaceLoading === true`
2. **Initialization Lock:** The engine refuses to reset/initialize thought positions while loading
3. **Height Sync:** By waiting until loading completes, the browser renders thoughts and measures their heights, allowing repulsion to work correctly from frame one

**Implementation:**
```typescript
// In usePhysics.ts - loop callback
const isSpaceLoading = useStore((state) => state.isSpaceLoading);

// Guard at start of loop
if (isSpaceLoading) return;

// Guard in initialization useEffect
useEffect(() => {
  if (isSpaceLoading) return;
  // ... initialize physics state
}, [thoughts, activeSpace?.mode, isSpaceLoading]);
```

### Physics Engine - Mode Transition Animations

Smooth animations occur when switching between Spatial, Kanban, and Calendar modes:

1. **Mode Transition System (`modeTransitionRef`):** When switching modes, the engine activates a 500ms transition period with faster lerp speed (0.25 vs normal 0.08)
2. **Launch Effect:** Thoughts scale up slightly (1.15x) during entry animation, then settle to normal scale
3. **Spatial Entry:** Camera auto-frames all thoughts by calculating bounding box and animating to fit viewport
4. **Smooth Lerp:** Non-spatial modes use position interpolation instead of instant snapping

**Key Code:**
```typescript
// In usePhysics.ts - transition speed
const isTransitioning = modeTransitionRef.current.active && 
  (performance.now() - modeTransitionRef.current.startTime < 500);
const speed = isTransitioning ? 0.25 : 0.08; // Fast during transition
```

**Anti-Pattern to Avoid:**
- ❌ DON'T force `snapNextFrame.current = true` on mode switch — this breaks the animation
- ✅ DO let the `modeTransitionRef` system handle smooth transitions

### Physics Engine - Ghost Thought Fix (Origin Hiding)

When switching to Kanban/Calendar modes, thoughts at position (0,0) are temporarily hidden until the layout calculates their correct position. This prevents the "ghost thought in top-left corner" flash.

**Implementation:**
```typescript
// In usePhysics.ts - hide thoughts at origin in non-spatial modes
const isAtOrigin = Math.abs(p.x) < 1 && Math.abs(p.y) < 1;
const shouldHide = mode !== 'spatial' && isAtOrigin && !isDraggingThis && !isSelected;

el.style.opacity = shouldHide ? '0' : (res.opacity ?? 1).toString();
el.style.visibility = shouldHide ? 'hidden' : (res.visibility ?? 'visible');
```

This is non-invasive — it only affects newly-created thoughts that haven't yet been positioned, allowing the animation system to work normally.

### Physics Engine - Layer Shadow Mode Awareness

Thought node shadows behave differently per mode:

| Mode | Layer Shadow | Notes |
|------|-------------|-------|
| **Spatial** | ✅ Applied | 3D stacking effect via `altitudeStyles` |
| **Kanban** | ❌ Disabled | Flat layout — layer-based shadows disabled |
| **Calendar** | ❌ Disabled | Flat layout — layer-based shadows disabled |

**Implementation in `ThoughtNode.tsx`:**
```typescript
const useLayerShadow = isSpatial && thought.layer && thought.layer > 0;
```

In non-spatial modes, only the base CSS shadow (`shadow-[0_10px_40px_rgba(0,0,0,0.5)]`) applies, ensuring consistent flat visuals.

### Physics Engine - Position Persistence

**How It Works:**

1. **Save on Mode/Space Switch:** The persistence effect saves positions when you leave Spatial mode (switch to Kanban/Calendar/Directory) or switch to a different space
2. **Load on Initialize:** When entering Spatial mode, the initialization effect reads saved `x, y` from IndexedDB and positions thoughts accordingly
3. **No Auto-Scatter:** The old `scatterThoughts()` call was removed from `setActiveSpace` — it was adding random jitter (±20px) to all thoughts on every load

**Key Code Flow:**
```
Spatial Mode → Move thoughts (physics runs, positions stored in memory) 
  → Switch to Kanban → Cleanup effect fires → bulkUpdateThoughts() saves to IndexedDB
  → Switch back to Spatial → Initialization effect reads saved x,y → Thoughts restored
```

**Anti-Patterns to Avoid:**
- ❌ DON'T call `refreshThoughts()` after local mutations — Zustand is already correct
- ❌ DON'T write directly to IndexedDB for UI state — use Zustand first
- ❌ DON'T use `scatterThoughts()` on space load — it overwrites saved positions

###  Storage
- **Unique Folder Protocol:** To prevent filename collisions and ensure clean user isolation, all file assets in cloud storage are organized using the path structure: `${userId}/${thoughtId}/${fileName}`.
- **Lazy Loading / On-Demand:** To minimize egress, the application uses an on-demand strategy where thoughts and assets are only "woken" (downloaded) into local IndexedDB when a space is opened by the user.
- **Private Bucket with Signed URLs:** The `user-files` bucket is private (`public: false`). All file access requires signed URLs generated via the API endpoint `api/chat.ts`. Signed URLs expire after 1 hour and are cached in memory to reduce API calls.
- **Local-First Rendering:** All file-rendering components prioritize local IndexedDB blobs over cloud access. The flow is:
  1. Try local IndexedDB blob first (fastest, works offline)
  2. If no local blob, fetch signed URL from cloud (authenticated access)
  3. **No cloud URL fallback** - If sync couldn't download a blob locally, the cloud URL won't work either (expired tokens, network issues). This ensures consistent behavior.
- **Background Images Stay Local:** Space backgrounds are stored locally only with zero cloud egress. They are never uploaded to Supabase Storage.

###  File Access: Signed URLs On-Demand

**Critical Pattern - NEVER Store Signed URLs in Database:**

Signed URLs expire after 1 hour. Storing them in the database causes "expired JWT" errors when users try to open files later.

```typescript
// ✅ CORRECT: Store only storagePath, generate URL on-demand
uploadThoughtBlob: async (thoughtId) => {
  const result = await supabaseStorage.uploadFile(user.id, blob, name, thoughtId);
  // Store PATH only, not the URL
  await db.thoughts.update(thoughtId, {
    storageUrl: null,  // Don't store signed URL - it expires!
    storagePath: result.path,  // Keep this - needed for fresh URL generation
  });
}

// ✅ CORRECT: Generate fresh signed URL when opening files
handleOpenExternal: async () => {
  const url = await supabaseStorage.getSignedUrl(thought.storagePath);
  window.open(url, '_blank');
}
```

**For File Operations:**
- **Download:** Prefer local blob, fallback to `getSignedUrl(storagePath)`
- **Open in New Tab:** Always use `getSignedUrl(storagePath)` - never `thought.storageUrl`
- **Render Images:** Use local blob → signed URL → `data.url` (for embeds/thumbnails)
- **Never use `thought.storageUrl`** - it's always null or expired

###  Unified Data Deletion System

**Location:** Settings → Storage → "Delete All Data"

The deletion system is unified in a single modal with three options:

| Option | Scope | Use Case |
|--------|-------|----------|
| Everything (Local + Cloud) | `deleteData('all')` | Complete reset |
| Local Data Only | `deleteData('local')` | Clear device only |
| Cloud Backup Only | `deleteData('cloud')` | Clear cloud, keep device |

**Implementation (`dataSlice.ts`):**
```typescript
deleteData: async (mode: 'all' | 'local' | 'cloud') => {
  // 1. Create fresh workspace FIRST (prevents UI crash)
  // 2. Update Zustand + localStorage
  // 3. Delete old data (user-scoped, NOT .clear())
  // 4. Delete cloud if authenticated
}
```

**Key Features:**
- User-scoped deletion (prevents cross-user data loss)
- Creates new workspace before deleting (safe UI)
- Parallel cloud deletion with error tracking
- Confirmation modal always required

**Deprecated Functions (now redirects):**
- `clearWorkspace()` → redirects to `deleteData('all')`
- `clearLocalData()` → redirects to `deleteData('local')`


###  State Management (Zustand)
The application uses a modular, slice-based architecture for state management to maintain readability and prevent circular dependencies.

- **Main Store (`useStore.ts`):** Composed of multiple slices in `src/store/slices/`:
  - `canvasSlice`: Spatial transforms, performance mode, and lightbox.
  - `thoughtSlice`: Entity CRUD, selection, and layering logic.
  - `spaceSlice`: Space management and publishing.
  - `stackSlice`: Linking and collection logic.
  - `historySlice`: Undo/Redo state and logic.
  - `dataSlice`: Initialization, onboarding, and data import/export.
  - `uiSlice`: Themes and interface search/filters.
- **Auth Store (`useAuthStore.ts`):** Composed of:
  - `authSlice`: User session and profile.
  - `syncSlice`: Cloud synchronization orchestration.
  - `storageSlice`: Media/Blob storage and usage calculation.
- **Other Stores:**
  - `useModalStore`: UI-wide modal and alert management.
  - `useSyncStore`: Visual synchronization status.

###  Oracle Workspace Intelligence
- **Dual Operating Modes**:
  - **Chat Mode**: Research and brainstorming focus. Restricted to READ-only tools.
  - **Action Mode**: Proactive agent focus. Full READ-WRITE access to workspace tools (subject to Pro tier).
- **Tool Governance**:
  - **READ Tools** (Searching, reading files/thoughts): Always allowed in both modes.
  - **WRITE Tools** (Creating/modifying thoughts/stacks): Restricted to Action mode.
- **Multimodal Standards**:
  - Strictly follow OpenRouter Unified Schema.
  - Use `type: 'file'` with `media_type: 'application/pdf'` for documents. Never use `image_url` for PDFs.
- **Internal ID Protocol**:
  - IDs are private handles for tools. NEVER show IDs to users or ask users for IDs. Look them up proactively from the provided context.
  - **ULID Standard:** All new Spaces, Stacks, and Thoughts must use **ULIDs** (Universally Unique Lexicographically Sortable Identifiers) as their primary IDs to prevent multi-device collisions and maintain temporal sorting. 

### Legacy & Deprecated Systems
This section serves as a definitive reference for patterns that are deprecated. Agents must avoid these when writing new code or refactoring.

- **Database Tables:** `pendingDeletions` and `pendingBlobs` are deprecated. All deletion tracking now uses the `deletedAt` tombstone pattern and `syncStatus`.
- **auth_user_id Column:** The `auth_user_id` column in `users` is deprecated. All users now have `users.id = auth.users.id` (UUID). No mapping table or subquery is needed — RLS policies use `user_id = auth.uid()` directly.
- **usage JSONB Column:** The `usage` JSONB column in `users` is deprecated. AI usage is now tracked in the dedicated `user_usage` table with explicit columns for atomic updates.
- **Auto-Increment IDs & Mapping:** Numeric `++id` primary keys and the local-to-cloud ID mapping system are deprecated. All new entities must use **ULIDs** (Universally Unique Lexicographically Sortable Identifiers) as their primary IDs across both IndexedDB and Supabase to prevent multi-device collisions and maintain temporal sorting. 
- **ID Handling:** Purge all `parseInt(id, 10)` logic and mapping lookups as IDs transition to strings.
- **Sync Logic:** 
  - `FullPushSync` and brute-force full syncing are deprecated in favor of **Lazy Loading** and **Delta Sync**.
  - Aggressive `mediaSweep` is replaced by **Event-Driven Deletion** (Ack-based) and a 30-day local purge.
  - `repairEmptyFileThoughts` is replaced by the **Healing Rule** (re-downloading missing blobs for synced thoughts).
  - Standardize on the **4-state machine** (`local`, `syncing`, `synced`, `error`).
  - Standardize on a single `SYNC_DEBOUNCE_MS = 10000` (10 seconds) across all store slices. (Deprecated - Now Instant via Realtime)
  - **Handshake Sequence:** Prematurely setting `isInitializing: false` on fresh logins is deprecated.
  - **Smart Hydration:** Unconditional merging in `handlePostAuthSync` is deprecated in favor of `isLocalWorkspaceEmpty` logic.
- **Backend:** Supabase Edge Functions (`supabase/functions/`) are deprecated in favor of Vercel Serverless Functions (`api/`).
- **published_spaces:** The `published_spaces` table is deprecated. Space publishing was replaced by the Oracle workspace intelligence sharing features. The table and `api/publish.ts` are no longer in use.
- **Authentication:** Custom Google OAuth2 flow is deprecated. Use Supabase Auth (`signInWithOAuth`, `signInWithOtp`) instead. The following are deprecated:
  - `api/google-auth.ts` - Removed (was token exchange/refresh)
  - `api/auth.ts` GET handler - Removed (was OAuth callback)
  - `google-auth-library` dependency - Removed
  - Manual token management (`cyberia-token`, `cyberia-token-expiry`, `cyberia-refresh-secret`, `cyberia-scopes`) - Removed
  - `handleAuthCode()` - Removed (use `handleSupabaseSession()` instead)
  - Google tokeninfo fallback in `api/utils/auth.ts` - Removed (Supabase JWT only)
- **Entity Types:** The `image` thought type is deprecated. Use `type: 'file'` for all image assets to ensure consistent handling and storage.
- **Onboarding:** Generating initial thoughts, stacks, or multiple spaces for new users is deprecated. Use `createInitialWorkspace` to provide a single, empty "Workspace" for a pure start. The `isOnboarding: true` flag is deprecated for general space use and only remains for the `Homepage` live demo.
- **Conflict Resolution:** The "Local vs Cloud" choice screen is deprecated. All synchronization conflicts must be resolved automatically using **Last-Write-Wins (LWW)** logic based on the `updatedAt` field.
- **Custom Themes:** Space-specific themes (storing theme in space settings) are deprecated. Only the global `dark` and `light` themes are supported. The `theme` field in Space entities should not be used.
- **Performance Mode:** The `performanceMode` flag and related optimizations are deprecated. The physics engine and rendering are now always-on at full quality. Remove all `performanceMode` checks and branches from components.
- **Mobile Support:** The web app is **desktop-only** (mouse/trackpad + wide viewport required). `src/components/MobilePage.tsx` is a gate that redirects mobile users to the landing page. All touch/long-press/mobile-specific interaction patterns are deprecated. Remove `onTouchStart`/`onTouchEnd`/`mobile-fab-adjust`/`mobile-bottom-bar-adjust` patterns from components. The `MobilePage` component itself is kept only as a "desktop required" gate — do not add mobile-responsive layouts to the main app.
- **Public Storage Bucket:** The `user-files` bucket was previously public (`public: true`), allowing direct CDN URLs. This is deprecated. The bucket is now private (`public: false`) and requires signed URLs for access. Use `supabaseStorage.getSignedUrl()` instead of `getPublicUrl()`.
- **Cloud URL Fallback:** The pattern of falling back to `storageUrl` from the database when local blobs are unavailable is deprecated. If sync couldn't download a blob locally, the cloud URL won't work either (expired tokens, network issues). Only use local IndexedDB blobs or signed URLs.
- **Background Cloud Uploads:** Uploading space backgrounds to Supabase Storage is deprecated. Backgrounds now stay local-only in IndexedDB with zero cloud egress. Remove any `uploadSpaceBackground()` or background cloud deletion logic.
- **Storing Signed URLs in Database:** Storing signed URLs in the `storageUrl` field is deprecated. Signed URLs expire after 1 hour. Always store `storagePath` only and generate fresh signed URLs on-demand via `supabaseStorage.getSignedUrl(path)`. The old pattern of `storageUrl = result.url` from uploads causes "expired JWT" errors.
- **Using thought.storageUrl for File Links:** Direct use of `thought.storageUrl` for links (href, window.open) is deprecated. This field may contain expired signed URLs. Use `handleOpenExternal()` / `handleDownload()` which generate fresh signed URLs.
- **Old Deletion Functions:** The separate `clearWorkspace()` and `clearLocalData()` functions are deprecated. Use the unified `deleteData(mode)` function with mode `'all'`, `'local'`, or `'cloud'`.
- **IndexedDB Bulk Clear:** Using `db.table.clear()` without userId filtering is deprecated and dangerous. It wipes ALL users' data. Always use `db.table.where('userId').equals(userId).delete()` for user-scoped deletion.

---

##  Design System & UI Guidelines

###  Typography Scale
Use these standardized text sizes for consistency across the application:

| Size | Usage | Class |
|------|-------|-------|
| **9px** | Labels, tags, badges | `text-[9px]` |
| **10px** | Small labels, keyboard shortcuts | `text-[10px]` |
| **11px** | Secondary metadata | `text-[11px]` |
| **12px** | Body small, menu items, timestamps | `text-xs` or `text-[12px]` |
| **13px** | Default body text | `text-[13px]` |
| **14px** | Body medium, descriptions | `text-sm` |
| **16px** | Large body, focus editor | `text-base` |
| **20px** | Section headings | `text-xl` |
| **24px** | Major headings | `text-2xl` |
| **32px** | Hero text | `text-[32px]` |

**Font Stack:**
- Primary: `'Plus Jakarta Sans', system-ui, sans-serif`
- Monospace: `'JetBrains Mono', monospace`
- Decorative: `'CyberiaBlueprint', cursive`

###  Theme System (Two-Theme Architecture)

**Active Themes:** Only `dark` and `light` themes are supported. Custom/space-specific themes are deprecated.

**Theme Application:**
- Theme is stored in Zustand store and localStorage (key: `cyberia-theme`)
- Theme persists across logout/login - user's preference is preserved
- Applied to `document.body` via `data-theme` attribute
- Global CSS transitions ensure smooth theme switching (0.2s duration)

**Custom Color Theme Switch Behavior:**
- Custom colors are applied with `!important` on `document.documentElement` to override CSS defaults
- Custom colors are theme-agnostic: they apply to BOTH dark and light modes
- On theme switch without custom color: applies theme-appropriate default
- On theme switch with custom color: keeps custom color for both themes
- **Important:** `--node-bg` and `--accent` are intentionally omitted from `[data-theme='light']` CSS selector to allow JavaScript `!important` override to work correctly

**CSS Variable Usage (MANDATORY):**

| Variable | Dark Theme | Light Theme | Usage |
|----------|------------|-------------|-------|
| `--bg-page` | `#05060a` | `#e2e8f0` | Page background |
| `--bg-main` | `#18181b` | `#ffffff` | Card/main backgrounds (neutral gray) |
| `--node-bg` | `#12121af5` | `#f8fafc` | Thought nodes (deep dark in dark mode) |
| `--node-text-primary` | `#f8fafc` | `#0f172a` | Text in thought nodes (dark mode colors) |
| `--node-text-secondary` | `rgba(248,250,252,0.85)` | `rgba(15,23,42,0.85)` | Secondary text in nodes |
| `--node-text-dimmed` | `rgba(248,250,252,0.7)` | `rgba(15,23,42,0.65)` | Dimmed text in nodes |
| `--node-text-muted` | `rgba(248,250,252,0.55)` | `rgba(15,23,42,0.5)` | Muted text in nodes |
| `--text-primary` | `#f8fafc` | `#0f172a` | Primary text |
| `--text-secondary` | `rgba(248,250,252,0.85)` | `rgba(15,23,42,0.85)` | Secondary text |
| `--text-muted` | `rgba(248,250,252,0.55)` | `rgba(15,23,42,0.5)` | Muted/placeholder text |
| `--glass-bg` | `rgba(10,10,15,0.75)` | `rgba(255,255,255,0.92)` | Glass morphism backgrounds |
| `--glass-border` | `rgba(255,255,255,0.08)` | `rgba(0,0,0,0.12)` | Borders on glass elements |
| `--accent` | `#6366f1` | `#6366f1` | Primary accent (indigo) |
| `--accent-secondary` | `#818cf8` | `#4f46e5` | Accent hover/active |
| `--secondary` | `#8b5cf6` | `#8b5cf6` | Secondary color (progress bars, glows) |

**Theme Transitions:**
All elements have smooth transitions when theme changes:
```css
*, *::before, *::after {
  transition-property: background-color, border-color, color, fill, stroke;
  transition-duration: 0.2s;
  transition-timing-function: ease;
}
```

###  Component Sizing Standards

**Toolbar Components (Consistent 44px height):**
- StatusBar: `h-[44px]`
- ViewSwitcher: `h-[44px]`
- SpaceSwitcher: `h-[44px]`
- AccountMenu: `h-[44px]`
- SystemTray: `h-[44px]`

**Standard Glass Container:**
```tsx
<div className="glass px-3 h-[44px] rounded-2xl flex items-center gap-1 
                border border-[var(--glass-border)] shadow-lg shadow-[var(--glass-border)]">
```

**Buttons:**
- Height: `h-full` (fills container)
- Padding: `px-3`
- Border radius: `rounded-xl`
- Active state: `bg-[var(--bg-page)] shadow-md`
- Inactive state: `text-[var(--text-muted)] hover:text-[var(--text-primary)]`

###  Background System

**BackgroundEngine Layers (z-index):**
1. **z-0:** Base background color (`--bg-page`)
2. **z-10:** Atmosphere (nebula gradients with dynamic blend mode)
3. **z-20:** Starfield (canvas-based particles)
4. **z-30+:** UI layers

**Theme-Aware Backgrounds:**
- Dark: White stars, screen blend mode for nebulae
- Light: Gray particles (40% opacity), multiply blend mode for nebulae

###  Overlay Backdrop Pattern (CRITICAL)

All overlay/modals should use the standardized backdrop pattern for consistency:

```tsx
// Standard overlay backdrop
<div className="fixed inset-0 bg-[var(--bg-page)]/60 backdrop-blur-md z-[N]">
```

**Key properties:**
- `bg-[var(--bg-page)]/60` - Uses page background with 60% opacity (adapts to light/dark themes)
- `backdrop-blur-md` - Tailwind's 12px blur (matches Settings/Shortcuts/Help modals)
- Never use `bg-black/80` or hardcoded colors in overlays

**Examples of components using this pattern:**
- Settings, Shortcuts, Help modals
- FocusEditor
- Dashboard modals (Modal.tsx, inline overlays)

###  Color Usage Rules (CRITICAL)

**NEVER use hardcoded colors:**
- ❌ `text-white`, `text-slate-400`, `text-gray-600`
- ❌ `bg-white/10`, `bg-black/20`
- ❌ `border-white/5`

**ALWAYS use CSS variables:**
- ✅ `text-[var(--text-primary)]`
- ✅ `text-[var(--text-muted)]`
- ✅ `bg-[var(--glass-bg)]`
- ✅ `border-[var(--glass-border)]`

**Dropdown/Menu Patterns (MANDATORY for custom dropdowns):**
- Button: `bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl px-3 py-2`
- Button hover: `hover:border-[var(--accent)]/50`
- Menu dropdown: `bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.3)]`
- Active item: `bg-[var(--accent)]/10 text-[var(--accent)]`
- Hover item: `hover:bg-[var(--glass-bg)]`
- **NEVER use `bg-[var(--bg-main)]`** - it has a blue tint in dark mode. Always use `bg-[var(--glass-bg)]` for dropdowns.

**Node Customization (Pro Feature):**
- Users can customize thought node background color via Settings → Customization → Node Colors
- Color is stored in localStorage as `cyberia-node-bg`
- Applied via CSS variable `--node-bg` on `document.documentElement` with `!important`
- **Theme-agnostic:** Custom color applies to BOTH dark and light modes
- Default values: dark: `#12121af5`, light: `#f8fafc`
- On reset: Applies theme-appropriate default based on current theme
- On theme switch: If no custom color, applies new theme's default
- Preset colors: Charcoal, Midnight, Obsidian, Plum, Navy, Teal

**Primary Color Customization (Pro Feature):**
- Users can customize the brand primary color via Settings → Customization → Primary Color
- Color is stored in localStorage as `cyberia-accent`
- Applied via CSS variable `--accent` on `document.documentElement` with `!important`
- **Theme-agnostic:** Custom color applies to BOTH dark and light modes
- On theme switch: If no custom color, removes override (lets CSS default)
- Secondary accent (`--accent-secondary`) is auto-calculated as primary + 60% opacity
- Default: `#6366f1` (indigo)
- 12 preset colors: Indigo, Violet, Pink, Rose, Red, Orange, Yellow, Green, Teal, Cyan, Blue, Purple

**Secondary Color Customization (Pro Feature):**
- Users can customize the secondary color via Settings → Customization → Secondary Color
- Color is stored in localStorage as `cyberia-secondary`
- Applied via CSS variable `--secondary` on `document.documentElement` with `!important`
- Controls: Progress bars, glow effects
- **Theme-agnostic:** Custom color applies to BOTH dark and light modes
- Default: `#8b5cf6` (violet)
- 12 preset colors: Violet, Pink, Rose, Red, Orange, Yellow, Green, Teal, Cyan, Blue, Indigo, Purple

**Semantic Colors (Allowed Exceptions):**
- Status indicators: `text-green-500`, `text-amber-500`, `text-red-500`
- Capacity dots: Green (<80%), Amber (80-99%), Red (100%+)

**Node-Specific Colors:**
- Thought nodes use `--node-text-*` variables for consistent text colors
- These always use dark mode colors for readability regardless of theme
- Applied via inline style on node container: `style={{ '--text-primary': 'var(--node-text-primary)', ... }}`

**Progress Bars:**
- Use `--secondary` for the progress fill color
- Default: `#8b5cf6` (violet)

###  Styling Architecture

**Tailwind + CSS Variables:**
- Use Tailwind for layout, spacing, sizing
- Use CSS variables for ALL colors
- Glass morphism via `.glass` utility class

**Common Patterns:**
```tsx
// Glass container
<div className="glass p-1 rounded-2xl border border-[var(--glass-border)]">

// Button
<button className="px-3 h-full rounded-xl text-[var(--text-muted)] 
                   hover:text-[var(--text-primary)] hover:bg-[var(--bg-page)]">

// Input
<input className="bg-[var(--glass-bg)] border border-[var(--glass-border)]
                  text-[var(--text-primary)] placeholder:text-[var(--text-muted)]">

// Card/Panel
<div className="glass rounded-2xl border border-[var(--glass-border)] 
                shadow-lg shadow-[var(--glass-border)]">
```

---

##  Code Style & Guidelines

###  Imports
- **Standard ESM Imports:** Use `import { x } from 'y'`.
- **Order:**
  1. React and third-party libraries (e.g., `zustand`, `@supabase/supabase-js`).
  2. Local stores (`./store/...`).
  3. Services and Utils (`./services/...`, `./utils/...`).
  4. Components (`./components/...`).
  5. Types and constants (`./db`, `./constants`).
  6. Styles (`./index.css`).
- **Circular Dependencies:** For services needing stores, use dynamic imports (`const { useStore } = await import('./store/useStore')`) inside functions to avoid circular issues during store initialization.
- **Store Slices:** When creating or modifying state, ensure you are working in the correct slice in `src/store/slices/`.

###  TypeScript & Typing
- **Strict Mode:** TypeScript is configured in strict mode. Avoid `any` where possible.
- **Interfaces:** Prefer `interface` over `type` for data structures.
- **Location:** Core entity types (Space, Thought, Stack) are defined in `src/db.ts`. Store-specific interfaces are defined in `src/store/types.ts`.

###  Naming Conventions
- **Components:** `PascalCase`.
- **Functions & Variables:** `camelCase`.
- **Constants:** `SCREAMING_SNAKE_CASE`.
- **Hooks:** Prefix with `use`.

###  React Patterns
- **Hooks at Top:** Always declare all hooks at the very top of the functional component.
- **Conditional Classes:** Use `tailwind-merge` and `clsx` for managing complex Tailwind classes.
- **Performance:** Use `useRef` for values that don't need to trigger re-renders (like mouse positions).

###  Error Handling
- **Async Operations:** Wrap with `try/catch` and use `console.error` for debugging.
- **User Feedback:** Use `useModalStore.getState().openModal()` to display user-facing alerts or errors.

---

##  Backend (Vercel & Supabase)

- **API Endpoints:** Located in `api/`. These are Vercel Serverless Functions.
- **Supabase Schema:** `supabase/schema.sql` is the primary source of truth for the database schema.
- **RLS:** RLS is **enabled** on all tables. Serverless functions use the `SUPABASE_SERVICE_ROLE_KEY` env var to bypass RLS for admin operations. Browser client uses user JWT which is validated by RLS policies.
- **User ID:** `users.id` = `auth.users.id` (UUID). All data tables reference `users.id` as `user_id`.
- **AI Usage:** The `user_usage` table tracks AI usage counters server-side to prevent client tampering. Users can SELECT their own usage (for UI display) but cannot INSERT/UPDATE via the browser client — only the server can modify counters.
- **Realtime Tables:** Cross-device sync is enabled via Supabase Realtime for `users`, `spaces`, `stacks`, `thoughts`, and `user_usage`. The `syncOrchestrator.setupRealtimeListener(userId)` sets up subscriptions filtered by `user_id`. Tables not in realtime (`feedback`, `payments`) don't need cross-device sync.

#### Database Tables

| Table | RLS | Realtime | Purpose |
|-------|-----|----------|---------|
| `users` | ✅ SELECT/UPDATE own row | ✅ UPDATE only | User profiles and settings |
| `spaces` | ✅ Full CRUD own rows | ✅ All events | Workspace data |
| `stacks` | ✅ Full CRUD own rows | ✅ All events | Collection data |
| `thoughts` | ✅ Full CRUD own rows | ✅ All events | All thought content |
| `user_usage` | ✅ SELECT own row | ✅ All events | AI usage counters |
| `feedback` | ✅ SELECT own row, INSERT own or anonymous | ❌ No | User feedback |
| `payments` | ✅ SELECT own row | ❌ No | Payment records |

#### User Table Protection (CRITICAL)

A trigger `tr_protect_user_columns` on the `users` table prevents users from updating sensitive columns via the browser client.

**Protected Columns:** `plan`, `subscription_status`, `expiry_date`, `is_admin`, `created_at`, `email`, `id`.

**Enforcement:**
- On `INSERT`: Forces defaults (`plan = 'free'`, `is_admin = FALSE`, etc.) unless using `service_role`.
- On `UPDATE`: Reverts changes to these columns unless using `service_role`.

#### Storage Security (CRITICAL)

The `user-files` bucket is **private** (`public: false`). Files are accessed via **signed URLs** instead of public URLs.

**Signed URL Flow:**
1. Client requests signed URL via API endpoint (`api/chat.ts` → `/storage/signed-url`)
2. Server uses `SUPABASE_SERVICE_ROLE_KEY` to generate a signed URL (1-hour expiry)
3. Client renders file from signed URL or local IndexedDB blob
4. Signed URLs are cached in memory to reduce API calls

**IMPORTANT: Never Store Signed URLs in Database**
- Signed URLs expire after 1 hour
- Storing them in `storageUrl` causes "expired JWT" errors when users open files later
- Only store `storagePath` (e.g., `userId/thoughtId/file.ext`) in the database
- Generate fresh signed URLs on-demand using `supabaseStorage.getSignedUrl(storagePath)`

**RLS Policies (still enforced):**
- `Users upload to own folder`: `(storage.foldername(name))[1] = auth.uid()::text`
- `Users update own files`: `(storage.foldername(name))[1] = auth.uid()::text`
- `Users delete own files`: `(storage.foldername(name))[1] = auth.uid()::text`

**Why Signed URLs?**
- Security: Only authenticated users with valid tokens can access files
- Egress control: Private buckets don't generate CDN egress costs
- User isolation: RLS ensures users can only access their own folder (`userId/...`)

**No Public SELECT Policy:** There is no SELECT policy on `storage.objects` — files are accessed via signed URLs which bypass RLS. The Supabase Storage Admin UI file browser won't show files, but the app works correctly.

**Backgrounds Are Local-Only:** Space backgrounds are never uploaded to Supabase Storage. They stay in IndexedDB only, ensuring zero cloud egress for decorative images.

#### Recommendations for Maintenance

1. **Schema Drift**: Always use the `supabase/migrations/` folder for changes. Never modify RLS policies directly in the Supabase Dashboard without updating the SQL files.

2. **New Tables**: If you add a new table, immediately run `ALTER TABLE x ENABLE ROW LEVEL SECURITY;` and add a user_id policy.

3. **Storage Paths**: Always use the `${userId}/...` prefix for any new storage features (e.g., exports, avatars) to ensure the existing RLS policies cover them automatically.

4. **Admin Tools**: If you need a "Super Admin" dashboard, do not add RLS policies for it. Instead, create a dedicated API route that uses the Service Role and validates an `ADMIN_KEY`.

---

##  Rules & Constraints
- **Preserve Conventions:** Adhere to the existing physical-logic and spatial-thinking metaphor of the app.
- **No Direct DOM Manipulation:** Except where strictly necessary for the spatial canvas (using Matrix transforms).
- **Security:** NEVER commit Supabase keys or secrets. Use `import.meta.env.VITE_...` for environment variables.
- **Unused Code:** Be aware that `supabase/functions/` and some scripts in `scripts/` may be legacy or for testing only. Always refer to `api/` for the active backend logic.
- **Delta Sync:** Always ensure `updatedAt` is updated to `Date.now()` on every mutation (create/update/delete) to support incremental Delta Sync logic.
- **User Isolation in IndexedDB:** When querying the database directly (not through Zustand), ALWAYS include `userId` in your filter. Example: `db.thoughts.filter(t => t.userId === currentUserId && !t.deletedAt)`. This prevents data leakage between users.
- **Bulk IndexedDB Deletes:** When deleting user data, ALWAYS use user-scoped deletion: `db.thoughts.where('userId').equals(userId).delete()`. NEVER use `db.thoughts.clear()` as it wipes ALL users' data.
- **SignOut User Isolation:** When signing out, the `signOut()` function in `authSlice.ts` must clean up ALL user-scoped state to prevent data leakage to the next user:
    1. Clear localStorage keys: `cyberia-user`, `cyberia-last-sync`, `cyberia-active-space-id`. Note: Do NOT clear `cyberia-theme` - user's theme preference persists across logout/login.
    2. Clear in-memory Zustand store: `thoughts`, `spaces`, `stacks`, `activeSpaceId`, `transform`, `selectedThoughtIds`, `creatorName`, `customBg`, `theme`.
    3. Apply stored theme from localStorage (not hardcoded `dark`) to `document.body` theme attribute.
    4. Call `createInitialWorkspace()` to provision a fresh guest workspace so the app isn't blank after logout.
    5. Sign out from Supabase: `await supabase.auth.signOut()` (clears session cookie).

### Communication & Language
- Use simple, user-friendly language in all UI text, alerts, and documentation.
- Avoid technical jargon or 'cool' sounding complex terms just because of the app's theme (Cyberia/Kinetic). For example, use 'Saving...' instead of 'Syncing Metadata' and 'Deleting everything' instead of 'Recursive Tombstoning'.
- The goal is to be accessible and friendly, not intimidatingly technical.
