# Cyberia Migration Plan: Vercel KV → Supabase (PostgreSQL + Edge Functions)

## Overview

Migrate from Vercel KV to Supabase while keeping:
- Google Auth (existing, on Vercel)
- Google Drive file storage (existing)
- Dexie local-first architecture (existing)

**Key architectural change:** Use Supabase Edge Functions instead of Vercel API routes to avoid Vercel's 12-function limit.

## Why Migrate

| Current Pain | Solution with Supabase |
|--------------|------------------------|
| No proper users table | Dedicated `users` table with RLS |
| KV = black box blob | Queryable relational data |
| Can't query across users | Full SQL for analytics |
| No admin dashboard | Easy dashboard with SQL queries |
| Vercel 12-function limit | Unlimited Supabase Edge Functions |
| Hard to scale to 1000+ users | Proper indexing, constraints |

---

## Target Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Dexie     │  │   Zustand   │  │  Google OAuth       │ │
│  │ (IndexedDB) │  │   (State)   │  │  (Vercel)          │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│         │                │                    │            │
│         ▼                ▼                    ▼            │
│  ┌───────────────────────────────────────────────────────┐ │
│  │               Cyberia Frontend                        │ │
│  └───────────────────────────────────────────────────────┘ │
└──────────────────────────┬──────────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
┌─────────────┐   ┌─────────────────┐   ┌─────────────────┐
│   Vercel    │   │  Supabase       │   │   Google       │
│   (Google   │   │  Edge Functions │   │   Drive        │
│   OAuth)    │   │  (API)          │   │   (Files)      │
│             │   └────────┬────────┘   └─────────────────┘
└─────────────┘            │
                           ▼
                    ┌─────────────────┐
                    │   Supabase      │
                    │   PostgreSQL    │
                    └─────────────────┘
