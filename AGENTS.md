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

##  Core Architecture

###  Data Flow & Synchronization
1.  **Local First:** All user data (Spaces, Thoughts, Stacks) is stored in **IndexedDB** using **Dexie**. This ensures offline functionality and low latency.
2.  **Cloud Sync:** Synchronization with Supabase is managed by `src/services/sync/syncOrchestrator.ts`.
3.  **Backend Services:**
    *   **Vercel Serverless Functions:** Primary API layer located in `api/` (e.g., `api/feedback.ts`, `api/publish.ts`), keep in mind that we are using hobby ter 12 functions max. These are the source of truth for custom backend functionality.
    *   **Supabase:** Acts as a "Backend-as-a-Service" (BaaS) for:
        *   **PostgreSQL Database:** Cloud storage for synced Dexie data.
        *   **Storage (Buckets):** Storage for binary assets like images and files.
    *   **Note:** Supabase Edge Functions (`supabase/functions/`) are deprecated/unused in favor of Vercel functions.

###  Spatial Thinking Engine
- Thoughts are not just static entries; they are physical entities with `x, y` (position) and `vx, vy` (velocity) properties.
- The canvas uses a custom physics engine for interactions, including "stacks" where nodes orbit each other.
- **Canvas Scaling:** Managed via `DOMMatrix` transforms. Avoid direct DOM manipulation for the canvas; use the `useStore` transform state.

###  State Management (Zustand)
Split into specific stores to prevent massive re-renders:
- `useStore`: Core application state (thoughts, spaces, stacks, canvas transform).
- `useModalStore`: UI-wide modal and alert management.
- `useAuthStore`: User profile, authentication state, and sync status.

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

###  TypeScript & Typing
- **Strict Mode:** TypeScript is configured in strict mode. Avoid `any` where possible.
- **Interfaces:** Prefer `interface` over `type` for data structures.
- **Location:** Core entity types (Space, Thought, Stack) are defined in `src/db.ts`.

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

---

##  Rules & Constraints
- **Preserve Conventions:** Adhere to the existing physical-logic and spatial-thinking metaphor of the app.
- **No Direct DOM Manipulation:** Except where strictly necessary for the spatial canvas (using Matrix transforms).
- **Security:** NEVER commit Supabase keys or secrets. Use `import.meta.env.VITE_...` for environment variables.
- **Unused Code:** Be aware that `supabase/functions/` and some scripts in `scripts/` may be legacy or for testing only. Always refer to `api/` for the active backend logic.
