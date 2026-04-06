# B2B & Team Collaboration Implementation Plan

## Executive Summary

Cyberia is currently built as a **single-user, personal spatial thinking tool** with userId-based isolation. Adding B2B/Team Collaboration requires significant architectural changes across the entire stack - from data modeling to auth to sync infrastructure.

This document outlines a comprehensive plan to transform Cyberia from a personal productivity tool into a collaborative team platform.

---

## Table of Contents

1. [Current Architecture Analysis](#current-architecture-analysis)
2. [Gap Analysis](#gap-analysis)
3. [Data Model Changes](#data-model-changes)
4. [Ticketing System (Org-Level)](#ticketing-system-org-level)
5. [Auth & Permission System](#auth--permission-system)
6. [Implementation Phases](#implementation-phases)
7. [Technical Implementation Details](#technical-implementation-details)
8. [Migration Strategy](#migration-strategy)
9. [Business Model Considerations](#business-model-considerations)
10. [Files Reference](#files-reference)
11. [Risk Assessment](#risk-assessment)

---

## Current Architecture Analysis

### Existing Data Model (User-Scoped)

```
User (Google OAuth)
  └── Spaces (userId → individual ownership)
       └── Thoughts (userId + spaceId)
       └── Stacks (userId + spaceId)
       └── SpaceBackgrounds (userId)
```

### Current Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Vite |
| State Management | Zustand (modular slices) |
| Local Storage | IndexedDB (Dexie) |
| Cloud Sync | Supabase |
| Auth | Supabase Auth (Google OAuth) |
| Realtime | Supabase Realtime |

### Current Entity Relationships (db.ts)

```typescript
interface Space {
  id: string;           // ULID
  name: string;
  userId: string;       // Single owner
  mode: 'spatial' | 'kanban' | 'calendar';
  physics: boolean;
  order: number;
  // ... other fields
}

interface Thought {
  id: string;           // ULID
  spaceId: string;
  userId: string;       // Single creator
  // ... other fields
}

interface Stack {
  id: string;
  name: string;
  userId: string;
  spaceId: string;
  // ... other fields
}
```

### Current Sync Architecture

- **User-scoped sync**: All data filtered by `userId`
- **Single-user realtime**: Updates per user ID
- **Conflict resolution**: Last-Write-Wins (LWW) based on `updatedAt`
- **Sync status states**: `local` → `syncing` → `synced` / `error`

---

## Gap Analysis

### Current Limitations for B2B

| Area | Current State | B2B Requirement | Gap Severity |
|------|---------------|-----------------|--------------|
| **Ownership** | Single user per space | Multiple users per space | 🔴 Major |
| **Permissions** | None (owner only) | Role-based access (owner/admin/editor/viewer) | 🔴 Major |
| **Organization** | None | Team/Organization entity with hierarchy | 🔴 Major |
| **Billing** | Individual only (Polar) | Team billing, seat-based pricing | 🔴 Major |
| **Real-time Collab** | Single-user sync | Multi-user live editing with presence | 🟡 Partial |
| **Invitations** | None | Team invite system with email/links | 🔴 Major |
| **Admin Controls** | None | Organization admin dashboard | 🔴 Major |
| **Content Moderation** | None | Admin can manage team content | 🔴 Minor |
| **Ticketing** | Basic status/priority only | Assignees, labels, subtasks, custom workflows, activity log | 🟡 Partial |
| **Ticket Numbers** | None | Auto-incrementing PROJ-123 style IDs | 🔴 Major |
| **Comments** | None | Discussion threads on tickets | 🔴 Major |

### Feature Readiness Matrix

| Feature | Status | Effort |
|---------|--------|--------|
| User Authentication | ✅ Ready | - |
| Space Management | ⚠️ Needs modification | Medium |
| Thought CRUD | ⚠️ Needs permission checks | Medium |
| Cloud Sync | ⚠️ Needs organization scope | High |
| Realtime Updates | ⚠️ Needs multi-user support | High |
| Billing Integration | 🔴 Not ready | Very High |
| Team Invites | 🔴 Not ready | High |
| Admin Dashboard | 🔴 Not ready | High |
| Kanban Board | ✅ Ready (enhance with ticket metadata) | Low |
| Status/Priority System | ✅ Ready | - |
| Calendar View | ✅ Ready | - |
| Ticket Assignees | 🔴 Not ready | Medium |
| Labels/Tags | 🔴 Not ready | Low |
| Subtasks | 🔴 Not ready | Medium |
| Ticket Numbers | 🔴 Not ready | Low |
| Custom Workflows | 🔴 Not ready | Medium |
| Activity Log | 🔴 Not ready | Medium |
| Comments | 🔴 Not ready | Medium |

---

## Data Model Changes

### 1. New Database Entities

#### Organization (Team/Workspace)

```typescript
interface Organization {
  id: string;                    // ULID - Primary key
  name: string;                  // Team name
  ownerId: string;               // User who created/pays
  slug?: string;                // For team URLs (e.g., cyberia.app/team/acme)
  createdAt: number;            // Unix timestamp
  updatedAt: number;
  settings: {
    allowMemberCreateSpaces: boolean;
    defaultPermission: 'editor' | 'viewer';
    requireApprovalForJoin: boolean;
  };
  // Sync status
  syncStatus?: 'local' | 'synced' | 'syncing' | 'error';
}
```

#### OrganizationMember

```typescript
interface OrganizationMember {
  id: string;                    // ULID
  organizationId: string;        // FK to Organization
  userId: string;               // FK to User
  role: 'owner' | 'admin' | 'member';
  joinedAt: number;
  invitedBy?: string;            // User who sent invite
  status: 'active' | 'pending' | 'declined';
  email?: string;                // For pending invites
  inviteToken?: string;          // For invite links
  expiresAt?: number;            // Invite expiration
}
```

#### TeamSpace (Shared Space)

```typescript
interface TeamSpace {
  id: string;
  organizationId: string;
  spaceId: string;              // Reference to Space entity
  createdAt: number;
  settings: {
    defaultPermission: 'editor' | 'viewer';
    membersCanInvite: boolean;
    requireApprovalForEdit: boolean;
  };
}
```

#### SpacePermission (Granular Access)

```typescript
interface SpacePermission {
  id: string;                    // ULID
  spaceId: string;              // FK to Space
  userId: string;               // FK to User
  permission: 'owner' | 'admin' | 'editor' | 'viewer';
  grantedAt: number;
  grantedBy: string;             // User who granted permission
  // Sync status
  syncStatus?: 'local' | 'synced' | 'syncing' | 'error';
}
```

### 2. Modified Existing Entities

#### Space (Enhanced)

```typescript
interface Space {
  // EXISTING - Keep as is
  id: string;
  name: string;
  mode: 'spatial' | 'kanban' | 'calendar';
  physics: boolean;
  order: number;
  // ... other existing fields
  
  // NEW FIELDS
  ownerId: string;              // CHANGED: Replace userId with ownerId
  organizationId?: string | null;  // NEW: Link to organization (nullable for personal spaces)
  isTeamSpace?: boolean;        // NEW: Mark as team-shared
  isPersonal?: boolean;         // NEW: Explicit personal space flag
  
  // Keep userId for backward compatibility during migration
  // DEPRECATE: userId - use ownerId instead
}
```

#### Thought (Enhanced for Collaboration)

```typescript
interface Thought {
  // EXISTING - Keep as is
  id: string;
  spaceId: string;
  // ... other existing fields
  
  // NEW FIELDS
  createdBy: string;            // NEW: Track original creator
  lastEditedBy: string;         // NEW: Track last editor
  lockToken?: string;           // NEW: For optimistic locking
  lockExpiresAt?: number;       // NEW: Lock expiry timestamp
  
  // Keep userId for backward compatibility
  // userId becomes "owner" of this thought
}
```

### 3. IndexedDB Schema Changes (db.ts)

```typescript
// Version 21: Add organization tables
db.version(21).stores({
  organizations: 'id, ownerId, name, slug, createdAt, syncStatus',
  organizationMembers: 'id, organizationId, userId, role, status, email',
  spacePermissions: 'id, spaceId, userId, permission, grantedAt',
  
  // Update existing indexes
  spaces: 'id, ownerId, organizationId, name, order, syncStatus, deletedAt, updatedAt',
  thoughts: 'id, spaceId, createdBy, lastEditedBy, syncStatus, deletedAt, updatedAt',
});
```

### 4. Supabase Schema Changes

```sql
-- organizations table
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id),
  slug TEXT UNIQUE,
  settings JSONB DEFAULT '{"allowMemberCreateSpaces": true, "defaultPermission": "editor"}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- organization_members table
CREATE TABLE organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'declined')),
  email TEXT,
  invite_token TEXT,
  expires_at TIMESTAMPTZ,
  invited_by UUID REFERENCES auth.users(id),
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

-- space_permissions table (for shared spaces)
CREATE TABLE space_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  permission TEXT NOT NULL CHECK (permission IN ('owner', 'admin', 'editor', 'viewer')),
  granted_by UUID NOT NULL REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(space_id, user_id)
);

-- Update spaces table
ALTER TABLE spaces ADD COLUMN organization_id UUID REFERENCES organizations(id);
ALTER TABLE spaces ADD COLUMN is_team_space BOOLEAN DEFAULT false;

-- Update thoughts table
ALTER TABLE thoughts ADD COLUMN created_by UUID REFERENCES auth.users(id);
ALTER TABLE thoughts ADD COLUMN last_edited_by UUID REFERENCES auth.users(id);
```

---

## Ticketing System (Org-Level)

### Overview

Cyberia already has a **60% ticketing foundation** built into the Thought entity. The Kanban board, status workflow (`todo` → `doing` → `done`), priority system (`none` → `urgent`), calendar view, and Stack grouping all exist. What's missing is the **collaboration layer** — assignees, labels, subtasks, ticket numbers, and activity tracking — which ties directly into the B2B organization model.

This section defines how to evolve the existing Thought/Stack system into a full ticketing system scoped to organizations.

### Existing Foundation (Already Built)

| Ticket Concept | Existing Field | Status |
|---|---|---|
| **Title** | `text` | ✅ Ready |
| **Description** | `description` | ✅ Ready |
| **Status** | `status: 'todo' \| 'doing' \| 'done'` | ✅ Ready |
| **Priority** | `priority: 'none' \| 'low' \| 'medium' \| 'high' \| 'urgent'` | ✅ Ready |
| **Type** | `type: 'tasks'` | ✅ Ready |
| **Due Date** | `startTime` / `endTime` | ✅ Ready |
| **Epic/Sprint** | `stackId` (Stacks group thoughts) | ✅ Ready |
| **Creator** | `author` | ✅ Ready |
| **Kanban Board** | `KanbanOverlay.tsx` + column layout | ✅ Ready |
| **Calendar View** | Calendar mode | ✅ Ready |
| **Filtering** | Status, type, date, stack filters per mode | ✅ Ready |

### What Needs to Be Built

| Feature | Description | Effort |
|---|---|---|
| **Assignee** | Assign tickets to org members | Medium |
| **Labels/Tags** | Custom color-coded labels per org | Low |
| **Subtasks** | Parent-child ticket relationships | Medium |
| **Ticket Numbers** | Auto-incrementing `PROJ-123` style IDs | Low |
| **Custom Statuses** | Org-configurable workflow states | Medium |
| **Activity Log** | Timestamped audit trail per ticket | Medium |
| **Comments** | Discussion threads on tickets | Medium |
| **Ticket Views** | Dedicated ticket list/table view | Medium |
| **Bulk Operations** | Multi-select status/assignee changes | Low |
| **Ticket Templates** | Reusable ticket blueprints | Low |

### Data Model Changes

#### Thought (Enhanced for Ticketing)

```typescript
interface Thought {
  // EXISTING fields (keep as-is)
  id: string;
  spaceId: string;
  userId: string;
  stackId: string | null;
  text: string;
  description: string;
  status: 'none' | 'todo' | 'doing' | 'done';
  priority: 'none' | 'low' | 'medium' | 'high' | 'urgent';
  startTime?: number | null;
  endTime?: number | null;
  type: ThoughtType;
  order: number;
  author: string;
  // ... other existing fields

  // NEW: Ticketing fields
  ticketNumber?: string;              // e.g., "PROJ-42" — auto-generated
  assigneeIds?: string[];             // Array of org member userIds
  labelIds?: string[];                // References to org labels
  parentTicketId?: string | null;     // For subtask hierarchy
  estimate?: number | null;           // Story points or hours
  timeSpent?: number;                 // Tracked time in minutes
  ticketType?: 'bug' | 'feature' | 'task' | 'epic' | 'story';  // Jira-style types
  sprintId?: string | null;           // Link to sprint (special Stack type)
  resolution?: string | null;         // How the ticket was resolved
  environment?: string | null;        // e.g., "production", "staging"
  severity?: 'critical' | 'major' | 'minor' | 'trivial';  // For bugs
}
```

#### Label (New Entity)

```typescript
interface Label {
  id: string;                         // ULID
  organizationId: string;             // Labels are org-scoped
  name: string;                       // e.g., "frontend", "urgent", "design"
  color: string;                      // Hex color
  description?: string;
  order: number;                      // Display order
  createdAt: number;
  updatedAt: number;
  syncStatus?: 'local' | 'synced' | 'syncing' | 'error';
}
```

#### TicketComment (New Entity)

```typescript
interface TicketComment {
  id: string;                         // ULID
  ticketId: string;                   // FK to Thought
  userId: string;                     // Comment author
  content: string;                    // Markdown content
  createdAt: number;
  updatedAt: number;
  deletedAt?: number | null;
  syncStatus?: 'local' | 'synced' | 'syncing' | 'error';
}
```

#### TicketActivity (New Entity — Audit Trail)

```typescript
interface TicketActivity {
  id: string;                         // ULID
  ticketId: string;                   // FK to Thought
  userId: string;                     // Who made the change
  action: 'created' | 'updated' | 'status_changed' | 'assigned' | 
          'unassigned' | 'label_added' | 'label_removed' | 
          'comment_added' | 'attachment_added' | 'priority_changed' |
          'due_date_changed' | 'subtask_added' | 'subtask_completed';
  field?: string;                     // What field changed
  oldValue?: string | null;           // Previous value
  newValue?: string | null;           // New value
  timestamp: number;
}
```

#### Sprint (Special Stack Type)

```typescript
interface Sprint {
  id: string;                         // ULID (same as Stack.id)
  stackId: string;                    // FK to Stack — sprints ARE stacks
  organizationId: string;
  name: string;
  startDate: number;
  endDate: number;
  goal?: string;
  status: 'planned' | 'active' | 'completed' | 'cancelled';
  createdAt: number;
  updatedAt: number;
}
```

### IndexedDB Schema Changes

```typescript
// Version 22: Add ticketing tables (after v21 org tables)
db.version(22).stores({
  labels: 'id, organizationId, name, color, order',
  ticketComments: 'id, ticketId, userId, createdAt, syncStatus',
  ticketActivity: 'id, ticketId, userId, action, timestamp',
  
  // Update thoughts index for ticketing fields
  thoughts: 'id, userId, spaceId, stackId, text, type, status, startTime, endTime, priority, order, author, storageUrl, syncStatus, deletedAt, updatedAt, ticketNumber, parentTicketId, sprintId',
});
```

### Supabase Schema Changes

```sql
-- labels table (org-scoped)
CREATE TABLE labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  description TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, name)
);

-- ticket_comments table
CREATE TABLE ticket_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES thoughts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- ticket_activity table (audit trail)
CREATE TABLE ticket_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES thoughts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  field TEXT,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Update thoughts table for ticketing
ALTER TABLE thoughts ADD COLUMN ticket_number TEXT;
ALTER TABLE thoughts ADD COLUMN assignee_ids UUID[] DEFAULT '{}';
ALTER TABLE thoughts ADD COLUMN label_ids UUID[] DEFAULT '{}';
ALTER TABLE thoughts ADD COLUMN parent_ticket_id UUID REFERENCES thoughts(id);
ALTER TABLE thoughts ADD COLUMN estimate INT;
ALTER TABLE thoughts ADD COLUMN time_spent INT DEFAULT 0;
ALTER TABLE thoughts ADD COLUMN ticket_type TEXT CHECK (ticket_type IN ('bug', 'feature', 'task', 'epic', 'story'));
ALTER TABLE thoughts ADD COLUMN sprint_id UUID;
ALTER TABLE thoughts ADD COLUMN resolution TEXT;
ALTER TABLE thoughts ADD COLUMN environment TEXT;
ALTER TABLE thoughts ADD COLUMN severity TEXT CHECK (severity IN ('critical', 'major', 'minor', 'trivial'));

-- Indexes for ticketing queries
CREATE INDEX idx_thoughts_ticket_number ON thoughts(ticket_number);
CREATE INDEX idx_thoughts_assignee_ids ON thoughts USING GIN(assignee_ids);
CREATE INDEX idx_thoughts_parent_ticket ON thoughts(parent_ticket_id);
CREATE INDEX idx_thoughts_sprint ON thoughts(sprint_id);
CREATE INDEX idx_thoughts_ticket_type ON thoughts(ticket_type);
```

### Ticket Number Generation

```typescript
// src/utils/ticketNumbers.ts

/**
 * Generate ticket numbers like "PROJ-42", "CYB-1001"
 * Uses org slug + auto-increment counter stored in Supabase
 */
async function generateTicketNumber(organizationId: string): Promise<string> {
  const org = await getOrganization(organizationId);
  const slug = org.slug?.toUpperCase() || 'CYB';
  
  // Get next number from Supabase sequence
  const { data } = await supabase.rpc('next_ticket_number', { 
    org_id: organizationId 
  });
  
  return `${slug}-${data.next_number}`;
}
```

### Custom Workflow States

Organizations can define their own status workflows beyond the default `todo → doing → done`:

```typescript
interface WorkflowState {
  id: string;
  organizationId: string;
  name: string;              // e.g., "In Review", "Blocked", "QA Testing"
  category: 'todo' | 'doing' | 'done';  // Maps to Kanban column group
  color: string;
  order: number;
  isDefault: boolean;        // New tickets start here
  isClosed: boolean;         // Counts as "done" for metrics
}

// Default workflow (built-in, no config needed)
const DEFAULT_WORKFLOW = [
  { name: 'Todo', category: 'todo', color: '#6366f1', isDefault: true, isClosed: false },
  { name: 'Doing', category: 'doing', color: '#eab308', isDefault: false, isClosed: false },
  { name: 'Done', category: 'done', color: '#22c55e', isDefault: false, isClosed: true },
];

// Custom workflow example
const CUSTOM_WORKFLOW = [
  { name: 'Backlog', category: 'todo', color: '#6b7280', isDefault: true, isClosed: false },
  { name: 'Todo', category: 'todo', color: '#6366f1', isDefault: false, isClosed: false },
  { name: 'In Progress', category: 'doing', color: '#eab308', isDefault: false, isClosed: false },
  { name: 'In Review', category: 'doing', color: '#f97316', isDefault: false, isClosed: false },
  { name: 'Blocked', category: 'doing', color: '#ef4444', isDefault: false, isClosed: false },
  { name: 'Done', category: 'done', color: '#22c55e', isDefault: false, isClosed: true },
];
```

### Ticket Views

#### 1. Kanban Board (Enhanced Existing)
The existing `KanbanOverlay.tsx` gets enhanced with:
- Assignee avatars on cards
- Label badges
- Ticket numbers (`PROJ-42`)
- Priority indicators
- Drag between custom workflow columns

#### 2. Ticket List View (New)
A table/list view for power users:
- Sortable columns (number, title, assignee, status, priority, due date)
- Bulk selection and operations
- Quick-filter bar
- Group by: status, assignee, label, sprint

#### 3. Ticket Detail Panel (Enhanced Inspector)
The existing `Inspector.tsx` gets enhanced with:
- Activity timeline
- Comment thread
- Subtask list
- Assignee picker (org members)
- Label selector
- Time tracking
- Parent/child ticket links

### Org-Level Ticket Settings

```typescript
interface TicketSettings {
  organizationId: string;
  
  // Workflow
  customStates: WorkflowState[];
  useDefaultWorkflow: boolean;
  
  // Ticket numbering
  ticketPrefix: string;           // e.g., "PROJ", "CYB"
  nextTicketNumber: number;       // Auto-increment counter
  
  // Defaults
  defaultPriority: 'none' | 'low' | 'medium' | 'high' | 'urgent';
  defaultAssignee?: string;       // userId
  defaultDueDays?: number;        // Auto-set due date from creation
  
  // Features
  enableTimeTracking: boolean;
  enableEstimates: boolean;
  enableSubtasks: boolean;
  enableComments: boolean;
  enableLabels: boolean;
  
  // Notifications
  notifyOnAssign: boolean;
  notifyOnComment: boolean;
  notifyOnStatusChange: boolean;
}
```

### Integration with B2B Phases

The ticketing system is **not a separate phase** — it's woven into the existing B2B rollout:

| B2B Phase | Ticketing Deliverables |
|-----------|----------------------|
| **Phase 1: Foundation** | Add ticketing fields to Thought, create Label entity, ticket number generation |
| **Phase 2: Team Spaces** | Assignee picker (org members), label management, Kanban card enhancements |
| **Phase 3: Real-time Collab** | Live comment threads, activity feed, presence on ticket editing |
| **Phase 4: Team Billing** | Ticket limits per plan, sprint planning as Pro feature, time tracking analytics |
| **Phase 5: Testing** | E2E ticket workflows, bulk operations, permission edge cases |

### Ticket Permission Model

Tickets inherit permissions from their parent Space, with additional granularity:

| Action | Space Owner | Space Admin | Editor | Viewer |
|--------|------------|-------------|--------|--------|
| View ticket | ✅ | ✅ | ✅ | ✅ |
| Edit ticket | ✅ | ✅ | ✅ | ❌ |
| Assign ticket | ✅ | ✅ | ✅ | ❌ |
| Change status | ✅ | ✅ | ✅ | ❌ |
| Add comment | ✅ | ✅ | ✅ | ✅ (read-only space → comment-only) |
| Delete ticket | ✅ | ✅ | Own only | ❌ |
| Manage labels | ✅ | ✅ | ❌ | ❌ |
| Manage workflow | ✅ | ✅ | ❌ | ❌ |

### Key Files for Ticketing

#### New Files
| File Path | Purpose |
|-----------|---------|
| `src/utils/ticketNumbers.ts` | Ticket number generation |
| `src/utils/workflow.ts` | Custom workflow state management |
| `src/store/slices/ticketSlice.ts` | Ticket-specific state (comments, activity, labels) |
| `src/components/tickets/TicketCard.tsx` | Enhanced Kanban card with assignee/labels |
| `src/components/tickets/TicketListView.tsx` | Table/list view for tickets |
| `src/components/tickets/TicketDetailPanel.tsx` | Enhanced inspector for tickets |
| `src/components/tickets/AssigneePicker.tsx` | Multi-select org member picker |
| `src/components/tickets/LabelSelector.tsx` | Label management UI |
| `src/components/tickets/ActivityTimeline.tsx` | Audit trail display |
| `src/components/tickets/CommentThread.tsx` | Discussion thread |
| `src/components/tickets/SubtaskList.tsx` | Parent-child ticket UI |
| `src/components/tickets/WorkflowSettings.tsx` | Custom workflow config |
| `src/components/tickets/TicketSettings.tsx` | Org ticket settings |
| `api/tickets.ts` | Ticket-specific API endpoints |

#### Modified Files
| File | Changes |
|------|---------|
| `src/db.ts` | Add ticketing fields to Thought, new tables (v22) |
| `src/store/types.ts` | Add ticket, label, comment, activity types |
| `src/store/slices/thoughtSlice.ts` | Add assignee, label, subtask operations |
| `src/store/slices/uiSlice.ts` | Add ticket view state |
| `src/components/KanbanOverlay.tsx` | Enhanced cards with ticket metadata |
| `src/components/Inspector.tsx` | Add activity, comments, subtasks tabs |
| `src/components/toolbar/FilterPanel.tsx` | Add assignee and label filters |
| `src/hooks/usePhysics.ts` | Kanban column rendering for custom workflows |
| `src/services/supabaseSync.ts` | Sync ticketing entities |

---

## Auth & Permission System

### Role Hierarchy

```
Organization Owner
    ├── Full billing control
    ├── Can delete organization
    ├── Can transfer ownership
    └── Can manage all spaces
    
Organization Admin
    ├── Manage members (invite/remove)
    ├── Manage team spaces settings
    ├── Cannot delete organization
    └── Cannot change billing
    
Team Member (Editor)
    ├── Create/edit/delete thoughts in shared spaces
    ├── Create stacks
    ├── Cannot manage members
    └── Cannot change organization settings
    
Team Viewer
    ├── Read-only access to shared spaces
    └── Cannot edit any content
```

### Role Comparison Matrix

| Action | Owner | Admin | Editor | Viewer |
|--------|-------|-------|--------|--------|
| View organization | ✅ | ✅ | ✅ | ✅ |
| View team spaces | ✅ | ✅ | ✅ | ✅ |
| Edit thoughts in shared spaces | ✅ | ✅ | ✅ | ❌ |
| Create new thoughts | ✅ | ✅ | ✅ | ❌ |
| Delete thoughts | ✅ | ✅ | ✅* | ❌ |
| Create new spaces | ✅ | ✅ | ✅* | ❌ |
| Share spaces | ✅ | ✅ | ❌ | ❌ |
| Invite members | ✅ | ✅ | ❌ | ❌ |
| Remove members | ✅ | ✅ | ❌ | ❌ |
| Change member roles | ✅ | ✅ | ❌ | ❌ |
| Update org settings | ✅ | ✅ | ❌ | ❌ |
| Change billing | ✅ | ❌ | ❌ | ❌ |
| Delete organization | ✅ | ❌ | ❌ | ❌ |

*Depends on space-specific settings

### Permission Check Functions

```typescript
// src/utils/permissions.ts

type Permission = 'owner' | 'admin' | 'editor' | 'viewer';
type Role = 'owner' | 'admin' | 'member';

const ROLE_HIERARCHY: Record<Permission, number> = {
  owner: 4,
  admin: 3,
  editor: 2,
  viewer: 1
};

/**
 * Check if user has minimum required permission
 */
function hasPermission(userId: string, spaceId: string, required: Permission): boolean {
  const permission = getSpacePermission(userId, spaceId);
  if (!permission) return false;
  return ROLE_HIERARCHY[permission.permission] >= ROLE_HIERARCHY[required];
}

/**
 * Check if user can edit a specific thought (considering locks)
 */
function canEditThought(userId: string, thought: Thought): boolean {
  // Check if thought is locked by another user
  if (thought.lockToken && thought.lockExpiresAt && thought.lockExpiresAt > Date.now()) {
    const currentUserLock = getUserLockToken(userId);
    if (thought.lockToken !== currentUserLock) {
      return false; // Locked by another user
    }
  }
  
  // Check space permission
  return hasPermission(userId, thought.spaceId, 'editor');
}

/**
 * Check organization role
 */
function hasOrgRole(userId: string, organizationId: string, requiredRole: Role): boolean {
  const member = getOrganizationMember(userId, organizationId);
  if (!member || member.status !== 'active') return false;
  
  const roleHierarchy: Record<Role, number> = {
    owner: 3,
    admin: 2,
    member: 1
  };
  
  return roleHierarchy[member.role] >= roleHierarchy[requiredRole];
}

/**
 * Validate action against permission system
 */
async function validateAction(
  userId: string, 
  action: 'read' | 'write' | 'delete' | 'manage',
  resource: { type: 'space' | 'thought' | 'organization'; id: string }
): Promise<{ allowed: boolean; reason?: string }> {
  
  switch (resource.type) {
    case 'organization':
      if (action === 'manage') {
        return { allowed: hasOrgRole(userId, resource.id, 'admin') };
      }
      return { allowed: true }; // All org members can view
      
    case 'space':
      const spacePermission = getSpacePermission(userId, resource.id);
      if (!spacePermission) {
        return { allowed: false, reason: 'You do not have access to this space' };
      }
      
      if (action === 'read') return { allowed: true };
      if (action === 'write') return hasPermission(userId, resource.id, 'editor');
      if (action === 'delete') return hasPermission(userId, resource.id, 'admin');
      if (action === 'manage') return hasPermission(userId, resource.id, 'owner');
      
    case 'thought':
      const thought = await getThoughtById(resource.id);
      return { allowed: canEditThought(userId, thought) };
  }
  
  return { allowed: false };
}
```

### Thought Locking System

```typescript
// src/services/collaboration/thoughtLock.ts

const LOCK_DURATION_MS = 30000; // 30 seconds
const LOCK_RENEWAL_MS = 15000;  // Renew at 15 seconds

interface ThoughtLock {
  thoughtId: string;
  userId: string;
  token: string;
  expiresAt: number;
  renewTimer?: NodeJS.Timeout;
}

/**
 * Acquire lock on a thought for editing
 */
async function acquireThoughtLock(thoughtId: string, userId: string): Promise<ThoughtLock | null> {
  const thought = await db.thoughts.get(thoughtId);
  if (!thought) return null;
  
  // Check if already locked by someone else
  if (thought.lockToken && thought.lockExpiresAt && thought.lockExpiresAt > Date.now()) {
    const existingToken = thought.lockToken;
    const currentUserToken = getUserLockToken(userId);
    
    if (existingToken !== currentUserToken) {
      return null; // Locked by another user
    }
  }
  
  // Create new lock
  const token = crypto.randomUUID();
  const expiresAt = Date.now() + LOCK_DURATION_MS;
  
  await db.thoughts.update(thoughtId, {
    lockToken: token,
    lockExpiresAt: expiresAt
  });
  
  // Start renewal timer
  const lock: ThoughtLock = {
    thoughtId,
    userId,
    token,
    expiresAt,
    renewTimer: setTimeout(() => renewThoughtLock(thoughtId, userId), LOCK_RENEWAL_MS)
  };
  
  // Broadcast lock via realtime
  broadcastThoughtLock(thoughtId, userId, 'acquired');
  
  return lock;
}

/**
 * Release thought lock
 */
async function releaseThoughtLock(thoughtId: string, userId: string): Promise<void> {
  const thought = await db.thoughts.get(thoughtId);
  if (!thought) return;
  
  const currentUserToken = getUserLockToken(userId);
  
  // Only release if we own the lock
  if (thought.lockToken === currentUserToken) {
    await db.thoughts.update(thoughtId, {
      lockToken: null,
      lockExpiresAt: null,
      lastEditedBy: userId,
      updatedAt: Date.now(),
      syncStatus: 'local'
    });
    
    // Broadcast unlock
    broadcastThoughtLock(thoughtId, userId, 'released');
  }
}

/**
 * Renew lock before expiration
 */
async function renewThoughtLock(thoughtId: string, userId: string): Promise<void> {
  const thought = await db.thoughts.get(thoughtId);
  if (!thought) return;
  
  const currentUserToken = getUserLockToken(userId);
  
  if (thought.lockToken === currentUserToken) {
    const newExpiresAt = Date.now() + LOCK_DURATION_MS;
    await db.thoughts.update(thoughtId, { lockExpiresAt: newExpiresAt });
  }
}
```

---

## Implementation Phases

### Phase 1: Foundation (Weeks 1-2)

**Objective**: Basic organization and member management infrastructure + ticketing data model.

#### Database & Backend

- [ ] Add `organizations` table to IndexedDB
- [ ] Add `organization_members` table to IndexedDB
- [ ] Update `spaces` table with `organizationId` + `isTeamSpace`
- [ ] Create Supabase schema for organizations
- [ ] **Add ticketing fields to `thoughts` table** (ticket_number, assignee_ids, label_ids, parent_ticket_id, etc.)
- [ ] **Create `labels` table** (org-scoped)
- [ ] **Create `ticket_comments` table**
- [ ] **Create `ticket_activity` table** (audit trail)
- [ ] **Create Supabase function `next_ticket_number`** for auto-increment
- [ ] Create API endpoints:
  - `POST /api/organizations` - Create organization
  - `GET /api/organizations/:id` - Get org details
  - `PUT /api/organizations/:id` - Update org settings
  - `DELETE /api/organizations/:id` - Delete org
  - `POST /api/organizations/:id/members` - Invite member
  - `GET /api/organizations/:id/members` - List members
  - `DELETE /api/organizations/:id/members/:userId` - Remove member
  - `PUT /api/organizations/:id/members/:userId/role` - Update role
  - **`GET /api/organizations/:id/labels` - List org labels**
  - **`POST /api/organizations/:id/labels` - Create label**
  - **`GET /api/tickets/:id` - Get ticket with comments + activity**

#### Frontend

- [ ] Create organization slice in Zustand store
- [ ] Create OrganizationSettings page
- [ ] Create TeamMembersList component
- [ ] Create InviteModal component
- [ ] Add "Create Organization" flow in onboarding
- [ ] Add organization switcher in sidebar
- [ ] **Add ticketing fields to Thought interface (db.ts v22)**
- [ ] **Create ticket slice in Zustand store**
- [ ] **Add ticket number display to existing thought cards**
- [ ] **Create Label management UI in org settings**

#### Key Files

```
New Files:
- src/db/org.ts
- src/store/slices/orgSlice.ts
- src/store/slices/ticketSlice.ts
- src/services/orgApi.ts
- src/utils/ticketNumbers.ts
- src/utils/workflow.ts
- src/components/OrganizationSettings.tsx
- src/components/TeamMembersList.tsx
- src/components/InviteModal.tsx
- src/components/tickets/LabelSelector.tsx
- api/organizations.ts
- api/tickets.ts

Modified Files:
- src/db.ts (v21: org tables, v22: ticketing tables)
- src/store/types.ts
- src/store/useStore.ts
- src/services/supabaseSync.ts
```

---

### Phase 2: Team Spaces & Permissions (Weeks 3-4)

**Objective**: Share spaces with team members with granular permissions + ticket collaboration features.

#### Database & Backend

- [ ] Add `space_permissions` table
- [ ] Update Supabase schema for space sharing
- [ ] Create API endpoints:
  - `POST /api/spaces/:id/share` - Share space with member
  - `DELETE /api/spaces/:id/share/:userId` - Revoke access
  - `GET /api/spaces/:id/permissions` - List permissions
  - `PUT /api/spaces/:id/permissions/:userId` - Update permission
  - **`POST /api/tickets/:id/assign` - Assign ticket to member(s)**
  - **`POST /api/tickets/:id/comments` - Add comment**
  - **`GET /api/tickets/:id/activity` - Get activity log**
  - **`POST /api/tickets/:id/subtasks` - Add subtask**

#### Frontend

- [ ] Create ShareSpaceModal component
- [ ] Add permission selector (viewer/editor/admin)
- [ ] Add "Share" button to space header
- [ ] Show team spaces section in sidebar
- [ ] Display member avatars on shared spaces
- [ ] Add space permission badges
- [ ] **Enhance KanbanOverlay cards with assignee avatars, labels, ticket numbers**
- [ ] **Create TicketListView component (table view)**
- [ ] **Create AssigneePicker component**
- [ ] **Add assignee and label filters to FilterPanel**
- [ ] **Enhance Inspector with ticket detail tabs (activity, comments, subtasks)**

#### Store Updates

- [ ] Add `getSpacePermissions` to space slice
- [ ] Add `shareSpace` function
- [ ] Add `revokeAccess` function
- [ ] Add permission checks to thought CRUD operations
- [ ] **Add `assignTicket`, `unassignTicket` to ticket slice**
- [ ] **Add `addComment`, `deleteComment` to ticket slice**
- [ ] **Add `recordActivity` to ticket slice**
- [ ] **Add `addSubtask`, `completeSubtask` to ticket slice**

#### Key Files

```
New Files:
- src/components/ShareSpaceModal.tsx
- src/components/PermissionSelector.tsx
- src/components/MemberAvatars.tsx
- src/components/tickets/TicketCard.tsx
- src/components/tickets/TicketListView.tsx
- src/components/tickets/AssigneePicker.tsx
- src/components/tickets/CommentThread.tsx
- src/components/tickets/SubtaskList.tsx
- src/components/tickets/ActivityTimeline.tsx

Modified Files:
- src/store/slices/spaceSlice.ts
- src/store/slices/thoughtSlice.ts
- src/store/slices/ticketSlice.ts
- src/components/KanbanOverlay.tsx
- src/components/Inspector.tsx
- src/components/toolbar/FilterPanel.tsx
- src/components/SpaceHeader.tsx
- src/components/Sidebar.tsx
```

---

### Phase 3: Real-time Collaboration (Weeks 5-6)

**Objective**: Live presence and collaborative editing + real-time ticket collaboration.

#### Realtime Infrastructure

- [ ] Update Supabase Realtime to support organization channels
- [ ] Implement presence system (who's online)
- [ ] Implement thought locking via realtime
- [ ] Add cursor/selection sharing (optional, stretch goal)
- [ ] **Add ticket comment realtime (live comment threads)**
- [ ] **Add ticket activity broadcast (who changed what)**
- [ ] **Add assignee presence (who's viewing/editing a ticket)**

#### Backend Updates

- [ ] Update `setupRealtimeListener` to support organization scope
- [ ] Add channel for organization-level events
- [ ] Add channel for space-level presence
- [ ] **Add channel for ticket-level events (comments, status changes)**

#### Frontend Updates

- [ ] Add presence indicator (online users)
- [ ] Add thought lock indicator (someone is editing)
- [ ] Show "User is typing..." for thoughts
- [ ] Handle concurrent edit conflicts gracefully
- [ ] **Add live comment notifications on tickets**
- [ ] **Add activity feed with real-time updates**
- [ ] **Add "X is editing this ticket" indicator**
- [ ] **Add custom workflow state support in Kanban columns**
- [ ] **Create WorkflowSettings component for org admins**

#### Collaboration Logic

```typescript
// src/services/collaboration/presence.ts

interface PresenceUser {
  userId: string;
  name: string;
  avatar: string;
  lastSeen: number;
  cursor?: { x: number; y: number };  // Optional: cursor position
  activeThoughtId?: string;           // Optional: thought being edited
}

interface SpacePresence {
  spaceId: string;
  users: Map<string, PresenceUser>;
}

/**
 * Join space presence channel
 */
async function joinSpacePresence(spaceId: string, userId: string): Promise<void> {
  const channel = supabase.channel(`presence:${spaceId}`);
  
  channel
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      updatePresenceUI(spaceId, state);
    })
    .on('presence', { event: 'join' }, ({ key, newPresence }) => {
      console.log('User joined:', newPresence);
      showNotification(`${newPresence[0].name} joined`);
    })
    .on('presence', { event: 'leave' }, ({ key, leftPresence }) => {
      console.log('User left:', leftPresence);
    });
  
  await channel.track({
    user_id: userId,
    name: user.name,
    avatar: user.avatar,
    lastSeen: Date.now()
  });
  
  await channel.subscribe();
}

/**
 * Broadcast thought edit start
 */
async function broadcastThoughtEdit(spaceId: string, thoughtId: string, userId: string): Promise<void> {
  const channel = supabase.channel(`presence:${spaceId}`);
  await channel.track({
    user_id: userId,
    active_thought_id: thoughtId,
    lastSeen: Date.now()
  });
}
```

#### Key Files

```
New Files:
- src/services/collaboration/presence.ts
- src/services/collaboration/thoughtLock.ts
- src/components/PresenceIndicator.tsx
- src/components/ThoughtLockIndicator.tsx
- src/components/tickets/WorkflowSettings.tsx

Modified Files:
- src/services/sync/syncOrchestrator.ts
- src/store/slices/thoughtSlice.ts
- src/store/slices/ticketSlice.ts
- src/components/KanbanOverlay.tsx
- src/components/SpatialCanvas.tsx
- src/hooks/usePhysics.ts (custom workflow columns)
```

---

### Phase 4: Team Billing (Weeks 7-8)

**Objective**: Seat-based team subscriptions with usage tracking + ticket-based plan limits.

#### Billing Integration

- [ ] Integrate Polar for team subscriptions (extend existing)
- [ ] Create team plan tiers (Starter, Pro, Enterprise)
- [ ] Implement seat management
- [ ] Add usage aggregation per organization
- [ ] **Add ticket count limits per plan tier**
- [ ] **Add sprint planning as Pro/Enterprise feature**
- [ ] **Add time tracking analytics dashboard**

#### Plan Configuration

```typescript
// src/constants.ts - New team plans

export type TeamPlan = 'team_starter' | 'team_pro' | 'enterprise';

export const TEAM_PLAN_CONFIG: Record<TeamPlan, TeamPlanLimits> = {
  team_starter: {
    minSeats: 2,
    maxSeats: 5,
    pricePerSeat: {
      monthly: 8,
      yearly: 80
    },
    storagePerSeat: 500, // MB
    maxTickets: 500,     // Total tickets across all spaces
    features: [
      'Basic collaboration',
      '2-5 team members',
      '500MB storage per user',
      '500 tickets total',
      'Default workflow (Todo/Doing/Done)',
      'Email support'
    ]
  },
  team_pro: {
    minSeats: 6,
    maxSeats: 20,
    pricePerSeat: {
      monthly: 15,
      yearly: 150
    },
    storagePerSeat: 2000, // MB
    maxTickets: 5000,
    features: [
      'Advanced permissions',
      '6-20 team members',
      '2GB storage per user',
      '5,000 tickets total',
      'Custom workflow states',
      'Sprint planning',
      'Time tracking & estimates',
      'Priority support',
      'Usage analytics'
    ]
  },
  enterprise: {
    minSeats: 21,
    maxSeats: null, // Unlimited
    pricePerSeat: {
      monthly: 25,
      yearly: 250
    },
    storagePerSeat: null, // Unlimited
    maxTickets: null,     // Unlimited
    features: [
      'Unlimited team members',
      'Unlimited storage',
      'Unlimited tickets',
      'Custom workflows',
      'Advanced sprint planning',
      'Time tracking & analytics',
      'SSO / SAML',
      'Dedicated support',
      'Custom integrations',
      'Advanced analytics',
      'Audit logs'
    ]
  }
};

export interface TeamPlanLimits {
  minSeats: number;
  maxSeats: number | null;
  pricePerSeat: {
    monthly: number;
    yearly: number;
  };
  storagePerSeat: number | null;
  maxTickets: number | null;
  features: string[];
}
```

#### Usage Dashboard

```typescript
// Frontend - TeamUsageDashboard component

interface OrganizationUsage {
  totalStorage: number;
  storagePerUser: Map<string, number>;
  thoughtCount: number;
  ticketCount: number;            // NEW: Total tickets
  activeMembers: number;
  activeSprints: number;          // NEW: Active sprint count
  billingCycleUsage: {
    storage: number;
    thoughtEdits: number;
    ticketsCreated: number;       // NEW: Tickets created this cycle
    aiUsage: number;
  };
}
```

#### Backend API

- [ ] `GET /api/organizations/:id/usage` - Get org usage stats
- [ ] `POST /api/organizations/:id/subscription` - Create/manage subscription
- [ ] `PUT /api/organizations/:id/seats` - Update seat count
- [ ] `GET /api/organizations/:id/invoices` - List invoices
- [ ] **`GET /api/organizations/:id/ticket-stats` - Ticket analytics**
- [ ] **`GET /api/organizations/:id/sprint-stats` - Sprint velocity**

#### Key Files

```
New Files:
- src/components/TeamUsageDashboard.tsx
- src/components/TeamBillingSettings.tsx
- src/components/SeatManagement.tsx
- src/components/tickets/TicketSettings.tsx
- api/billing.ts

Modified Files:
- src/constants.ts
- src/store/slices/orgSlice.ts
- src/store/slices/ticketSlice.ts
```

---

### Phase 5: Testing & Polish (Weeks 9-10)

**Objective**: Bug fixes, performance optimization, UX improvements.

- [ ] End-to-end testing of collaboration flows
- [ ] Performance testing with multiple concurrent users
- [ ] Conflict resolution testing
- [ ] Mobile responsiveness for collaboration features
- [ ] Error state handling improvements
- [ ] Loading states and skeletons
- [ ] Accessibility improvements
- [ ] Documentation update
- [ ] **E2E testing of ticket workflows (create → assign → comment → resolve)**
- [ ] **Bulk ticket operations testing (multi-select, drag, batch status changes)**
- [ ] **Custom workflow state edge cases**
- [ ] **Ticket number collision testing**
- [ ] **Permission edge cases (viewer trying to edit, cross-org access)**
- [ ] **Activity log accuracy and ordering**
- [ ] **Comment thread realtime sync testing**

---

## Technical Implementation Details

### 1. Store Architecture Changes

#### New Organization Slice (src/store/slices/orgSlice.ts)

```typescript
import { type StateCreator } from 'zustand';

interface OrganizationState {
  // Data
  organizations: Organization[];
  currentOrganizationId: string | null;
  members: OrganizationMember[];
  pendingInvites: OrganizationMember[];
  
  // UI State
  isLoading: boolean;
  error: string | null;
  
  // Actions - Organizations
  createOrganization: (name: string) => Promise<string>;
  updateOrganization: (id: string, updates: Partial<Organization>) => Promise<void>;
  deleteOrganization: (id: string) => Promise<void>;
  setCurrentOrganization: (id: string | null) => void;
  
  // Actions - Members
  inviteMember: (email: string, role: 'admin' | 'member') => Promise<void>;
  removeMember: (userId: string) => Promise<void>;
  updateMemberRole: (userId: string, role: 'admin' | 'member') => Promise<void>;
  acceptInvite: (token: string) => Promise<void>;
  resendInvite: (email: string) => Promise<void>;
  
  // Actions - Sync
  refreshOrganization: (id: string) => Promise<void>;
  refreshMembers: (organizationId: string) => Promise<void>;
}

export const createOrgSlice: StateCreator<OrganizationState, [], [], any> = (set, get, _api) => ({
  // Implementation...
});
```

#### Updated Space Slice

```typescript
// Add to existing spaceSlice
interface SpaceState {
  // ... existing methods
  
  // NEW: Permission methods
  getSpacePermissions: (spaceId: string) => Promise<SpacePermission[]>;
  shareSpace: (spaceId: string, userId: string, permission: Permission) => Promise<void>;
  revokeSpaceAccess: (spaceId: string, userId: string) => Promise<void>;
  updateSpacePermission: (spaceId: string, userId: string, permission: Permission) => Promise<void>;
  
  // NEW: Team space queries
  getTeamSpaces: () => Promise<Space[]>;
  getPersonalSpaces: () => Promise<Space[]>;
}
```

### 2. Sync Orchestrator Updates

```typescript
// src/services/sync/syncOrchestrator.ts

class SyncOrchestrator {
  // ... existing methods
  
  /**
   * Setup realtime for organization (multi-user)
   */
  setupOrganizationRealtimeListener(organizationId: string) {
    const channel = supabase
      .channel(`org-sync:${organizationId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'organizations',
        filter: `id=eq.${organizationId}`
      }, (payload) => this.handleOrganizationChange(payload))
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'organization_members',
        filter: `organization_id=eq.${organizationId}`
      }, (payload) => this.handleMemberChange(payload))
      .subscribe();
    
    this.channels.push(channel);
  }
  
  /**
   * Permission-aware thought sync
   */
  async pushThoughtChange(thought: Thought, userId: string): Promise<void> {
    const permission = await getSpacePermission(userId, thought.spaceId);
    
    if (!permission || !['owner', 'admin', 'editor'].includes(permission.permission)) {
      throw new Error('No permission to edit this thought');
    }
    
    // Check if thought is locked
    if (thought.lockToken && thought.lockExpiresAt > Date.now()) {
      const userLockToken = getUserLockToken(userId);
      if (thought.lockToken !== userLockToken) {
        throw new Error('This thought is being edited by another user');
      }
    }
    
    // Proceed with sync
    await this.deltaSync();
  }
}
```

### 3. Frontend Component Updates

#### Sidebar - Organization & Team Spaces

```tsx
// src/components/Sidebar.tsx - Updated structure

export function Sidebar() {
  const { 
    organizations, 
    currentOrganizationId,
    setCurrentOrganization 
  } = useOrgStore();
  
  const { 
    spaces, 
    teamSpaces, 
    personalSpaces 
  } = useStore();
  
  return (
    <div className="sidebar">
      {/* Organization Switcher */}
      <OrganizationSwitcher 
        organizations={organizations}
        currentId={currentOrganizationId}
        onChange={setCurrentOrganization}
      />
      
      {/* Personal Spaces */}
      <Section title="My Spaces">
        {personalSpaces.map(space => (
          <SpaceItem key={space.id} space={space} />
        ))}
      </Section>
      
      {/* Team Spaces */}
      {currentOrganizationId && (
        <Section title="Team Spaces">
          {teamSpaces.map(space => (
            <TeamSpaceItem 
              key={space.id} 
              space={space}
              members={getSpaceMembers(space.id)}
            />
          ))}
        </Section>
      )}
      
      {/* Create Space Button */}
      <CreateSpaceButton />
    </div>
  );
}
```

#### Share Space Modal

```tsx
// src/components/ShareSpaceModal.tsx

interface ShareSpaceModalProps {
  spaceId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ShareSpaceModal({ spaceId, isOpen, onClose }: ShareSpaceModalProps) {
  const { members } = useOrgStore();
  const { shareSpace, permissions, revokeAccess } = useStore();
  
  const existingPermissions = useMemo(
    () => permissions.filter(p => p.spaceId === spaceId),
    [permissions, spaceId]
  );
  
  const availableMembers = useMemo(
    () => members.filter(
      m => !existingPermissions.some(p => p.userId === m.userId)
    ),
    [members, existingPermissions]
  );
  
  const handleShare = async (userId: string, permission: Permission) => {
    await shareSpace(spaceId, userId, permission);
  };
  
  const handleRevoke = async (userId: string) => {
    await revokeAccess(spaceId, userId);
  };
  
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Share Space">
      <div className="share-modal-content">
        {/* Current Permissions */}
        <Section title="People with access">
          {existingPermissions.map(perm => (
            <div key={perm.userId} className="permission-row">
              <UserAvatar userId={perm.userId} />
              <PermissionSelector 
                value={perm.permission}
                onChange={(p) => updatePermission(spaceId, perm.userId, p)}
              />
              <Button 
                variant="ghost" 
                onClick={() => handleRevoke(perm.userId)}
              >
                Remove
              </Button>
            </div>
          ))}
        </Section>
        
        {/* Invite New Members */}
        <Section title="Invite members">
          <Select
            options={availableMembers.map(m => ({
              value: m.userId,
              label: m.email
            }))}
            onChange={handleShare}
            placeholder="Select member to invite"
          />
        </Section>
      </div>
    </Modal>
  );
}
```

---

## Migration Strategy

### For Existing Users

#### Automatic Migration (Zero-Breaking)

1. **On First Login After Update**:
   - Create personal organization for user
   - Add user as "owner" member
   - Migrate all existing spaces to organization
   - Set `organizationId` on all spaces
   - Create owner permission for all spaces
   - **Generate ticket numbers for all existing thoughts** (backfill)
   - **Create default labels for the organization** (bug, feature, enhancement)
   - **Set `createdBy` = `userId` for all existing thoughts**

2. **Migration Script**:

```typescript
async function migrateUserToOrganization(userId: string): Promise<void> {
  const db = getDatabase();
  
  // 1. Create personal organization
  const orgId = ulid();
  await db.organizations.add({
    id: orgId,
    name: 'My Workspace',
    ownerId: userId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    settings: {
      allowMemberCreateSpaces: true,
      defaultPermission: 'editor'
    },
    syncStatus: 'local'
  });
  
  // 2. Add owner as member
  await db.organizationMembers.add({
    id: ulid(),
    organizationId: orgId,
    userId,
    role: 'owner',
    joinedAt: Date.now(),
    status: 'active'
  });
  
  // 3. Create default labels for the organization
  const defaultLabels = [
    { name: 'bug', color: '#ef4444' },
    { name: 'feature', color: '#6366f1' },
    { name: 'enhancement', color: '#22c55e' },
  ];
  for (const label of defaultLabels) {
    await db.labels.add({
      id: ulid(),
      organizationId: orgId,
      name: label.name,
      color: label.color,
      order: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      syncStatus: 'local'
    });
  }
  
  // 4. Migrate all existing spaces to org
  const userSpaces = await db.spaces.where('userId').equals(userId).toArray();
  let ticketCounter = 1;
  const orgSlug = 'WS'; // Default prefix for personal workspace
  
  for (const space of userSpaces) {
    await db.spaces.update(space.id, {
      ownerId: userId,
      organizationId: orgId,
      isPersonal: true,
      syncStatus: 'local'
    });
    
    // 5. Create owner permission
    await db.spacePermissions.add({
      id: ulid(),
      spaceId: space.id,
      userId,
      permission: 'owner',
      grantedAt: Date.now(),
      grantedBy: userId,
      syncStatus: 'local'
    });
    
    // 6. Backfill ticket numbers for existing thoughts
    const spaceThoughts = await db.thoughts
      .where('spaceId').equals(space.id)
      .toArray();
    
    for (const thought of spaceThoughts) {
      await db.thoughts.update(thought.id, {
        createdBy: thought.createdBy || thought.userId,
        lastEditedBy: thought.lastEditedBy || thought.userId,
        ticketNumber: thought.ticketNumber || `${orgSlug}-${ticketCounter++}`,
        syncStatus: 'local'
      });
      
      // 7. Record initial activity
      await db.ticketActivity.add({
        id: ulid(),
        ticketId: thought.id,
        userId,
        action: 'created',
        timestamp: thought.createdAt ? new Date(thought.createdAt).getTime() : Date.now()
      });
    }
  }
  
  console.log(`Migration complete: Created org ${orgId}, migrated ${userSpaces.length} spaces, ${ticketCounter - 1} tickets`);
}
```

### Gradual Rollout Plan

| Phase | Timeline | Feature | Description |
|-------|----------|---------|-------------|
| Beta | Weeks 1-4 | Organizations | Create orgs, invite members (invite-only) |
| Beta | Weeks 1-4 | Ticketing Foundation | Add ticketing fields, labels, ticket numbers |
| Beta | Weeks 5-8 | Team Spaces | Share spaces, basic permissions |
| Beta | Weeks 5-8 | Ticket Collaboration | Assignees, comments, Kanban enhancements |
| Beta | Weeks 9-12 | Collaboration | Presence, locking, basic collab |
| Beta | Weeks 9-12 | Advanced Ticketing | Custom workflows, activity log, subtasks |
| GA | Weeks 13+ | Team Billing | Paid team plans, usage dashboard, ticket limits |

### Rollback Plan

If migration fails:

1. **Partial Migration**: Keep original data intact
2. **Fallback Mode**: App works in "legacy" single-user mode
3. **Manual Recovery**: Export/import functionality preserved

---

## Business Model Considerations

### Team Pricing Structure

| Plan | Monthly/Seat | Annual/Seat | Features |
|------|--------------|-------------|----------|
| **Team Starter** | $8 | $80 | 2-5 members, 500MB/user |
| **Team Pro** | $15 | $150 | 6-20 members, 2GB/user, analytics |
| **Enterprise** | $25 | $250 | Unlimited, SSO, priority support |

### Revenue Model

```
Monthly Revenue = (Active Team Orgs) × (Avg Seats) × (Price/Seat)
```

### Billing Flow

1. **Organization Owner** subscribes to team plan
2. **Add Seats** → Pro-rated billing
3. **Remove Seats** → Credit for next month
4. **Usage Tracking** → Alerts at 80%, 100%
5. **Upgrade/Downgrade** → Immediate effect

### Integration with Existing Billing

- Existing Polar integration extends to team plans
- New billing endpoints in `/api/billing`
- Webhook handlers for subscription events

---

## Files Reference

### New Files to Create

| File Path | Purpose |
|-----------|---------|
| `src/db/org.ts` | Organization entity types |
| `src/store/slices/orgSlice.ts` | Organization state management |
| `src/store/slices/ticketSlice.ts` | Ticket state (comments, activity, labels) |
| `src/services/orgApi.ts` | Organization API client |
| `src/services/collaboration/presence.ts` | Real-time presence |
| `src/services/collaboration/thoughtLock.ts` | Thought locking logic |
| `src/utils/permissions.ts` | Permission check utilities |
| `src/utils/ticketNumbers.ts` | Ticket number generation |
| `src/utils/workflow.ts` | Custom workflow state management |
| `src/components/OrganizationSettings.tsx` | Org settings page |
| `src/components/TeamMembersList.tsx` | Member management UI |
| `src/components/InviteModal.tsx` | Invite flow modal |
| `src/components/ShareSpaceModal.tsx` | Space sharing modal |
| `src/components/PermissionSelector.tsx` | Role dropdown component |
| `src/components/MemberAvatars.tsx` | Team presence avatars |
| `src/components/PresenceIndicator.tsx` | Online status indicator |
| `src/components/ThoughtLockIndicator.tsx` | Edit lock indicator |
| `src/components/TeamUsageDashboard.tsx` | Usage stats page |
| `src/components/TeamBillingSettings.tsx` | Billing management |
| `src/components/tickets/TicketCard.tsx` | Enhanced Kanban card with assignee/labels |
| `src/components/tickets/TicketListView.tsx` | Table/list view for tickets |
| `src/components/tickets/TicketDetailPanel.tsx` | Enhanced inspector for tickets |
| `src/components/tickets/AssigneePicker.tsx` | Multi-select org member picker |
| `src/components/tickets/LabelSelector.tsx` | Label management UI |
| `src/components/tickets/ActivityTimeline.tsx` | Audit trail display |
| `src/components/tickets/CommentThread.tsx` | Discussion thread |
| `src/components/tickets/SubtaskList.tsx` | Parent-child ticket UI |
| `src/components/tickets/WorkflowSettings.tsx` | Custom workflow config |
| `src/components/tickets/TicketSettings.tsx` | Org ticket settings |
| `api/organizations.ts` | Organization API endpoints |
| `api/billing.ts` | Team billing endpoints |
| `api/tickets.ts` | Ticket-specific API endpoints |

### Files to Modify

| File | Changes |
|------|---------|
| `src/db.ts` | Add new tables (v21: org, v22: ticketing), indexes |
| `src/constants.ts` | Add TEAM_PLAN_CONFIG with ticket limits |
| `src/store/types.ts` | Add org, member, permission, ticket, label, comment types |
| `src/store/useStore.ts` | Add org slice + ticket slice to store |
| `src/store/slices/spaceSlice.ts` | Add permission methods |
| `src/store/slices/thoughtSlice.ts` | Add permission checks, ticketing fields |
| `src/store/slices/uiSlice.ts` | Add ticket view state, assignee/label filters |
| `src/services/supabaseSync.ts` | Add org sync + ticketing entity sync |
| `src/services/sync/syncOrchestrator.ts` | Add org realtime, permission checks, ticket channels |
| `src/components/Sidebar.tsx` | Add org switcher, team spaces |
| `src/components/SpaceHeader.tsx` | Add share button |
| `src/components/KanbanOverlay.tsx` | Enhanced cards with ticket metadata |
| `src/components/Inspector.tsx` | Add activity, comments, subtasks tabs |
| `src/components/toolbar/FilterPanel.tsx` | Add assignee and label filters |
| `src/hooks/usePhysics.ts` | Kanban columns for custom workflows |
| `api/spaces.ts` | Add share endpoints |

---

## Risk Assessment

### Technical Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **Data isolation failure** | Security breach | Medium | RLS policies, permission checks everywhere |
| **Sync conflicts** | Data loss | High | Thought locking + CRDT research |
| **Performance degradation** | Slow with many users | Medium | Optimize queries, paginate, caching |
| **Realtime bottlenecks** | Poor collaboration | Medium | Channel optimization, presence throttling |
| **Migration failures** | Data loss | Low | Transactional migration, rollback plan |
| **Ticket number collisions** | Data integrity | Low | Supabase sequence + atomic RPC |
| **Activity log bloat** | Storage/performance | Medium | Auto-archive after 90 days, pagination |
| **Comment thread conflicts** | Data loss | Medium | Optimistic UI + server reconciliation |

### Business Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **Complexity overload** | Feature creep | Medium | Phased rollout, MVP first |
| **Competition** | Market loss | Medium | Focus on unique spatial + ticketing value |
| **Pricing pressure** | Margin erosion | Low | Value-based pricing, clear differentiation |
| **"Just another Jira"** | Positioning | Medium | Emphasize spatial thinking + AI + visual workflow |

### Mitigation Strategies

1. **Security First**:
   - All permission checks in backend API
   - RLS policies in Supabase
   - Audit logging for admin actions
   - Regular security audits

2. **Performance**:
   - Pagination for member lists
   - Debounced presence updates
   - Optimistic UI with rollback
   - Background sync with progress

3. **Reliability**:
   - Transactional migrations
   - Graceful degradation
   - Comprehensive error handling
   - User-friendly error messages

---

## Timeline Summary

| Phase | Duration | Key Deliverables |
|-------|----------|------------------|
| Phase 1 | 2 weeks | Organization CRUD, member management, ticketing data model, labels |
| Phase 2 | 2 weeks | Space sharing, permissions, assignee, comments, Kanban enhancements |
| Phase 3 | 2 weeks | Real-time presence, live comments, activity feed, custom workflows |
| Phase 4 | 2 weeks | Team billing, ticket limits, sprint planning, time tracking analytics |
| Phase 5 | 2 weeks | Testing, polish, E2E ticket workflows, launch prep |
| **Total** | **10 weeks** | **Full B2B + Ticketing implementation** |

---

## Next Steps

1. **Decide on MVP scope**: Which features are essential for launch?
2. **Design review**: UI/UX for organization, sharing, and ticketing flows
3. **Backend implementation**: Start with Phase 1 database and API
4. **Frontend implementation**: Build organization slice, ticket slice, and UI
5. **Testing strategy**: Define E2E test scenarios for ticket workflows
6. **Launch planning**: Beta program, pricing, marketing
7. **Positioning**: Define how Cyberia's spatial ticketing differs from Jira/Linear

---

*Document Version: 2.0*  
*Last Updated: April 2026*  
*Author: Technical Planning*  
*Changes: Added org-level ticketing system (assignees, labels, subtasks, custom workflows, activity log, comments)*