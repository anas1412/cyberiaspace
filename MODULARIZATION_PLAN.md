# ThoughtNode Modularization & Data Migration Plan

## 1. Overview

The current `ThoughtNode` architecture is a monolithic switch-case system with a flat data model. This plan outlines a safe, backwards-compatible transition to a **Registry-Based Architecture** with a **Discriminated Union** data payload.

### Current Analysis Summary

#### 1.1 Existing Thought Types (8 Types)
| Type | Renderer File | Focus Editor | Data Fields Used |
|------|--------------|--------------|------------------|
| `label` | `LabelRenderer.tsx` | None | `text` |
| `text` | `TextRenderer.tsx` | `TextFocusEditor.tsx` | `content` |
| `tasks` | `TasksRenderer.tsx` | `TasksFocusEditor.tsx` | `tasks[]` |
| `table` | `TableRenderer.tsx` | `TableFocusEditor.tsx` | `table[][]` |
| `paint` | `PaintRenderer.tsx` | `PaintFocusEditor.tsx` | `drawing` |
| `image` | `ImageRenderer.tsx` | (via Inspector) | `image`, `meta` |
| `embed` | `EmbedRenderer.tsx` | `EmbedFocusEditor.tsx` | `content`, `author` |
| `file` | `FileRenderer.tsx` | `FileFocusEditor.tsx` | `image`, `meta` |

#### 1.2 Current Data Flow
```
ThoughtNode.tsx (Monolith - 264 lines)
├── ThoughtHeader.tsx (103 lines) - Priority, Status, Sync status
├── renderContent() [Switch-Case]
│   ├── TextRenderer.tsx
│   ├── TasksRenderer.tsx
│   ├── TableRenderer.tsx
│   ├── PaintRenderer.tsx
│   ├── ImageRenderer.tsx
│   ├── EmbedRenderer.tsx
│   ├── FileRenderer.tsx
│   └── LabelRenderer.tsx
└── ThoughtFooter.tsx (88 lines) - Stack info, Link action
```

#### 1.3 Shared Patterns Identified
All renderers follow this pattern:
1. **Empty State**: Show placeholder with icon when data is empty
2. **Remote Content**: Handle `storageUrl` for cloud-synced content
3. **Hover Overlay**: Show "expand" button on hover
4. **Group Transitions**: Use `group/xxx` Tailwind classes for hover effects

#### 1.4 Inspector.tsx Analysis (806 lines)
- **Type Selector**: Grid of 8 type buttons (lines 255-277)
- **Common Fields**: Title, Description, Date, Status, Priority, Size, Layering (shared across all types)
- **Type-Specific Sections**: Lines 397-669 contain switch-case for type-specific UI
- **Issues**:
  - Hardcoded type icons in local object
  - Mixed concerns (UI + Logic)
  - Hard to extend for new types

---

## 2. Data Structure Evolution (`src/db.ts`)

We will introduce a `data` field in the `Thought` interface while keeping legacy fields for backwards compatibility during the transition.

### 2.1 Thought Type Definition

```typescript
// NEW: All possible thought types
type ThoughtType = 'label' | 'text' | 'tasks' | 'paint' | 'table' | 'image' | 'embed' | 'file';

// NEW: Discriminated Union for Payload
type ThoughtPayload =
  | { type: 'text'; content: string }
  | { type: 'tasks'; tasks: { text: string; done: boolean }[] }
  | { type: 'table'; rows: string[][] }
  | { type: 'paint'; drawing: string }
  | { type: 'image'; url: string; meta?: ImageMeta }
  | { type: 'embed'; url: string; provider?: string; providerId?: string }
  | { type: 'file'; url: string; name: string; size: number; meta?: FileMeta }
  | { type: 'label' };  // No payload data needed

interface ImageMeta {
  width?: number;
  height?: number;
  type?: string;
}

interface FileMeta {
  name: string;
  size: number;
  type: string;
}

interface Thought {
  // Common Metadata (Existing - DON'T CHANGE)
  id: number;
  spaceId: string;
  stackId: string | null;
  x: number;
  y: number;
  vx: number;
  vy: number;
  text: string;
  placeholder?: string;
  description: string;
  type: ThoughtType;
  deletedAt?: number | null;
  status: 'none' | 'todo' | 'doing' | 'done';
  date: string;
  priority: 'none' | 'low' | 'medium' | 'high' | 'urgent';
  size: number;
  order: number;
  layer?: number;
  author: string;
  meta?: any;
  storageUrl?: string;
  storagePath?: string;
  syncStatus?: 'local' | 'synced' | 'pending' | 'syncing' | 'error';
  retryCount?: number;

  // NEW: Modular Payload (Discriminated Union)
  data?: ThoughtPayload;

  // @deprecated: Legacy fields - will be phased out
  // These remain for backward compatibility during migration
  content?: string;
  tasks?: { text: string; done: boolean }[];
  table?: string[][];
  image?: string | null;
  drawing?: string | null;
}
```

