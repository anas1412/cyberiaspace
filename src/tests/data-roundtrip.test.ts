import { describe, expect, it } from 'bun:test';
import { ulid } from 'ulid';
import Dexie, { type EntityTable } from 'dexie';
import type {
  Thought,
  Space,
  Stack,
  LocalBlob,
  AppSetting,
  ChatConversation,
  ChatMessage,
  SpaceBackground,
  ThoughtType,
} from '../db';

// ---------------------------------------------------------------------------
// Single shared Dexie instance for all tests.
//   - DO NOT call clear() — it breaks fake-indexeddb in bun.
//   - Every test uses unique IDs via ulid(); no cross-test collision.
//   - count() is NOT used because data from other tests exists.
//     Instead, verify by retrieving specific IDs or filter-scoped queries.
// ---------------------------------------------------------------------------
type TestDB = Dexie & {
  spaces: EntityTable<Space, 'id'>;
  thoughts: EntityTable<Thought, 'id'>;
  stacks: EntityTable<Stack, 'id'>;
  blobs: EntityTable<LocalBlob, 'id'>;
  chatHistory: EntityTable<ChatMessage, 'id'>;
  spaceBackgrounds: EntityTable<SpaceBackground, 'id'>;
  chatConversations: EntityTable<ChatConversation, 'id'>;
  settings: EntityTable<AppSetting, 'key'>;
};

const db = new Dexie('CyberiaTestDB') as TestDB;
db.version(24).stores({
  spaces: 'id, name, order, deletedAt, updatedAt',
  thoughts: 'id, spaceId, stackId, text, type, status, startTime, endTime, priority, order, author, deletedAt, updatedAt',
  stacks: 'id, spaceId, name, deletedAt, updatedAt',
  blobs: 'id, thoughtId',
  chatHistory: 'id, spaceId, [spaceId+conversationId], timestamp',
  spaceBackgrounds: 'id, spaceId',
  chatConversations: 'id, spaceId',
  settings: 'key',
});

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

function makeThought(overrides?: Partial<Thought>): Thought {
  return {
    id: ulid(),
    spaceId: ulid(),
    stackId: ulid(),
    x: 100,
    y: 200,
    vx: 0.5,
    vy: -0.3,
    createdAt: '2025-01-15T10:00:00.000Z',
    text: 'Test thought',
    placeholder: 'Type here...',
    description: 'A test thought for round-trip verification',
    type: 'text',
    status: 'todo',
    startTime: 1705312800000,
    endTime: 1705316400000,
    isAllDay: false,
    reminders: [{ time: 1705312800000 }],
    recurrenceRule: 'FREQ=DAILY',
    location: 'Test location',
    priority: 'high',
    size: 42,
    order: 1,
    layer: 4,
    author: 'tester',
    meta: { source: 'test', version: 2 },
    data: { type: 'text', content: 'Hello world' },
    deletedAt: null,
    archivedAt: null,
    updatedAt: 1705312800000,
    ...overrides,
  };
}

function makeSpace(overrides?: Partial<Space>): Space {
  return {
    id: ulid(),
    name: 'Test Space',
    mode: 'spatial',
    physics: true,
    order: 0,
    transformX: 0,
    transformY: 0,
    transformScale: 1,
    theme: 'dark',
    customBg: null,
    deletedAt: null,
    updatedAt: 1705312800000,
    ...overrides,
  };
}

function makeStack(overrides?: Partial<Stack>): Stack {
  return {
    id: ulid(),
    name: 'Test Stack',
    color: '#6366f1',
    spaceId: ulid(),
    deletedAt: null,
    updatedAt: 1705312800000,
    ...overrides,
  };
}

function makeBlob(overrides?: Partial<LocalBlob>): LocalBlob {
  return {
    id: ulid(),
    thoughtId: ulid(),
    blob: new Blob(['test binary content'], { type: 'text/plain' }),
    name: 'test-file.txt',
    type: 'text/plain',
    updatedAt: Date.now(),
    ...overrides,
  };
}

