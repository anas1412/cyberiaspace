# Pro to Free Downgrade Plan

## Overview
When a Pro user doesn't renew their subscription, they should gracefully transition to the Free tier without losing data, but with appropriate limitations applied. This plan outlines the implementation to handle this scenario professionally.

---

## Current State (As-Is)

### What Works
- ✅ Downgrade happens automatically when `expiryDate` passes
- ✅ Users keep all data (local + cloud)
- ✅ Users can still edit existing content
- ✅ Users can delete content to reduce usage

### What Needs Fixing
- ❌ **Storage loophole**: Users can still upload files even if over 50MB limit (only per-file limit is checked)
- ❌ **No user awareness**: No warning banner when over limits
- ❌ **No selective locking**: Entire app blocks at once, not selective spaces
- ❌ **No grace period**: Immediate downgrade with no transition

---

## Phase 1: Infrastructure & Data Model

### 1.1 Update Schema
**File:** `supabase/schema.sql`

Add new fields to track downgrade state:
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS grace_period_ends TIMESTAMP;
ALTER TABLE users ADD COLUMN subscription_status TEXT DEFAULT 'active'; -- active, grace_period, expired, canceled
```

---

## Phase 2: Grace Period Logic

### 2.1 Modify Expiry Check
**File:** `src/store/useAuthStore.ts`

Update `checkExpiry` to set grace period instead of immediate downgrade:
```typescript
checkExpiry: () => {
  const { user } = get();
  if (!user || user.plan === 'free' || !user.expiryDate) return;
  
  if (new Date(user.expiryDate) < new Date()) {
    const gracePeriodEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    
    // Set to grace period status instead of immediate downgrade
    set({ 
      user: { 
        ...user, 
        subscriptionStatus: 'grace_period',
        gracePeriodEnds: gracePeriodEnd.toISOString()
      }
    });
  }
}
```

### 2.2 Create Grace Period End Logic
After grace period ends, downgrade to free:
```typescript
checkGracePeriod: () => {
  const { user } = get();
  if (!user || user.subscriptionStatus !== 'grace_period') return;
  
  if (new Date(user.gracePeriodEnds) < new Date()) {
    set({ 
      user: { 
        ...user, 
        plan: 'free',
        subscriptionStatus: 'expired',
        gracePeriodEnds: null,
        expiryDate: null
      }
    });
  }
}
```

---

## Phase 3: Limit Enforcement (Closing the Loophole)

### 3.1 Add Storage Check Before Upload
**File:** `src/services/supabaseStorage.ts`

Add check before uploading new files:
```typescript
export const uploadThoughtBlob = async (userId: string, file: File, thoughtId: string) => {
  const limits = PLAN_CONFIG.free; // or get from user.plan
  const currentUsage = await getStorageUsage(userId);
  const newUsageMB = currentUsage / (1024 * 1024) + file.size / (1024 * 1024);
  
  if (newUsageMB > limits.MAX_STORAGE_MB) {
    throw new Error('Storage limit exceeded. Please upgrade or delete files.');
  }
  // ... rest of upload logic
}
```

### 3.2 Add Thought Count Check
**File:** `src/store/useStore.ts`

In `addThought` function, ensure storage is also checked:
```typescript
const limits = getLimits();
// Existing check for thought count per space
// Add: Check total cloud thoughts limit
const totalCloudThoughts = await db.thoughts.where('syncStatus').equals('synced').count();
if (totalCloudThoughts >= limits.MAX_CLOUD_THOUGHTS) {
  // Show limit modal
}
```

---

## Phase 4: Selective Space Locking

### 4.1 Create Space Status Selector
**File:** `src/store/useStore.ts`

Add a utility to determine space status:
```typescript
export type SpaceAccessStatus = 'editable' | 'locked_subscription' | 'locked_demo' | 'locked_shared';

export const getSpaceAccessStatus = (space: Space, userPlan: SubscriptionPlan): SpaceAccessStatus => {
  if (userPlan === 'pro') return 'editable';
  
  const freeLimits = PLAN_CONFIG.free;
  const spaceIndex = get().spaces.findIndex(s => s.id === space.id);
  
  // First 3 spaces are always editable on free tier
  if (spaceIndex < freeLimits.MAX_SPACES) return 'editable';
  
  return 'locked_subscription';
};
```

### 4.2 Update UI Components to Respect Lock Status
**File:** `src/components/Space.tsx`

Instead of using global `isReadOnly`, check space-specific status:
```typescript
const spaceStatus = useStore(state => 
  getSpaceAccessStatus(currentSpace, user.plan)
);

