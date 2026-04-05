# Migration to Supabase Auth

> **Status:** Planned  
> **Current Auth:** Google OAuth2 (direct)  
> **Target Auth:** Supabase Auth (Google OAuth)  
> **Created:** 2026-04-04

---

## Executive Summary

This document outlines the migration from the current custom Google OAuth2 implementation to Supabase Auth. The migration simplifies token management, improves security, and reduces server-side code complexity while maintaining the same user experience.

### Why Migrate?

| Aspect | Current (Google OAuth2) | After (Supabase Auth) |
|--------|------------------------|----------------------|
| Token Management | Manual (state, nonce, cookies) | Automatic (HttpOnly) |
| Server Code | Custom token exchange | Handled by Supabase |
| Refresh Tokens | Custom `/api/google-auth` | Built-in |
| Session Persistence | localStorage | Supabase client |
| Security | CSRF via manual state | Built-in CSRF protection |
| Multi-provider | Complex | Easy to add more |

---

## Current Architecture

### Authentication Flow

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  LoginPage.tsx  │────▶│  Google OAuth2   │────▶│  /api/auth.ts   │────▶│  localStorage  │
│  (frontend)    │     │  (direct)        │     │  (Vercel)       │     │  + IndexedDB   │
└─────────────────┘     └──────────────────┘     └─────────────────┘     └─────────────────┘
        │                                                  │
        │  • handleLogin() generates state/nonce          │
        │  • Redirects to Google                           │  • Stores: cyberia-token
        │  • Callback at /api/auth?route=callback          │  • cyberia-token-expiry
        │  • Token exchange on server                      │  • cyberia-user
        │                                                 │  • cyberia-refresh-secret
        ▼                                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  ChatOverlay.tsx + All API Endpoints                                        │
