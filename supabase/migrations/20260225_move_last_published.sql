-- Migration: Move last_published from spaces to published_spaces

-- 1. Add last_published column to published_spaces
ALTER TABLE published_spaces ADD COLUMN IF NOT EXISTS last_published TIMESTAMP DEFAULT NOW();

-- 2. Set last_published = created_at for existing records
UPDATE published_spaces SET last_published = created_at WHERE last_published IS NULL;

-- 3. Remove last_published from spaces (if exists)
ALTER TABLE spaces DROP COLUMN IF EXISTS last_published;
