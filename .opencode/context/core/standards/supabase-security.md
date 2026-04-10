<!-- Context: core/standards/supabase-security | Priority: critical | Version: 1.1 | Updated: 2026-04-09 -->
# Supabase Security & RLS Guide

**Purpose**: Supabase database security, RLS policies, and API authentication patterns.

---

## Overview

RLS is **enabled** on all tables. The browser client uses the user JWT which is validated by RLS policies. Serverless functions use `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS for admin operations.

---

## Database Tables

| Table | RLS | Realtime | Purpose |
|-------|-----|----------|---------|
| `users` | ✅ SELECT/UPDATE own | ✅ UPDATE only | User profiles and settings |
| `spaces` | ✅ Full CRUD own | ✅ All events | Workspace data |
| `stacks` | ✅ Full CRUD own | ✅ All events | Collection data |
| `thoughts` | ✅ Full CRUD own | ✅ All events | All thought content |
| `user_usage` | ✅ SELECT own only | ✅ All events | AI usage counters (server-write) |
| `feedback` | ✅ SELECT/INSERT own | ❌ No | User feedback |
| `payments` | ✅ SELECT own only | ❌ No | Payment records |

---

## RLS Pattern

All data tables use `user_id = auth.uid()::text` for policies. The `users` table uses `id = auth.uid()::text`.

**Example policies:**
```sql
-- Data tables: user can only access their own rows
CREATE POLICY "Users view own thoughts" ON thoughts
  FOR SELECT USING (user_id = auth.uid()::text);

-- user_usage: user can read but NOT write (server-only)
CREATE POLICY "Users view own usage" ON user_usage
  FOR SELECT USING (user_id = auth.uid()::text);
