# Waterfall AI Strategy - Implementation Complete

> **Status**: Implemented and Deployed
> **Last Updated**: 2026-03-24

---

## Pricing

| Plan | Price |
|------|-------|
| Pro Monthly | $10 |

---

## Quota Structure

### Current Implementation Limits

| Tier | Daily | Weekly | Monthly |
|------|-------|--------|---------|
| Premium | 15 | 100 | 400 |
| Normal | 60 | 420 | 1,800 |
| Small | 500 | 3,500 | 15,000 |
| Free | 15 (daily only) | N/A | N/A |

---

## Architecture

### Single Source of Truth

The quota system uses the **auth store** as the single source of truth for quota data across all components:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    AUTH STORE (Single Source)                        │
├─────────────────────────────────────────────────────────────────────┤
│  user.usage = {                                                     │
│    ai_daily_count, ai_top_count, ai_medium_count, ai_small_count,  │
│    daily_anchor, weekly_anchor, monthly_anchor,                      │
│    weekly_top_count, weekly_medium_count, weekly_small_count,        │
│    monthly_top_count, monthly_medium_count, monthly_small_count      │
│  }                                                                   │
└─────────────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
   ┌────────────┐     ┌────────────┐     ┌────────────┐
   │ChatOverlay │     │  Settings  │     │ Other UI   │
   │            │     │  Quota Tab │     │ Components │
   └────────────┘     └────────────┘     └────────────┘
