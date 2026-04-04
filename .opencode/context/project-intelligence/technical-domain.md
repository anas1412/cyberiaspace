<!-- Context: project-intelligence/technical | Priority: critical | Version: 1.0 | Updated: 2026-04-04 -->
# Technical Domain

**Purpose**: Tech stack, architecture, development patterns for Cyberia.
**Last Updated**: 2026-04-04

## Quick Reference
**Update Triggers**: Tech stack changes | New patterns | Architecture decisions
**Audience**: Developers, AI agents

## Primary Stack
| Layer | Technology | Version | Rationale |
|-------|-----------|---------|-----------|
| Framework | React + Vite | 19 | SPA with fast HMR |
| Language | TypeScript | strict | Type safety, interfaces |
| State | Zustand | slice-based | Modular, no boilerplate |
| Local DB | IndexedDB (Dexie) | v20 | Offline-first persistence |
| Cloud | Supabase | BaaS | Sync, auth, storage |
| Styling | Tailwind + CSS Variables | — | Theme system, glass morphism |
| Physics | Custom engine + framer-motion | — | Spatial canvas, springs |
| Backend | Vercel Serverless | api/ | Hobby tier, 12 functions max |

## Code Patterns

### Three-Layer Write Flow (MANDATORY)
```
User Action → Zustand (source of truth) → IndexedDB → Supabase (background)
```

### API Endpoint (Vercel Serverless)
```typescript
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { message, rating } = req.body;
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}
```

### Component Pattern
```tsx
const ThoughtNode: React.FC<ThoughtNodeProps> = React.memo(({ thought }) => {
  const isSelected = useStore((state) => state.selectedThoughtId === thought.id);
  const config = useMemo(() => getThoughtConfig(thought.type), [thought.type]);
  return <div className="thought-bulb absolute will-change-transform">{/* ... */}</div>;
});
```

## Naming Conventions
| Type | Convention | Example |
|------|-----------|---------|
| Files | PascalCase (components), camelCase (utils) | `ThoughtNode.tsx`, `usePhysics.ts` |
| Components | PascalCase | `ThoughtNode`, `BackgroundEngine` |
| Hooks | `use` prefix + camelCase | `useCamera.ts`, `useViewportGestures.ts` |
| Functions | camelCase | `mergeThoughts`, `sanitizeStatus` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_THOUGHTS_PER_STACK` |
| Database | camelCase (IndexedDB), snake_case (Supabase) | `thoughts`, `updated_at` |
| Types | PascalCase | `Thought`, `ThoughtPayload` |

## Code Standards
- Zustand slice-based state management (source of truth for UI)
- IndexedDB for local persistence, NOT for UI reads during active sessions
- ULID for all entity IDs (no auto-increment, no `parseInt`)
- `updatedAt: Date.now()` on every mutation for LWW conflict resolution
- Editing session registry prevents sync from overwriting active edits
- `React.memo` + granular selectors for performance
- CSS variables for ALL colors (no hardcoded values)
- Two-theme architecture only (dark/light)
- Boundary translation: camelCase ↔ snake_case

## Security Requirements
- User isolation in IndexedDB: ALWAYS filter by `userId`
- Never commit secrets (use `import.meta.env.VITE_...`)
- Guest data never marked `syncStatus: 'local'`
- Sign-out cleans ALL user-scoped state
- Input sanitization for status/priority fields
- 2MB payload limit on thoughts

## 📂 Codebase References
**State Management**: `src/store/slices/thoughtSlice.ts` - Three-layer write flow
**Type Registry**: `src/components/thought/registry.ts` - Modular thought types
**Physics Engine**: `src/hooks/usePhysics.ts` - Spatial/kanban/calendar strategies
**Sync Orchestrator**: `src/services/sync/syncOrchestrator.ts` - Delta sync, editing registry
**Database Schema**: `src/db.ts` - Dexie v20, ULIDs, Thought interface
**API Layer**: `api/` - Vercel serverless functions

## Related Files
- Code Quality: `.opencode/context/core/standards/code-quality.md`
- UI Components: `.opencode/context/core/standards/ui-components.md`
- State Mutations: `.opencode/context/core/processes/state-mutations.md`