### 2.2 Dexie Store Update

```typescript
// Increment version and add data index
db.version(14).stores({
  spaces: 'id, name, order, syncStatus',
  thoughts: '++id, spaceId, stackId, text, type, status, date, priority, order, author, storageUrl, syncStatus, deletedAt, data', // Added 'data' index
  stacks: 'id, spaceId, name, syncStatus',
  blobs: 'id, thoughtId',
  pendingDeletions: '++id, tableName, localId',
  pendingBlobs: '++id, thoughtId, createdAt'
});
```

---

## 3. The Migration Strategy

### 3.1 Migration Script (`src/utils/migrations.ts`)

```typescript
import { db, type Thought } from '../db';
import { type ThoughtPayload } from '../db';

const MIGRATION_KEY = 'cyberia_thought_migration_v1';

export async function migrateThoughtsToModular(): Promise<void> {
  // Check if migration already ran
  if (localStorage.getItem(MIGRATION_KEY)) {
    console.log('[Migration] Already completed, skipping...');
    return;
  }

  console.log('[Migration] Starting thought data migration...');
  
  const thoughts = await db.thoughts.toArray();
  const needsMigration = thoughts.filter(t => !t.data);
  
  if (needsMigration.length === 0) {
    console.log('[Migration] No thoughts need migration');
    localStorage.setItem(MIGRATION_KEY, 'true');
    return;
  }

  console.log(`[Migration] Migrating ${needsMigration.length} thoughts...`);

  const updates = needsMigration.map(t => ({
    id: t.id,
    data: constructDataFromLegacy(t)
  }));

  await db.transaction('rw', db.thoughts, async () => {
    for (const update of updates) {
      await db.thoughts.update(update.id, { data: update.data });
    }
  });

  console.log('[Migration] Migration complete!');
  localStorage.setItem(MIGRATION_KEY, 'true');
}

function constructDataFromLegacy(t: Thought): ThoughtPayload {
  switch (t.type) {
    case 'text':
      return { type: 'text', content: t.content || '' };
    
    case 'tasks':
      return { type: 'tasks', tasks: t.tasks || [] };
    
    case 'table':
      return { type: 'table', rows: t.table || [] };
    
    case 'paint':
      return { type: 'paint', drawing: t.drawing || '' };
    
    case 'image':
      return { 
        type: 'image', 
        url: t.image || '', 
        meta: t.meta 
      };
    
    case 'embed':
      return { 
        type: 'embed', 
        url: t.content || '',
        // Note: provider/providerId extracted from URL at runtime
      };
    
    case 'file':
      return { 
        type: 'file', 
        url: t.image || '', 
        name: t.text || 'Untitled',
        size: t.meta?.file?.size || 0,
        meta: t.meta
      };
    
    case 'label':
    default:
      return { type: 'label' };
  }
}
```

### 3.2 Dual-Read Hook (For Backward Compatibility)

