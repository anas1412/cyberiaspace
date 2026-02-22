-- Cyberia Database Schema for Supabase

-- Users table (replaces KV profile blobs)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,  -- Google sub (user unique ID)
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    avatar TEXT,
    plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
    subscription_status TEXT DEFAULT 'none',
    expiry_date TIMESTAMP,
    settings JSONB DEFAULT '{}',
    usage JSONB DEFAULT '{"ai_daily_count": 0, "sync_thoughts": 0, "last_ai_reset": ""}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Spaces table
CREATE TABLE IF NOT EXISTS spaces (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    mode TEXT DEFAULT 'spatial' CHECK (mode IN ('spatial', 'kanban', 'calendar')),
    physics BOOLEAN DEFAULT true,
    "order" INT DEFAULT 0,
    transform JSONB DEFAULT '{"x": 0, "y": 0, "scale": 1}',
    theme TEXT DEFAULT 'cyberia',
    custom_bg TEXT,
    published_id TEXT,
    last_published TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Stacks table
CREATE TABLE IF NOT EXISTS stacks (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    space_id TEXT REFERENCES spaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#6366f1',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Thoughts table (main content)
CREATE TABLE IF NOT EXISTS thoughts (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    space_id TEXT REFERENCES spaces(id) ON DELETE CASCADE,
    stack_id TEXT REFERENCES stacks(id) ON DELETE SET NULL,
    x REAL DEFAULT 0,
    y REAL DEFAULT 0,
    vx REAL DEFAULT 0,
    vy REAL DEFAULT 0,
    text TEXT DEFAULT '',
    placeholder TEXT,
    description TEXT DEFAULT '',
    type TEXT NOT NULL CHECK (type IN ('label', 'text', 'tasks', 'paint', 'table', 'image', 'embed', 'file')),
    content TEXT DEFAULT '',
    image TEXT,
    drawing TEXT,
    status TEXT DEFAULT 'none' CHECK (status IN ('none', 'todo', 'doing', 'done')),
    tasks JSONB DEFAULT '[]',
    table_data JSONB DEFAULT '[]',
    date TIMESTAMP DEFAULT NOW(),
    priority TEXT DEFAULT 'none' CHECK (priority IN ('none', 'low', 'medium', 'high', 'urgent')),
    size REAL DEFAULT 1,
    "order" INT DEFAULT 0,
    layer INT DEFAULT 0,
    author TEXT,
    meta JSONB DEFAULT '{}',
    drive_file_id TEXT,
    google_task_list_id TEXT,
    google_calendar_event_id TEXT,
    sync_status TEXT DEFAULT 'local' CHECK (sync_status IN ('local', 'synced', 'pending', 'syncing', 'error')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Published spaces (for sharing)
CREATE TABLE IF NOT EXISTS published_spaces (
    id TEXT PRIMARY KEY,
    space_id TEXT REFERENCES spaces(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    snapshot JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP
);

-- Feedback table
CREATE TABLE IF NOT EXISTS feedback (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    type TEXT NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    payment_ref TEXT UNIQUE NOT NULL,
    amount INT NOT NULL,
    currency TEXT DEFAULT 'USD',
    status TEXT DEFAULT 'pending',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_spaces_user ON spaces(user_id);
CREATE INDEX IF NOT EXISTS idx_stacks_space ON stacks(space_id);
CREATE INDEX IF NOT EXISTS idx_stacks_user ON stacks(user_id);
CREATE INDEX IF NOT EXISTS idx_thoughts_space ON thoughts(space_id);
CREATE INDEX IF NOT EXISTS idx_thoughts_user ON thoughts(user_id);
CREATE INDEX IF NOT EXISTS idx_thoughts_type ON thoughts(type);
CREATE INDEX IF NOT EXISTS idx_thoughts_status ON thoughts(status);
CREATE INDEX IF NOT EXISTS idx_published_user ON published_spaces(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_user ON feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);

-- Enable RLS (optional - can enable later for security)
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE spaces ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE stacks ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE thoughts ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE published_spaces ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

SELECT 'Schema created successfully!' as result;