```

### Data Flow

1. **On Chat Open**: GET `/api/chat` → Updates auth store via `updateQuotaUsage()`
2. **On Request (SSE)**: Backend returns updated counts → Updates auth store
3. **On Settings Quota Tab**: GET `/api/chat` → Updates auth store
4. **All Components**: Read directly from `user?.usage` (reactive)

### Key Actions

| Action | Location | Purpose |
|--------|----------|---------|
| `updateQuotaUsage()` | `authSlice.ts` | Centralized quota update for all components |
| `getInitialUser()` | `authSlice.ts` | Initializes user with weekly/monthly fields |
| `setAuthenticatedUser()` | `authSlice.ts` | Sets user with all quota fields |

---

## Backend Implementation

### Reset Logic (Anchor-Based)

The system uses local date anchors to track reset periods:

1. **Daily Anchor**: Resets at local midnight each day
2. **Weekly Anchor**: Resets every Monday at local midnight (ISO week)
3. **Monthly Anchor**: Resets on the 1st of each month at local midnight

### Waterfall Rules

- **First exhausted wins**: If monthly is exhausted, don't reset weekly. If weekly exhausted but monthly not, reset daily but keep weekly exhausted.
- **Counter Structure**: Each tier has 3 counters (daily, weekly, monthly) that increment independently
- **Reset on anchor change**: When anchor changes (new day/week/month), the corresponding counter resets to 0

### API Endpoints

- **GET /api/chat**: Returns current usage for all periods with anchors
- **POST /api/chat**: Increments all 3 counters (daily/weekly/monthly) for the used tier, returns via SSE

### Database Schema

Usage stored as JSONB in Supabase:
```json
{
  "ai_daily_count": 10,
  "ai_top_count": 5,
  "ai_medium_count": 3,
  "ai_small_count": 2,
  "daily_anchor": "2026-03-24",
  "weekly_anchor": "2026-03-23",
  "monthly_anchor": "2026-03-01",
  "weekly_top_count": 35,
  "weekly_medium_count": 150,
  "weekly_small_count": 1200,
  "monthly_top_count": 140,
  "monthly_medium_count": 600,
  "monthly_small_count": 5000,
  "sync_thoughts": 0
}
```

---

## Frontend UI

### Tier Selection Behavior

#### User Interaction Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                     MODEL SELECTION FLOW                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. USER CLICKS MODEL (via dropdown)                                 │
│     └─ setSelectedModel(model.id)                                    │
│     └─ setActiveTier('top') ← Optimistic UI (instant)                │
│     └─ setShowModelDropdown(false)                                   │
│                                                                      │
│  2. USER SENDS REQUEST                                               │
│     └─ POST /api/chat with { model: selectedModel }                  │
│     └─ Backend checks quota (ALL periods)                           │
│                                                                      │
│  3. BACKEND RESPONDS (SSE)                                           │
│     └─ If tier available: uses requested model                      │
│     └─ If tier exhausted: waterfall fallback + autoSwitch=true      │
│     └─ Returns: { model, tier, autoSwitch, usage_counts }           │
│                                                                      │
│  4. FRONTEND UPDATES (SSE)                                          │
│     └─ If autoSwitch=true: update activeTier + show notification    │
│     └─ Always: update quota via updateQuotaUsage()                 │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

#### Exhausted Tier Handling

| Behavior | Implementation |
|----------|----------------|
| **Exhausted tiers show gray** | `disabled={getTierStatus(...).exhausted}` + CSS `grayscale opacity-50` |
| **Can't click exhausted** | React button `disabled` attribute prevents click |
| **Free tier** | No disabled check (unlimited for Pro) |

#### State Management Pattern

**Pattern: Server-Authoritative with Optimistic UI**

| State | Source | Purpose |
|-------|--------|---------|
| `selectedModel` | Frontend local | User's selected model |
| `activeTier` | Frontend local | Badge display (user's tier choice) |
| `user?.usage` | Auth store | Quota data (server truth) |
| SSE `data.tier` | Backend | Actual tier used |

**Key Principle**: Frontend shows user's **intent** (optimistic), backend validates and returns **reality**. Only update badge when `autoSwitch=true` (actual quota exhaustion).

---

## Model Mapping

### Premium Tier (15/100/400)
- Step 3.5 Flash

### Normal Tier (60/420/1800)
- MiniMax 2.5

### Small Tier (500/3500/15000)
- Nemotron 3 Super

### Free Tier (15 daily only)
- Random Free Model (limited access)

---

## Cost Estimates

| Usage Level | Premium | Normal | Small | Monthly Cost |
|-------------|---------|--------|-------|--------------|
| Light | 10 | 20 | 100 | ~$1.50 |
| Medium | 100 | 420 | 3500 | ~$3.00 |
| Heavy | 400 | 1800 | 15000 | ~$3.10 |

**At $10 revenue → Margin: 70%**

---

## Files Modified

| File | Changes |
|------|---------|
| `api/chat.ts` | Reset logic, counter increments, anchor handling, waterfall fallback |
| `api/models.ts` | Model tiers with quota config |
| `src/constants.ts` | Updated User.usage type (weekly/monthly required), PLAN_CONFIG |
| `src/store/types.ts` | Added `updateQuotaUsage` to AuthState interface |
| `src/store/slices/authSlice.ts` | Added `updateQuotaUsage` action, weekly/monthly field initialization |
| `src/components/ChatOverlay.tsx` | Real-time quota from auth store, onClick tier update, SSE handler |
| `src/components/toolbar/Modals.tsx` | Reads from auth store, fetches on quota tab open |

---

## Recent Fixes (2026-03-24)

### Issue: Tier Auto-Switching Incorrectly

**Problem**: Badge was switching to "Normal" after every request even when quota wasn't exhausted.

**Root Causes**:
1. `useEffect` reset model selection whenever model arrays changed
2. SSE handler unconditionally updated tier on every response
3. Duplicate client-side waterfall logic conflicted with backend

**Fixes Applied**:

1. **useEffect Default Selection** (ChatOverlay.tsx:235-250)
   - Added `hasInitializedRef` to only run on initial mount
   - Added `prevPlanRef` to detect actual plan changes
   - User's selection now preserved across model list refreshes

2. **SSE Handler** (ChatOverlay.tsx:641-656)
   - Removed unconditional `else if (data.tier)` block
   - Now only updates `activeTier` when `autoSwitch=true`
   - User's manual selection preserved unless backend actually switches

3. **Removed Duplicate Waterfall** (ChatOverlay.tsx:667-752)
   - Deleted ~90 lines of client-side tier switching logic
   - Backend is now single source of truth for quota-based switching
   - Only one "Auto-switched" notification (from backend)

---

## How It Works Now

| Scenario | Behavior |
|----------|----------|
| Click Premium (quota available) | Badge shows "Premium" instantly ✅ |
| Send request with Premium | Backend uses Premium if available ✅ |
| Premium quota exhausted | Backend auto-switches to next available ✅ |
| Exhausted tier in dropdown | Grayed out, cannot click ✅ |
| Free tier | Always clickable (unlimited for Pro) ✅ |
| Model lists refresh | Your selection preserved ✅ |
| Settings > Quota tab | Shows real-time quota from database ✅ |

---

## Open Questions (Resolved)

1. [x] Should we show remaining requests or %? → **% only, no numbers**
2. [x] What happens when a tier is exhausted? → **Auto-fallback to next tier + notification**
3. [x] Should we show both "daily remaining" AND "monthly remaining"? → **Separate tabs**
4. [x] Add separate "Reset in X hours" countdown per tier? → **Shows when exhausted**
5. [x] User's selection resetting unexpectedly? → **Fixed - only resets on plan change**
6. [x] Badge flickering between tiers? → **Fixed - optimistic UI, backend authoritative**
