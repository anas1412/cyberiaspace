# Time & Calendar System — Implementation Plan

## Overview

This document outlines the plan to add a comprehensive Time & Calendar system to Cyberia, including scheduling, reminders, recurrence, and smart automation. The system will be built on the existing spatial-thinking architecture without compromising the local-first philosophy.

---

## Phase 1: The Foundation (Schema & Data)

### 1.1 Database Schema Upgrade

#### Local Database (`src/db.ts`)

Extend the `Thought` entity to support temporal data:

```typescript
interface Thought {
  // ... existing fields ...

  // === NEW FIELDS ===
  startTime?: number | null;   // Unix timestamp (ms) — source of truth for ALL dates
  endTime?: number | null;     // Unix timestamp (ms) — for duration/range
  isAllDay?: boolean;          // Toggle for "Whole Day" events (ignore timezone)
  reminders?: number[];        // Array of minutes before event (e.g., [15, 60])
  recurrenceRule?: string | null; // RFC 5545 string (e.g., "FREQ=WEEKLY;BYDAY=MO")
  location?: string | null;    // Context (e.g., "Zoom", "Office", "Home")
}
```

#### Cloud Database (Supabase)

Migration file: `supabase/migrations/20260322_add_time_fields.sql`

```sql
ALTER TABLE thoughts 
ADD COLUMN start_time timestamptz,
ADD COLUMN end_time timestamptz,
ADD COLUMN is_all_day boolean DEFAULT false,
ADD COLUMN reminders jsonb DEFAULT '[]',
ADD COLUMN recurrence_rule text,
ADD COLUMN location text;

-- Index for efficient time-based queries
CREATE INDEX idx_thoughts_start_time ON thoughts (start_time);
CREATE INDEX idx_thoughts_end_time ON thoughts (end_time);
```

### 1.2 Data Migration Strategy

On first launch after migration:

1. Read all thoughts with existing `date` string values
2. Parse the date string (e.g., "2024-03-22")
3. Set `startTime = <date> 00:00:00 UTC` (Unix ms)
4. Set `endTime = <date> 23:59:59 UTC` (Unix ms)
5. Set `isAllDay = true`
6. **REMOVE** the original `date` string field (schema cleanup)
7. One-time operation, idempotent (check if `startTime` already exists before migrating)

### 1.3 Calendar Strategy Update

The calendar currently relies on `thought.date`. This will be refactored:

1. **Query:** Use `startTime` range query instead of exact date match
   - `thoughts.where('startTime').between(dayStart, dayEnd)`
2. **Multi-Day Events:**
   - If `endTime > startTime + 24h` (or spans across midnight):
   - The calendar cell logic must identify these "spanning" events
   - Render them as continuous bars across multiple day cells (like Google Calendar)
   - Visual: Use a distinct background color or pill shape that connects across grid lines

### 1.4 Timezone Handling (Critical)

- **All Day Events (`isAllDay: true`):**
  - Stored as UTC midnight
  - Rendered as "Date Only" (ignore local timezone offset)
  - Example: "Jan 5 00:00 UTC" renders as "Jan 5" everywhere
- **Timed Events (`isAllDay: false`):**
  - Stored as UTC timestamp
  - Rendered in user's local timezone
  - Example: "Jan 5 14:00 UTC" renders as "Jan 5 9:00 AM EST"

### 1.5 Sync Translation

Ensure `toSnakeCase` and `toCamelCase` transformers in `syncOrchestrator.ts` handle:
- `startTime` ↔ `start_time`
- `endTime` ↔ `end_time`
- `isAllDay` ↔ `is_all_day`
- `recurrenceRule` ↔ `recurrence_rule`

---

## Phase 2: Core Logic (The Time Engine)

### 2.1 The `TimeKeeper` Service

**Location:** `src/services/time/timeKeeper.ts`

**Purpose:** A singleton service running a lightweight check loop (every 30-60s) to monitor upcoming events and fire notifications.

**Responsibilities:**
- Query `db.thoughts` for events in the upcoming window (e.g., next 1 hour)
- Check `reminders` array against current time
- Trigger browser notifications via `Notification API`
- Show in-app toasts via `useModalStore`
- Smart dismissal: track "sent" reminders in ephemeral memory (not synced) to prevent duplicates
- Context awareness: Do NOT fire if user is actively editing that thought

**State:**
```typescript
interface TimeKeeperState {
  isRunning: boolean;
  lastCheck: number;
  pendingReminders: Map<string, number[]>; // thoughtId -> sent reminder offsets
}
```

