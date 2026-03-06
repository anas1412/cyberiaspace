import Dexie, { type EntityTable } from 'dexie';

interface Space {
  id: string;
  name: string;
  mode: 'spatial' | 'kanban' | 'calendar';
  physics: boolean;
  order: number;
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
  type: 'label' | 'text' | 'tasks' | 'paint' | 'table' | 'image' | 'embed' | 'file';
  deletedAt?: number | null;
  content: string;
  image: string | null;
  drawing: string | null;
  status: 'none' | 'todo' | 'doing' | 'done';
  tasks: { text: string; done: boolean }[];
  table: string[][];
  date: string;
  priority: 'none' | 'low' | 'medium' | 'high' | 'urgent';
  size: number;
  order: number;
  layer?: number;
  author: string;
  meta?: any;
  storageUrl?: string;      // NEW: Supabase Storage URL
  storagePath?: string;    // NEW: Supabase Storage path for deletion
  googleTaskListId?: string;
  googleCalendarEventId?: string;
  syncStatus?: 'local' | 'synced' | 'pending' | 'syncing' | 'error';
  retryCount?: number;
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

db.version(13).stores({
  spaces: 'id, name, order, syncStatus',
  thoughts: '++id, spaceId, stackId, text, type, status, date, priority, order, author, storageUrl, syncStatus, deletedAt',
  stacks: 'id, spaceId, name, syncStatus',
  blobs: 'id, thoughtId',
  pendingDeletions: '++id, tableName, localId',
  pendingBlobs: '++id, thoughtId, createdAt'
});

export type { Space, Thought, Stack, PendingDeletion, PendingBlob };
export { db };
