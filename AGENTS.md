# Agent Guidelines: Cyberia Project

Welcome to the Cyberia codebase! This project is a modern, high-performance spatial-thinking tool built with React 19, TypeScript, and Vite. It utilizes IndexedDB for local persistence (via Dexie) and Supabase for cloud synchronization.

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


- **handlePostAuthSync:** Not deprecated. It remains as part of the auth flow for initial hydration; must be awaited during `init()` on fresh logins to ensure cloud data resolution before the loading screen fades.
- **isLocalWorkspaceEmpty:** Standard utility to distinguish between fresh devices (overwrite) and guest sessions (merge).
- **Synchronized Tombstones:** Standardized on using `timestamp = Date.now()` for both `updatedAt` and `deletedAt` within transactions to ensure atomic cloud reconciliation.

##  Core Architecture

###  Data Flow & Synchronization
1.  **Local First:** All user data (Spaces, Thoughts, Stacks) is stored in **IndexedDB** using **Dexie**. This ensures offline functionality and low latency.
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

###  Spatial Thinking Engine
- Thoughts are not just static entries; they are physical entities with `x, y` (position) and `vx, vy` (velocity) properties.
- The canvas uses a custom physics engine for interactions, including "stacks" where nodes orbit each other.
- **Performance Optimization:** 
    *   **Frame Pre-Processor:** Collision detection and spatial indexing use an optimized $O(N^2)$ pre-processor to manage entity interactions without jitter.
    *   **Selfish Selectors:** React components use highly granular "selfish selectors" to minimize re-renders, ensuring only the specific properties needed by a component (e.g., just `x` and `y`) trigger updates.
- **Physics Architecture:** Detailed principles regarding Top-Left Anchoring, DOM Synchronization, and Persistence are documented in [docs/physics-engine.md](./docs/physics-engine.md).
- **Canvas Scaling:** Managed via `DOMMatrix` transforms. Avoid direct DOM manipulation for the canvas; use the `useStore` transform state.

###  Storage
- **Unique Folder Protocol:** To prevent filename collisions and ensure clean user isolation, all file assets in cloud storage are organized using the path structure: `${userId}/${thoughtId}/${fileName}`.
- **Lazy Loading / On-Demand:** To minimize egress, the application uses an on-demand strategy where thoughts and assets are only "woken" (downloaded) into local IndexedDB when a space is opened by the user.


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
- **Entity Types:** The `image` thought type is deprecated. Use `type: 'file'` for all image assets to ensure consistent handling and storage.
- **Onboarding:** Generating initial thoughts, stacks, or multiple spaces for new users is deprecated. Use `createInitialWorkspace` to provide a single, empty "Workspace" for a pure start. The `isOnboarding: true` flag is deprecated for general space use and only remains for the `Homepage` live demo.
- **Conflict Resolution:** The "Local vs Cloud" choice screen is deprecated. All synchronization conflicts must be resolved automatically using **Last-Write-Wins (LWW)** logic based on the `updatedAt` field.

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

###  Styling
- **Tailwind CSS:** Primary styling method. Use utility classes directly in `className`.
- **Themes:** Supported themes include `cyberia`, `sea`, `forest`, and `rain`, toggled via `data-theme` on `document.body`.

---

##  Backend (Vercel & Supabase)
- **API Endpoints:** Located in `api/`. These are Vercel Serverless Functions.
- **Supabase Schema:** `supabase/schema.sql` is the primary source of truth for the database schema.
- **RLS:** RLS is is disabled for the supabase database

---

##  Rules & Constraints
- **Preserve Conventions:** Adhere to the existing physical-logic and spatial-thinking metaphor of the app.
- **No Direct DOM Manipulation:** Except where strictly necessary for the spatial canvas (using Matrix transforms).
- **Security:** NEVER commit Supabase keys or secrets. Use `import.meta.env.VITE_...` for environment variables.
- **Unused Code:** Be aware that `supabase/functions/` and some scripts in `scripts/` may be legacy or for testing only. Always refer to `api/` for the active backend logic.
- **Delta Sync:** Always ensure `updatedAt` is updated to `Date.now()` on every mutation (create/update/delete) to support incremental Delta Sync logic.

### Communication & Language
- Use simple, user-friendly language in all UI text, alerts, and documentation.
- Avoid technical jargon or 'cool' sounding complex terms just because of the app's theme (Cyberia/Kinetic). For example, use 'Saving...' instead of 'Syncing Metadata' and 'Deleting everything' instead of 'Recursive Tombstoning'.
- The goal is to be accessible and friendly, not intimidatingly technical.
