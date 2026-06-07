import Dexie, { type EntityTable } from 'dexie';

// ============================================
// Thought Type Definitions
// ============================================

export type ThoughtType = 'label' | 'text' | 'tasks' | 'paint' | 'table' | 'embed' | 'file';

/**
 * Type-based default layer offsets for visual stacking order.
 * Higher values render on top.
 */
export const TYPE_BASE_LAYERS: Record<ThoughtType, number> = {
  label: 10,
  tasks: 6,
  text: 4,
  table: 2,
  paint: 0,
  embed: -2,
  file: -4,
};

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
  | { type: 'tasks'; tasks: { id?: string; text: string; done: boolean }[] }
  | { type: 'table'; rows: string[][] }
  | { type: 'paint'; drawing: string }
  | { type: 'embed'; url: string; provider?: string; providerId?: string }
  | { type: 'file'; url: string; name: string; size: number; meta?: FileMeta }
  | { type: 'label' };

// ============================================
// Entity Interfaces
// ============================================

interface Space {
  id: string; // ULID
  name: string;
  userId: string;
  mode: 'spatial' | 'kanban' | 'calendar' | 'directory';
  physics: boolean;
  order: number;
  isOnboarding?: boolean;
  deletedAt?: number | null;
  transformX?: number;
  transformY?: number;
  transformScale?: number;
  updatedAt?: number | null;
  theme?: 'dark' | 'light';
  customBg?: string | null;
}

interface Stack {
  id: string; // ULID
  name: string;
  userId: string;
  color: string;
  spaceId: string;
  isOnboarding?: boolean;
  deletedAt?: number | null;
  updatedAt?: number | null;
}

interface Thought {
  id: string;
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
  archivedAt?: number | null;
  status: 'none' | 'todo' | 'doing' | 'done';
  startTime?: number | null;
  endTime?: number | null;
  isAllDay?: boolean;
  reminders?: any[];
  recurrenceRule?: string | null;
  location?: string | null;
  priority: 'none' | 'low' | 'medium' | 'high' | 'urgent';
  size: number;
  order: number;
  layer?: number;
  author: string;
  image?: string | null;
  meta?: any;
  googleTaskListId?: string;
  googleCalendarEventId?: string;
  updatedAt?: number | null;

  // Modular Payload (Discriminated Union)
  data?: ThoughtPayload;
}

interface LocalBlob {
  id: string;
  thoughtId: string;
  blob: Blob;
  name: string;
  type: string;
  userId: string;
  updatedAt: number;
}

interface ChatMessage {
  id: string;
  spaceId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  msgType?: 'chat' | 'system';
}

interface SpaceBackground {
  id: string;
  spaceId: string;
  blob: Blob;
  name: string;
  type: string;
  userId: string;
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
  chatHistory: EntityTable<ChatMessage, 'id'>;
  spaceBackgrounds: EntityTable<SpaceBackground, 'id'>;
};

db.on('versionchange', () => {
  db.close();
  window.location.reload();
});

// Version 17: Base schema
db.version(17).stores({
  spaces: 'id, userId, name, order, syncStatus, deletedAt, updatedAt',
  thoughts: 'id, userId, spaceId, stackId, text, type, status, date, priority, order, author, storageUrl, syncStatus, deletedAt, updatedAt',
  stacks: 'id, userId, spaceId, name, syncStatus, deletedAt, updatedAt',
  blobs: 'id, thoughtId, userId'
});

// Version 18: Added chatHistory
db.version(18).stores({
  chatHistory: 'id, spaceId, timestamp'
});

// Version 19: Added time-based fields
db.version(19).stores({
  thoughts: 'id, userId, spaceId, stackId, text, type, status, startTime, endTime, priority, order, author, storageUrl, syncStatus, deletedAt, updatedAt',
});

// Version 20: Added spaceBackgrounds
db.version(20).stores({
  spaceBackgrounds: 'id, spaceId, userId'
});

export type { Space, Thought, Stack, ChatMessage };
export { db };
