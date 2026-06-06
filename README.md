# Cyberia

A spatial-thinking workspace where ideas exist as physical objects — positioned, connected, and organized on an infinite canvas augmented by a custom physics engine.

![Cyberia Preview](public/preview.png)

---

## Overview

Cyberia is a local-first productivity application designed for non-linear thinkers. It combines a real-time physics simulation with structured data management, allowing information to be arranged spatially, grouped into stacks, filtered by view mode, and augmented by an integrated AI assistant.

The workspace supports four view modes — **Spatial**, **Kanban**, **Calendar**, and **Directory** — each transforming the same data into a different organizational metaphor without duplication. All content is stored locally in IndexedDB with optional cloud synchronization via Supabase for cross-device access.

---

## Architecture

### Three-Layer Data Flow

Data flows through three layers with strict ordering:

```
UI (React) ──reads──> Zustand Store ──persists──> IndexedDB ──syncs──> Supabase
                           ^                          ^
                           │                          │
                     Source of Truth            Write-Behind Cache
                     for all UI state           for offline resilience
```

1. **Zustand** — In-memory state store. All UI components read from and write to Zustand. It is the single source of truth during active sessions.
2. **IndexedDB (Dexie)** — Persistent local database. Written to after every Zustand mutation. Used for app hydration on load and offline access.
3. **Supabase** — Cloud PostgreSQL + Storage. Synchronized incrementally via delta sync. Private file buckets are accessed through on-demand signed URLs.

### Key Design Decisions

- **Local-first**: All operations work offline. Cloud sync is optional and non-blocking.
- **Delta sync**: Only changed records are pushed and pulled. Conflict resolution uses Last-Write-Wins based on `updatedAt`.
- **Physics engine**: A custom 2D engine manages thought positions, velocities, repulsion, and stack cohesion. Mode-specific layout strategies (spatial, kanban, calendar) transform the same data into different visual arrangements.
- **Editing session registry**: Active edits are protected from sync overwrites. IndexedDB writes are debounced during typing to avoid save storms.
- **Soft deletes**: Removed entities set a `deletedAt` tombstone. Local records are purged only after cloud acknowledgment.
- **ULID identifiers**: All entities use ULIDs for collision-free multi-device operation and temporal sortability.
- **Private file storage**: The storage bucket is private. Files are served via expiring signed URLs (1 hour) generated on-demand.

---

## Features

### Workspace Modes

| Mode | Description |
|------|-------------|
| **Spatial** | Free-form canvas. Thoughts drift, repel, and stack via physics simulation. |
| **Kanban** | Column-based layout for task and workflow management. |
| **Calendar** | Time-aligned grid where thoughts are organized by date. |
| **Directory** | Searchable list/table view with filtering and sorting. |

### Content Types

Eight thought types, each with a dedicated renderer and focus editor:

- **Label** — Lightweight headers and structural markers
- **Text** — Rich Markdown editing with live preview
- **Task** — Interactive checklists with progress tracking
- **Table** — Editable data grids with row/column management
- **Paint** — SVG-based sketching and diagrams
- **File** — Image, PDF, audio, and video uploads with thumbnail previews
- **Embed** — YouTube, Spotify, and other oEmbed players
- **Image** (legacy) — Unified under File type

### AI Assistant (Oracle)

Oracle is an integrated AI agent with two modes:

- **Chat mode** — Read-only research assistant. Can search the web, read files, and analyze content.
- **Action mode** — Full workspace access. Can create, modify, and organize thoughts and stacks autonomously.

Uses OpenRouter for access to 300+ models and Tavily for web search.

### Data Synchronization

- **Local-first**: Instant writes to IndexedDB. No network dependency for basic operations.
- **Supabase Realtime**: Cross-device updates propagate via WebSocket subscriptions.
- **Offline queue**: Changes made offline are queued and flushed when connectivity returns.
- **File sync**: Binary assets upload asynchronously. Local blobs are prioritized for rendering.

### Customization

- **Dark and Light themes** with persistent preference across sessions
- **Custom accent colors** — primary, secondary, and node background colors are configurable
- **Node-level background color** override for visual differentiation

---

## Tech Stack

| Category | Technology |
|----------|-----------|
| Framework | React 19, TypeScript 5.9 |
| Build | Vite 7 |
| State | Zustand 5 |
| Local DB | Dexie.js 4 (IndexedDB) |
| Cloud | Supabase (PostgreSQL, Storage, Realtime) |
| Backend | Vercel Serverless Functions (Node) |
| Styling | Tailwind CSS 4, CSS custom properties |
| Animation | Framer Motion 12 |
| AI | OpenRouter SDK |
| Payments | Polar SDK, Flouci |
| Icons | Lucide React |
| ID Generation | ULID |
| PWA | vite-plugin-pwa |
| i18n | i18next |

---

## Getting Started

```bash
git clone https://github.com/anas1412/cyberia.git
cd cyberia
npm install
npm run dev
```

The development server starts at `http://localhost:5173`. API routes are proxied to `http://localhost:3000`.

### Build

```bash
npm run build    # TypeScript check + Vite production build
```

### Configuration

Required environment variables (see `.env.example`):

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `VITE_OPENROUTER_API_KEY` | OpenRouter API key for Oracle AI |

---

## Project Structure

```
src/
├── components/       # React components (Viewport, ThoughtNode, Toolbar, editors, overlays)
├── store/            # Zustand slices (thought, space, stack, canvas, auth, sync, etc.)
├── services/         # Supabase client, sync orchestrator, storage, Oracle executor
├── hooks/            # Physics engine, camera, viewport gestures, layout strategies
├── utils/            # File helpers, date utils, embeds, migrations
├── types/            # Zod schemas for API validation
├── locales/          # i18n translations (en, fr)
├── tests/            # Vitest test suites
└── db.ts             # Dexie schema definition

api/                  # Vercel serverless functions (chat, admin, feedback, payments, etc.)
supabase/             # SQL schema and migrations
docs/                 # Architecture, data flow, physics engine documentation
```

---

## Documentation

- [Architecture](docs/architecture.md) — Three-layer data architecture
- [Data Flow](docs/data-flow-audit.md) — Write, load, and sync flow details
- [Physics Engine](docs/physics-engine.md) — Spatial engine principles and layout strategies
- [Design System](docs/design-system.md) — Component and styling reference

---

## License

Proprietary. All rights reserved.
