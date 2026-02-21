# Storage & Sync Lifecycle

Cyberia manages data persistence across local storage and two cloud layers.

## 1. Local Storage (Dexie)

All data is primary-saved to IndexedDB for zero-latency UI interaction.
- **Thoughts/Spaces/Stacks:** Standard relational tables.
- **Blobs:** A dedicated table for raw binary files (PDF, MP3, MP4). This allows instant previews via `URL.createObjectURL`.
- **Pending Deletions:** A queue for Drive file deletions that failed while offline.

## 2. Google Drive Structure

Content is sorted into human-readable folders under a root `Cyberia/` directory:

- `/Cyberia/Thoughts/`: Structured JSON files (`[id].json`) for Notes, Tasks, Tables, and Drawings.
- `/Cyberia/Media/`: Binary assets (Images, PDFs, etc.).

## 3. Image Optimization Pipeline

To keep the spatial map fast, Cyberia uses a dual-resolution strategy:
1. **Thumbnail Generation:** Dropped images are compressed to a static JPEG (~30KB).
2. **Metadata Save:** The thumbnail is saved in the `image` field of the thought.
3. **Blob Offload:** The original high-res asset (or animated GIF) is moved to the `blobs` table.
4. **Cloud Sync:** The original high-res asset is pushed to Drive. 
5. **Retrieval:** Focus Mode prioritizes the original local blob, then the Drive stream, then the thumbnail.

## 4. Sync Status States

- **`local`**: Data only exists on this device.
- **`pending`**: Changes detected, waiting for background sync.
- **`synced`**: Metadata is in Vercel KV and content is in Google Drive.
- **`error`**: A network or permission error occurred.

## 5. Stranded Data Handling
If a device pulls metadata but cannot find the local blob or `driveFileId`, it displays a **"Sync Pending - Available on other device"** warning. This ensures the user knows the data is safe but hasn't reached the current device yet.