```

### API Distribution

| Functionality | Location | Why |
|---------------|----------|-----|
| Google OAuth | Vercel `api/google-auth.ts` | Needs to set Vercel cookies |
| Google Auth Callback | Vercel `api/auth/callback.ts` | Needs to set Vercel cookies |
| AI Chat | Vercel `api/chat.ts` | Uses Groq SDK, stays on Vercel |
| User CRUD | Supabase Edge Functions | Avoids Vercel limit |
| Spaces CRUD | Supabase Edge Functions | Avoids Vercel limit |
| Thoughts CRUD | Supabase Edge Functions | Avoids Vercel limit |
| Stacks CRUD | Supabase Edge Functions | Avoids Vercel limit |
| Publish | Supabase Edge Functions | Avoids Vercel limit |
| Feedback | Supabase Edge Functions | Avoids Vercel limit |
| Payments | Supabase Edge Functions | Avoids Vercel limit |
| Admin | Supabase Edge Functions | Avoids Vercel limit |

---

## Database Schema

```sql
-- Users table (replaces KV profile blobs)
CREATE TABLE users (
    id TEXT PRIMARY KEY,  -- Google sub (user unique ID)
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    avatar TEXT,
    plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
    subscription_status TEXT DEFAULT 'none',
    expiry_date TIMESTAMP,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Spaces table
CREATE TABLE spaces (
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
CREATE TABLE stacks (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    space_id TEXT REFERENCES spaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#6366f1',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Thoughts table (main content)
CREATE TABLE thoughts (
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
CREATE TABLE published_spaces (
    id TEXT PRIMARY KEY,
    space_id TEXT REFERENCES spaces(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    snapshot JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP
);

-- Feedback table
CREATE TABLE feedback (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    type TEXT NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Payments table
CREATE TABLE payments (
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
CREATE INDEX idx_spaces_user ON spaces(user_id);
CREATE INDEX idx_stacks_space ON stacks(space_id);
CREATE INDEX idx_stacks_user ON stacks(user_id);
CREATE INDEX idx_thoughts_space ON thoughts(space_id);
CREATE INDEX idx_thoughts_user ON thoughts(user_id);
CREATE INDEX idx_thoughts_type ON thoughts(type);
CREATE INDEX idx_thoughts_status ON thoughts(status);
CREATE INDEX idx_published_user ON published_spaces(user_id);
CREATE INDEX idx_feedback_user ON feedback(user_id);
CREATE INDEX idx_payments_user ON payments(user_id);

-- Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE stacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE thoughts ENABLE ROW LEVEL SECURITY;
ALTER TABLE published_spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
-- Note: Since we use Google Auth (not Supabase Auth), RLS uses custom validation
-- In Edge Functions, we validate the Google token manually and pass user_id

CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (id = current_setting('request.jwt.claims', true)::jsonb->>'sub');
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (id = current_setting('request.jwt.claims', true)::jsonb->>'sub');
CREATE POLICY "Users can view own spaces" ON spaces FOR SELECT USING (user_id = current_setting('request.jwt.claims', true)::jsonb->>'sub');
CREATE POLICY "Users can manage own spaces" ON spaces FOR ALL USING (user_id = current_setting('request.jwt.claims', true)::jsonb->>'sub');
CREATE POLICY "Users can view own stacks" ON stacks FOR SELECT USING (user_id = current_setting('request.jwt.claims', true)::jsonb->>'sub');
CREATE POLICY "Users can manage own stacks" ON stacks FOR ALL USING (user_id = current_setting('request.jwt.claims', true)::jsonb->>'sub');
CREATE POLICY "Users can view own thoughts" ON thoughts FOR SELECT USING (user_id = current_setting('request.jwt.claims', true)::jsonb->>'sub');
CREATE POLICY "Users can manage own thoughts" ON thoughts FOR ALL USING (user_id = current_setting('request.jwt.claims', true)::jsonb->>'sub');
```

### Alternative: Bypass RLS in Edge Functions

Since you're validating Google tokens in Edge Functions, you can use the service role key to bypass RLS entirely. This is simpler but requires careful code:

```typescript
// Use service role to bypass RLS
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

// Then filter by user_id manually in queries
const { data } = await supabaseAdmin
  .from('users')
  .select('*')
  .eq('id', userId)  // User ID from validated Google token
```

---

## Migration Steps

### Phase 1: Setup Supabase

- [ ] Create Supabase project at supabase.com (free tier)
- [ ] Run SQL schema in Supabase SQL Editor
- [ ] Get Supabase credentials from Dashboard: Settings → API
  - Project URL
  - `anon` public key
  - `service_role` secret key
- [ ] Add Edge Function secrets: Settings → Edge Functions → Secrets
  - Add `SUPABASE_SERVICE_ROLE_KEY`
  - Add `GOOGLE_CLIENT_ID`
  - Add `GOOGLE_CLIENT_SECRET`

### Phase 2: Create Supabase Edge Functions

You can create functions via the **Supabase Dashboard → Edge Functions** or using the CLI. Here's both approaches:

#### Option A: Via Dashboard (Recommended)
1. Go to Edge Functions in Dashboard
2. Click "Deploy a new function" → "Via Editor"
3. Copy-paste your function code
4. Click Deploy

#### Option B: Via CLI
```bash
supabase functions new user
# Edit supabase/functions/user/index.ts
supabase functions deploy user
```

#### Functions to Create

- [ ] Create `user` function - User CRUD (profile, settings, sync)
- [ ] Create `spaces` function - Space CRUD
- [ ] Create `thoughts` function - Thought CRUD
- [ ] Create `stacks` function - Stack CRUD
- [ ] Create `publish` function - Publish functionality
- [ ] Create `feedback` function - Feedback
- [ ] Create `payments` function - Payments
- [ ] Create `admin` function - Admin analytics

#### Set Secrets
Go to Settings → Edge Functions → Secrets:
```
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

### Phase 3: Client Updates

- [ ] Install `@supabase/supabase-js` in client
- [ ] Create `src/lib/supabase.ts` - Client-side Supabase config
- [ ] Update auth flow to sync user to Supabase on Google login
- [ ] Add sync mechanism: Dexie ↔ Supabase Edge Functions
- [ ] Update API calls to use Supabase functions instead of Vercel API

### Phase 4: Keep Vercel Functions (Lightweight)

- [ ] Keep `api/google-auth.ts` - OAuth flow (needs Vercel cookies)
- [ ] Keep `api/auth/callback.ts` - Auth callback
- [ ] Keep `api/chat.ts` - Groq AI API
- [ ] Remove KV dependencies from remaining Vercel functions

### Phase 5: Admin Dashboard

- [ ] Create `/admin` route (protected)
- [ ] User management table
- [ ] Analytics: daily active users
- [ ] Analytics: thoughts per user
- [ ] Analytics: storage usage
- [ ] Export functionality (CSV)

### Phase 6: Data Migration (Optional)

- [ ] Export existing KV data
- [ ] Write migration script
- [ ] Import to Supabase
- [ ] Verify data integrity

### Phase 7: Cleanup

- [ ] Remove KV dependencies from Supabase Edge Functions
- [ ] Remove KV from package.json
- [ ] Test all functionality
- [ ] Monitor for 1 week

---

## File Structure

### Supabase Edge Functions (via Dashboard)

Create these in **Dashboard → Edge Functions**:
- `user` - User CRUD
- `spaces` - Space CRUD  
- `thoughts` - Thought CRUD
- `stacks` - Stack CRUD
- `publish` - Publish functionality
- `feedback` - Feedback
- `payments` - Payments
- `admin` - Admin analytics

### Frontend Updates

```
src/
├── lib/
│   └── supabase.ts        # Client-side Supabase (anon key)
├── components/
│   └── Admin/             # Admin dashboard components
└── pages/
    └── admin.tsx          # Admin page
```

### Keep on Vercel (Lightweight)

```
api/
├── google-auth.ts         # Google OAuth flow (needs cookies)
├── auth/
│   └── callback.ts        # Auth callback
└── chat.ts               # Groq AI API
```

---

## Edge Function Endpoints

All Supabase Edge Functions run at: `https://[PROJECT_REF].supabase.co/functions/v1/[name]`

| Function | Endpoint | Method | Description |
|----------|----------|--------|-------------|
| user | `/functions/v1/user` | POST | profile, settings, sync |
| spaces | `/functions/v1/spaces` | GET/POST | List/create spaces |
| spaces | `/functions/v1/spaces` | PUT/DELETE | Update/delete space |
| thoughts | `/functions/v1/thoughts` | GET/POST | List/create thoughts |
| thoughts | `/functions/v1/thoughts` | PUT/DELETE | Update/delete thought |
| stacks | `/functions/v1/stacks` | GET/POST | List/create stacks |
| stacks | `/functions/v1/stacks` | PUT/DELETE | Update/delete stack |
| publish | `/functions/v1/publish` | GET/POST | Published spaces |
| feedback | `/functions/v1/feedback` | GET/POST | Feedback |
| payments | `/functions/v1/payments` | GET/POST | Payments |
| admin | `/functions/v1/admin` | GET | Admin analytics |

### Client Usage Example

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

// Call Edge Function
const { data, error } = await supabase.functions.invoke('user', {
  body: { action: 'profile', userId: 'google-sub-id' }
})
```

### Vercel Endpoints (Keep)

| Endpoint | Description |
|----------|-------------|
| `/api/google-auth` | Google OAuth initiation |
| `/api/auth/callback` | Google OAuth callback |
| `/api/chat` | Groq AI chat |

---

## Environment Variables

### Supabase (set via CLI or Dashboard)

```bash
# Supabase Edge Functions will access these via Deno.env.get()
supabase functions secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
supabase functions secrets set GOOGLE_CLIENT_ID=your_client_id
supabase functions secrets set GOOGLE_CLIENT_SECRET=your_client_secret
```

### Frontend (.env)

```
VITE_SUPABASE_URL=https://[PROJECT_REF].supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### Vercel (keep existing)

```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GROQ_API_KEY=...
```

---

## Backward Compatibility

- Dexie remains the primary local store
- Supabase acts as cloud sync + user management
- Users without Supabase sync can continue using local-only mode

---

## Cost Projection

| Users | Supabase Free | Notes |
|-------|---------------|-------|
| 0-500 | ✅ Free | 2M edge function invocations/mo, 500MB DB |
| 500-2000 | ~$25/mo | Pro plan |
| 2000+ | ~$50/mo | Pro plan |

**Vercel:** Remove KV (saves potential $5+/mo at scale), keep free tier for OAuth + Chat.

---

## Your Next Steps

1. **Create Supabase project** at https://supabase.com/database.new
2. **Run SQL** from this plan in the SQL Editor
3. **Deploy Edge Functions** via Dashboard (user, spaces, thoughts, stacks, publish, feedback, payments, admin)
4. **Add secrets** in Settings → Edge Functions → Secrets

---

## Edge Function Development Workflow

### Via Dashboard (Your Approach)

1. **Create**: Go to Edge Functions → Deploy new function → Via Editor
2. **Edit**: Modify code in the browser editor
3. **Deploy**: Click "Deploy function" button
4. **Test**: Use the built-in test runner or curl:

```bash
# Test your function
curl -X POST 'https://[PROJECT_REF].supabase.co/functions/v1/user' \
  -H 'Authorization: Bearer [ANON_KEY]' \
  -H 'Content-Type: application/json' \
  -d '{"action": "profile"}'
```

### Via CLI (Optional Local Dev)

```bash
# Link to your project
supabase link --project-ref [YOUR_PROJECT_REF]

# Serve locally with hot reload
supabase functions serve user --env-file .env

# Deploy to production
supabase functions deploy user
```

### Testing from Client

```typescript
// Development
const fn = supabase.functions.invoke('user', { body: {...} })
// → calls http://localhost:54321/functions/v1/user

// Production  
const fn = supabase.functions.invoke('user', { body: {...} })
// → calls https://[ref].supabase.co/functions/v1/user
```

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Migration downtime | Keep KV as fallback during migration |
| Data loss | Export KV before migration |
| Auth issues | Keep Google Auth on Vercel, sync to Supabase |
| RLS misconfigured | Test thoroughly with test users |
| Edge function cold starts | Design for idempotent, short operations |
| Deno runtime differences | Test locally with `supabase functions serve` |

---

## Timeline Estimate

| Phase | Effort |
|-------|--------|
| Phase 1 (Setup) | 1 day |
| Phase 2 (Edge Functions) | 2-3 days |
| Phase 3 (Client) | 1-2 days |
| Phase 4 (Vercel Cleanup) | 0.5 day |
| Phase 5 (Admin) | 2-3 days |
| Phase 6-7 (Migration) | 1-2 days |
| **Total** | **~8-10 days** |