const isLocked = spaceStatus !== 'editable';

// Show lock UI
{isLocked && (
  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
    <LockModal onUpgrade={openPricing} />
  </div>
)}
```

### 4.3 Update Sidebar to Show Locked Spaces
**File:** `src/components/Sidebar.tsx`

Add lock indicator for over-limit spaces:
```typescript
// In space list item
{spaceIndex >= PLAN_CONFIG.free.MAX_SPACES && (
  <LockIcon className="w-4 h-4 text-yellow-500" />
)}
```

---

## Phase 5: User Awareness (Banners & Warnings)

### 5.1 Create Upgrade Required Banner
**File:** `src/components/UpgradeRequiredBanner.tsx` (New component)

```typescript
export const UpgradeRequiredBanner = () => {
  const { user } = useAuthStore();
  const { spaces } = useStore();
  
  const limits = PLAN_CONFIG.free;
  const isOverSpaces = spaces.length > limits.MAX_SPACES;
  const isOverStorage = storageUsageMB > limits.MAX_STORAGE_MB;
  
  if (user?.plan !== 'free') return null;
  if (!isOverSpaces && !isOverStorage) return null;
  
  return (
    <Banner type="warning">
      You're using Pro features on a Free plan. 
      {isOverSpaces && ` ${spaces.length - limits.MAX_SPACES} spaces are in read-only mode.`}
      {isOverStorage && ` Storage limit exceeded.`}
      <Button variant="primary" onClick={openPricing}>Upgrade</Button>
    </Banner>
  );
};
```

### 5.2 Add Banner to Main Layout
**File:** `src/App.tsx` or workspace layout

```typescript
// Add below Header
{user?.subscriptionStatus === 'grace_period' ? (
  <GracePeriodBanner gracePeriodEnds={user.gracePeriodEnds} />
) : (
  <UpgradeRequiredBanner />
)}
```

---

## Phase 6: Grace Period Banner (Bonus)

### 6.1 Create Grace Period Warning
**File:** `src/components/GracePeriodBanner.tsx` (New component)

Shows when user is in the 7-day grace period:
```typescript
export const GracePeriodBanner = ({ gracePeriodEnds }) => {
  const daysLeft = Math.ceil(
    (new Date(gracePeriodEnds).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  
  return (
    <Banner type="info">
      Your Pro plan has expired. You have {daysLeft} days to resubscribe 
      before your account becomes read-only.
      <Button variant="primary" onClick={openPricing}>Renew Now</Button>
    </Banner>
  );
};
```

---

## Implementation Order

| Phase | Task | Priority |
|-------|------|----------|
| 1 | Update schema (grace_period_ends, subscription_status) | High |
| 2 | Fix storage loophole in upload service | High |
| 3 | Add thought count limit check | High |
| 4 | Create selective space locking logic | Medium |
| 5 | Create UpgradeRequiredBanner component | Medium |
| 6 | Update Space.tsx to respect lock status | Medium |
| 7 | Update Sidebar to show lock icons | Low |
| 8 | Implement grace period logic (Phase 2) | Low |

---

## Edge Cases to Handle

1. **User has exactly 3 spaces on free**: All should work normally
2. **User deletes a space while locked**: Next available space should unlock
3. **User tries to drag content between locked/unlocked spaces**: Prevent or warn
4. **Offline edits while in grace period**: Queue for sync when reconnected
5. **Shared space link still works**: Public links should remain accessible even if owner is locked

---

## Files to Modify

- `supabase/schema.sql`
- `src/store/useAuthStore.ts`
- `src/store/useStore.ts`
- `src/services/supabaseStorage.ts`
- `src/components/Space.tsx`
- `src/components/Sidebar.tsx`
- `src/components/AccountMenu.tsx`
- `src/App.tsx` (or workspace layout)
- **New:** `src/components/UpgradeRequiredBanner.tsx`
- **New:** `src/components/GracePeriodBanner.tsx`
