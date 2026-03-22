# Alert Implementation Plan

> Brainstorming only — not implemented yet.

---

## 1. Reminders (In-App Toast Notifications)

### The Problem
Users can set reminders (5 min before, 1 day before, etc.) on thoughts, but nothing ever fires them. Reminders are stored in IndexedDB but never acted upon.

### Options

#### Option A: Tab-Level Polling (Simplest)
- A singleton `setInterval` (~30-60s) runs in the main thread.
- On each tick, query IndexedDB for thoughts where `startTime - reminderTime <= now < startTime`.
- Fire a toast notification in-app using a new `useToastStore`.
- **Pros:** Dead simple, no service worker needed, works offline.
- **Cons:** Only fires when the tab is open and in focus.

#### Option B: Service Worker + Background Sync
- Register a service worker that handles `setInterval` logic even when tab is closed.
- Use Background Sync API or Alarms API (Chrome) to schedule checks.
- Fire a browser push notification via the Notification API.
- **Pros:** Fires even when tab is closed.
- **Cons:** Requires Notification permission flow, more complex, service worker lifecycle management.

#### Option C: Supabase Edge Function + Cron (Cloud)
- On reminder creation, insert a row into a `scheduled_notifications` table with `fire_at = startTime - reminderMinutes * 60000`.
- A cron job (Vercel Cron or Supabase pg_cron) runs every minute, queries overdue notifications, sends push notifications via a provider (e.g., OneSignal, Firebase, or raw Web Push), then marks them sent.
- **Pros:** Works across devices, works with browser closed.
- **Cons:** Requires push subscription infrastructure, server-side push credentials (VAPID), and a delivery queue.

### Recommendation
Start with **Option A** for in-app toasts. It's the fastest path to a working feature. Users see reminders fire when they're actively using the app. Upgrade to Option B/C only if cross-device or background notifications are requested.

---

## 2. Repeat (Recurrence Engine)

### The Problem
Users can save recurrence rules (`FREQ=DAILY`, etc.) but the app never generates recurring instances or expands them on a calendar view.

### Options