function makeSetting(overrides?: Partial<AppSetting>): AppSetting {
  return {
    key: ulid(),
    value: 'test-value',
    ...overrides,
  };
}

function makeChatConversation(overrides?: Partial<ChatConversation>): ChatConversation {
  return {
    id: ulid(),
    spaceId: ulid(),
    title: 'Test Conversation',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

function makeChatMessage(overrides?: Partial<ChatMessage>): ChatMessage {
  return {
    id: ulid(),
    spaceId: ulid(),
    conversationId: ulid(),
    role: 'user',
    content: 'Hello AI',
    timestamp: Date.now(),
    msgType: 'chat',
    ...overrides,
  };
}

function makeSpaceBackground(overrides?: Partial<SpaceBackground>): SpaceBackground {
  return {
    id: ulid(),
    spaceId: ulid(),
    blob: new Blob(['image binary'], { type: 'image/png' }),
    name: 'bg.png',
    type: 'image/png',
    updatedAt: Date.now(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Dexie data round-trips', () => {
  // ─── THOUGHT ─────────────────────────────────────────────────

  describe('Thought CRUD', () => {
    it('stores and retrieves a thought with every field populated', async () => {
      const original = makeThought();
      await db.thoughts.add(original);

      const retrieved = await db.thoughts.get(original.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(original.id);
      expect(retrieved!.spaceId).toBe(original.spaceId);
      expect(retrieved!.stackId).toBe(original.stackId);
      expect(retrieved!.x).toBe(original.x);
      expect(retrieved!.y).toBe(original.y);
      expect(retrieved!.vx).toBe(original.vx);
      expect(retrieved!.vy).toBe(original.vy);
      expect(retrieved!.createdAt).toBe(original.createdAt);
      expect(retrieved!.text).toBe(original.text);
      expect(retrieved!.placeholder).toBe(original.placeholder);
      expect(retrieved!.description).toBe(original.description);
      expect(retrieved!.type).toBe(original.type);
      expect(retrieved!.status).toBe(original.status);
      expect(retrieved!.startTime).toBe(original.startTime);
      expect(retrieved!.endTime).toBe(original.endTime);
      expect(retrieved!.isAllDay).toBe(original.isAllDay);
      expect(retrieved!.recurrenceRule).toBe(original.recurrenceRule);
      expect(retrieved!.location).toBe(original.location);
      expect(retrieved!.priority).toBe(original.priority);
      expect(retrieved!.size).toBe(original.size);
      expect(retrieved!.order).toBe(original.order);
      expect(retrieved!.layer).toBe(original.layer);
      expect(retrieved!.author).toBe(original.author);
      expect(retrieved!.meta).toEqual(original.meta);
      expect(retrieved!.data).toEqual(original.data);
      expect(retrieved!.updatedAt).toBe(original.updatedAt);
      expect(retrieved!.deletedAt).toBeNull();
      expect(retrieved!.archivedAt).toBeNull();
    });

    it('stores and retrieves a thought with minimal fields', async () => {
      const minimal: Thought = {
        id: ulid(),
        spaceId: ulid(),
        stackId: null,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        text: 'minimal',
        description: '',
        type: 'label',
        status: 'none',
        priority: 'none',
        size: 0,
        order: 0,
        author: 'tester',
      };
      await db.thoughts.add(minimal);
      const got = await db.thoughts.get(minimal.id);
      expect(got).not.toBeNull();
      expect(got!.text).toBe('minimal');
      expect(got!.stackId).toBeNull();
      expect(got!.type).toBe('label');
    });

    it('round-trips every ThoughtType payload', async () => {
      const payloads: { type: ThoughtType; data: Thought['data'] }[] = [
        { type: 'label', data: undefined },
        { type: 'text', data: { type: 'text', content: 'hello' } },
        { type: 'tasks', data: { type: 'tasks', tasks: [{ id: 't1', text: 'do it', done: false }] } },
        { type: 'table', data: { type: 'table', rows: [['a', 'b'], ['c', 'd']] } },
        { type: 'paint', data: { type: 'paint', drawing: 'base64...' } },
        { type: 'embed', data: { type: 'embed', url: 'https://youtube.com/watch?v=123', provider: 'youtube', providerId: '123' } },
        { type: 'file', data: { type: 'file', url: 'blob:...', name: 'doc.pdf', size: 1024, meta: { name: 'doc.pdf', size: 1024, type: 'application/pdf' } } },
      ];

      for (const { type, data } of payloads) {
        const id = ulid();
        await db.thoughts.add(makeThought({ id, type, data }));
        const got = await db.thoughts.get(id);
        expect(got).not.toBeNull();
        expect(got!.type).toBe(type);
        expect(got!.data).toEqual(data);
      }
    });

    it('updates a thought and retrieves the new values', async () => {
      const t = makeThought();
      await db.thoughts.add(t);
      await db.thoughts.update(t.id, { text: 'updated', priority: 'urgent', x: 999 });
      const got = await db.thoughts.get(t.id);
      expect(got!.text).toBe('updated');
      expect(got!.priority).toBe('urgent');
      expect(got!.x).toBe(999);
      expect(got!.y).toBe(t.y);
    });

    it('deletes a thought and verifies it is gone', async () => {
      const t = makeThought();
      await db.thoughts.add(t);
      await db.thoughts.delete(t.id);
      const got = await db.thoughts.get(t.id);
      expect(got).toBeUndefined();
    });

    it('bulk-adds thoughts and retrieves them by ID', async () => {
      const thoughts = Array.from({ length: 10 }, () => makeThought({ id: ulid() }));
      await db.thoughts.bulkAdd(thoughts);
      // Verify each by ID
      for (const t of thoughts) {
        const got = await db.thoughts.get(t.id);
        expect(got).not.toBeNull();
        expect(got!.id).toBe(t.id);
      }
    });

    it('bulk-deletes thoughts', async () => {
      const thoughts = Array.from({ length: 5 }, () => makeThought({ id: ulid() }));
      await db.thoughts.bulkAdd(thoughts);
      await db.thoughts.bulkDelete(thoughts.map(t => t.id));
      for (const t of thoughts) {
        const got = await db.thoughts.get(t.id);
        expect(got).toBeUndefined();
      }
    });

    it('filters thoughts by spaceId via index', async () => {
      const spaceA = ulid();
      const spaceB = ulid();
      const aThoughts = Array.from({ length: 3 }, () => makeThought({ id: ulid(), spaceId: spaceA }));
      const bThoughts = Array.from({ length: 2 }, () => makeThought({ id: ulid(), spaceId: spaceB }));
      await db.thoughts.bulkAdd([...aThoughts, ...bThoughts]);

      const fromA = await db.thoughts.where('spaceId').equals(spaceA).toArray();
      const fromB = await db.thoughts.where('spaceId').equals(spaceB).toArray();
      // Results include our data + any from other tests, but our data must be present
      expect(fromA.some(t => aThoughts.some(at => at.id === t.id))).toBe(true);
      expect(fromB.some(t => bThoughts.some(bt => bt.id === t.id))).toBe(true);
    });

    it('filters thoughts by stackId', async () => {
      const stackA = ulid();
      const stackThoughts = Array.from({ length: 4 }, () => makeThought({ id: ulid(), stackId: stackA }));
      const nullStackThoughts = Array.from({ length: 3 }, () => makeThought({ id: ulid(), stackId: null }));
      await db.thoughts.bulkAdd([...stackThoughts, ...nullStackThoughts]);

      const fromStack = await db.thoughts.where('stackId').equals(stackA).toArray();
      // Our 4 should be a subset of what's returned
      const ourIds = new Set(stackThoughts.map(t => t.id));
      const matched = fromStack.filter(t => ourIds.has(t.id));
      expect(matched).toHaveLength(4);
    });

    it('filters thoughts by status', async () => {
      const todoId = ulid();
      const doingId = ulid();
      await db.thoughts.bulkAdd([
        makeThought({ id: todoId, status: 'todo', priority: 'high' }),
        makeThought({ id: doingId, status: 'doing', priority: 'medium' }),
        makeThought({ id: ulid(), status: 'done', priority: 'low' }),
      ]);

      const todos = await db.thoughts.where('status').equals('todo').toArray();
      expect(todos.some(t => t.id === todoId)).toBe(true);
    });
  });

  // ─── SPACE ─────────────────────────────────────────────────

  describe('Space CRUD', () => {
    it('stores and retrieves a space with every field', async () => {
      const original = makeSpace();
      await db.spaces.add(original);

      const got = await db.spaces.get(original.id);
      expect(got).not.toBeNull();
      expect(got!.id).toBe(original.id);
      expect(got!.name).toBe(original.name);
      expect(got!.mode).toBe(original.mode);
      expect(got!.physics).toBe(original.physics);
      expect(got!.order).toBe(original.order);
      expect(got!.transformX).toBe(original.transformX);
      expect(got!.transformY).toBe(original.transformY);
      expect(got!.transformScale).toBe(original.transformScale);
      expect(got!.theme).toBe(original.theme);
      expect(got!.customBg).toBeNull();
    });

    it('supports all four mode values', async () => {
      const modes: Space['mode'][] = ['spatial', 'kanban', 'calendar', 'directory'];
      for (const mode of modes) {
        const s = makeSpace({ id: ulid(), mode });
        await db.spaces.add(s);
        const got = await db.spaces.get(s.id);
        expect(got!.mode).toBe(mode);
      }
    });

    it('updates and soft-deletes a space', async () => {
      const s = makeSpace({ name: 'original' });
      await db.spaces.add(s);

      await db.spaces.update(s.id, { name: 'renamed', order: 5 });
      const updated = await db.spaces.get(s.id);
      expect(updated!.name).toBe('renamed');
      expect(updated!.order).toBe(5);

      const now = Date.now();
      await db.spaces.update(s.id, { deletedAt: now });
      const deleted = await db.spaces.get(s.id);
      expect(deleted!.deletedAt).toBe(now);
    });

    it('orders spaces by order field', async () => {
      const ids = ['Z', 'A', 'M'].map(name => {
        const s = makeSpace({ id: ulid(), name, order: { Z: 2, A: 0, M: 1 }[name]! });
        return s;
      });
      await db.spaces.bulkAdd(ids);

      const ordered = await db.spaces.orderBy('order').toArray();
      const ourNames = ordered.filter(s => ids.some(our => our.id === s.id)).map(s => s.name);
      expect(ourNames).toEqual(['A', 'M', 'Z']);
    });
  });

  // ─── STACK ─────────────────────────────────────────────────

  describe('Stack CRUD', () => {
    it('stores and retrieves a stack with every field', async () => {
      const original = makeStack();
      await db.stacks.add(original);

      const got = await db.stacks.get(original.id);
      expect(got).not.toBeNull();
      expect(got!.id).toBe(original.id);
      expect(got!.name).toBe(original.name);
      expect(got!.color).toBe(original.color);
      expect(got!.spaceId).toBe(original.spaceId);
    });

    it('filters stacks by spaceId', async () => {
      const spaceA = ulid();
      const aStacks = Array.from({ length: 2 }, () => makeStack({ id: ulid(), spaceId: spaceA }));
      const bStacks = Array.from({ length: 1 }, () => makeStack({ id: ulid(), spaceId: ulid() }));
      await db.stacks.bulkAdd([...aStacks, ...bStacks]);

      const fromA = await db.stacks.where('spaceId').equals(spaceA).toArray();
      const aIds = new Set(aStacks.map(s => s.id));
      expect(fromA.filter(s => aIds.has(s.id))).toHaveLength(2);
    });

    it('filters out soft-deleted stacks in query', async () => {
      const active = makeStack({ id: ulid() });
      const deleted = makeStack({ id: ulid(), deletedAt: Date.now() });
      await db.stacks.bulkAdd([active, deleted]);

      const all = await db.stacks.toArray();
      const activeStacks = all.filter(s => s.id === active.id || s.id === deleted.id);
      const activeOnes = activeStacks.filter(s => !s.deletedAt);
      expect(activeOnes).toHaveLength(1);
      expect(activeOnes[0]!.id).toBe(active.id);
    });
  });

  // ─── BLOB ─────────────────────────────────────────────────

  describe('Blob persistence', () => {
    it('stores and retrieves a blob by id', async () => {
      const original = makeBlob();
      await db.blobs.add(original);

      const got = await db.blobs.get(original.id);
      expect(got).not.toBeNull();
      expect(got!.id).toBe(original.id);
      expect(got!.thoughtId).toBe(original.thoughtId);
      expect(got!.name).toBe(original.name);
      expect(got!.type).toBe(original.type);
    });

    it('retrieves blob binary content', async () => {
      const content = 'Hello from the blob!';
      const blob = makeBlob({ blob: new Blob([content], { type: 'text/plain' }) });
      await db.blobs.add(blob);

      const got = await db.blobs.get(blob.id);
      const text = await got!.blob.text();
      expect(text).toBe(content);
    });

    it('finds blobs by thoughtId', async () => {
      const thoughtId = ulid();
      const thoughtBlobs = Array.from({ length: 2 }, () => makeBlob({ id: ulid(), thoughtId }));
      const otherBlob = makeBlob({ id: ulid() });
      await db.blobs.bulkAdd([...thoughtBlobs, otherBlob]);

      const found = await db.blobs.where('thoughtId').equals(thoughtId).toArray();
      const ourIds = new Set(thoughtBlobs.map(b => b.id));
      expect(found.filter(b => ourIds.has(b.id))).toHaveLength(2);
    });

    it('stores blobs of various MIME types', async () => {
      const mimeTypes = ['image/png', 'application/pdf', 'video/mp4', 'audio/mpeg'];
      for (const type of mimeTypes) {
        const b = makeBlob({ id: ulid(), blob: new Blob(['data'], { type }), type });
        await db.blobs.add(b);
        const got = await db.blobs.get(b.id);
        expect(got!.type).toBe(type);
        expect(got!.blob.type).toBe(type);
      }
    });
  });

  // ─── APP SETTING ───────────────────────────────────────────

  describe('AppSetting persistence', () => {
    it('stores and retrieves a setting by key', async () => {
      await db.settings.put({ key: 'theme', value: 'dark' });
      const got = await db.settings.get('theme');
      expect(got).not.toBeNull();
      expect(got!.value).toBe('dark');
    });

    it('overwrites existing key on put (same key)', async () => {
      await db.settings.put({ key: 'lang', value: 'en' });
      await db.settings.put({ key: 'lang', value: 'fr' });
      const got = await db.settings.get('lang');
      expect(got!.value).toBe('fr');
    });

    it('deletes a setting by key', async () => {
      const key = `temp-${ulid()}`;
      await db.settings.add({ key, value: 'x' });
      await db.settings.delete(key);
      const got = await db.settings.get(key);
      expect(got).toBeUndefined();
    });

    it('stores multiple independent settings', async () => {
      const key = `multi-${ulid()}`;
      await db.settings.bulkAdd([
        { key: `${key}-a`, value: '1' },
        { key: `${key}-b`, value: '2' },
        { key: `${key}-c`, value: '3' },
      ]);
      const all = await db.settings.toArray();
      const ours = all.filter(s => s.key.startsWith(key));
      expect(ours.map(s => s.key).sort()).toEqual([`${key}-a`, `${key}-b`, `${key}-c`]);
    });
  });

  // ─── CHAT CONVERSATION ─────────────────────────────────────

  describe('ChatConversation CRUD', () => {
    it('stores and retrieves a conversation', async () => {
      const original = makeChatConversation();
      await db.chatConversations.add(original);

      const got = await db.chatConversations.get(original.id);
      expect(got).not.toBeNull();
      expect(got!.title).toBe(original.title);
      expect(got!.spaceId).toBe(original.spaceId);
    });

    it('updates conversation title', async () => {
      const c = makeChatConversation({ title: 'old title' });
      await db.chatConversations.add(c);
      await db.chatConversations.update(c.id, { title: 'new title' });
      const got = await db.chatConversations.get(c.id);
      expect(got!.title).toBe('new title');
    });

    it('filters conversations by spaceId', async () => {
      const spaceId = ulid();
      const convs = Array.from({ length: 2 }, () => makeChatConversation({ id: ulid(), spaceId }));
      const other = makeChatConversation({ id: ulid() });
      await db.chatConversations.bulkAdd([...convs, other]);

      const found = await db.chatConversations.where('spaceId').equals(spaceId).toArray();
      const ourIds = new Set(convs.map(c => c.id));
      expect(found.filter(c => ourIds.has(c.id))).toHaveLength(2);
    });
  });

  // ─── CHAT MESSAGE ──────────────────────────────────────────

  describe('ChatMessage persistence', () => {
    it('stores and retrieves a chat message', async () => {
      const original = makeChatMessage();
      await db.chatHistory.add(original);

      const got = await db.chatHistory.get(original.id);
      expect(got).not.toBeNull();
      expect(got!.role).toBe(original.role);
      expect(got!.content).toBe(original.content);
      expect(got!.msgType).toBe('chat');
    });

    it('queries messages by compound key [spaceId+conversationId]', async () => {
      const spaceId = ulid();
      const convId = ulid();
      const msgs = [
        makeChatMessage({ id: ulid(), spaceId, conversationId: convId, content: 'msg1' }),
        makeChatMessage({ id: ulid(), spaceId, conversationId: convId, content: 'msg2' }),
      ];
      const other = makeChatMessage({ id: ulid(), spaceId, conversationId: ulid(), content: 'other' });
      await db.chatHistory.bulkAdd([...msgs, other]);

      const convMessages = await db.chatHistory
        .where('[spaceId+conversationId]')
        .equals([spaceId, convId])
        .toArray();
      const ourIds = new Set(msgs.map(m => m.id));
      const ours = convMessages.filter(m => ourIds.has(m.id));
      expect(ours).toHaveLength(2);
      expect(ours.map(m => m.content).sort()).toEqual(['msg1', 'msg2']);
    });

    it('stores both user and assistant roles', async () => {
      const userId = ulid();
      const assistantId = ulid();
      await db.chatHistory.bulkAdd([
        makeChatMessage({ id: userId, role: 'user', content: 'hello' }),
        makeChatMessage({ id: assistantId, role: 'assistant', content: 'hi there' }),
      ]);
      const userMsg = await db.chatHistory.get(userId);
      const assistantMsg = await db.chatHistory.get(assistantId);
      expect(userMsg!.role).toBe('user');
      expect(assistantMsg!.role).toBe('assistant');
    });

    it('stores system messages', async () => {
      const msg = makeChatMessage({ msgType: 'system', content: 'system update' });
      await db.chatHistory.add(msg);
      const got = await db.chatHistory.get(msg.id);
      expect(got!.msgType).toBe('system');
    });
  });

  // ─── SPACE BACKGROUND ─────────────────────────────────────

  describe('SpaceBackground persistence', () => {
    it('stores and retrieves a background by id', async () => {
      const original = makeSpaceBackground();
      await db.spaceBackgrounds.add(original);

      const got = await db.spaceBackgrounds.get(original.id);
      expect(got).not.toBeNull();
      expect(got!.spaceId).toBe(original.spaceId);
      expect(got!.name).toBe(original.name);
      expect(got!.type).toBe(original.type);
    });

    it('retrieves background blob', async () => {
      const bg = makeSpaceBackground({ blob: new Blob(['png data'], { type: 'image/png' }) });
      await db.spaceBackgrounds.add(bg);

      const got = await db.spaceBackgrounds.get(bg.id);
      const text = await got!.blob.text();
      expect(text).toBe('png data');
    });

    it('finds backgrounds by spaceId', async () => {
      const spaceId = ulid();
      const bgs = Array.from({ length: 2 }, () => makeSpaceBackground({ id: ulid(), spaceId }));
      const other = makeSpaceBackground({ id: ulid() });
      await db.spaceBackgrounds.bulkAdd([...bgs, other]);

      const found = await db.spaceBackgrounds.where('spaceId').equals(spaceId).toArray();
      const ourIds = new Set(bgs.map(b => b.id));
      expect(found.filter(b => ourIds.has(b.id))).toHaveLength(2);
    });
  });

  // ─── SOFT-DELETE PATTERNS ─────────────────────────────────

  describe('Soft-delete patterns', () => {
    it('thoughts with deletedAt set are persisted but distinguishable', async () => {
      const active = makeThought({ id: ulid() });
      const deleted = makeThought({ id: ulid(), deletedAt: Date.now() });
      await db.thoughts.bulkAdd([active, deleted]);

      const gotActive = await db.thoughts.get(active.id);
      const gotDeleted = await db.thoughts.get(deleted.id);
      expect(gotActive!.deletedAt).toBeNull();
      expect(gotDeleted!.deletedAt).not.toBeNull();
    });

    it('soft-deleted stacks can be restored by setting deletedAt to null', async () => {
      const s = makeStack({ deletedAt: Date.now() });
      await db.stacks.add(s);

      await db.stacks.update(s.id, { deletedAt: null });
      const restored = await db.stacks.get(s.id);
      expect(restored!.deletedAt).toBeNull();
    });
  });

  // ─── CONCURRENT WRITES ─────────────────────────────────────

  describe('Concurrent writes', () => {
    it('handles parallel adds to different tables', async () => {
      const results = await Promise.all([
        db.spaces.add(makeSpace({ id: ulid() })),
        db.thoughts.add(makeThought({ id: ulid() })),
        db.stacks.add(makeStack({ id: ulid() })),
        db.settings.add(makeSetting()),
      ]);
      expect(results).toHaveLength(4);
      results.forEach(r => expect(r).toBeTruthy());
    });
  });

  // ─── SCHEMA INDEXES ───────────────────────────────────────

  describe('Schema index coverage', () => {
    it('indexes every field declared in v24 schema (spaces)', async () => {
      const s = makeSpace({ name: `idx-${ulid()}`, order: 42 });
      await db.spaces.add(s);

      expect(await db.spaces.where('name').equals(s.name).count()).toBe(1);
      expect(await db.spaces.where('order').equals(42).filter(x => x.id === s.id).count()).toBe(1);
    });

    it('orders spaces by order field', async () => {
      const spaces = [
        makeSpace({ id: ulid(), name: 'C', order: 10 }),
        makeSpace({ id: ulid(), name: 'A', order: 0 }),
        makeSpace({ id: ulid(), name: 'B', order: 5 }),
      ];
      await db.spaces.bulkAdd(spaces);

      const ordered = await db.spaces.orderBy('order').toArray();
      const ourOrdered = ordered.filter(s => spaces.some(our => our.id === s.id));
      expect(ourOrdered.map(s => s.name)).toEqual(['A', 'B', 'C']);
    });
  });
});
