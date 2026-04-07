<!-- Context: navigation | Priority: critical | Version: 1.0 | Updated: 2026-04-03 -->
# OpenCode Context Navigation

**Purpose**: Index of all context files for this project.

---

## Quick Routes

| Category | File | Purpose | Priority |
|----------|------|---------|----------|
| Standards | `core/standards/code-quality.md` | Critical patterns (stale state, 3-layer write, etc.) | critical |
| Standards | `core/standards/ui-components.md` | CSS variables, typography, glass patterns | high |
| Standards | `core/standards/supabase-security.md` | RLS policies, API auth, user_usage, realtime | critical |
| Processes | `core/processes/state-mutations.md` | Decision trees for store operations | high |
| Intelligence | `project-intelligence/technical-domain.md` | Tech stack, architecture, coding patterns | critical |

---

## Deep Dives

### Standards (`core/standards/`)

| File | What It Covers |
|------|----------------|
| `code-quality.md` | Zustand/IndexedDB patterns, user isolation, ULIDs, editing registry |
| `ui-components.md` | CSS variables, glass containers, typography scale, overlay patterns |
| `supabase-security.md` | RLS policies, API auth patterns, user_usage, realtime tables |

### Processes (`core/processes/`)

| File | What It Covers |
|------|----------------|
| `state-mutations.md` | Stack limits, choosing update functions, sync triggers, editing registry |

### Project Intelligence (`project-intelligence/`)

| File | What It Covers |
|------|----------------|
| `technical-domain.md` | Tech stack, API patterns, component style, naming, standards, security |

---

## Context Loading Order

When executing code tasks, load context in this order:

1. **`.opencode/context/core/standards/code-quality.md`** - ALWAYS load first for code tasks
2. **`.opencode/context/core/processes/state-mutations.md`** - For store/DB operations
3. **`AGENTS.md`** - Project-specific architecture and conventions

---

## Adding New Context Files

1. Create file in appropriate subdirectory
2. Add HTML frontmatter with metadata
3. Keep under 200 lines (MVI compliance)
4. Include "📂 Codebase References" section
5. Update this navigation.md

---

## Version History

| File | Version | Updated |
|------|---------|---------|
| `core/standards/code-quality.md` | 1.0 | 2026-04-03 |
| `core/standards/ui-components.md` | 1.0 | 2026-04-03 |
| `core/standards/supabase-security.md` | 1.0 | 2026-04-07 |
| `core/processes/state-mutations.md` | 1.0 | 2026-04-03 |
| `project-intelligence/technical-domain.md` | 1.0 | 2026-04-04 |
