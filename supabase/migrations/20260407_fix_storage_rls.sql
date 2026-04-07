-- Migration: Fix storage bucket RLS policies
-- Removes overly permissive "Allow public" policies that allowed unauthenticated access
-- Fixes authenticated policies to enforce user folder isolation

BEGIN;

-- 1. Drop the 4 dangerous public policies (allow unauthenticated access to ALL files)
DROP POLICY IF EXISTS "Allow public insert" ON storage.objects;
DROP POLICY IF EXISTS "Allow public select" ON storage.objects;
DROP POLICY IF EXISTS "Allow public update" ON storage.objects;
DROP POLICY IF EXISTS "Allow public delete" ON storage.objects;

-- 2. Drop the 3 authenticated policies that lack user folder isolation
DROP POLICY IF EXISTS "Allow authenticated reads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes" ON storage.objects;

-- Note: "Allow authenticated uploads" already has correct folder check, keep it

-- 3. Create properly scoped policies that enforce user folder isolation

-- Users can update files in their own folder only
CREATE POLICY "Users update own files" ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'user-files' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'user-files' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Users can delete files in their own folder only
CREATE POLICY "Users delete own files" ON storage.objects
  FOR DELETE
  USING (bucket_id = 'user-files' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Users can upload to their own folder only (already existed, recreated for consistency)
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
CREATE POLICY "Users upload to own folder" ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'user-files' AND (storage.foldername(name))[1] = auth.uid()::text);

COMMIT;
