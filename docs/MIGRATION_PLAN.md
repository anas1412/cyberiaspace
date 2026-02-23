# Cyberia Migration Plan: Vercel KV → Supabase (PostgreSQL + Storage)

## Overview

Migrate from Vercel KV to Supabase while keeping:
- Google Auth (existing, on Vercel)
- Dexie local-first architecture (existing)

**NEW: Replace Google Drive with Supabase Storage for file handling.**

---

## Why Migrate

| Current Pain | Solution with Supabase |
|--------------|----------------------|
| No proper users table | Dedicated `users` table |
| KV = black box blob | Queryable relational data |
| Can't query across users | Full SQL for analytics |
| No admin dashboard | Easy SQL dashboard |
| Vercel 12-function limit | Unlimited Supabase Edge Functions |
| Drive OAuth complexity | Supabase Storage (simpler) |
| Large files blocked | Up to 50 MB per file (Free tier) |

---

## Target Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Dexie     │  │   Zustand   │  │  Google OAuth       │ │
│  │ (IndexedDB) │  │   (State)   │  │  (Vercel)          │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│         │                │                    │              │
│         ▼                ▼                    ▼              │
│  ┌───────────────────────────────────────────────────────┐   │
│  │               Cyberia Frontend                        │   │
│  └───────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
┌─────────────┐   ┌─────────────────┐   ┌─────────────────┐
│   Vercel    │   │  Supabase      │   │  Supabase       │
│   (Google   │   │  Edge Functions │   │  Storage        │
│   OAuth)    │   │  (API)         │   │  (Files)        │
│             │   └────────┬────────┘   └─────────────────┘
└─────────────┘             │
                           ▼
                    ┌─────────────────┐
                    │   Supabase      │
                    │   PostgreSQL    │
                    └─────────────────┘
```

### Storage Distribution

| Data Type | Location | Why |
|-----------|----------|-----|
| Spaces | PostgreSQL | Relational data, queries |
| Stacks | PostgreSQL | Relational data, queries |
| Thoughts (content) | PostgreSQL | Text, JSON |
| Thoughts (media) | Supabase Storage | Files up to 50 MB |
| User avatars | Supabase Storage | Images |

---

## Supabase Storage Limits

| Plan | File Size Limit | Total Storage |
|------|-----------------|---------------|
| Free | 50 MB | 1 GB |
| Pro | 500 GB | 100 GB |

✅ **50 MB matches our requirements!**

---

## Database Schema

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id TEXT PRIMARY KEY,  -- Google sub (user unique ID)
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    avatar TEXT,
    plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
    subscription_status TEXT DEFAULT 'none',
    settings JSONB DEFAULT '{}',
    storage_used BIGINT DEFAULT 0,       -- Track storage usage
    storage_limit BIGINT DEFAULT 52428800, -- 50 MB default
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Spaces table (UUID primary key, local_id for Dexie mapping)
CREATE TABLE spaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    local_id TEXT,                       -- Dexie ID for mapping
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    mode TEXT DEFAULT 'spatial',
    physics BOOLEAN DEFAULT true,
    "order" INT DEFAULT 0,
    transform JSONB DEFAULT '{"x": 0, "y": 0, "scale": 1}',
    theme TEXT DEFAULT 'cyberia',
    custom_bg TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Stacks table
CREATE TABLE stacks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    local_id TEXT,
    user_id TEXT NOT NULL,
    space_id TEXT,                       -- FK to spaces (TEXT for local IDs)
    name TEXT NOT NULL,
    color TEXT DEFAULT '#6366f1',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Thoughts table
CREATE TABLE thoughts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    local_id BIGINT,                     -- Dexie auto-increment ID
    user_id TEXT NOT NULL,
    space_id TEXT,
    stack_id TEXT,
    x REAL DEFAULT 0,
    y REAL DEFAULT 0,
    vx REAL DEFAULT 0,
    vy REAL DEFAULT 0,
    text TEXT DEFAULT '',
    placeholder TEXT,
    description TEXT DEFAULT '',
    type TEXT NOT NULL,
    content TEXT DEFAULT '',
    image TEXT,
    drawing TEXT,
    status TEXT DEFAULT 'none',
    tasks JSONB DEFAULT '[]',
    table_data JSONB DEFAULT '[]',
    "table" JSONB DEFAULT '[]',
    date TIMESTAMP,
    priority TEXT DEFAULT 'none',
    size REAL DEFAULT 1,
    "order" INT DEFAULT 0,
    layer INT DEFAULT 0,
    author TEXT,
    meta JSONB DEFAULT '{}',
    storage_url TEXT,                    -- NEW: Supabase Storage URL
    sync_status TEXT DEFAULT 'local',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Published spaces
CREATE TABLE published_spaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    space_id TEXT,
    user_id TEXT NOT NULL,
    snapshot JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP
);

-- Feedback
CREATE TABLE feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT,
    type TEXT NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Payments
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    payment_ref TEXT UNIQUE NOT NULL,
    amount INT NOT NULL,
    currency TEXT DEFAULT 'USD',
    status TEXT DEFAULT 'pending',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Pending deletions (for sync)
CREATE TABLE pending_deletes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    table_name TEXT NOT NULL,
    local_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_spaces_user ON spaces(user_id);
CREATE INDEX idx_stacks_user ON stacks(user_id);
CREATE INDEX idx_thoughts_user ON thoughts(user_id);
CREATE INDEX idx_thoughts_space ON thoughts(space_id);
CREATE INDEX idx_pending_deletes_user ON pending_deletes(user_id);
```