**Key Methods:**
- `start()`: Begin the check loop
- `stop()`: Halt the loop (on tab close/background)
- `checkReminders()`: Core logic — evaluate all thoughts, fire as needed
- `showNotification(thought, minutesBefore)`: Fire browser notification
- `dismissReminder(thoughtId, offset)`: Mark reminder as sent

### 2.2 Recurrence Engine

**Location:** `src/services/time/recurrence.ts`

**Purpose:** Handle repeating events without bloating the database with infinite copies.

**Implementation:**
- Use the `rrule` library (RFC 5545 standard)
- `getNextInstances(thought, count)`: Generate the next N virtual "ghost" instances
- `getInstancesInRange(thought, rangeStart, rangeEnd)`: Generate instances within a date range
- Ghost nodes are computed on-the-fly by the Calendar View, not stored in DB

**Virtual Node Structure:**
```typescript
interface VirtualThoughtInstance {
  thoughtId: string;      // Original thought ID
  instanceDate: Date;     // This specific occurrence
  isGhost: true;          // Flag to indicate it's virtual
  // Inherits all other fields from parent thought
}
```

### 2.3 Time Utilities

**Location:** `src/services/time/timeUtils.ts`

Utility functions:
- `formatTime(timestamp)`: "2:00 PM"
- `formatDate(timestamp)`: "Mar 22, 2024"
- `formatDateTime(timestamp)`: "Mar 22, 2024 at 2:00 PM"
- `isToday(timestamp)`: Boolean
- `isPast(timestamp)`: Boolean
- `isOverdue(thought)`: `now > endTime && status !== 'done'`
- `getDurationMinutes(startTime, endTime)`: Number
- `parseDateInput(input)`: Smart parsing ("tomorrow", "next monday", "in 2 hours")

---

## Phase 3: User Interface

### 3.1 Time Picker Component

**Location:** `src/components/ui/TimePicker.tsx`

**Purpose:** A modern, glassmorphism-styled input for setting time on thoughts.

**Features:**
- **Date Selection:** Mini calendar grid dropdown
- **Time Selection:** Hour/minute input with AM/PM toggle
- **All Day Toggle:** Switch to ignore time components
- **Quick Selects:** "Tomorrow Morning", "Next Week", "In 1 Hour", "Pick a Date"
- **Reminders Section:**
  - "+ Add Reminder" button
  - Options: 5 min, 15 min, 30 min, 1 hour, 1 day before
  - Custom input for arbitrary minutes
- **Recurrence Section:**
  - "Repeat" toggle
  - Options: Daily, Weekly, Monthly, Yearly
  - Advanced: "Custom Rule" (opens RFC 5545 builder)
- **Location Input:** Text field for venue/link

**States:**
- Default (no time set): Shows "Add time" placeholder
- Partial (date only): Shows date with "All Day" badge
- Complete: Shows full datetime summary
- Error: Invalid range (end before start)

### 3.2 Thought Editor Integration

**Updates to `ThoughtEditor`:**
- Add a **"Schedule" button** (clock icon) to the toolbar
- Opens `TimePicker` as a popover
- Displays a summary badge when time is set:
  - Future: "Mar 22, 2:00 PM"
  - Active (now): "Happening now" (pulsing badge)
  - Past: "Mar 22, 2:00 PM" (red tint)
- Quick actions: "Remove time", "Edit time"

### 3.3 Thought Node Visualization

**Updates to `ThoughtNode.tsx`:**

| State | Visual Indicator |
|-------|------------------|
| **No time** | No indicator |
| **Future (not started)** | Small time badge: "2:00 PM" (subtle, top-right) |
| **Active (happening now)** | Accent border pulse, "NOW" badge |
| **Past (not done)** | Red tint on time badge, "OVERDUE" badge |
| **Recurring** | Small "loop" icon next to time |
| **Has location** | Pin icon + truncated location text |

### 3.4 Calendar View Upgrade

**Updates to `calendarStrategy.ts`:**

1. **Time-Based Sorting:**
   - Within a day cell, sort thoughts vertically by `startTime`
   - Morning at top, evening at bottom

2. **Multi-Day Rendering:**
   - Detect thoughts spanning > 24h
   - Render as continuous bar across multiple cells (colSpan)
   - Visual: Distinct background color/pill

3. **Ghost Node Injection:**
   - Expand recurring thoughts into virtual instances
   - Render as semi-transparent (ghost) nodes
   - Clicking a ghost prompts: "Edit this instance" or "Edit series"

4. **Day Timeline View (Future):**
   - Y-axis: Time (00:00 to 24:00)
   - X-axis: Spatial freedom for overlapping items
   - Toggle between Month Grid and Day Timeline

