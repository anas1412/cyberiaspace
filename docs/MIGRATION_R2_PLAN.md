# Migration Plan: Supabase Storage to Cloudflare R2 (Full Architecture Switch)

This document provides an exhaustive, step-by-step plan to migrate **all storage-related functionality** from Supabase to Cloudflare R2. This is a total switch; Supabase Storage will be completely removed from the codebase.

## Table of Contents
1. [Core Architecture Change](#core-architecture-change)
2. [Prerequisites & Configuration](#prerequisites--configuration)
3. [Phase 1: Backend API (Vercel) Implementation](#phase-1-backend-api-vercel-implementation)
4. [Phase 2: Frontend Service (r2Storage.ts) Implementation](#phase-2-frontend-service-r2storagets-implementation)
5. [Phase 3: State Management (Zustand) Refactor](#phase-3-state-management-zustand-refactor)
6. [Phase 4: Sync & Maintenance Integration](#phase-4-sync--maintenance-integration)
7. [Phase 5: Deprecation & Deletion of Supabase](#phase-5-deprecation--deletion-of-supabase)
8. [Mapping: Supabase Logic -> R2 Logic](#mapping-supabase-logic---r2-logic)
9. [TODO Checklist](#todo-checklist)

---

## 1. Core Architecture Change

**Current:**
Client directly calls `@supabase/supabase-js` storage methods. This requires the Supabase URL/Key to be public but uses RLS for security.

**Proposed:**
Client calls a new Vercel Serverless Function (`api/storage.ts`).
1. **Uploads:** Client requests a **Presigned PUT URL**. Client then uploads the file directly to R2.
2. **Management (Delete/List/Usage):** Client calls the Vercel API, which performs the operation server-side using the `AWS S3 SDK` and returns the result.
3. **Security:** All Vercel API calls are protected by verifying the user's Supabase JWT.

---

## 2. Prerequisites & Configuration

- [ ] **R2 Bucket:** Create a bucket named `cyberia-user-files` (or similar).
- [ ] **R2 Tokens:** Create API tokens with `Object Read & Write` permissions.
- [ ] **CORS Policy:** Apply this JSON to the R2 bucket:
  ```json
  [
    {
      "AllowedOrigins": ["http://localhost:5173", "https://cyberia.vercel.app"],
      "AllowedMethods": ["GET", "PUT", "DELETE", "POST"],
      "AllowedHeaders": ["Content-Type", "Authorization"],
      "MaxAgeSeconds": 3000
    }
  ]
  ```

---

## 3. Phase 1: Backend API (Vercel) Implementation

Create `api/storage.ts`. This single endpoint will handle multiple actions:

- `action=presign`: 
  - Input: `path`, `contentType`.
  - Logic: Use `getSignedUrl` with `PutObjectCommand`.
  - Security: Ensure `path` starts with the authenticated `userId`.
- `action=delete`:
  - Input: `path`.
  - Logic: Use `DeleteObjectCommand`.
- `action=deleteBatch`:
  - Input: `paths[]`.
  - Logic: Use `DeleteObjectsCommand` (up to 1000 items).
- `action=list`:
  - Input: `prefix` (defaults to `userId/`).
  - Logic: Use `ListObjectsV2Command`.
- `action=usage`:
  - Logic: Iteratively list all objects under `userId/` and sum the `Size` field.

---

## 4. Phase 2: Frontend Service (r2Storage.ts) Implementation

Create `src/services/r2Storage.ts` to mirror the existing `supabaseStorage` interface.

| Method | Supabase Implementation | R2 Implementation |
| :--- | :--- | :--- |
| `uploadFile` | `supabase.storage.upload` | Fetch presigned URL -> `PUT` file to URL. |
| `deleteFile` | `supabase.storage.remove` | Fetch `api/storage?action=delete`. |
| `getSignedUrl` | `supabase.storage.getPublicUrl` | Return `R2_PUBLIC_DOMAIN + path`. |
| `listFiles` | `supabase.storage.list` | Fetch `api/storage?action=list`. |
| `fileExists` | `supabase.storage.getPublicUrl` check | Fetch `api/storage?action=list` or Head request. |
| `getStorageUsage` | List + Reduce sizes | Fetch `api/storage?action=usage`. |
| `deleteAllUserFiles`| List recursive + remove | Fetch `api/storage?action=list` -> `deleteBatch`. |
| `cleanupOrphanedFiles`| Complex recursive list + diff | Mirror logic using `action=list` and `action=deleteBatch`. |

---

## 5. Phase 3: State Management (Zustand) Refactor

**File:** `src/store/slices/storageSlice.ts`
- Replace `import { supabaseStorage } from ...` with `import { r2Storage } from ...`.
- Refactor `uploadThoughtBlob`:
  - Call `r2Storage.uploadFile`.
  - The return `url` will now be from the R2 Public Domain.
- Refactor `calculateUsage`:
  - Call `r2Storage.getStorageUsage`.
- Refactor `removeCloudAsset`:
  - Call `r2Storage.deleteFile`.

---

## 6. Phase 4: Sync & Maintenance Integration

**File:** `src/services/sync/syncOrchestrator.ts`
- Update `deleteMedia` to call `r2Storage.deleteFile`.
- Update "Step 8: Final structural storage cleanup":
  - Call `r2Storage.cleanupOrphanedFiles`.
  - Ensure the R2 version handles the same nested folder structure (`userId/thoughtId/fileName`).

---

## 7. Phase 5: Deprecation & Deletion of Supabase

- [ ] **Broken Link Management:** Implement a small utility to check if a `storageUrl` contains `supabase.co`. If so, hide the attachment or show a "Legacy file unavailable" notice.
- [ ] **One-time Database Wipe (Optional):** Run `UPDATE thoughts SET storage_url = NULL, storage_path = NULL` to clear broken links.
- [ ] **Delete File:** Remove `src/services/supabaseStorage.ts`.
- [ ] **Uninstall:** `npm uninstall supabase` (Wait! Only if not used for DB/Auth. Keep if used for DB).

---

## 8. Mapping: Supabase Logic -> R2 Logic

We will preserve the **Unique Folder Protocol**:
- Paths remain: `${userId}/${thoughtId}/${fileName}`.
- This ensures that if we ever move back or to another S3 provider, the database paths remain consistent.

The **Media Sweep** logic will be **fully preserved**:
- It will still build a `Set` of valid paths from local thoughts.
- It will still list the cloud storage objects.
- It will still compute the difference (orphans) and delete them.
- **Change:** It will use the `deleteBatch` R2 API for much faster execution than Supabase's individual removals.

---

## 9. TODO Checklist

### Infrastructure
- [ ] Create R2 Bucket
- [ ] Configure R2 CORS (PUT/GET/DELETE/POST)
- [ ] Add R2 Env Vars to Vercel/Local

### Backend (Vercel)
- [ ] `npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner`
- [ ] Implement `api/storage.ts` with Actions: `presign`, `delete`, `deleteBatch`, `list`, `usage`.

### Frontend
- [ ] Create `src/services/r2Storage.ts` (Mirror `supabaseStorage` interface).
- [ ] Update `storageSlice.ts`: Replace Supabase calls with R2 calls.
- [ ] Update `syncOrchestrator.ts`: Update Media Sweep and deletion calls.
- [ ] Add "R2_PUBLIC_DOMAIN" to Vite env (`VITE_R2_PUBLIC_DOMAIN`).

### Cleanup
- [ ] Verify R2 Upload/Delete/List/Sweep works.
- [ ] Delete `src/services/supabaseStorage.ts`.
- [ ] Wipe Supabase Storage Bucket.