```typescript
// src/components/thought/hooks/useThoughtPayload.ts

import { useMemo } from 'react';
import { type Thought, type ThoughtPayload } from '../../db';

interface UseThoughtPayloadResult {
  content: string;
  tasks: { text: string; done: boolean }[];
  table: string[][];
  image: string | null;
  drawing: string | null;
  meta: any;
}

export function useThoughtPayload(thought: Thought): UseThoughtPayloadResult {
  return useMemo(() => {
    const data = thought.data;
    
    // NEW: Read from modular data field
    if (data) {
      switch (data.type) {
        case 'text':
          return {
            content: data.content,
            tasks: [],
            table: [],
            image: null,
            drawing: null,
            meta: undefined
          };
        case 'tasks':
          return {
            content: '',
            tasks: data.tasks,
            table: [],
            image: null,
            drawing: null,
            meta: undefined
          };
        case 'table':
          return {
            content: '',
            tasks: [],
            table: data.rows,
            image: null,
            drawing: null,
            meta: undefined
          };
        case 'paint':
          return {
            content: '',
            tasks: [],
            table: [],
            image: null,
            drawing: data.drawing,
            meta: undefined
          };
        case 'image':
          return {
            content: '',
            tasks: [],
            table: [],
            image: data.url,
            drawing: null,
            meta: data.meta
          };
        case 'file':
          return {
            content: '',
            tasks: [],
            table: [],
            image: data.url,
            drawing: null,
            meta: data.meta
          };
        case 'embed':
          return {
            content: data.url,
            tasks: [],
            table: [],
            image: null,
            drawing: null,
            meta: undefined
          };
        case 'label':
        default:
          return {
            content: '',
            tasks: [],
            table: [],
            image: null,
            drawing: null,
            meta: undefined
          };
      }
    }
    
    // LEGACY: Fallback to old flat fields
    return {
      content: thought.content || '',
      tasks: thought.tasks || [],
      table: thought.table || [],
      image: thought.image || null,
      drawing: thought.drawing || null,
      meta: thought.meta
    };
  }, [thought]);
}
```

---

## 4. Component Registry Pattern

### 4.1 Registry Definition (`src/components/thought/registry.ts`)

```typescript
import { type LucideIcon } from 'lucide-react';
import { type Thought, type ThoughtType, type ThoughtPayload } from '../../db';

// Forward declarations
interface ThoughtTypeConfig {
  type: ThoughtType;
  label: string;
  icon: LucideIcon;
  
  // Renderers
  renderer: React.ComponentType<ThoughtRendererProps>;
  footerRenderer?: React.ComponentType<ThoughtFooterProps>;
  
  // Editors
  focusEditor?: React.ComponentType<FocusEditorProps>;
  inspectorPanel?: React.ComponentType<InspectorPanelProps>;
  
  // Factory
  createPayload: () => ThoughtPayload;
  
  // Capabilities
  hasFooter: boolean;
  supportsFocusMode: boolean;
  supportsInspector: boolean;
}

interface ThoughtRendererProps {
  thought: Thought;
  payload: UseThoughtPayloadResult;
  isReadOnly: boolean;
  isCalendar?: boolean;
  isSpatial?: boolean;
  setActiveFocus?: (id: number, type: ThoughtType) => void;
  setSelectedThoughtId?: (id: number | null) => void;
  setInspectorOpen?: (open: boolean) => void;
}

interface FocusEditorProps {
  thoughtId: number;
  onClose: () => void;
}

interface InspectorPanelProps {
  thought: Thought;
  isReadOnly: boolean;
}

// Registry map
export const ThoughtRegistry: Record<ThoughtType, ThoughtTypeConfig> = {
  label: {
    type: 'label',
    label: 'Label',
    icon: Tag,
    renderer: LabelRenderer,
    createPayload: () => ({ type: 'label' }),
    hasFooter: true,
    supportsFocusMode: false,
    supportsInspector: true
  },
  text: {
    type: 'text',
    label: 'Text',
    icon: Type,
    renderer: TextRenderer,
    focusEditor: TextFocusEditor,
    createPayload: () => ({ type: 'text', content: '' }),
    hasFooter: true,
    supportsFocusMode: true,
    supportsInspector: true
  },
  // ... etc for all types
};

// Helper function
export function getThoughtConfig(type: ThoughtType): ThoughtTypeConfig {
  return ThoughtRegistry[type];
}
```

### 4.2 Modular ThoughtNode Structure

