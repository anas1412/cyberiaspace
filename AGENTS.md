# Agent Guidelines: Cyberia Project

Welcome to the **Cyberia** codebase! This is a modern, high-performance **visual thinking** tool built with React 19, TypeScript, and Vite. It is fully **local-first** (IndexedDB via Dexie), **open source** (MIT), and deploys as a static SPA on Vercel with a minimal serverless API layer.

---

##  Commands

### Build & Lint
- **Build:** `bun run build` (Runs TypeScript type-checking followed by Vite build)
- **Lint:** `bun run lint` (Uses ESLint with TypeScript and React Refresh rules)
- **Dev:** `bun run dev` (Starts the Vite development server)
- **Add package:** `bun add <package>`

### Testing
- No standard test suite (Jest/Vitest) is currently configured.
- When adding new functionality, it's highly recommended to add self-verifying logic or console logs since there is no automated test harness.

---

##  Architecture Overview

### Storage Layer (No Cloud Sync)

The app uses a **simplified local-first architecture**. There is no cloud sync, no authentication, and no remote database:

| Layer | Role |
|-------|------|
| **Zustand** | Source of Truth for all UI state |
| **IndexedDB (Dexie)** | Local persistence — read on load, written after Zustand updates |

**Write Flow:**
```
User Action → 1. Update Zustand (source of truth) → 2. Persist to IndexedDB
```

**Read Flow:**
- On app load: Read from IndexedDB, hydrate Zustand, then render
- During session: Components read ONLY from Zustand

### Blobs/Files
Files (binary data) are stored directly in IndexedDB, never in Zustand. Metadata goes to Zustand.

```
await db.blobs.put({ id, blob, thoughtId, userId });  // Blob to IndexedDB
await updateThought(id, { text: file.name, data: {...} });  // Metadata to Zustand
```

### Key Anti-Patterns (BLOCKING)
```typescript
// ❌ NEVER: Direct IndexedDB write without Zustand update
await db.thoughts.update(id, { name: 'new' });
// UI won't update!

// ❌ NEVER: Reading from IndexedDB for UI state
const thoughts = await db.thoughts.toArray(); // Don't do this for rendering!
```

### IndexedDB is User-Scoped (CRITICAL)
IndexedDB stores data for ALL users in a single database. You MUST always filter by `userId` when querying `db.thoughts`, `db.stacks`, or `db.spaces` directly. Use `'guest'` as the default userId.

### Synchronized Tombstones
Deletion follows a soft-delete pattern using the `deletedAt` timestamp. Direct `db.delete()` is FORBIDDEN for entities — always use `deletedAt` + `updatedAt`.

---

##  State Management (Zustand)

The application uses a modular, slice-based architecture:

- **Main Store (`useStore.ts`):** Composed of slices in `src/store/slices/`:
  - `canvasSlice`: Spatial transforms and lightbox.
  - `thoughtSlice`: Entity CRUD, selection, and layering logic.
  - `spaceSlice`: Space management.
  - `stackSlice`: Collection/linking logic.
  - `historySlice`: Undo/Redo state and logic.
  - `dataSlice`: Initialization and data import/export.
  - `uiSlice`: Themes and interface search/filters.
- **Modal Store (`useModalStore.ts`):** UI-wide modal and alert management.

**CRITICAL: Always Get Fresh State**

When a store function calls another store function, always call `get()` fresh rather than using destructured variables from the outer scope. This prevents stale state bugs:

```typescript
// WRONG — stale state bug
unlinkSelectedThoughts: async () => {
  const { thoughts } = get();
  // ...updates Zustand...
  await get().cleanupStacks(); // cleanupStacks won't see the updates
}

cleanupStacks: async () => {
  const { thoughts } = get(); // Gets stale state!
}

// CORRECT
cleanupStacks: async () => {
  const currentThoughts = get().thoughts; // Fresh state
}
```