│  • Uses authStore.getOrRefreshToken() for Bearer token                     │
│  • Sends Authorization header to /api/*                                    │
│  • Handles 401 → signOut()                                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Files Involved in Current Auth

| File | Role | Lines |
|------|------|-------|
| `src/components/auth/LoginPage.tsx` | OAuth trigger, Google redirect | 203 |
| `src/store/slices/authSlice.ts` | Token management, refresh, profile sync | 1004 |
| `api/auth.ts` | Server-side token exchange | 208 |
| `api/google-auth.ts` | Token refresh endpoint | ~200 |
| `src/components/ChatOverlay.tsx` | Token retrieval for API calls | 1500+ |
| All `/api/*` endpoints | Expect `Authorization: Bearer <token>` | - |

### localStorage Keys Currently Used

```
cyberia-user              → User profile (email, name, plan, usage)
cyberia-token            → Google access token
cyberia-token-expiry     → Token expiration timestamp
cyberia-refresh-secret   → Custom refresh token
cyberia-scopes           → OAuth scopes
cyberia-last-sync        → Last sync timestamp
cyberia-active-space-id  → Current space
cyberia-theme            → Theme preference (KEEP)
```

---

## User Data Linking Strategy

### The Problem: ID Mismatch

Your current setup has incompatible IDs between tables:

| Table | ID Format | Example |
|-------|-----------|---------|
| `auth.users` (Supabase) | UUID | `ff0b67cc-7056-40b0-a677-34fb2742a6df` |
| `public.users` (Your app) | Google sub (numeric string) | `107764394786775444431` |

Without a link, old users can't access their data after migration!

---

### The Solution: Hybrid ID Strategy

#### For New Users (After Migration)
```
User signs up with Supabase Auth
         │
         ▼
Supabase creates: auth.users (id = "abc-123-uuid")
         │
         ▼
App creates: public.users (id = "abc-123-uuid")  ← SAME ID!
         │
         ▼
Linked automatically - no extra work needed
```

#### For Old Users (Existing Users)
```
Current database:
┌────────────────────┐
│ public.users       │
│ id: "10776439..."  │  ← Keep this! (don't break anything)
│ email: "x@g.com"   │
│ plan: "pro"        │
└────────────────────┘

         │
         ▼ Add "auth_user_id" column to connect them:

┌────────────────────┐
│ public.users       │
│ id: "10776439..."  │  ← Keep old ID
│ auth_user_id:      │  ← NEW: links to auth.users
│   "abc-123..."     │
│ email: "x@g.com"   │
│ plan: "pro"        │
└────────────────────┘
```

---

### Database Migration Steps

```sql
-- 1. Add nullable auth_user_id column
ALTER TABLE public.users
ADD COLUMN auth_user_id UUID UNIQUE REFERENCES auth.users(id);

-- 2. Backfill for existing users (link by email)
UPDATE public.users u
SET auth_user_id = (
  SELECT a.id FROM auth.users a
  WHERE a.email = u.email LIMIT 1
);

-- 3. Make it NOT NULL for future new users
-- (can be done after all old users have logged in once)
```

---

### Auth Code Implementation

```typescript
// New users: use same ID as auth.users
// Old users: use auth_user_id column

const getAppUser = async (supabaseUser: User) => {
  // Fast path: direct lookup by auth_user_id
  const { data: appUser } = await supabase
    .from('users')
    .select('*')
    .eq('auth_user_id', supabaseUser.id)
    .single();

  // Fallback for legacy users (link by email + backfill)
  if (!appUser) {
    const { data: legacyUser } = await supabase
      .from('users')
      .select('*')
      .eq('email', supabaseUser.email)
      .single();

    // Backfill the link for next time
    if (legacyUser) {
      await supabase
        .from('users')
        .update({ auth_user_id: supabaseUser.id })
        .eq('id', legacyUser.id);
    }

    return legacyUser;
  }

  return appUser;
};
```

---

### Summary

| User Type | What to Do |
|-----------|------------|
| **New user** | Use `auth.users.id` as `public.users.id` (same UUID) |
| **Old user** | Add `auth_user_id` column, fill by matching email |

This keeps old data working while building a clean path forward for new users.

---

## Breaking Changes

### 1. Frontend Login Flow (LoginPage.tsx)

#### Before (Current Implementation)

```typescript
// Lines 39-71
const handleLogin = () => {
  const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const REDIRECT_URI = `${window.location.origin}/api/auth?route=callback`;
  
  // Manual state/nonce generation
  const state = crypto.randomUUID();
  const nonce = crypto.randomUUID();
  
  // Store in cookies
  document.cookie = `auth_state=${state}; ...`;
  document.cookie = `auth_nonce=${nonce}; ...`;
  
  // Direct Google OAuth URL
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + 
    `client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&...`;
  
  window.location.href = authUrl;
};
```

#### After (Supabase Auth)

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const handleLogin = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/home`
    }
  });
};
```

#### Changes Summary

| Aspect | Before | After |
|--------|--------|-------|
| State/nonce | Manual `crypto.randomUUID()` | Handled by Supabase |
| Redirect URI | `/api/auth?route=callback` | Supabase callback |
| Cookies | `auth_state`, `auth_nonce` | Not needed |
| Library | `google-auth-library` (server) | `@supabase/supabase-js` |
| Error handling | URL query param `?error=...` | Supabase error object |

---

### 2. Token Management (authSlice.ts)

#### Before (Current Implementation)

```typescript
// Lines 822-837
getOrRefreshToken: async () => {
  const { accessToken, accessTokenExpiresAt, status, isOnline } = get();
  if (status !== 'authenticated' || !isOnline) return accessToken;

  const BUFFER_MS = 60 * 1000;
  const now = Date.now();
  
  if (!accessToken || !accessTokenExpiresAt || (accessTokenExpiresAt - now) < BUFFER_MS) {
    await get().refreshProfile();
    return get().accessToken;
  }
  return accessToken;
},

// Lines 716-820
refreshProfile: async () => {
  // 1. Fetch profile from Supabase
  const supabaseProfile = await supabaseSync.getProfile(user.id);
  
  // 2. Refresh Google OAuth token via custom API
  const refreshRes = await fetch('/api/google-auth?action=refresh', {
    method: 'POST',
    body: JSON.stringify({ userId: user.id, refreshSecret })
  });
}
```

#### After (Supabase Auth)

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Replace getOrRefreshToken
getSessionToken: async () => {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error('[Auth] Session error:', error);
    return null;
  }
  return data.session?.access_token ?? null;
}
```

#### Changes Summary

| Function | Before | After |
|----------|--------|-------|
| `getOrRefreshToken()` | Manual expiry check + custom refresh | `supabase.auth.getSession()` |
| `refreshProfile()` | Fetches from Supabase + Google refresh | Just fetches from Supabase |
| `setupRefreshInterval()` | Custom 55min refresh interval | Supabase auto-refresh |
| `accessToken` | In localStorage | Managed by Supabase client |
| `accessTokenExpiresAt` | In localStorage | Managed by Supabase |

---

### 3. Server-Side Auth (api/auth.ts)

#### Before (Current Implementation)

The `/api/auth.ts` file handles:
1. Google OAuth2 token exchange
2. User creation/update in `public.users`
3. Generation of custom `refresh_secret`
4. Setting cookies and localStorage via HTML redirect

#### After (Supabase Auth)

The endpoint can be **deprecated** or simplified to just handle the callback if needed. Supabase handles:
1. OAuth token exchange internally
2. User creation in `auth.users`
3. Session management
4. Refresh tokens automatically

#### API Endpoints to Remove/Deprecate

| Endpoint | Purpose | Action |
|----------|---------|--------|
| `/api/auth` | Token exchange | Deprecate |
| `/api/google-auth?action=exchange` | Token exchange | Remove |
| `/api/google-auth?action=refresh` | Token refresh | Remove |

---

### 4. API Calls (ChatOverlay.tsx + Others)

#### Before (Current Implementation)

```typescript
// Line 586 in ChatOverlay.tsx
const authStore = useAuthStore.getState();
const token = await authStore.getOrRefreshToken();

response = await fetch('/api/chat', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  // ...
});
```

#### After (Supabase Auth)

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// In the component
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;

response = await fetch('/api/chat', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  // ...
});
```

#### All Files Using Authorization Header

```
api/chat.ts           → Expects Bearer token
api/pay.ts           → Payment endpoints
api/publish.ts       → Space publishing
api/dashboard.ts     → Dashboard data
api/feedback.ts      → Feedback submission
api/models.ts        → Model config
```

**All these endpoints need to verify Supabase JWT instead of Google OAuth token.**

---

### 5. Session State Management

#### Before (Current)

```typescript
// authSlice.ts initAuth (lines 356-460)
initAuth: async () => {
  // Event listeners
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  
  // Manual token refresh
  get().setupRefreshInterval();
  get().checkExpiry();
}
```

#### After (Supabase Auth)

```typescript
// Using Supabase auth state change listener
initAuth: async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  // Listen to auth state changes
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session) {
      // Handle signed in
      get().setAuthenticatedUser(session.user);
    } else if (event === 'SIGNED_OUT') {
      // Handle signed out
      get().signOut();
    }
  });
}
```

---

### 6. Sign Out Flow

#### Before (Current)

```typescript
// authSlice.ts lines 596-669
signOut: async () => {
  // Cleanup listeners
  cleanup();
  clearInterval(refreshInterval);
  
  // Clear localStorage
  localStorage.removeItem('cyberia-user');
  localStorage.removeItem('cyberia-token');
  localStorage.removeItem('cyberia-token-expiry');
  localStorage.removeItem('cyberia-refresh-secret');
  localStorage.removeItem('cyberia-scopes');
  
  // Reset store
  set({ user: null, accessToken: null, ... });
  
  // Redirect
  window.location.reload();
}
```

#### After (Supabase Auth)

```typescript
signOut: async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  // Supabase sign out
  await supabase.auth.signOut();
  
  // Clear app-specific localStorage (keep theme, etc.)
  localStorage.removeItem('cyberia-user');
  localStorage.removeItem('cyberia-last-sync');
  localStorage.removeItem('cyberia-active-space-id');
  
  window.location.reload();
}
```

---

### 7. localStorage Changes

| Key | Action | Reason |
|-----|--------|--------|
| `cyberia-token` | **REMOVE** | Managed by Supabase |
| `cyberia-token-expiry` | **REMOVE** | Managed by Supabase |
| `cyberia-refresh-secret` | **REMOVE** | Not needed - Supabase handles refresh |
| `cyberia-scopes` | **REMOVE** | Not needed - Supabase handles scopes |
| `cyberia-user` | **KEEP** | App profile data (from public.users) |
| `cyberia-theme` | **KEEP** | Theme preference |
| `cyberia-active-space-id` | **KEEP** | Active space |
| `cyberia-physics-enabled` | **KEEP** | Physics setting |
| `cyberia-last-sync` | **KEEP** | Sync orchestrator uses this (unrelated to auth) |

---

## Migration Checklist

### Phase 0: Database Setup (Before Any Code Changes)

- [ ] Add `auth_user_id` column to `public.users`:
  ```sql
  ALTER TABLE public.users
  ADD COLUMN auth_user_id UUID UNIQUE REFERENCES auth.users(id);
  ```
- [ ] Backfill existing users by email:
  ```sql
  UPDATE public.users u
  SET auth_user_id = (
    SELECT a.id FROM auth.users a
    WHERE a.email = u.email LIMIT 1
  );
  ```

### Phase 1: Supabase Configuration

- [ ] Enable Google OAuth in Supabase Dashboard
- [ ] Add authorized redirect URL: `https://<domain>/auth/callback`
- [ ] Add Google OAuth credentials (Client ID + Secret)
- [ ] Verify scopes: `openid`, `email`, `profile`

### Phase 2: Frontend Changes

#### 2.1 Install Dependencies
```bash
npm install @supabase/supabase-js
```

#### 2.2 Create Supabase Client
Create `src/lib/supabase.ts`:
```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

#### 2.3 Update LoginPage.tsx
- [ ] Replace `handleLogin()` with `supabase.auth.signInWithOAuth()`
- [ ] Remove manual state/nonce generation
- [ ] Remove cookie handling
- [ ] Update error handling

#### 2.4 Update authSlice.ts
- [ ] Replace `initAuth()` with Supabase auth listener
- [ ] Replace `getOrRefreshToken()` with `getSessionToken()`
- [ ] Remove `refreshProfile()` Google token refresh logic
- [ ] Remove `setupRefreshInterval()` (Supabase handles)
- [ ] Update `setAuthenticatedUser()` for Supabase session
- [ ] Update `signOut()` with Supabase signOut
- [ ] Keep `refreshProfile()` for fetching user data from `public.users`

#### 2.5 Update ChatOverlay.tsx
- [ ] Replace `authStore.getOrRefreshToken()` with Supabase session
- [ ] Update authorization header pattern

#### 2.6 Update All API Calls
- [ ] `api/chat.ts` - Verify Supabase JWT
- [ ] `api/pay.ts` - Verify Supabase JWT
- [ ] `api/publish.ts` - Verify Supabase JWT
- [ ] `api/dashboard.ts` - Verify Supabase JWT
- [ ] `api/feedback.ts` - Verify Supabase JWT
- [ ] `api/models.ts` - Verify Supabase JWT

### Phase 3: Server Cleanup

- [ ] Deprecate `/api/auth.ts` (or remove completely)
- [ ] Remove `/api/google-auth.ts`
- [ ] Update API token verification to accept Supabase JWT

### Phase 4: Testing

- [ ] Test OAuth flow end-to-end
- [ ] Test session persistence across reloads
- [ ] Test token refresh
- [ ] Test sign out flow
- [ ] Test API calls with new token
- [ ] Test offline behavior
- [ ] Verify user data integrity

---

## Risk Assessment

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| Token refresh issues | Medium | Low | Extensive testing, Supabase is reliable |
| Session persistence | Medium | Low | Use Supabase's built-in persistence |
| API compatibility | High | High | Update all endpoints before launch |
| **User data linking** | **High** | Medium | Use hybrid ID strategy (auth_user_id column) |
| User data loss | Low | Very Low | User IDs stay the same |
| Downtime during migration | High | Medium | Implement incrementally, rollback plan |
| **Email mismatch on old users** | **High** | Low | Fallback to email match + backfill |

---

## Rollback Plan

If migration fails:

1. **Revert LoginPage.tsx** to use old OAuth code
2. **Restore localStorage keys** for token storage
3. **Re-enable `/api/auth.ts`** and `/api/google-auth.ts`
4. **Update API endpoints** to accept both old and new tokens (dual support period)

---

## Timeline Estimate

| Phase | Effort | Duration |
|-------|--------|----------|
| Supabase Config | 1 hour | Setup |
| Frontend Core | 4-6 hours | 1 day |
| API Endpoints | 2-3 hours | Half day |
| Testing | 2-4 hours | 1 day |
| **Total** | **9-15 hours** | **~3 days** |

---

## References

- [Supabase Google Auth Docs](./SUPABASE_GOOGLE_AUTH.md)
- [Supabase Auth JS SDK](https://supabase.com/docs/reference/javascript/auth-signinwithoauth)
- [Current auth flow docs](./auth-flow.md)

---

## Appendix: Code Diff Preview

### LoginPage.tsx

```diff
- import { useEffect } from 'react';
+ import { createClient } from '@supabase/supabase-js';
+ const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);

  const handleLogin = () => {
-   const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
-   const REDIRECT_URI = `${window.location.origin}/api/auth?route=callback`;
-   const state = crypto.randomUUID();
-   const nonce = crypto.randomUUID();
-   document.cookie = `auth_state=${state}; ...`;
-   document.cookie = `auth_nonce=${nonce}; ...`;
-   const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?...`;
-   window.location.href = authUrl;
+   supabase.auth.signInWithOAuth({
+     provider: 'google',
+     options: { redirectTo: `${window.location.origin}/home` }
+   });
  };
```

### authSlice.ts

```diff
- getOrRefreshToken: async () => {
-   const { accessToken, accessTokenExpiresAt, status, isOnline } = get();
-   if (status !== 'authenticated' || !isOnline) return accessToken;
-   const BUFFER_MS = 60 * 1000;
-   if (!accessToken || !accessTokenExpiresAt || (accessTokenExpiresAt - Date.now()) < BUFFER_MS) {
-     await get().refreshProfile();
-   }
-   return get().accessToken;
- },
+ getSessionToken: async () => {
+   const { data } = await supabase.auth.getSession();
+   return data.session?.access_token ?? null;
+ },
```