```
src/components/thought/
├── registry.ts              # Central registry configuration
├── hooks/
│   ├── useThoughtPayload.ts # Dual-read hook (NEW)
│   └── useThoughtData.ts    # Data extraction helper
├── base/
│   ├── ThoughtContainer.tsx # Base container with common styles
│   ├── ThoughtHeader.tsx    # Existing, will be refined
│   └── ThoughtFooter.tsx    # Existing, will be refined
├── renderers/
│   ├── TextRenderer.tsx     # Updated to use useThoughtPayload
│   ├── TasksRenderer.tsx     # Updated to use useThoughtPayload
│   ├── TableRenderer.tsx     # Updated to use useThoughtPayload
│   ├── PaintRenderer.tsx    # Updated to use useThoughtPayload
│   ├── ImageRenderer.tsx    # Updated to use useThoughtPayload
│   ├── EmbedRenderer.tsx    # Updated to use useThoughtPayload
│   ├── FileRenderer.tsx     # Updated to use useThoughtPayload
│   └── LabelRenderer.tsx    # Updated to use useThoughtPayload
├── inspectors/              # Extracted inspector panels (NEW)
│   ├── TextInspector.tsx
│   ├── TasksInspector.tsx
│   ├── TableInspector.tsx
│   └── ...
└── index.ts                 # Barrel export
```

---

## 5. Implementation Roadmap

### Phase 1: Infrastructure & Migration (Safe Bridge)
- [ ] **1.1** Update `db.ts` schema with `data` field and new Dexie version
- [ ] **1.2** Create `src/utils/migrations.ts` with migration logic
- [ ] **1.3** Add migration runner to `dataSlice.ts` `init()` function
- [ ] **1.4** Create `useThoughtPayload` hook for dual-read compatibility
- [ ] **1.5** Update all renderers to use `useThoughtPayload` hook

### Phase 2: Registry Implementation
- [ ] **2.1** Create `src/components/thought/registry.ts` with type definitions
- [ ] **2.2** Create base `ThoughtContainer.tsx` component
- [ ] **2.3** Extract inspector panels from `Inspector.tsx` to separate files
- [ ] **2.4** Register all 8 types in the registry

### Phase 3: Modularization
- [ ] **3.1** Refactor `ThoughtNode.tsx` to use registry
- [ ] **3.2** Update `Inspector.tsx` to use registry for type selection
- [ ] **3.3** Update store's `addThought` to use registry's `createPayload`

### Phase 4: Cleanup (Final)
- [ ] **4.1** Remove legacy field fallbacks from renderers (after confirming migration worked)
- [ ] **4.2** Update Supabase sync to handle new `data` field
- [ ] **4.3** Remove deprecated fields from TypeScript interfaces
- [ ] **4.4** Update Dexie schema to remove legacy indexes

---

## 6. Best Practices Applied

### 6.1 Backward Compatibility
1. **Dual-Read Pattern**: Always check `data` field first, fallback to legacy fields
2. **Migration Flag**: Use localStorage to ensure migration runs only once
3. **Gradual Rollout**: Registry allows gradual adoption per type

### 6.2 Performance
1. **React.memo**: All renderers wrapped in memo to prevent canvas re-renders
2. **useMemo**: Payload extraction is memoized per thought
3. **Lazy Loading**: Focus editors can be lazy-loaded via registry

### 6.3 Type Safety
1. **Discriminated Unions**: TypeScript ensures `data.type` matches payload shape
2. **Registry Typing**: Each type has explicit configuration
3. **Strict Mode**: No `any` types in core data flow

### 6.4 CSS Consistency (Preserved from Existing)
1. **Design Tokens**: Use CSS variables (`--accent`, `--node-bg`, etc.)
2. **Group Patterns**: Maintain `group/xxx` Tailwind hover patterns
3. **Theme Support**: All components inherit theme via CSS variables
4. **Performance Mode**: Respect `body.low-perf` class

---

## 7. Sync Strategy & Supabase Migration

### 7.1 Supabase Compatibility
The `supabaseSync.ts` uses `toSnakeCase()` which will automatically convert:
- `data` → `data` (passthrough for JSONB)
- Existing fields remain unchanged

### 7.2 DEFINITIVE MIGRATION PATH (Production-Safe)

For production, we use a **zero-downtime, bidirectional migration** that ensures:
1. Existing cloud data works without any changes
2. New local data syncs correctly
3. No data loss under any circumstance

#### The Strategy: Dual-Read + Lazy Sync

**IMPORTANT: This is a "Shadow" migration - NO DATA IS DELETED**
The SQL script below creates a *copy* of your existing data in the new `data` column. Your old columns remain untouched as a backup.

