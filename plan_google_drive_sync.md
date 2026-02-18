# Cyberia: Google Ecosystem Integration Plan (Drive, Calendar, Tasks)

This document outlines the strategy for turning Cyberia into a spatial command center by integrating Google Drive for storage, Google Calendar for scheduling, and Google Tasks for productivity.

## 1. Objectives
- **Storage (Drive):** Externalize all media (PDF, MP3, MP4) and workspace data (Markdown, JSON) into a `/Cyberia` folder in the user's personal Google Drive.
- **Scheduling (Calendar):** Synchronize Cyberia's Calendar view with real-time Google Calendar events.
- **Productivity (Tasks):** Map Cyberia's Task thoughts directly to Google Tasks for mobile-to-desktop parity.
- **AI Context:** Enable the Oracle (Gemini) to securely analyze documents, events, and tasks via the "Librarian" model.

## 2. Technical Architecture

### 2.1. Authentication & Scopes
We will expand the Google OAuth request to include:
- `https://www.googleapis.com/auth/drive.file`: Isolated access to Cyberia-created files.
- `https://www.googleapis.com/auth/calendar.events`: To read and write events to the user's primary calendar.
- `https://www.googleapis.com/auth/tasks`: To sync task lists and completion statuses.

### 2.2. Google Calendar Sync (The "Two-Way Mirror")
- **Incoming Events:** Real-time Google Calendar events appear in Cyberia's `CalendarOverlay.tsx` as non-physical "Ghost Thoughts."
- **Outgoing Events:** Dragging a thought to a date in Cyberia (or setting a date in the Inspector) creates an event in Google Calendar.
- **Kinetic Sync:** Changing the date of a thought in Cyberia's Calendar view updates the `start_time` in Google Calendar via a debounced API call.

### 2.3. Google Tasks Integration
- **Direct Mapping:** Every Cyberia thought of type `tasks` can be linked to a specific Google Task List.
- **Two-Way Completion:** Checking a task in the `TasksFocusEditor.tsx` marks it as complete in the Google Tasks mobile app instantly.
- **External Additions:** New tasks added via Google Tasks appear in a designated "Inbox" stack in Cyberia.

### 2.4. Data Externalization (Drive)
- **Files/Media:** PDF, MP3, and MP4 files are stored in `/Cyberia/Media/`.
- **Note Content:** Text thoughts are saved as `.md` files in `/Cyberia/Notes/`.
- **Database Scaling:** The local IndexedDB becomes a lightweight cache for `fileIds` and spatial coordinates, while the actual content lives in Drive.

## 3. Implementation Phases

### Phase 1: Authentication & Drive Foundations
- Update `AccountMenu.tsx` to request the new scopes.
- Create `src/services/google/driveService.ts` for file/folder management.
- Implement the "Cyberia" root folder bootstrap logic.

### Phase 2: Calendar Overlay Expansion
- Create `src/services/google/calendarService.ts`.
- Update `CalendarOverlay.tsx` to fetch and render the user's primary calendar events alongside Cyberia thoughts.
- Implement "Date Mapping" logic: `Thought.date <-> Google Calendar Event`.

### Phase 3: Tasks Synchronization
- Create `src/services/google/tasksService.ts`.
- Update `TasksFocusEditor.tsx` to push/pull updates to Google Tasks.
- Implement background polling (or Webhooks if feasible) to catch mobile task updates.

### Phase 4: Oracle Bridge (AI Integration)
- Update `src/services/oracle/executor.ts` to include "Tools" for reading the user's calendar and task lists.
- **Privacy Rule:** The Oracle only sees data that is explicitly relevant to the current user query.

## 4. Visual Standards (V12 Compliance)
- **Ghost Thoughts:** Google Calendar events are rendered with `opacity-50` and a distinct "Google Blue" accent to differentiate them from local thoughts.
- **Sync Badges:** Thoughts that are successfully synced to Google show a small, pulsing `Check` or `Cloud` icon in the `ThoughtHeader.tsx`.
- **Kinetic Feedback:** When a task is completed, it triggers a "pop" animation across all synced devices.

## 5. Security & Privacy
- **Librarian Model:** Cyberia (Client-side) fetches data using the user's token and only passes necessary text to the AI.
- **OAuth Token Safety:** Tokens remain in the browser and are never stored on Cyberia's backend.
- **User Choice:** Users can toggle individual sync features (e.g., "Drive ON," "Calendar OFF") in the Account Menu.
