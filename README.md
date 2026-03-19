# 🌌 Cyberia: The Kinetic Mind

> **Thought is a physical object.** Organize your mental landscape in a spatial workspace where ideas have mass, velocity, and gravity.

Cyberia is a next-generation productivity tool designed for non-linear thinkers. It blends a custom physics engine with structured data management to create a "live" information architecture.

![Cyberia Overview](public/screenshot.png)

## ✨ Core Pillars

### 🚀 Kinetic Architecture
Ideas in Cyberia aren't just rows in a database; they are entities in a physics-enabled ecosystem.
- **Natural Clustering**: Thoughts form "Stacks" based on their shared context and physical proximity.
- **Dynamic Interaction**: Drift, repulsion, and spring-attraction forces help organize complex information intuitively.

### 🎭 Multi-Dimensional Views
Context is fluid. Cyberia morphs your data into the shape you need instantly.
- **Spatial Mode**: A free-form playground for brainstorming and visual links.
- **Kanban Mode**: A structured, column-based workflow for task management.
- **Calendar Mode**: A time-oriented "Filing Cabinet" where thoughts stack into elegant decks.

### 🧠 Oracle (AI)
Oracle is your spatial research assistant, integrated directly into the workspace loop.
- **Skeleton Strategy**: Optimized context handling for high-speed reasoning.
- **Deep Investigation**: Oracle can "read" your documents and analyze notes to provide deep insights.
- **Autonomous Actions**: Let the AI help you cluster related thoughts or generate new branches of investigation.

## 🛠️ Tech Stack

- **Frontend**: [React 19](https://react.dev/) + [Vite](https://vitejs.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **State**: [Zustand](https://zustand-demo.pmnd.rs/) (High-performance reactive state)
- **Persistence**: [Dexie.js](https://dexie.org/) (Local-first IndexedDB)
- **Sync Infrastructure**: [Supabase](https://supabase.com/) (PostgreSQL + Storage Buckets) + [Vercel Serverless Functions](https://vercel.com/docs/concepts/functions) (Custom API layer)
- **AI API**: [OpenRouter](https://openrouter.ai/) (Unified access to 300+ AI models)
- **Theming**: [Tailwind CSS](https://tailwindcss.com/) (Advanced glassmorphism & cosmic aesthetics)
- **Motion**: [Framer Motion](https://www.framer.com/motion/)

## 🎯 Features

### Rich Content Types
Create versatile thoughts with multiple formats:
- **Label**: Pure structural markers for map headers and stack titles.
- **Text**: Markdown-supported rich text editing for deep notes.
- **Tasks**: Interactive checklists with real-time status tracking.
- **Tables**: Structured data grids with full editing capabilities.
- **Paint**: SVG-based sketches and diagrams.
- **File**: Images, PDFs, MP3s, and MP4s with automated cloud offloading.
- **Embed**: Interactive players for YouTube, Spotify, and more.

### Distributed Sync Bridge
- **Local-First**: Work offline with zero latency via IndexedDB. All changes are saved locally first.
- **Delta Sync**: Incremental cloud sync via Supabase Realtime for instant cross-device updates.
- **Permanent Sessions**: OAuth Code flow ensures you stay logged in indefinitely without recurring popups.
- **Universal Previews**: Instant local previews for large files while background sync handles cloud upload.
- **Soft Deletes**: Deleted items use tombstone pattern (30-day grace period) for safe cross-device deletion.

##  Data Architecture

Your data lives in three layers:
- **Local (IndexedDB)**: Instant access, full offline support, user-scoped.
- **Cloud (Supabase Postgres)**: Metadata backup and cross-device sync.
- **Media (Supabase Storage)**: Binary assets (images, files) with lazy on-demand loading.

---

### 📥 Getting Started

1. Clone the repository: `git clone https://github.com/anas1412/cyberia.git`
2. Install dependencies: `npm install`
3. Launch the Wired: `npm run dev`

---

*Welcome to the Wired. Optimized for Desktop, Tablet, and Mobile.*
