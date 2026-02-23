-- Migration: Add missing columns for local data compatibility
ALTER TABLE spaces ADD COLUMN IF NOT EXISTS transform_scale REAL DEFAULT 1;
ALTER TABLE thoughts ADD COLUMN IF NOT EXISTS "table" JSONB DEFAULT '[]';