### Undo/Redo (historySlice)
- Stores snapshots of `thoughts` array (up to 50 entries)
- Uses `JSON.stringify` dedup to skip duplicate snapshots
- `updateThought` calls `pushHistory()` for non-position changes (dragging doesn't pollute history)
- Ctrl+Z / Ctrl+Y global keyboard shortcuts in Viewport

---

##  AI Chat (Cyberia AI)

- **Location:** `src/components/ChatOverlay.tsx`
- **AI Service:** `src/services/ai/` (executor, prompts, toolParser)
- **Model list:** Fetched live from `GET https://openrouter.ai/api/v1/models` using the user's API key
- **Tool-calling filter:** Only models with `"tools"` in `supported_parameters` are shown (hard filter)
- **Model pricing:** Displayed as $X input / $Y output per 1M tokens
- **Multi-conversation support:** Conversations stored in Dexie (`chatConversations` table), auto-named from first user message
- **System prompt:** Instructs the AI to never show internal thought IDs to users

### LocalStorage Keys
| Key | Purpose |
|-----|---------|
| `cyberia-ai-model` | Selected AI model |
| `cyberia-models-url` | Override URL for model list (power user feature) |

---

##  Spatial Engine

- Thoughts are physical entities with `x, y` (position) and `vx, vy` (velocity) properties.
- Custom physics engine for interactions, including "stacks" where nodes orbit each other.
- **Loading State Guard:** The physics loop pauses while `isSpaceLoading === true` to prevent position collapse.
- **Mode Transition Animations:** 500ms transition period with faster lerp speed (0.25 vs normal 0.08) when switching between Spatial/Kanban/Calendar modes.
- **Ghost Thought Fix:** Thoughts at position (0,0) are hidden in non-spatial modes until layout calculates their position.
- **Position Persistence:** Positions saved to IndexedDB on mode/space switch, restored on re-entry.
- **Canvas Scaling:** Managed via `DOMMatrix` transforms.
- **Smooth Camera System (`useCamera.ts`):** Decoupled from React render cycle via `framer-motion` springs.
- **Performance:** React components use highly granular "selfish selectors" to minimize re-renders.

---

##  Database (Dexie)

- **Version 21** — Current schema
- **Tables:** `spaces`, `thoughts`, `stacks`, `blobs`, `chatHistory`, `spaceBackgrounds`, `chatConversations`
- **Entity types (`src/db.ts`):** `Space`, `Thought`, `Stack`, `ChatMessage`, `ChatConversation`, `LocalBlob`, `SpaceBackground`
- **Thought types:** `'label' | 'text' | 'tasks' | 'paint' | 'table' | 'embed' | 'file'`
- **Primary IDs:** All entities use **ULIDs** (string-based, universally unique, lexicographically sortable)
- **Soft delete:** Uses `deletedAt` timestamp on Space, Stack, Thought

---

##  Backend (Vercel Serverless)

The only API endpoint is `api/utils.ts` with these actions:

| Action | Endpoint | Purpose | Requires Env Var |
|--------|----------|---------|-----------------|
| `metadata` | `?action=metadata&url=...` | Scrapes page metadata (title, description, image) | None |
| `oembed` | `?action=oembed&url=...` | Proxies oEmbed requests (Spotify, Twitter, etc.) | `FB_APP_ID` + `FB_CLIENT_TOKEN` (optional, for Facebook/Instagram) |
| `proxy-video` | `?action=proxy-video&url=...` | Proxies video content | None |
| `youtube-search` | `?action=youtube-search&q=...` | YouTube video search | `YOUTUBE_API_KEY` |

No authentication, auth stores, or Supabase integration exists. The app is fully local-first.

---

##  Design System & UI Guidelines

### Typography Scale
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

### Theme System (Two-Theme Architecture)

Only `dark` and `light` themes are supported. Stored in localStorage as `cyberia-theme`. Theme persists across sessions.

**CSS Variable Usage (MANDATORY):**

| Variable | Dark Theme | Light Theme | Usage |
|----------|------------|-------------|-------|
| `--bg-page` | `#05060a` | `#e2e8f0` | Page background |
| `--bg-main` | `#18181b` | `#ffffff` | Card/main backgrounds |
| `--node-bg` | `#12121af5` | `#f8fafc` | Thought nodes |
| `--node-text-primary` | `#f8fafc` | `#0f172a` | Text in thought nodes |
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

**NEVER use hardcoded colors — ALWAYS use CSS variables.**

### Component Sizing Standards

**Toolbar Components (44px height):**
- StatusBar, ViewSwitcher, SpaceSwitcher, AccountMenu, SystemTray: `h-[44px]`

**Buttons:**
- Height: `h-full`, Padding: `px-3`, Border radius: `rounded-xl`
- Active: `bg-[var(--bg-page)] shadow-md`, Inactive: `text-[var(--text-muted)] hover:text-[var(--text-primary)]`

### Overlay Backdrop Pattern
```tsx
<div className="fixed inset-0 bg-[var(--bg-page)]/60 backdrop-blur-md z-[N]">
```
Never use `bg-black/80` or hardcoded colors in overlays.

### Dropdown/Menu Patterns
- Container: `bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl`
- Active item: `bg-[var(--accent)]/10 text-[var(--accent)]`
- Hover: `hover:bg-[var(--glass-bg)]`

### Customization (Node Color, Accent, Secondary)
All stored in localStorage and applied via CSS variables on `document.documentElement` with `!important`. Theme-agnostic.

---

##  Code Style & Guidelines

### Imports
1. React and third-party libraries
2. Local stores (`./store/...`)
3. Services and Utils (`./services/...`, `./utils/...`)
4. Components (`./components/...`)
5. Types and constants (`./db`, `./constants`)
6. Styles (`./index.css`)

### TypeScript
- Strict mode enabled. Avoid `any`.
- Core entity types in `src/db.ts`. Store interfaces in `src/store/types.ts`.

### Naming
- Components: `PascalCase`, Functions/Variables: `camelCase`, Constants: `SCREAMING_SNAKE_CASE`
- Hooks: Prefix with `use`

### React Patterns
- Hooks at the top of functional components.
- Use `tailwind-merge` and `clsx` for complex Tailwind classes.
- Use `useRef` for values that don't trigger re-renders.

### Error Handling
- Async operations: `try/catch` with `console.error`.
- User-facing alerts: `useModalStore.getState().openModal()`.

---

##  Rules & Constraints

- **No Direct DOM Manipulation:** Except for the spatial canvas (DOMMatrix transforms, physics loop).
- **Security:** Never commit API keys. Use `import.meta.env.VITE_...` for environment variables.
- **User Isolation:** Always filter IndexedDB queries by `userId`. Never use `db.table.clear()`.
- **AI IDs:** Internal entity IDs must never be shown to users in AI responses.
- **Soft Delete:** Use `deletedAt` + `updatedAt` pattern. Never call `db.delete()` directly on synced entities.
- **PWA Install:** Install button shown in SystemTray via `deferredPrompt`. No "Open in app" button exists.
- **Mobile:** Desktop-only. `MobilePage.tsx` gates mobile users with a "Desktop Required" message.

### Branding
- "visual thinking" not "spatial thinking"
- "Cyberia" or "Cyberia Space" not "Cyberia AI" (the AI feature is "Cyberia AI")
- User-facing text should avoid technical jargon (use "Saving..." not "Syncing Metadata")

