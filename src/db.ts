import Dexie, { type EntityTable } from 'dexie';

// ============================================
// NEW: Thought Type Definitions (Modular)
// ============================================

export type ThoughtType = 'label' | 'text' | 'tasks' | 'paint' | 'table' | 'embed' | 'file';

export interface FileMeta {
  name: string;
  size: number;
  type: string;
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
  id: string;
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
  updatedAt?: string | null;
  theme?: 'cyberia' | 'sea' | 'forest' | 'rain';
  customBg?: string | null;
  syncStatus?: 'local' | 'synced' | 'pending' | 'syncing' | 'error';
  retryCount?: number;
}

interface Stack {
  id: string;
  name: string;
  color: string;
  spaceId: string;
  isOnboarding?: boolean;
  deletedAt?: number | null;
  syncStatus?: 'local' | 'synced' | 'pending' | 'syncing' | 'error';
  retryCount?: number;
}

interface Thought {
  id: number;
  spaceId: string;
  stackId: string | null;
  x: number;
  y: number;
  vx: number;
  vy: number;
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
  syncStatus?: 'local' | 'synced' | 'pending' | 'syncing' | 'error';
  retryCount?: number;
  updatedAt?: number | null;

  // Modular Payload (Discriminated Union)
  data?: ThoughtPayload;
}

interface LocalBlob {
  id: string;
  thoughtId: number;
  blob: Blob;
  name: string;
  type: string;
  updatedAt: number;
}

interface PendingDeletion {
  id?: number;
  tableName: 'spaces' | 'stacks' | 'thoughts';
  localId: string | number;
  storagePath?: string;
  createdAt: number;
}

interface PendingBlob {
  id?: number;
  thoughtId: number;
  name: string;
  type: string;
  createdAt: number;
  retryCount: number;
}

// ============================================
// Database Setup
// ============================================

const db = new Dexie('CyberiaDB') as Dexie & {
  spaces: EntityTable<Space, 'id'>;
  thoughts: EntityTable<Thought, 'id'>;
  stacks: EntityTable<Stack, 'id'>;
  blobs: EntityTable<LocalBlob, 'id'>;
  pendingDeletions: EntityTable<PendingDeletion, 'id'>;
  pendingBlobs: EntityTable<PendingBlob, 'id'>;
};

db.on('versionchange', () => {
  db.close();
  window.location.reload();
});

// Version 15: Removed legacy thought data field indexes
db.version(15).stores({
  spaces: 'id, name, order, syncStatus',
  thoughts: '++id, spaceId, stackId, text, type, status, date, priority, order, author, storageUrl, syncStatus, deletedAt, data',
  stacks: 'id, spaceId, name, syncStatus',
  blobs: 'id, thoughtId',
  pendingDeletions: '++id, tableName, localId',
  pendingBlobs: '++id, thoughtId, createdAt'
});

export type { Space, Thought, Stack, PendingDeletion, PendingBlob };
export { db };