-- No INSERT/UPDATE policy = blocked for browser client
```

---

## API Authentication

All API endpoints use `api/utils/auth.ts` → `verifyAuth()` to validate Supabase JWTs.

### Client Setup

**Browser (`src/services/supabase.ts`):**
```typescript
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { autoRefreshToken: true, persistSession: true },
})
// JWT attached automatically by Supabase client
```

**Serverless functions (`api/*.ts`):**
```typescript
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Anon client for auth verification
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Service role client for admin operations (bypasses RLS)
const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
  : supabase;
```

### When to Use Which Client

| Operation | Browser Client | Anon Server Client | Service Role Server Client |
|-----------|---------------|-------------------|--------------------------|
| CRUD data tables | ✅ (RLS enforced) | ❌ (no JWT) | ✅ (RLS bypassed) |
| Read user_usage | ✅ (SELECT policy) | ❌ | ✅ |
| Write user_usage | ❌ (no INSERT policy) | ❌ | ✅ |
| Admin stats | N/A | ❌ | ✅ |
| Public metadata fetch | N/A | ✅ | ✅ |

---

## Key Rules

1. **Browser client**: JWT automatically attached, RLS enforces isolation
2. **Server `verifyAuth()`**: Validates JWT, extracts `userId` from `auth.uid()`
3. **Server `supabaseAdmin`**: Bypasses RLS for operations that need cross-user access
4. **user_usage**: Server-only writes — client cannot tamper with AI counters

---

## Common Mistakes

### ❌ Wrong: Hardcoded Authorization header
```typescript
// BREAKS RLS - overrides user's JWT with anon key
global: {
  headers: { Authorization: `Bearer ${supabaseAnonKey}` }
}
```

### ✅ Correct: Let Supabase client manage JWT
```typescript
// JWT automatically attached from auth session
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { autoRefreshToken: true, persistSession: true }
})
```

### ❌ Wrong: Using anon client in server for user-specific queries
```typescript
// RLS blocks - anon client has no auth.uid()
const { data } = await supabase.from('users').select('*').eq('id', userId)
```

### ✅ Correct: Use service role for server-side user queries
```typescript
// Service role bypasses RLS
const { data } = await supabaseAdmin.from('users').select('*').eq('id', userId)
```

---

## Realtime

Supabase Realtime is enabled for `users`, `spaces`, `stacks`, `thoughts`, and `user_usage`. All subscriptions are filtered by `user_id = auth.uid()` to prevent cross-user events.

Setup in `src/services/sync/syncOrchestrator.ts`:
```typescript
supabase
  .channel(`sync:${userId}`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'thoughts',
    filter: `user_id=eq.${userId}`
  }, handler)
  .subscribe()
```

---

## Storage Bucket RLS

The `user-files` bucket has RLS policies on `storage.objects` that enforce user folder isolation. The first path segment must match `auth.uid()`.

**IMPORTANT (2026-04-09):** The bucket is now **private** (`public: false`). Files are accessed via **signed URLs**, not public URLs.

### Signed URL Flow
```typescript
// 1. Client requests signed URL via API endpoint (api/chat.ts → /storage/signed-url)
const response = await fetch('/api/chat', {
  body: JSON.stringify({ action: 'get-signed-url', storagePath: 'userId/thoughtId/file.jpg' })
});
const { url } = await response.json();

// 2. Server uses SUPABASE_SERVICE_ROLE_KEY to generate signed URL
const { data, error } = await supabaseAdmin
  .storage
  .from('user-files')
  .createSignedUrl(path, { expiresIn: 3600 }); // 1 hour

// 3. Client renders file from signed URL (or local IndexedDB blob)
return data.signedUrl;
```

### Key Rules
1. **Private bucket**: `public: false` - no direct CDN URLs
2. **Signed URLs**: 1-hour expiry, cached in memory to reduce API calls
3. **Local-first**: Always try IndexedDB blob first (works offline)
4. **No cloud fallback**: If sync couldn't download locally, cloud URL won't work either

### CRITICAL: Never Store Signed URLs in Database

Signed URLs expire after 1 hour. Storing them in `storageUrl` causes "expired JWT" errors when users open files later.

```typescript
// ✅ CORRECT: Store only storagePath, generate URL on-demand
uploadThoughtBlob: async (thoughtId) => {
  const result = await supabaseStorage.uploadFile(user.id, blob, name, thoughtId);
  // Store PATH only, not the URL
  await db.thoughts.update(thoughtId, {
    storageUrl: null,  // Don't store signed URL - it expires!
    storagePath: result.path,  // Keep this - needed for fresh URL generation
  });
}

// ✅ CORRECT: Generate fresh signed URL when opening files
handleOpenExternal: async () => {
  const url = await supabaseStorage.getSignedUrl(thought.storagePath);
  window.open(url, '_blank');
}

// ❌ WRONG: Using thought.storageUrl for links
href={thought.storageUrl}  // May be expired!

### Policies
```sql
-- Users can only read files in their own folder
CREATE POLICY "Users read own files" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'user-files' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Users can only upload to their own folder
CREATE POLICY "Users upload to own folder" ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'user-files' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Users can only update files in their own folder
CREATE POLICY "Users update own files" ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'user-files' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'user-files' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Users can only delete files in their own folder
CREATE POLICY "Users delete own files" ON storage.objects
  FOR DELETE
  USING (bucket_id = 'user-files' AND (storage.foldername(name))[1] = auth.uid()::text);
```

**Path convention:** `${userId}/${thoughtId}/${fileName}` for thought files, `${userId}/backgrounds/bg_${spaceId}` for space backgrounds.

**Storage size RPC:** `get_user_storage_size(user_id TEXT)` returns total bytes. Runs as caller (not definer), so storage RLS applies.

---

## User Table Protection

A trigger `tr_protect_user_columns` on the `users` table prevents users from updating sensitive columns via the browser client.

**Protected Columns:**
- `plan`
- `subscription_status`
- `expiry_date`
- `is_admin`
- `polar_customer_id`
- `polar_subscription_id`
- `payment_provider`
- `created_at`
- `email`
- `id`

**Enforcement:**
- On `INSERT`: Forces defaults (`plan = 'free'`, `is_admin = FALSE`, etc.) unless using `service_role`.
- On `UPDATE`: Reverts changes to these columns unless using `service_role`.
- `updated_at` is automatically updated to `NOW()`.

---

## Recommendations for Maintenance

1. **Schema Drift**: Always use the `supabase/migrations/` folder for changes. Never modify RLS policies directly in the Supabase Dashboard without updating the SQL files.

2. **New Tables**: If you add a new table, immediately run `ALTER TABLE x ENABLE ROW LEVEL SECURITY;` and add a user_id policy.

3. **Storage Paths**: Always use the `${userId}/...` prefix for any new storage features (e.g., exports, avatars) to ensure the existing RLS policies cover them automatically.

4. **Admin Tools**: If you need a "Super Admin" dashboard, do not add RLS policies for it. Instead, create a dedicated API route that uses the Service Role and validates an `ADMIN_KEY`.

---

## Migration History

### 2026-04-10: Signed URLs Never Stored in Database
- Changed `uploadThoughtBlob()` to set `storageUrl: null` after upload
- Only `storagePath` is now stored in the database
- FileFocusEditor generates fresh signed URLs on "Open in New Tab" click
- FileRenderer removed `thought.storageUrl` from fallback chain
- Prevents "expired JWT" errors when opening files hours later

### 2026-04-09: Private Bucket with Signed URLs
- Changed bucket to private (`public: false`)
- Added signed URL endpoint to `api/chat.ts`
- Rewrote `supabaseStorage.ts` with caching and signed URL support
- Updated file-rendering components: FileRenderer, FileFocusEditor, DirectoryInlineEditor, Lightbox, executor
- Removed background uploads (space backgrounds stay local-only)
- Removed cloud URL fallback (if sync couldn't download locally, cloud won't work either)

### 2026-04-07: RLS Enablement (Round 3 - User Protection)
- Added `tr_protect_user_columns` trigger to `users` table
- Prevents users from updating sensitive columns (`plan`, `is_admin`, `expiry_date`, etc.) via the browser
- These columns can now only be updated by the server (Service Role)
- Added trigger and function to `schema.sql`

### 2026-04-07: RLS Enablement (Round 2 - Storage)
- Fixed storage bucket RLS: dropped 4 "Allow public" policies that allowed unauthenticated access to ALL files
- Fixed storage bucket RLS: added user folder isolation to read/update/delete policies
- Removed `getAdminStats` from `supabaseSync.ts` (dead code, fake admin check)
- Fixed `createThoughts` to inject `userId` (was missing, inconsistent with siblings)
- Added storage RLS policies and `get_user_storage_size` RPC to `schema.sql`

### 2026-04-07: RLS Enablement (Round 1)
- Enabled RLS on all 6 tables
- Created `user_usage` table (AI usage moved from `users.usage` JSONB)
- Dropped `auth_user_id`, `usage`, `refresh_token`, `refresh_secret` columns
- Dropped 16 legacy users (numeric IDs, no auth_user_id)
- Fixed feedback INSERT policies (prevents user impersonation)
- Added `user_usage` to realtime publication
- Updated all API files to use service role where needed
