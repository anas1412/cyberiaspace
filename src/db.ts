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

export const DEFAULT_KANBAN_COLUMNS = ['Unplanned', 'To Do', 'Doing', 'Done'];

interface Space {
  id: string; // ULID
  name: string;
  mode: 'spatial' | 'kanban' | 'calendar' | 'directory';
  physics: boolean;
  order: number;
  deletedAt?: number | null;
  transformX?: number;
  transformY?: number;
  transformScale?: number;
  updatedAt?: number | null;
  theme?: 'dark' | 'light';
  customBg?: string | null;
  kanbanColumns?: string[];
}

interface Stack {
  id: string; // ULID
  name: string;
  color: string;
  spaceId: string;
  deletedAt?: number | null;
  updatedAt?: number | null;
}

interface Thought {
  id: string;
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
  archivedAt?: number | null;
  status: 'none' | 'todo' | 'doing' | 'done';
  kanbanCol?: number;
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
  meta?: any;
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
  updatedAt: number;
}

interface ChatConversation {
  id: string; // ULID
  spaceId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

interface ChatMessage {
  id: string;
  spaceId: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  msgType?: 'chat' | 'system';
}

interface AppSetting {
  key: string;
  value: string;
}

interface SpaceBackground {
  id: string;
  spaceId: string;
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
  chatHistory: EntityTable<ChatMessage, 'id'>;
  spaceBackgrounds: EntityTable<SpaceBackground, 'id'>;
  chatConversations: EntityTable<ChatConversation, 'id'>;
  settings: EntityTable<AppSetting, 'key'>;
};

db.on('versionchange', () => {
  db.close();
  window.location.reload();
});

// Version 17: Base schema
db.version(17).stores({
  spaces: 'id, userId, name, order, syncStatus, deletedAt, updatedAt',
   thoughts: 'id, userId, spaceId, stackId, text, type, status, date, priority, order, author, syncStatus, deletedAt, updatedAt',
  stacks: 'id, userId, spaceId, name, syncStatus, deletedAt, updatedAt',
  blobs: 'id, thoughtId, userId'
});

// Version 18: Added chatHistory
db.version(18).stores({
  chatHistory: 'id, spaceId, timestamp'
});

// Version 19: Added time-based fields
db.version(19).stores({
   thoughts: 'id, userId, spaceId, stackId, text, type, status, startTime, endTime, priority, order, author, syncStatus, deletedAt, updatedAt',
});

// Version 20: Added spaceBackgrounds
db.version(20).stores({
  spaceBackgrounds: 'id, spaceId, userId'
});

// Version 21: Added chatConversations + conversationId to chatHistory
db.version(21).stores({
  chatConversations: 'id, spaceId',
  chatHistory: 'id, spaceId, [spaceId+conversationId], timestamp'
});

// Version 22: Remove syncStatus from schema (local-only, no sync)
db.version(22).stores({
  spaces: 'id, userId, name, order, deletedAt, updatedAt',
  thoughts: 'id, userId, spaceId, stackId, text, type, status, startTime, endTime, priority, order, author, deletedAt, updatedAt',
  stacks: 'id, userId, spaceId, name, deletedAt, updatedAt',
  blobs: 'id, thoughtId, userId',
  chatHistory: 'id, spaceId, [spaceId+conversationId], timestamp',
  spaceBackgrounds: 'id, spaceId, userId',
  chatConversations: 'id, spaceId'
});

// Version 23: Added settings table for key-value app settings
db.version(23).stores({
  settings: 'key, userId'
});

// Version 24: Remove userId from all schemas (local-only, single user)
db.version(24).stores({
  spaces: 'id, name, order, deletedAt, updatedAt',
  thoughts: 'id, spaceId, stackId, text, type, status, startTime, endTime, priority, order, author, deletedAt, updatedAt',
  stacks: 'id, spaceId, name, deletedAt, updatedAt',
  blobs: 'id, thoughtId',
  chatHistory: 'id, spaceId, [spaceId+conversationId], timestamp',
  spaceBackgrounds: 'id, spaceId',
  chatConversations: 'id, spaceId',
  settings: 'key'
});

export type { Space, Thought, Stack, ChatMessage, ChatConversation };
export { db };
