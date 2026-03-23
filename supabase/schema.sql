-- Cyberia Database Schema v4
-- Unified ULID string IDs for Dexie sync

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users: id = Google sub (TEXT)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT,
    name TEXT,
    avatar TEXT,
    plan TEXT DEFAULT 'free',
    subscription_status TEXT DEFAULT 'none',
    expiry_date TIMESTAMP,
    settings JSONB DEFAULT '{}',
    usage JSONB DEFAULT '{"ai_daily_count": 0}',
    polar_customer_id TEXT,
    polar_subscription_id TEXT,
    payment_provider TEXT,
    auto_sync BOOLEAN DEFAULT false,
    is_admin BOOLEAN DEFAULT false,
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
CREATE INDEX IF NOT EXISTS idx_users_polar_customer ON users(polar_customer_id);

SELECT 'Schema v4 (ULID Unified) created successfully!' as result;
