import Dexie, { type EntityTable } from 'dexie';

// ============================================
// NEW: Thought Type Definitions (Modular)
// ============================================

export type ThoughtType = 'label' | 'text' | 'tasks' | 'paint' | 'table' | 'embed' | 'file';

export interface FileMeta {
  name?: string;
  size?: number;
  type?: string;
  isImage?: boolean;
  isPdf?: boolean;
  isVideo?: boolean;
  isAudio?: boolean;
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
  userId: string;
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
  theme?: 'cyberia' | 'sea' | 'forest' | 'rain' | 'sakura';
  customBg?: string | null;
  syncStatus?: 'local' | 'synced' | 'syncing' | 'error';
  retryCount?: number;
}

interface Stack {
  id: string; // ULID
  name: string;
  userId: string;
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
  userId: string;
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
  image?: string | null;
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
  thoughtId: string;
  blob: Blob;
  name: string;
  type: string;
  userId: string; // Required for user isolation
  updatedAt: number;
}

interface ChatMessage {
  id: string;      // ULID for ordering
  spaceId: string; // Per-space history
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  msgType?: 'chat' | 'system'; //区分聊天消息和系统错误消息
}

// ============================================
// Database Setup
// ============================================

const db = new Dexie('CyberiaDB') as Dexie & {
  spaces: EntityTable<Space, 'id'>;
  thoughts: EntityTable<Thought, 'id'>;
  stacks: EntityTable<Stack, 'id'>;
  blobs: EntityTable<LocalBlob, 'id'>;
  chatHistory: EntityTable<ChatMessage, 'id'>;
};

db.on('versionchange', () => {
  db.close();
  window.location.reload();
});

// Version 17: Added deletedAt index to spaces and stacks for robust filtering
db.version(17).stores({
  spaces: 'id, userId, name, order, syncStatus, deletedAt, updatedAt',
  thoughts: 'id, userId, spaceId, stackId, text, type, status, date, priority, order, author, storageUrl, syncStatus, deletedAt, updatedAt',
  stacks: 'id, userId, spaceId, name, syncStatus, deletedAt, updatedAt',
  blobs: 'id, thoughtId, userId'
});

// Version 18: Added chatHistory for local persistent Oracle conversations
db.version(18).stores({
  chatHistory: 'id, spaceId, timestamp'
});

export type { Space, Thought, Stack, ChatMessage };
export { db };
