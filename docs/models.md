# Data Models & Schema (V13)

Cyberia uses a structured schema to manage its kinetic workspace.

## 1. Thought Model

The core unit of information.

```typescript
interface Thought {
  id: number;           // Auto-incrementing (Local)
  spaceId: string;      // ID of the parent space
  stackId: string | null; // ID of the parent stack
  x: number;            // World-space coordinate
  y: number;            // World-space coordinate
  text: string;         // Title/Label
  description: string;  // Secondary info
  type: 'label' | 'text' | 'tasks' | 'paint' | 'table' | 'image' | 'embed' | 'file';
  content: string;      // Markdown or URL
  image: string | null; // Static map thumbnail (max 50KB)
  syncStatus: 'local' | 'pending' | 'synced' | 'error';
  driveFileId?: string; // Reference to original content in Drive
  meta?: any;           // Type-specific data (file size, oEmbed info)
}
```

## 2. Thought Types

1. **`label`**: (Default) Structural marker. No content body.
2. **`text`**: Rich Markdown notes.
3. **`tasks`**: Interactive checkbox lists.
4. **`table`**: Structured data grids.
5. **`paint`**: SVG-based sketches.
6. **`image`**: Photos/GIFs with automated Drive sync.
7. **`embed`**: Social media and media players (YouTube, Spotify).
8. **`file`**: Document management (PDF, MP3, MP4).

## 3. Unified User Profile (Vercel KV)

Centralized record for account and usage management.

```typescript
interface User {
  id: string;
  email: string;
  plan: 'free' | 'pro';
  usage: {
    ai_daily_count: number;
    sync_thoughts: number;
    last_ai_reset: string;
  };
  settings: {
    autoSync: boolean;
    driveEnabled: boolean;
    theme: string;
  };
}
```

## 4. Hierarchy
- **Space:** An isolated infinite workspace with its own physics settings and theme.
- **Stack:** A physical grouping of thoughts within a space.
- **Blob:** A local binary storage for files awaiting cloud upload.
