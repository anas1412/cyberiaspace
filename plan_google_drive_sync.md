# Cyberia Distributed Sync Bridge (v2)

This document outlines the architecture for high-velocity workspace synchronization using a hybrid cloud approach: **Vercel KV** for spatial metadata and **Google Drive** for rich content and media.

## 1. Architecture Overview: The "Bridge"

To maintain "local-first" performance while supporting massive files and deep service integration, Cyberia split each **Thought** into two layers:

| Layer | Service | Data Type | Payload Size | Update Frequency |
| :--- | :--- | :--- | :--- | :--- |
| **Spatial Metadata** | **Vercel KV** | Coordinates (X,Y,Z), Type, Title, Stack ID, Color | Very Small (<1KB) | Instant / High |
| **Rich Content** | **Google Drive** | Text content, Task arrays, Table data, SVGs | Variable | Background / Medium |
| **Heavy Blobs** | **Google Drive** | PDF, MP3, MP4, Large Images | Large (>2MB) | Streaming / On-Demand |

---

## 2. Storage Strategy: Human-Readable & Transparent

Cyberia stores data in a visible `Cyberia/` root folder in the user's Google Drive. Content is stored in human-readable formats to ensure data portability and user ownership.

### 2.1. Drive Directory Structure
- `Cyberia/`
    - `Thoughts/`
        - `[id].md`: Text thoughts (Standard Markdown).
        - `[id].tasks.json`: Task lists (JSON for structure, synced with Google Tasks).
        - `[id].table.json`: Structured tables (JSON).
    - `Drawings/`
        - `[id].svg`: Paint thoughts (Standard SVG).
    - `Media/`
        - `[id].pdf`, `[id].mp3`, `[id].mp4`: Raw binary files.
    - `Archive/`
        - Trash bin for deleted thoughts/files.

### 2.2. Mapping & Linking
The Vercel KV metadata for a thought contains the `driveFileId`. 
- **Local:** Dexie caches the full content for instant loading.
- **Cloud:** If the `driveFileId` is present but the content is missing locally, Cyberia streams it from Drive.

---

## 3. New Thought Type: `file`

We are introducing a dedicated `file` thought type to handle document management.
- **Visual:** Rendered as a "Document Card" in the spatial view.
- **Functionality:** 
    - Supports Preview (PDF), Playback (Audio/Video), and Download.
    - No 2MB limit (Uploaded directly to Google Drive).
    - Metadata (Filename, Size, Type) lives in KV; Binary lives in Drive.

---

## 4. Ecosystem Sync Logic

### 4.1. Google Tasks (Action Sync)
- Thoughts of type `tasks` are bi-directionally synced with a dedicated list in Google Tasks.
- Checking a task in Cyberia triggers an immediate update to the Google Tasks API.

### 4.2. Google Calendar (Temporal Sync)
- Thoughts with a `date` property generate a Google Calendar event.
- Moving a thought on the **Calendar View** in Cyberia updates the event's start time in Google.
- The Cyberia `thoughtId` is stored in the event's private metadata.

---

## 5. Implementation Roadmap

### Phase 1: Authentication (Build Ready)
- Expand OAuth scopes: `drive.file`, `tasks`, `calendar.events`.
- Update `useAuthStore` to handle specific service permissions.

### Phase 2: The Proxy Layer
- `api/google/drive.ts`: Handles multipart uploads and content streaming.
- `api/google/tasks.ts`: CRUD for Google Tasks.
- `api/google/calendar.ts`: Event synchronization.

### Phase 3: Sync Engine Refactor
- Implement a background `SyncQueue` that prioritizes Metadata (KV) before Content (Drive).
- Add `driveFileId` and `syncStatus` to the Dexie schema.

### Phase 4: UI Enhancements
- Update `ThoughtHeader` with sync status indicators.
- Implement the `FileFocusEditor` for the new `file` type.
- Add "Download for Offline" toggle for media.
