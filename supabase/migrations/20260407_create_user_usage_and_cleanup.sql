-- Migration: Create user_usage table, drop dead columns
-- Moves AI usage tracking from users.usage JSONB to a dedicated table
-- Drops refresh_token, refresh_secret, and usage from users table

BEGIN;

-- 1. Create user_usage table with explicit columns for atomic updates
CREATE TABLE user_usage (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  ai_daily_count INTEGER DEFAULT 0,
  ai_top_count INTEGER DEFAULT 0,
  ai_medium_count INTEGER DEFAULT 0,
  ai_small_count INTEGER DEFAULT 0,
  sync_thoughts INTEGER DEFAULT 0,
  daily_anchor TEXT,
  weekly_anchor TEXT,
  monthly_anchor TEXT,
  weekly_top_count INTEGER DEFAULT 0,
  weekly_medium_count INTEGER DEFAULT 0,
  weekly_small_count INTEGER DEFAULT 0,
  monthly_top_count INTEGER DEFAULT 0,
  monthly_medium_count INTEGER DEFAULT 0,
  monthly_small_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Migrate existing usage JSONB → user_usage columns
INSERT INTO user_usage (
  user_id, ai_daily_count, ai_top_count, ai_medium_count, ai_small_count,
  sync_thoughts, daily_anchor, weekly_anchor, monthly_anchor,
  weekly_top_count, weekly_medium_count, weekly_small_count,
  monthly_top_count, monthly_medium_count, monthly_small_count
)
SELECT 
  id,
  COALESCE((usage->>'ai_daily_count')::int, 0),
  COALESCE((usage->>'ai_top_count')::int, 0),
  COALESCE((usage->>'ai_medium_count')::int, 0),
  COALESCE((usage->>'ai_small_count')::int, 0),
  COALESCE((usage->>'sync_thoughts')::int, 0),
  usage->>'daily_anchor',
  usage->>'weekly_anchor',
  usage->>'monthly_anchor',
  COALESCE((usage->>'weekly_top_count')::int, 0),
  COALESCE((usage->>'weekly_medium_count')::int, 0),
  COALESCE((usage->>'weekly_small_count')::int, 0),
  COALESCE((usage->>'monthly_top_count')::int, 0),
  COALESCE((usage->>'monthly_medium_count')::int, 0),
  COALESCE((usage->>'monthly_small_count')::int, 0)
FROM users
WHERE usage IS NOT NULL;

-- 3. Drop dead columns from users table
ALTER TABLE users DROP COLUMN usage;
ALTER TABLE users DROP COLUMN refresh_token;
ALTER TABLE users DROP COLUMN refresh_secret;

-- 4. Enable RLS on user_usage
ALTER TABLE user_usage ENABLE ROW LEVEL SECURITY;

-- Users can READ their own usage (for UI display)
CREATE POLICY "Users view own usage" ON user_usage
  FOR SELECT USING (user_id = auth.uid()::text);

-- NO INSERT/UPDATE/DELETE for anon key — only server (service role) can modify

COMMIT;
