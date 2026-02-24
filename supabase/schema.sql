-- Cyberia Database Schema v3
-- UUIDs with local_id mapping for Dexie sync

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
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Spaces: id = UUID, local_id = original Dexie string ID
CREATE TABLE IF NOT EXISTS spaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    local_id TEXT,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    mode TEXT DEFAULT 'spatial',
    physics BOOLEAN DEFAULT true,
    "order" INT DEFAULT 0,
    transform JSONB DEFAULT '{"x": 0, "y": 0, "scale": 1}',
    theme TEXT DEFAULT 'cyberia',
    custom_bg TEXT,
    published_id TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Stacks: id = UUID, local_id = original Dexie string ID
CREATE TABLE IF NOT EXISTS stacks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    local_id TEXT,
    user_id TEXT NOT NULL,
    space_id UUID,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#6366f1',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Thoughts: id = UUID, local_id = original Dexie number ID
CREATE TABLE IF NOT EXISTS thoughts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    local_id BIGINT,
    user_id TEXT NOT NULL,
    space_id UUID,
    stack_id UUID,
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
    drive_file_id TEXT,
    google_task_list_id TEXT,
    google_calendar_event_id TEXT,
    sync_status TEXT DEFAULT 'local',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Published spaces
CREATE TABLE IF NOT EXISTS published_spaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    space_id UUID,
    user_id TEXT NOT NULL,
    snapshot JSONB NOT NULL,
    last_published TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP
);

-- Feedback
CREATE TABLE IF NOT EXISTS feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT,
    type TEXT NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_spaces_user ON spaces(user_id);
CREATE INDEX IF NOT EXISTS idx_stacks_space ON stacks(space_id);
CREATE INDEX IF NOT EXISTS idx_stacks_user ON stacks(user_id);
CREATE INDEX IF NOT EXISTS idx_thoughts_space ON thoughts(space_id);
CREATE INDEX IF NOT EXISTS idx_thoughts_user ON thoughts(user_id);
CREATE INDEX IF NOT EXISTS idx_thoughts_type ON thoughts(type);
CREATE INDEX IF NOT EXISTS idx_thoughts_status ON thoughts(status);

SELECT 'Schema v3 created successfully!' as result;
