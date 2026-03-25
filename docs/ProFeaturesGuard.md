# ProFeaturesGuard: Centralized Access Control

This document outlines the design for a centralized, flexible access control system for Pro-tier features in Cyberia Space. This system supports both **Removing** (unmounting) and **Disabling** (making non-interactive) restricted features based on the user's current subscription plan.

## 1. Centralized Utility (`src/utils/access.ts`)

We define a single source of truth for subscription checks.

```typescript
import { User } from '../constants';

export const isPro = (user: User | null): boolean => {
  return user?.plan === 'pro';
};

export const isAuthenticated = (user: User | null): boolean => {
  return !!user?.id;
};
```

## 2. The `AccessGuard` Component (`src/components/common/AccessGuard.tsx`)

This component wraps UI elements to control visibility and interactivity based on the user's plan or authentication status.

- **`mode="remove"`**: Completely unmounts the children. Used for reducing UI clutter (e.g., hiding Pro-only badges or extra options).
- **`mode="disable"`**: Renders children but applies `disabled` props and CSS filters (opacity, pointer-events-none) to visually lock the element. Use this for action buttons like "New Space" or "New Thought".
- **`mode="modal"`**: Renders children as interactive but intercepts the click event to open the Pricing Modal. Use this for settings inputs (AI Personality, Backgrounds) where you want to educate the user on *why* it is locked.

### Pro-Feature Guard

```tsx
interface AccessGuardProps {
  user: User | null;
  mode: 'remove' | 'disable' | 'modal';
  feature?: 'pro' | 'auth'; // Defaults to 'pro'
  children: React.ReactElement;
}
```

### Auth-Gate Guard

For features that require authentication but are not Pro-gated, use `feature="auth"`:

```tsx
// Example: Cloud Sync button
<AccessGuard
  user={user}
  mode="modal"
  feature="auth"
  modalTitle="Sign in to Sync"
  modalMessage="Sync your workspace across devices by signing in."
>
  <SyncButton />
</AccessGuard>
```

## 3. Backend Protection (`api/utils.ts`)

UI protection is for user experience only. Backend endpoints must be secured.

### Pro Access Enforcement

```typescript
export const enforceProAccess = (profile: User) => {
  if (profile.plan !== 'pro') {
    throw new Error('Pro tier required');
  }
};
```

### Authentication Enforcement

```typescript
export const enforceAuthAccess = (profile: User | null) => {
  if (!profile?.id) {
    throw new Error('Authentication required');
  }
};
```

## 4. User Regression Policy (Pro -> Free)

- **Automatic Enforcement**: The `AccessGuard` and `enforceProAccess` check the current user's plan in real-time.
- **Hard Reset**: When a user regresses from Pro to Free, Pro-tier customizations are cleared to ensure a clean state for Free-tier usage:
  - **AI Personality**: Clear from local storage and cloud.
  - **Custom Backgrounds**: Delete from cloud storage and reset to default.
  - **Theme**: Reset to default theme.
- **Effect**: Upon regression, the user's Pro customizations are immediately removed, and the UI reflects a fresh Free-tier state.

## 5. Inventory of Pro Features & Regression Behavior

This section inventories the current implementation of Pro features and defines the expected behavior when a user downgrades from Pro to Free.

> **Note**: The "Proposed Guard Strategy" in this section applies **only to Pro-gated features**. For authentication-gated features (Cloud Sync, Publishing), see Section 6.

### 5.1 AI Models & Limits
- **Feature Name**: Premium AI Models & Daily Limits.
- **Current Implementation**: 
  - `api/chat.ts`: Enforces `AI_DAILY_LIMIT` (15 Free / 60 Pro).
  - `api/chat.ts`: Selects model based on plan.
  - `api/chat.ts`: Strips image/file content from messages for Free users (Vision features).
- **Proposed Guard Strategy**: 
  - `mode="modal"` on the chat input when daily limit is reached (so they can click to see *why* it stopped).
  - `mode="disable"` for the "Action Mode" toggle button in the chat overlay (Free users are restricted to Chat Mode).
- **Regression Behavior**: 
  - **Currently**: Immediate enforcement. Daily limit drops to 15. Action Mode revoked.
  - **Proposal**: Hard limit. Action Mode toggle becomes visible but non-interactive (grayed out).

### 5.2 Storage & File Uploads
- **Feature Name**: Cloud Storage & File Size.
- **Current Implementation**: 
  - `constants.ts`: Defines `MAX_STORAGE_MB` (50MB Free / 500MB Pro).
  - `SettingsModal.tsx`: Enforces 2MB limit for background images.
- **Proposed Guard Strategy**: 
  - `mode="disable"` on upload buttons (File, Image) when `storageUsage >= MAX_STORAGE_MB`.
  - `mode="modal"` on "Upload Background" button in settings (Pro feature).