#### Option A: Client-Side RRULE Expansion (Simplest)
- Use the `rrule` npm library to parse stored `recurrenceRule` strings.
- On calendar/spatial view, expand occurrences client-side for the visible date range.
- Generate ephemeral thought instances for rendering (don't persist every occurrence).
- **Pros:** No server changes, works offline, no storage bloat.
- **Cons:** Recurring thoughts appear only on the current device; other devices only see the master thought.

#### Option B: Pre-Generated Instances
- When a recurring thought is created/edited, compute the next N occurrences (e.g., 30 days) and insert them as separate thought rows in IndexedDB.
- A background job regenerates new occurrences as the window slides forward.
- **Pros:** Consistent across devices, works offline, fully queryable.
- **Cons:** Storage bloat, complex sync conflicts (what if the master changes?), requires regeneration logic.

#### Option C: Server-Side Expansion
- Store only the master thought with its RRULE in Supabase.
- A serverless function (triggered by Vercel Cron) computes and returns occurrences for a given date range when the client requests them.
- **Pros:** Single source of truth, no device divergence.
- **Cons:** Requires network for expansion, adds latency to calendar views.

### Recommendation
**Option A** is the right starting point. The `rrule` library is lightweight (~15kb), well-maintained, and handles complex recurrence (byweekday, until, count, etc.). It works entirely client-side and generates occurrences on demand. This is how Google Calendar handles recurring events in their UI — the expansion happens at render time, not storage time.

---

## 3. Browser Push Notifications

### The Problem
No push notification infrastructure exists. Users have no way to receive reminder alerts on their device unless the app tab is open.

### Options

#### Option A: Web Push (VAPID) + Supabase Edge Functions
- Generate VAPID keys (public/private pair) for the application.
- On first launch, request Notification permission. If granted, subscribe the browser to push via `pushManager.subscribe()` and store the `pushSubscription` object in Supabase (per user).
- Create a Supabase Edge Function (or Vercel API route) that accepts a notification payload and delivers it via Web Push protocol to all subscribed endpoints.
- Trigger this function when a reminder fires (either via a cron job or when the user opens the app and triggers Option A's polling).
- **Pros:** Cross-device, works with browser closed, industry standard.
- **Cons:** VAPID key management, subscription lifecycle (expired subscriptions), payload size limits (max 4KB per push).

#### Option B: OneSignal / Firebase Cloud Messaging
- Integrate a third-party push service (OneSignal or FCM) to handle push delivery.
- Store device tokens per user in Supabase.
- Server-side trigger sends to the provider API.
- **Pros:** Handles delivery, expired tokens, and analytics out of the box. Free tier available.
- **Cons:** Third-party dependency, account setup, potential data sharing concerns.

### Recommendation
**Option A** (Web Push) is cleaner long-term — no third-party dependency, full control. But it's also more work. If speed is the priority, Option B (OneSignal) gets push notifications working fastest. OneSignal also handles iOS Safari push which Web Push doesn't natively support on iOS.

---

## 4. In-App Toast / Notification System

### The Problem
The only "notification" system is modal dialogs via `useModalStore`. There's no non-blocking toast or snackbar for things like: "Saved", "Reminder: Project deadline in 1 hour", "Sync complete", etc.

### Options

#### Option A: Simple Toast Store (Recommended)
- Create a `useToastStore` with a `toasts` array: `{ id, message, type: 'info'|'success'|'warning'|'error', duration }`.
- A `<ToastContainer>` component renders toasts at a fixed position (bottom-right or top-right).
- `openToast(message, type, duration)` helper function for fire-and-forget toasts.
- Animations via framer-motion (already used in the codebase).
- **Pros:** Zero dependencies, fully custom, works offline.
- **Cons:** Only visible in the current tab.

#### Option B: React Hot Toast or Sonner
- Use a third-party library like `react-hot-toast` or `sonner`.
- Pros: Battle-tested, accessible, keyboard-friendly.
- Cons: Additional bundle size (~5-15kb), less customizable styling to match Cyberia's theme.

### Recommendation
**Option A** — a custom toast store is straightforward (30-50 lines of code) and matches Cyberia's aesthetic better than a generic third-party library.

---

## 5. Unified Alert Architecture

Here's how the pieces fit together:

```
User sets reminder on thought
         │
         ▼
  Stored in IndexedDB & Supabase
  (startTime, reminders[], isAllDay)
         │
         ▼
  ┌─────────────────────────────────────────┐
  │  Tab is open?                           │
  │  ├── YES → Tab Polling (Option A, Rem)  │
  │  │         └── Show in-app toast         │
  │  │             (Toast System)            │
  │  │                                      │
  │  │         Push subscribed?              │
  │  │         └── YES → Web Push fired     │
  │  │             (Vercel API Route)        │
  │  │             via push provider          │
  │  │                                      │
  │  └── NO  → Browser closed               │
  │           ├── Cron job (pg_cron)        │
  │           │   queries overdue reminders  │
  │           │   └── Triggers push          │
  │           └── OR: User opens app later  │
  │               (Tab Polling catches up)  │
  └─────────────────────────────────────────┘
```

For **recurring thoughts**, the flow adds one step:

```
User sets FREQ=DAILY on thought
         │
         ▼
  Stored with recurrenceRule
         │
         ▼
  On calendar/spatial render
  ├── rrule library expands occurrences
  │   for visible date range
  └── Render expanded instances
      (no DB write needed)
```

---

## Phased Implementation Order

### Phase 1: Quick Wins (Minimal Effort)
1. **Toast system** (`useToastStore`) — foundations for all future notifications
2. **Tab-level reminder polling** — fires in-app toasts for due reminders

### Phase 2: Core Recurrence
3. **RRULE expansion** — install `rrule`, expand on calendar/render

### Phase 3: Push Notifications (More Effort)
4. **Web Push setup** — VAPID keys, subscription storage, push function
5. **Reminder → Push pipeline** — connect polling to push delivery

### Phase 4: Polish
6. **Supabase cron fallback** — ensure reminders fire even if user hasn't opened the app
7. **iOS push support** — OneSignal as fallback for Safari on iOS

---

## Open Questions

1. **Permission UX:** When should we ask for Notification permission? On first reminder creation? Onboarding? Never (only in-app toasts)?
2. **Recurring thought identity:** If a recurring thought instance is completed, should it mark just that instance done or all future instances? (Google Calendar uses the former.)
3. **Past occurrence generation:** Should we pre-generate past occurrences of recurring thoughts for historical calendar views, or only show forward?
4. **Sync conflicts on recurring thoughts:** If a recurring thought is modified on two devices before sync, which master instance wins?
5. **Delete behavior:** If a recurring thought is deleted, should all past/future instances be tombstoned, or just the future ones?
6. **Reminder scope:** Should reminders fire only for the original thought, or also for each generated recurrence instance?

---

*Last updated: 2026-03-22 — brainstorming draft*
