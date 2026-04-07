-- Cyberia Database Schema v6
-- AI usage moved to dedicated user_usage table. Dead columns removed.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users: id = auth.users.id (UUID)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT,
    name TEXT,
    avatar TEXT,
    plan TEXT DEFAULT 'free',
    subscription_status TEXT DEFAULT 'none',
    expiry_date TIMESTAMP,
    settings JSONB DEFAULT '{}',
    polar_customer_id TEXT,
    polar_subscription_id TEXT,
    payment_provider TEXT,
    auto_sync BOOLEAN DEFAULT false,
    is_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Protect sensitive user columns (plan, is_admin, etc.)
-- These can only be updated by the service_role (server-side)
CREATE OR REPLACE FUNCTION protect_user_columns()
RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('role') != 'service_role' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.plan := 'free';
      NEW.subscription_status := 'none';
      NEW.expiry_date := NULL;
      NEW.is_admin := FALSE;
      NEW.polar_customer_id := NULL;
      NEW.polar_subscription_id := NULL;
      NEW.payment_provider := NULL;
      NEW.created_at := NOW();
    ELSIF TG_OP = 'UPDATE' THEN
      NEW.plan := OLD.plan;
      NEW.subscription_status := OLD.subscription_status;
      NEW.expiry_date := OLD.expiry_date;
      NEW.is_admin := OLD.is_admin;
      NEW.polar_customer_id := OLD.polar_customer_id;
      NEW.polar_subscription_id := OLD.polar_subscription_id;
      NEW.payment_provider := OLD.payment_provider;
      NEW.created_at := OLD.created_at;
      NEW.email := OLD.email;
      NEW.id := OLD.id;
    END IF;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tr_protect_user_columns
  BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION protect_user_columns();

-- AI Usage tracking (separate table so RLS can block client writes)
CREATE TABLE IF NOT EXISTS user_usage (
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Spaces: id = ULID (TEXT)
CREATE TABLE IF NOT EXISTS spaces (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    mode TEXT DEFAULT 'spatial',
    physics BOOLEAN DEFAULT true,
    "order" BIGINT DEFAULT 0,
    transform JSONB DEFAULT '{"x": 0, "y": 0, "scale": 1}',
    theme TEXT DEFAULT 'cyberia',
    custom_bg TEXT,
    published_id TEXT,
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Stacks: id = ULID (TEXT)
CREATE TABLE IF NOT EXISTS stacks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#6366f1',
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Thoughts: id = ULID (TEXT)
CREATE TABLE IF NOT EXISTS thoughts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    stack_id TEXT REFERENCES stacks(id) ON DELETE SET NULL,
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
    date TIMESTAMP WITH TIME ZONE,
    priority TEXT DEFAULT 'none',
    size REAL DEFAULT 1,
    "order" BIGINT DEFAULT 0,
    layer BIGINT DEFAULT 0,
    author TEXT,
    meta JSONB DEFAULT '{}',
    drive_file_id TEXT,
    google_task_list_id TEXT,
    google_calendar_event_id TEXT,
    sync_status TEXT DEFAULT 'local',
    storage_url TEXT,
    storage_path TEXT,
    deleted_at TIMESTAMP WITH TIME ZONE,
    archived_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    is_all_day BOOLEAN DEFAULT true,
    reminders JSONB DEFAULT '[]',
    recurrence_rule TEXT,
    location TEXT
);

-- Published spaces
CREATE TABLE IF NOT EXISTS published_spaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    space_id TEXT REFERENCES spaces(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    snapshot JSONB NOT NULL,
    last_published TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);

-- Feedback
CREATE TABLE IF NOT EXISTS feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    type TEXT NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    payment_ref TEXT UNIQUE NOT NULL,
    amount INT NOT NULL,
    currency TEXT DEFAULT 'USD',
    status TEXT DEFAULT 'pending',
    metadata JSONB DEFAULT '{}',
    terms_version TEXT,
    privacy_version TEXT,
    terms_accepted_at TIMESTAMP WITH TIME ZONE,
    consent_ip TEXT,
    consent_user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_spaces_user ON spaces(user_id);
CREATE INDEX IF NOT EXISTS idx_stacks_space ON stacks(space_id);
CREATE INDEX IF NOT EXISTS idx_stacks_user ON stacks(user_id);
CREATE INDEX IF NOT EXISTS idx_thoughts_space ON thoughts(space_id);
CREATE INDEX IF NOT EXISTS idx_thoughts_user ON thoughts(user_id);
CREATE INDEX IF NOT EXISTS idx_thoughts_type ON thoughts(type);
CREATE INDEX IF NOT EXISTS idx_thoughts_status ON thoughts(status);
CREATE INDEX IF NOT EXISTS idx_thoughts_archived ON thoughts(archived_at);
CREATE INDEX IF NOT EXISTS idx_users_polar_customer ON users(polar_customer_id);

-- Storage bucket RLS policies (user-files bucket)

CREATE POLICY IF NOT EXISTS "Users upload to own folder" ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'user-files' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY IF NOT EXISTS "Users update own files" ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'user-files' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'user-files' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY IF NOT EXISTS "Users delete own files" ON storage.objects
  FOR DELETE
  USING (bucket_id = 'user-files' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Storage size RPC function (runs as caller, not definer — storage RLS applies)
CREATE OR REPLACE FUNCTION get_user_storage_size(user_id TEXT)
RETURNS BIGINT
LANGUAGE SQL
STABLE
AS $$
  SELECT COALESCE(SUM((metadata->>'size')::BIGINT), 0)
  FROM storage.objects
  WHERE bucket_id = 'user-files' AND name LIKE user_id || '/%'
$$;

-- Enable Realtime for all core tables
-- This ensures that cross-device and post-payment updates work instantly.
BEGIN;
  -- Remove existing if any to avoid errors
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR TABLE users, spaces, stacks, thoughts, user_usage;
COMMIT;

-- Ensure replication is enabled for the tables
ALTER TABLE users REPLICA IDENTITY FULL;
ALTER TABLE spaces REPLICA IDENTITY FULL;
ALTER TABLE stacks REPLICA IDENTITY FULL;
ALTER TABLE thoughts REPLICA IDENTITY FULL;
ALTER TABLE user_usage REPLICA IDENTITY FULL;

SELECT 'Schema v5 (Archived thoughts support) created successfully!' as result;