- **Regression Behavior**: 
  - **Currently**: Soft lock (UI warning).
  - **Proposal**: Strict Soft Lock. No new uploads allowed until storage is cleared.

### 5.3 Spaces & Thoughts
- **Feature Name**: Workspace Limits.
- **Current Implementation**: 
  - `SpaceSwitcher.tsx`: "New Space" button logic.
  - `App.tsx`: "New Thought" logic.
- **Proposed Guard Strategy**: 
  - `mode="disable"` for "New Space" button when limit reached.
  - `mode="disable"` for "New Thought" button (FAB) when limit reached.
- **Regression Behavior**: 
  - **Currently**: Soft lock. Keep existing, cannot create new.
  - **Proposal**: Maintain current behavior.

### 5.4 Customization
- **Feature Name**: AI Personality & Custom Backgrounds.
- **Current Implementation**: 
  - `SettingsModal.tsx`: Editing `user.settings.personality`.
  - `SettingsModal.tsx`: Uploading custom backgrounds.
- **Proposed Guard Strategy**: 
  - `mode="modal"` for the "AI Personality" textarea (so clicking it prompts upgrade).
  - `mode="modal"` for the "Upload Background" button.
- **Regression Behavior**: 
  - **Currently**: Fully accessible.
  - **Proposal**: Hard Reset. Clear personality, delete custom backgrounds from all spaces, reset theme to default.

### 5.5 Team / Shared Spaces
- **Feature Name**: Teams.
- **Current Implementation**: "Coming Soon" in UI. No logic implemented.
- **Proposed Guard Strategy**: N/A.
- **Regression Behavior**: N/A.

## 6. Inventory of Authentication & Feature Flags

This section inventories features that require authentication but are not necessarily Pro-gated.

### 6.1 Cloud Sync
- **Feature Name**: Cross-device synchronization.
- **Requirement**: Authentication required (both Free and Pro users must be signed in).
- **Current Implementation**: 
  - `useAuthStore.ts`: Manages authentication state.
  - `syncOrchestrator.ts`: Handles sync logic.
- **Proposed Guard Strategy**: 
  - `mode="modal"` on sync-related UI elements.
  - Modal Title: "Sign in to Sync"
  - Modal Message: "Sign in to sync your workspace across devices."
- **Backend Protection**: 
  - `api/sync.ts`: Enforce auth via `enforceAuthAccess`.

### 6.2 Publishing
- **Feature Name**: Publishing thoughts/spaces to the web.
- **Requirement**: Authentication required (both Free and Pro users must be signed in).
- **Current Implementation**: 
  - `api/publish.ts`: Handles publishing logic.
- **Proposed Guard Strategy**: 
  - `mode="modal"` on "Publish" button.
  - Modal Title: "Sign in to Publish"
  - Modal Message: "Sign in to publish your workspace."
- **Backend Protection**: 
  - `api/publish.ts`: Enforce auth via `enforceAuthAccess`.

## 7. Implementation Consequences & Breaking Points

This section documents practical implementation details and potential issues to watch for when integrating the AccessGuard system.

### 7.1 New Files to Create

- **`src/utils/access.ts`**: Centralized utility with `isPro()` and `isAuthenticated()` functions.
- **`src/components/common/AccessGuard.tsx`**: Reusable component supporting `mode="remove"`, `"disable"`, and `"modal"`.

### 7.2 Files to Modify

| Component | Modification |
|-----------|--------------|
| `ChatOverlay.tsx` | Wrap Action Mode toggle button with `AccessGuard` |
| `Modals.tsx` | Wrap AI Personality textarea and Background Upload button with `AccessGuard` |
| `SpaceSwitcher.tsx` | Wrap "New Space" button with `AccessGuard` |
| `ActionFAB.tsx` | Wrap "New Thought" button with `AccessGuard` |

### 7.3 Potential Breaking Points

- **ChatOverlay**: Wrap ONLY the Action Mode toggle button, NOT the entire input form. If the entire form is wrapped with `mode="disable"`, Pro users might lose access if the `isPro` check fails.
- **ActionFAB**: Currently doesn't receive `limits` or `thoughtCount` props. Need to pass limits via props or access via store.
- **Settings Modals**: Using `mode="modal"` might create duplicate modals. The inner modal should be the AccessGuard's upgrade prompt, replacing existing behavior.

### 7.4 Backend Impact

| Endpoint | Status | Action Required |
|----------|--------|-----------------|
| `api/chat.ts` | Already protected | No changes needed |
| `api/publish.ts` | **MISSING AUTH CHECK** | Add `enforceAuthAccess` |
| `api/sync.ts` | Client-side handled | No changes needed |

**Regression Handling**: Implement a `handleProRegression()` function in the auth slice (`useAuthStore.ts`) that clears AI Personality, deletes custom backgrounds from cloud storage, and resets the theme to default when a user regresses from Pro to Free.
