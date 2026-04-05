# B2B & Team Collaboration Implementation Plan

## Executive Summary

Cyberia is currently built as a **single-user, personal spatial thinking tool** with userId-based isolation. Adding B2B/Team Collaboration requires significant architectural changes across the entire stack - from data modeling to auth to sync infrastructure.

This document outlines a comprehensive plan to transform Cyberia from a personal productivity tool into a collaborative team platform.

---

## Table of Contents

1. [Current Architecture Analysis](#current-architecture-analysis)
2. [Gap Analysis](#gap-analysis)
3. [Data Model Changes](#data-model-changes)
4. [Auth & Permission System](#auth--permission-system)
5. [Implementation Phases](#implementation-phases)
6. [Technical Implementation Details](#technical-implementation-details)
7. [Migration Strategy](#migration-strategy)
8. [Business Model Considerations](#business-model-considerations)
9. [Files Reference](#files-reference)
10. [Risk Assessment](#risk-assessment)

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

**Objective**: Basic organization and member management infrastructure.

#### Database & Backend

- [ ] Add `organizations` table to IndexedDB
- [ ] Add `organization_members` table to IndexedDB
- [ ] Update `spaces` table with `organizationId` + `isTeamSpace`
- [ ] Create Supabase schema for organizations
- [ ] Create API endpoints:
  - `POST /api/organizations` - Create organization
  - `GET /api/organizations/:id` - Get org details
  - `PUT /api/organizations/:id` - Update org settings
  - `DELETE /api/organizations/:id` - Delete org
  - `POST /api/organizations/:id/members` - Invite member
  - `GET /api/organizations/:id/members` - List members
  - `DELETE /api/organizations/:id/members/:userId` - Remove member
  - `PUT /api/organizations/:id/members/:userId/role` - Update role

#### Frontend

- [ ] Create organization slice in Zustand store
- [ ] Create OrganizationSettings page
- [ ] Create TeamMembersList component
- [ ] Create InviteModal component
- [ ] Add "Create Organization" flow in onboarding
- [ ] Add organization switcher in sidebar

#### Key Files

```
New Files:
- src/db/org.ts
- src/store/slices/orgSlice.ts
- src/services/orgApi.ts
- src/components/OrganizationSettings.tsx
- src/components/TeamMembersList.tsx
- src/components/InviteModal.tsx
- api/organizations.ts

Modified Files:
- src/db.ts
- src/store/types.ts
- src/store/useStore.ts
- src/services/supabaseSync.ts
```

---

### Phase 2: Team Spaces & Permissions (Weeks 3-4)

**Objective**: Share spaces with team members with granular permissions.

#### Database & Backend

- [ ] Add `space_permissions` table
- [ ] Update Supabase schema for space sharing
- [ ] Create API endpoints:
  - `POST /api/spaces/:id/share` - Share space with member
  - `DELETE /api/spaces/:id/share/:userId` - Revoke access
  - `GET /api/spaces/:id/permissions` - List permissions
  - `PUT /api/spaces/:id/permissions/:userId` - Update permission

#### Frontend

- [ ] Create ShareSpaceModal component
- [ ] Add permission selector (viewer/editor/admin)
- [ ] Add "Share" button to space header
- [ ] Show team spaces section in sidebar
- [ ] Display member avatars on shared spaces
- [ ] Add space permission badges

#### Store Updates

- [ ] Add `getSpacePermissions` to space slice
- [ ] Add `shareSpace` function
- [ ] Add `revokeAccess` function
- [ ] Add permission checks to thought CRUD operations

#### Key Files

```
New Files:
- src/components/ShareSpaceModal.tsx
- src/components/PermissionSelector.tsx
- src/components/MemberAvatars.tsx

Modified Files:
- src/store/slices/spaceSlice.ts
- src/store/slices/thoughtSlice.ts
- src/components/SpaceHeader.tsx
- src/components/Sidebar.tsx
```

---

### Phase 3: Real-time Collaboration (Weeks 5-6)

**Objective**: Live presence and collaborative editing.

#### Realtime Infrastructure

- [ ] Update Supabase Realtime to support organization channels
- [ ] Implement presence system (who's online)
- [ ] Implement thought locking via realtime
- [ ] Add cursor/selection sharing (optional, stretch goal)

#### Backend Updates

- [ ] Update `setupRealtimeListener` to support organization scope
- [ ] Add channel for organization-level events
- [ ] Add channel for space-level presence

#### Frontend Updates

- [ ] Add presence indicator (online users)
- [ ] Add thought lock indicator (someone is editing)
- [ ] Show "User is typing..." for thoughts
- [ ] Handle concurrent edit conflicts gracefully

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

Modified Files:
- src/services/sync/syncOrchestrator.ts
- src/store/slices/thoughtSlice.ts
- src/components/SpatialCanvas.tsx
```

---

### Phase 4: Team Billing (Weeks 7-8)

**Objective**: Seat-based team subscriptions with usage tracking.

#### Billing Integration

- [ ] Integrate Polar for team subscriptions (extend existing)
- [ ] Create team plan tiers (Starter, Pro, Enterprise)
- [ ] Implement seat management
- [ ] Add usage aggregation per organization

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
    features: [
      'Basic collaboration',
      '2-5 team members',
      '500MB storage per user',
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
    features: [
      'Advanced permissions',
      '6-20 team members',
      '2GB storage per user',
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
    features: [
      'Unlimited team members',
      'Unlimited storage',
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
  activeMembers: number;
  billingCycleUsage: {
    storage: number;
    thoughtEdits: number;
    aiUsage: number;
  };
}
```

#### Backend API

- [ ] `GET /api/organizations/:id/usage` - Get org usage stats
- [ ] `POST /api/organizations/:id/subscription` - Create/manage subscription
- [ ] `PUT /api/organizations/:id/seats` - Update seat count
- [ ] `GET /api/organizations/:id/invoices` - List invoices

#### Key Files

```
New Files:
- src/components/TeamUsageDashboard.tsx
- src/components/TeamBillingSettings.tsx
- src/components/SeatManagement.tsx
- api/billing.ts

Modified Files:
- src/constants.ts
- src/store/slices/orgSlice.ts
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
  
  // 3. Migrate all existing spaces to org
  const userSpaces = await db.spaces.where('userId').equals(userId).toArray();
  for (const space of userSpaces) {
    await db.spaces.update(space.id, {
      ownerId: userId,
      organizationId: orgId,
      isPersonal: true,
      syncStatus: 'local'
    });
    
    // 4. Create owner permission
    await db.spacePermissions.add({
      id: ulid(),
      spaceId: space.id,
      userId,
      permission: 'owner',
      grantedAt: Date.now(),
      grantedBy: userId,
      syncStatus: 'local'
    });
  }
  
  // 5. Update userId references in thoughts (for audit trail)
  for (const space of userSpaces) {
    await db.thoughts
      .where('spaceId').equals(space.id)
      .modify((thought: any) => {
        thought.createdBy = thought.createdBy || thought.userId;
        thought.lastEditedBy = thought.lastEditedBy || thought.userId;
      });
  }
  
  console.log(`Migration complete: Created org ${orgId}, migrated ${userSpaces.length} spaces`);
}
```

### Gradual Rollout Plan

| Phase | Timeline | Feature | Description |
|-------|----------|---------|-------------|
| Beta | Weeks 1-4 | Organizations | Create orgs, invite members (invite-only) |
| Beta | Weeks 5-8 | Team Spaces | Share spaces, basic permissions |
| Beta | Weeks 9-12 | Collaboration | Presence, locking, basic collab |
| GA | Weeks 13+ | Team Billing | Paid team plans, usage dashboard |

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
| `src/services/orgApi.ts` | Organization API client |
| `src/services/collaboration/presence.ts` | Real-time presence |
| `src/services/collaboration/thoughtLock.ts` | Thought locking logic |
| `src/utils/permissions.ts` | Permission check utilities |
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
| `api/organizations.ts` | Organization API endpoints |
| `api/billing.ts` | Team billing endpoints |

### Files to Modify

| File | Changes |
|------|---------|
| `src/db.ts` | Add new tables (v21), indexes |
| `src/constants.ts` | Add TEAM_PLAN_CONFIG |
| `src/store/types.ts` | Add org, member, permission types |
| `src/store/useStore.ts` | Add org slice to store |
| `src/store/slices/spaceSlice.ts` | Add permission methods |
| `src/store/slices/thoughtSlice.ts` | Add permission checks |
| `src/services/supabaseSync.ts` | Add org sync functions |
| `src/services/sync/syncOrchestrator.ts` | Add org realtime, permission checks |
| `src/components/Sidebar.tsx` | Add org switcher, team spaces |
| `src/components/SpaceHeader.tsx` | Add share button |
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

### Business Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **Complexity overload** | Feature creep | Medium | Phased rollout, MVP first |
| **Competition** | Market loss | Medium | Focus on unique collaboration value |
| **Pricing pressure** | Margin erosion | Low | Value-based pricing, clear differentiation |

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
| Phase 1 | 2 weeks | Organization CRUD, member management |
| Phase 2 | 2 weeks | Space sharing, permissions |
| Phase 3 | 2 weeks | Real-time presence, collaboration |
| Phase 4 | 2 weeks | Team billing, usage tracking |
| Phase 5 | 2 weeks | Testing, polish, launch prep |
| **Total** | **10 weeks** | **Full B2B implementation** |

---

## Next Steps

1. **Decide on MVP scope**: Which features are essential for launch?
2. **Design review**: UI/UX for organization and sharing flows
3. **Backend implementation**: Start with Phase 1 database and API
4. **Frontend implementation**: Build organization slice and UI
5. **Testing strategy**: Define E2E test scenarios
6. **Launch planning**: Beta program, pricing, marketing

---

*Document Version: 1.0*  
*Last Updated: April 2026*  
*Author: Technical Planning*