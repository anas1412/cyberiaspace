# Cyberia V11 Blueprint (Current State)

## 1. Project Identity
**Cyberia** is a spatial productivity tool designed for kinetic information architecture. It treats thoughts as physical objects in an infinite workspace, blending physics-driven organization with structured data management.

## 2. Core Physics Engine (The "Vibe")
Driven by a `requestAnimationFrame` loop in `usePhysics.ts` with the following constants:
- **Damping:** 0.8 (Increased friction/Air resistance)
- **Repulsion:** 80,000 (Inverse-square force between nodes)
- **Attraction:** 0.01 (Spring force for shared stacks)
- **Gravity:** 0.003 (Gentle pull toward the center of the viewport)
- **Max Velocity:** 10 (Strict speed limit for stability)
- **Comfort Zone:** 200px (Target distance for stack attraction)
- **Priority Weighting:**
    - `urgent`: 4
    - `high`: 3
    - `medium`: 2
    - `low`: 1
    - `none`: 0

## 3. Data Schema (The `Thought` Model)
Each node in the workspace follows this structure (synced via `Dexie.js` and `Zustand`):
```typescript
interface Thought {
  id: number;
  spaceId: string;
  stackId: string | null;
  x: number;
  y: number;
  vx: number;
  vy: number;
  text: string;
  placeholder: string; // Quirky random title
  description: string;
  type: 'text' | 'tasks' | 'paint' | 'table' | 'image' | 'embed';
  content: string; // Markdown/URL content
  image: string | null; // Base64 or URL
  drawing: string | null; // Base64 from Canvas
  tags: string[]; // Potential for tag-based linking
  status: 'none' | 'todo' | 'doing' | 'done';
  tasks: { text: string; done: boolean }[];
  table: string[][];
  date: string; // YYYY-MM-DD
  priority: 'none' | 'low' | 'medium' | 'high' | 'urgent';
  size: number; // Scale multiplier (default 1.0)
  layer: number; // Z-Index ordinal depth
  order: number; // Sorting order within Kanban/Calendar
}
```

## 4. Multi-Space Management
- **Persistence:** Local-first via IndexedDB (`cyberia-db`).
- **Quota:** 2MB payload safety check before saving large items.
- **Spaces:** Users can create multiple isolated workspaces.
- **Limits:** 
    - **Free:** 3 Spaces, 40 thoughts per space.
    - **Pro:** 10 Spaces, 150 thoughts per space.

## 5. Interaction Patterns
- **Triple-View Morphing:** 
    - **Spatial:** Physics-driven freeform clusters.
    - **Kanban:** Vertical stacks with opacity-based header fading.
    - **Calendar:** "Filing Cabinet" stacking with top-edge clipping.
- **Drag & Drop:** 5px threshold distinguishes "click" from "drag".
- **Paste Logic:** 
    1. Check for `image/gif` (Priority 1).
    2. Any `image/*` (Priority 2).
    3. URL/Embed Meta Fetching (Priority 3).
    4. Text fallback.

## 6. Oracle (AI)
- **Provider:** Gemini (Vercel AI SDK).
- **Features:** Web research, ideation, and workspace organization.
- **Access:** Pro-only feature, integrated via `ChatOverlay`.

## 7. Style & Palette (Master Reference)

### 7.1. Themes
Cyberia supports three core aesthetic modes:
- **Cyberia (Default):** Deep space blue (`#0f172a` to `#020408`).
- **Sakura:** Dark floral pinks (`#1a0f14` to `#0a0508`).
- **Neon:** Cyber-emerald green (`#050a08` to `#020403`).

### 7.2. Visual Standards
- **Font:** 'Plus Jakarta Sans' (Weights: 300-700).
- **Glassmorphism:** `backdrop-filter: blur(24px)` with `rgba(10, 10, 15, 0.85)` surface.
- **Accent:** `#6366f1` (Indigo 500).
- **Z-Index Hierarchy:**
    - `0`: Background Stars/Nebula
    - `20+`: Thoughts (Ordinal based on `layer`)
    - `50`: Kanban Headers
    - `1000`: Currently Dragged Node
    - `9999`: UI Toolbar/Overlays
    - `10001`: Focus Editors (Highest)

### 7.3. Thought Node Architecture (V12)
- **Universal Compactness**: 
    - Padding reduced from `p-6` to `p-4.5`.
    - Gaps reduced to `gap-2`.
    - Border radius tightened to `rounded-3xl` (24px).
- **Embedded Actions**: Link/Unlink button moved to corner `bottom-2.5 right-2.5` with `p-1.5` for zero-footer feel.

### 7.4. Type-Specific Behaviors
- **Text Notes**:
    - **Dynamic Prompt**: "Write Note..." logic depends on connectivity:
        - **Unlinked**: Always visible to encourage capture.
        - **Linked (Stack)**: Hidden by default (`h-0`, `opacity-0`, `overflow-hidden`), revealed on card hover (`group-hover:h-8 group-hover:opacity-100`) via 500ms transition.
    - **Tactile Feedback**: `motion.div` from `framer-motion` provides scale-up (1.05) on hover and scale-down (0.95) on tap.
    - **Compact Logic**: Nodes only maintain `min-h-[80px]` if unlinked OR containing content. Linked empty nodes collapse to absolute labels.

## 8. Precision & Scaling (Coordinate System)
- **Visual Scaling**: Global `0.85` scale applied to `.app-body` for responsive laptop views.
- **Normalization Rule**: All canvas, marquee, and mouse transforms must include a `getGlobalScale()` factor (retrieved from `DOMMatrix` of `.app-body`) to ensure cursor-to-thought alignment. 
- **World Space Compliance**: Spawning and dragging must divide client coordinates by the global scale before applying world-space translation.

## 9. Development Standards
1. **Atomic Components:** Keep components focused (e.g., `ThoughtNode.tsx`).
2. **Logic Isolation:** Physics and math reside in `usePhysics.ts`.
3. **Tailwind First:** Use utility classes; avoid inline styles except for transform math.
4. **Local First:** Always prioritize Dexie/IndexedDB over cloud sync.
5. **Layout Flow**: Avoid `absolute` positioning for elements that clash with status badges; use flex-row clusters for adaptive height.
6. **Embeds:** Always try to fetch dark mode versions of embeds.

## 10. Social Embed Workarounds (CRITICAL)
- **Meta (FB/IG) oEmbed**: DO NOT MODIFY the proxy logic in `api/oembed.ts`. It uses Meta Graph v19.0 with `FB_APP_ID`/`FB_CLIENT_TOKEN` and spoofs `facebookexternalhit` User-Agent to bypass login/scraping walls. 
- **Instagram High-Fidelity**: Uses `ddinstagram.com` as a metadata source in `embeds.ts` for high-quality public previews without login blocks.
- **Regex Guard**: Alphanumeric IDs (e.g., `pfbid...`) are supported; do not revert to numeric-only regex.