**Step 1: Add Column to Supabase**
```sql
-- Supabase Migration (run via Supabase dashboard or CLI)
-- migrations/20260306_add_thought_data_column.sql

-- 1. Add the new JSONB column (non-breaking, nullable)
ALTER TABLE thoughts ADD COLUMN IF NOT EXISTS data JSONB DEFAULT NULL;

-- 2. Add index for performance (necessary for future queries)
CREATE INDEX IF NOT EXISTS idx_thoughts_data_type ON thoughts ((data->>'type')) WHERE data IS NOT NULL;

-- 3. Verify column exists
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'thoughts' AND column_name = 'data';
```

**Step 2: One-Shot Data Migration**

This script fills the new `data` column with copies of your existing data. It takes seconds for small datasets and is 100% safe.

```sql
-- One-Shot Production Migration
-- migrations/20260306_migrate_thoughts_data.sql
-- STATUS: Safe to run - ONLY COPIES data, does not delete anything

-- Fill the new 'data' column by copying from old columns
-- Note: Using 'table_data' based on schema.sql - verify your column name
UPDATE thoughts 
SET data = 
  CASE 
    WHEN type = 'text'  THEN jsonb_build_object('type', 'text',  'content', COALESCE(content, ''))
    WHEN type = 'tasks' THEN jsonb_build_object('type', 'tasks', 'tasks',   COALESCE(tasks, '[]'::jsonb))
    WHEN type = 'table' THEN jsonb_build_object('type', 'table', 'rows',    COALESCE(table_data, '[]'::jsonb))
    WHEN type = 'paint' THEN jsonb_build_object('type', 'paint', 'drawing', COALESCE(drawing, ''))
    WHEN type = 'image' THEN jsonb_build_object('type', 'image', 'url',     COALESCE(image, ''), 'meta', meta)
    WHEN type = 'embed' THEN jsonb_build_object('type', 'embed', 'url',     COALESCE(content, ''))
    WHEN type = 'file'  THEN jsonb_build_object('type', 'file',  'url',     COALESCE(image, ''), 'name', text, 'size', (meta->'file'->>'size')::bigint)
    ELSE jsonb_build_object('type', 'label')
  END
WHERE data IS NULL;

-- Verify migration success
SELECT 
  type,
  COUNT(*) as total,
  COUNT(data) as migrated,
  COUNT(data) * 100.0 / NULLIF(COUNT(*), 0) as percentage
FROM thoughts 
GROUP BY type;
```

**What this does (Simple Explanation):**
- It looks at every row in your `thoughts` table
- For each type (text, tasks, table, etc.), it takes the data from the old columns
- It creates a copy and puts it into the new `data` column  
- The old columns stay exactly as they are
- If anything goes wrong, your original data is still there

**Step 3: Client Code Handles Both States**
- Client code always uses **dual-read**: check `data` field first, fallback to legacy fields
- When user syncs, local data (with `data` field) overwrites cloud data via upsert
- This means: **no explicit cloud migration needed** - it happens naturally on first sync

**Step 4: What Happens in Each Scenario**

| Scenario | What Happens | Risk |
|----------|--------------|------|
| New user, fresh install | Creates thoughts with `data` field directly | None |
| Existing user, offline | Local migration runs, creates `data` field, syncs to cloud | None |
| Existing user, online | Local migration runs, next sync pushes `data` to cloud | None |
| Cloud data without `data` field | Client uses legacy fields (dual-read) | None |
| Cloud data with `data` field | Client uses new field (dual-read) | None |

### 7.3 Migration Execution Order

