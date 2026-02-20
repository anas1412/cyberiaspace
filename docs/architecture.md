# Architecture: The Sync Bridge

Cyberia uses a "Local-First, Hybrid-Cloud" architecture designed for high performance and user data ownership.

## 1. The Three Layers of Data

| Layer | Service | Role | Persistence |
| :--- | :--- | :--- | :--- |
| **Local-First** | **IndexedDB (Dexie)** | Primary Source of Truth. Low-latency UI. | Permanent (Browser) |
| **Spatial Map** | **Vercel KV** | Real-time map sync (Positions, Titles, Stacks). | Cloud (Redis) |
| **Rich Content** | **Google Drive** | Heavy data storage (Markdown, JSON, Media). | Cloud (User-Owned) |

## 2. The "Bridge" Flow

1. **Capture:** User makes a change. It is saved instantly to Dexie and marked as `syncStatus: 'pending'`.
2. **Snapshot:** A lightweight metadata snapshot is pushed to Vercel KV. This allows multiple devices to see the same "map."
3. **Deep Sync:** Rich content (notes, tasks) and binary blobs (PDF, MP3) are pushed to specific folders in the user's Google Drive.
4. **Resolution:** Once both cloud layers confirm success, the thought is marked as `syncStatus: 'synced'`.

## 3. Secure Master Key Management

To avoid recurring Google popups, Cyberia uses an **Authorization Code Flow**:
- The **Access Token** (short-lived) stays in the browser.
- The **Refresh Token** (Master Key) is stored securely in the user's Vercel KV profile.
- The backend (`api/google-auth.ts`) performs silent rotation to keep the session alive indefinitely.

## 4. Mobile Responsiveness

The architecture uses **DVH (Dynamic Viewport Height)** and CSS scaling to ensure the coordinate system remains accurate across Laptops, Tablets, and Phones. All mouse/touch events are normalized against a `getGlobalScale()` factor.
