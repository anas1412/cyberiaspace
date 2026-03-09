import Dexie, { type EntityTable } from 'dexie';

// ============================================
// NEW: Thought Type Definitions (Modular)
// ============================================

export type ThoughtType = 'label' | 'text' | 'tasks' | 'paint' | 'table' | 'embed' | 'file';

export interface FileMeta {
  name?: string;
  size?: number;
  type?: string;
  file?: {
    name: string;
    size: number;
    type: string;
  };
}

// Discriminated Union for modular payload
export type ThoughtPayload =
  | { type: 'text'; content: string }
  | { type: 'tasks'; tasks: { text: string; done: boolean }[] }
  | { type: 'table'; rows: string[][] }
  | { type: 'paint'; drawing: string }
  | { type: 'embed'; url: string; provider?: string; providerId?: string }
  | { type: 'file'; url: string; name: string; size: number; meta?: FileMeta }
  | { type: 'label' };  // No payload data needed

// ============================================
// Entity Interfaces
// ============================================

interface Space {
  id: string; // ULID
  name: string;
  mode: 'spatial' | 'kanban' | 'calendar';
  physics: boolean;
  order: number;
  isOnboarding?: boolean;
  deletedAt?: number | null;
  transformX?: number;
  transformY?: number;
  transformScale?: number;
  publishedId?: string | null;
  lastPublished?: string | null;
  updatedAt?: number | null; // Changed to number (Unix ms)
  theme?: 'cyberia' | 'sea' | 'forest' | 'rain';
  customBg?: string | null;
  syncStatus?: 'local' | 'synced' | 'syncing' | 'error';
  retryCount?: number;
}

interface Stack {
  id: string; // ULID
  name: string;
  color: string;
  spaceId: string;
  isOnboarding?: boolean;
  deletedAt?: number | null;
  syncStatus?: 'local' | 'synced' | 'syncing' | 'error';
  retryCount?: number;
  updatedAt?: number | null; // Added field
}

interface Thought {
  id: string; // Changed from number to string (ULID)
  spaceId: string;
  stackId: string | null;
  x: number;
  y: number;
  vx: number;
  vy: number;
  createdAt?: string | null;
  text: string;
  placeholder?: string;
  description: string;
  type: ThoughtType;
  deletedAt?: number | null;
  status: 'none' | 'todo' | 'doing' | 'done';
  date: string;
  priority: 'none' | 'low' | 'medium' | 'high' | 'urgent';
  size: number;
  order: number;
  layer?: number;
  author: string;
  meta?: any;
  storageUrl?: string;
  storagePath?: string;
  googleTaskListId?: string;
  googleCalendarEventId?: string;
  syncStatus?: 'local' | 'synced' | 'syncing' | 'error';
  retryCount?: number;
  updatedAt?: number | null; // Standardized to number

  // Modular Payload (Discriminated Union)
  data?: ThoughtPayload;
}

interface LocalBlob {
  id: string;
  thoughtId: string; // Changed from number to string
  blob: Blob;
  name: string;
  type: string;
  updatedAt: number;
}

// ============================================
// Database Setup
// ============================================

const db = new Dexie('CyberiaDB') as Dexie & {
  spaces: EntityTable<Space, 'id'>;
  thoughts: EntityTable<Thought, 'id'>;
  stacks: EntityTable<Stack, 'id'>;
  blobs: EntityTable<LocalBlob, 'id'>;
};

db.on('versionchange', () => {
  db.close();
  window.location.reload();
});

// Version 16: Transition to ULIDs and Delta Sync schema
// Removed pendingDeletions and pendingBlobs
db.version(16).stores({
  spaces: 'id, name, order, syncStatus, updatedAt',
  thoughts: 'id, spaceId, stackId, text, type, status, date, priority, order, author, storageUrl, syncStatus, deletedAt, updatedAt',
  stacks: 'id, spaceId, name, syncStatus, updatedAt',
  blobs: 'id, thoughtId'
});

export type { Space, Thought, Stack };
export { db };