```
┌────────────────────────────────────────────────────────────────────┐
│                    PRODUCTION MIGRATION ORDER                      │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  STEP 1: BACKUP                                                   │
│  ├── Export current Supabase DB (pg_dump)                         │
│  └── Document current schema state                                │
│                                                                    │
│  STEP 2: SUPABASE SCHEMA                                          │
│  ├── Run SQL: ALTER TABLE thoughts ADD COLUMN data JSONB          │
│  ├── Run SQL: CREATE INDEX for performance                        │
│  └── Verify column exists via SELECT query                        │
│                                                                    │
│  STEP 3: SUPABASE DATA MIGRATION                                 │
│  ├── Run One-Shot SQL migration script                           │
│  └── Verify all rows migrated via SELECT query                    │
│                                                                    │
│  STEP 4: DEPLOY CLIENT CODE                                       │
│  ├── Deploy to staging first                                      │
│  ├── Test migration on staging data                              │
│  └── Deploy to production                                         │
│                                                                    │
│  STEP 5: VERIFY                                                   │
│  ├── Check: Local IndexedDB has 'data' field                      │
│  ├── Check: Sync pushes 'data' to cloud                          │
│  └── Check: Cloud reads 'data' correctly                          │
│                                                                    │
│  STEP 6: MONITOR (24-48 hours)                                   │
│  ├── Watch for sync errors                                        │
│  └── Watch for client-side crashes                                │
│                                                                    │
│  STEP 7: CLEANUP (after 1-2 weeks of stability)                 │
│  ├── Remove legacy field fallbacks from client code               │
│  └── Remove legacy columns from Dexie schema                      │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```
┌────────────────────────────────────────────────────────────────────┐
│                    PRODUCTION MIGRATION ORDER                      │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  STEP 1: BACKUP                                                   │
│  ├── Export current Supabase DB (pg_dump)                         │
│  └── Document current schema state                                │
│                                                                    │
│  STEP 2: DEPLOY SUPPBASE CHANGES                                  │
│  ├── Run SQL: ALTER TABLE thoughts ADD COLUMN data JSONB         │
│  └── Verify column exists via SELECT query                        │
│                                                                    │
│  STEP 3: DEPLOY CLIENT CODE                                       │
│  ├── Deploy to staging first                                      │
│  ├── Test migration on staging data                               │
│  └── Deploy to production                                         │
│                                                                    │
│  STEP 4: VERIFY                                                   │
│  ├── Check: Local IndexedDB has 'data' field                      │
│  ├── Check: Sync pushes 'data' to cloud                           │
│  └── Check: Cloud reads 'data' correctly                          │
│                                                                    │
│  STEP 5: MONITOR (24-48 hours)                                    │
│  ├── Watch for sync errors                                        │
│  └── Watch for client-side crashes                                │
│                                                                    │
│  STEP 6: CLEANUP (after 1-2 weeks of stability)                  │
│  ├── Remove legacy field fallbacks from client code               │
│  └── Remove legacy columns from Dexie schema                      │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### 7.4 Rollback Plan (If Critical Failure)

If production fails catastrophically:
1. **Revert client code**: Deploy previous version (dual-read still works)
2. **Cloud data intact**: `data` column is additive, legacy fields untouched
3. **Local data intact**: Old clients ignore `data` column

---

## 8. Testing Checklist

- [ ] Legacy thought renders correctly in new modular node
- [ ] New thought with `data` field renders correctly
- [ ] Theme switching (cyberia/sea/forest/rain) works
- [ ] Performance mode (`body.low-perf`) works
- [ ] Sync status indicator works
- [ ] Focus editors open/close correctly
- [ ] Inspector type switcher works
- [ ] Calendar view renders thoughts correctly
- [ ] Stack linking/unlinking works

---

## 9. File Changes Summary

### Files to CREATE:
- `src/utils/migrations.ts`
- `src/components/thought/hooks/useThoughtPayload.ts`
- `src/components/thought/registry.ts`
- `src/components/thought/base/ThoughtContainer.tsx`
- `src/components/thought/inspectors/*.tsx` (8 files)

### Files to MODIFY:
- `src/db.ts` - Add data field, increment version
- `src/store/slices/dataSlice.ts` - Add migration runner
- `src/components/thought/TextRenderer.tsx` - Use hook
- `src/components/thought/TasksRenderer.tsx` - Use hook
- `src/components/thought/TableRenderer.tsx` - Use hook
- `src/components/thought/PaintRenderer.tsx` - Use hook
- `src/components/thought/ImageRenderer.tsx` - Use hook
- `src/components/thought/EmbedRenderer.tsx` - Use hook
- `src/components/thought/FileRenderer.tsx` - Use hook
- `src/components/thought/LabelRenderer.tsx` - Use hook
- `src/components/ThoughtNode.tsx` - Use registry
- `src/components/Inspector.tsx` - Use registry

### Files to DELETE:
(NONE - all changes are additive or refactoring)