### 3.5 Notifications UI

**Browser Notifications:**
- Use `Notification API`
- Request permission on first "Add Reminder" action
- Notification body: Thought text + time remaining (e.g., "in 15 minutes")

**In-App Toasts:**
- Use `useModalStore` toast system
- Less intrusive than browser notifications
- Shows for: Upcoming events (5 min warning), Active now, Overdue items

---

## Phase 4: Oracle AI Integration

### 4.1 Tool Updates

**Update `get_thought_details` output:**
```json
{
  "thought": {
    "id": "...",
    "text": "Call Mom",
    "startTime": 1711120800000,
    "endTime": 1711124400000,
    "isAllDay": false,
    "reminders": [15, 60],
    "recurrenceRule": null,
    "location": "Phone"
  }
}
```

**New Tool Suggestions (optional for V2):**
- `get_upcoming_events(count)`: Returns next N scheduled thoughts
- `get_overdue_events()`: Returns past-due uncompleted thoughts
- `get_events_on_date(date)`: Returns thoughts for a specific date

### 4.2 Prompt Engineering

Update system prompt to teach Oracle about scheduling:

```
You can now schedule thoughts by setting these fields:
- startTime: Unix timestamp in milliseconds (e.g., 1711120800000 for Mar 22, 2024 at 2:00 PM)
- endTime: Optional, for events with duration
- isAllDay: true for whole-day events
- reminders: Array of minutes before to notify (e.g., [15, 60] for 15min and 1hr before)
- recurrenceRule: RFC 5545 format (e.g., "FREQ=WEEKLY;BYDAY=MO" for every Monday)
- location: String for venue or meeting link

When a user asks to be reminded or scheduled, use update_thought to set these fields.
```

### 4.3 Natural Language Scheduling

Oracle should handle:
- "Remind me to call Mom tomorrow at 5 PM"
- "Schedule a weekly standup every Monday at 9 AM"
- "I have a meeting in the office on March 22 from 2-3 PM"
- "Remind me 30 minutes before the meeting"

---

## Phase 5: Edge Cases & Error Handling

### 5.1 Timezone Handling
- Store all times in UTC (Unix ms is timezone-agnostic)
- Display in user's local timezone
- Handle daylight saving transitions gracefully

### 5.2 Offline Behavior
- All scheduling works offline (data in IndexedDB)
- TimeKeeper checks run locally
- Notifications fire even when offline (if tab is open)

### 5.3 Sync Conflicts
- If `startTime` is edited on two devices, Last-Write-Wins applies (same as other fields)
- If recurring event is edited on one device, that instance wins

### 5.4 Invalid States
- `endTime` before `startTime`: Reject on input, show validation error
- Time set on completed thought: Keep time but don't show overdue state
- Deleting a recurring thought: Prompt "Delete this instance or all instances?"

---

## What We Are NOT Doing (Scope Boundaries)

| Feature | Reason |
|---------|--------|
| `trigger_action` / `trigger_payload` | Over-engineering. Oracle AI handles automation. |
| Hardcoded automation rules | Oracle is the automation engine. |
| Google Calendar sync | V2 feature. Keep it simple for V1. |
| Service Worker for background notifications | Complex, requires PWA setup. V2. |
| Timezone selection per thought | User sets once, system uses local. V2. |

---

## Questions / Open Decisions

1. **TimePicker granularity:** Should time be selectable in 5-minute increments, 1-minute, or 15-minute blocks?

2. **Notification permission:** Should we ask for browser notification permission proactively, or only when the user first adds a reminder?

3. **Overdue visual treatment:** Should overdue thoughts automatically show a red tint, or only after a user-configurable grace period?

4. **Oracle daily briefing:** Should the Oracle proactively surface upcoming events in the morning chat summary?

5. **Default reminder:** Should we auto-set a default reminder (e.g., "at time of event") or require the user to explicitly choose?

---

## Migration Checklist

- [ ] Create `supabase/migrations/20260322_add_time_fields.sql`
- [ ] Update `src/db.ts` Thought interface
- [ ] Update `src/store/types.ts`
- [ ] Update `toSnakeCase` / `toCamelCase` transformers
- [ ] Write data migration script for existing thoughts
- [ ] Implement `TimeKeeper` service
- [ ] Implement recurrence utilities (`rrule`)
- [ ] Build `TimePicker` component
- [ ] Update `ThoughtEditor` with schedule button
- [ ] Update `ThoughtNode` with time visuals
- [ ] Update `calendarStrategy.ts` for time-based sorting
- [ ] Update Oracle prompts and tool outputs
- [ ] Test offline behavior
- [ ] Test sync between devices