---

## Supabase Storage Setup

### Create Bucket

```sql
-- Create bucket (run in Supabase Dashboard → Storage)
-- Or via API:
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('user-files', 'user-files', true, 52428800, NULL);
```

### Storage Policies

```sql
-- Allow users to upload their own files
CREATE POLICY "Users can upload own files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'user-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to read own files
CREATE POLICY "Users can read own files"
ON storage.objects FOR SELECT
USING (bucket_id = 'user-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to delete own files
CREATE POLICY "Users can delete own files"
ON storage.objects FOR DELETE
USING (bucket_id = 'user-files' AND auth.uid()::text = (storage.foldername(name))[1]);
```

---

## Sync Strategy

### Dexie → Supabase Sync Flow

| Action | Local (Dexie) | Sync Behavior |
|--------|---------------|---------------|
| Create space/stack/thought | `syncStatus: 'pending'` | Push on login → mark 'synced' |
| Edit space/stack/thought | `syncStatus: 'pending'` | Push on login → mark 'synced' |
| Delete | Add to `pendingDeleting` table | Delete from Supabase on login |
| Upload media | Store in IndexedDB | Upload to Supabase Storage → save URL |

### Sync Status Values

- `local` - Created locally, never synced
- `synced` - Synced to Supabase
- `pending` - Modified locally, needs sync
- `syncing` - Currently syncing
- `error` - Sync failed

### On Login Sync Sequence

1. Process `pendingDeleting` → delete from Supabase
2. Push pending creates/updates → mark as synced
3. Pull cloud data → merge with local
4. Upload pending media files to Supabase Storage

---

## File Storage Flow

### Upload (New Thought with Media)
```
User uploads file → IndexedDB (temp) → Supabase Storage → Get URL → Save to thought.storage_url
```

### Download
```
thought.storage_url → Supabase Storage → Get signed URL → Load in app
```

### Delete
```
Delete thought → Add to pending_deletes → On sync: delete from Supabase Storage
```

---

## Migration Steps

### Phase 1: Setup Supabase Storage (DONE ✅)

- [x] Create Supabase project
- [x] Run SQL schema
- [x] Create storage bucket `user-files`
- [x] Set file size limit to 50 MB

### Phase 2: Update Client Code

- [ ] Update `src/db.ts`:
  - Add `syncStatus` to Space and Stack
  - Replace `driveFileId` with `storageUrl`
  - Update `PendingDeletion` interface

- [ ] Create `src/services/supabaseStorage.ts`:
  ```typescript
  import { createClient } from '@supabase/storage-js'
  
  const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY
  
  export const storageClient = createClient(supabaseUrl, supabaseAnonKey)
  
  export const storageService = {
    async upload(userId: string, file: Blob, fileName: string): Promise<string> {
      const path = `${userId}/${Date.now()}-${fileName}`
      const { data, error } = await storageClient
        .from('user-files')
        .upload(path, file, { upsert: false })
      
      if (error) throw error
      
      const { data: { publicUrl } } = storageClient
        .from('user-files')
        .getPublicUrl(path)
      
      return publicUrl
    },
    
    async delete(storagePath: string): Promise<void> {
      const { error } = await storageClient
        .from('user-files')
        .remove([storagePath])
      
      if (error) throw error
    }
  }
  ```

- [ ] Update `src/services/supabaseSync.ts`:
  - Use `syncStatus` to track changes
  - Add deletion sync
  - Handle storage URLs

- [ ] Update `src/store/useAuthStore.ts`:
  - Remove Drive OAuth scopes
  - Remove `driveService` imports
  - Add storage sync
  - Update `syncData()` to process pending operations

### Phase 3: Remove Google Drive

- [ ] Delete `src/services/google/driveService.ts`
- [ ] Remove Drive-related code from `useAuthStore.ts`
- [ ] Remove `driveEnabled` from settings
- [ ] Remove Drive OAuth from Google Auth config

### Phase 4: Test

- [ ] Test file upload (< 50 MB)
- [ ] Test file download
- [ ] Test file deletion
- [ ] Test sync on login
- [ ] Test deletion sync

---

## File Size Handling

| File Size | Handling |
|-----------|----------|
| < 50 MB | Upload to Supabase Storage ✅ |
| > 50 MB | Show error, suggest compression |

---

## Storage Usage Tracking

```sql
-- Track storage per user
UPDATE users 
SET storage_used = (
  SELECT COALESCE(SUM(size), 0)
  FROM storage.objects
  WHERE name LIKE user_id || '%'
)
WHERE id = 'user-id';
```

---

## Cost Projection

| Users | Storage | Supabase Cost |
|-------|---------|---------------|
| 100 | 1 GB | Free |
| 1,000 | 10 GB | Free (1 GB included) |
| 10,000 | 100 GB | ~$2/mo |

**Google Drive:** Removed - saves OAuth complexity.

---

## Your Next Steps

1. **Create storage bucket** in Supabase Dashboard → Storage
2. **Update client code** to use Supabase Storage
3. **Test file operations**
4. **Remove Drive code**

---

## Files to Modify

| File | Action |
|------|--------|
| `src/db.ts` | Update interfaces |
| `src/services/supabaseStorage.ts` | New file |
| `src/services/supabaseSync.ts` | Add sync status |
| `src/store/useAuthStore.ts` | Remove Drive, add Storage |
| `src/services/google/driveService.ts` | Delete |
| `src/constants.ts` | Update limits |
