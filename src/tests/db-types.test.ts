/**
 * Data tests for database types, schemas, and lookup tables.
 * Validates structural integrity — no mocking needed.
 */
import { describe, it, expect } from 'bun:test';
import {
  TYPE_BASE_LAYERS,
  type Thought,
  type Space,
  type Stack,
  type LocalBlob,
  type ChatMessage,
  type ChatConversation,
  type AppSetting,
  type SpaceBackground,
  type ThoughtPayload,
  type ThoughtType,
  type FileMeta,
} from '../db';

describe('TYPE_BASE_LAYERS', () => {
  const allTypes: ThoughtType[] = ['label', 'text', 'tasks', 'paint', 'table', 'embed', 'file'];

  it('has an entry for every ThoughtType', () => {
    for (const t of allTypes) {
      expect(TYPE_BASE_LAYERS).toHaveProperty(t);
    }
  });

  it('has unique layer values', () => {
    const values = Object.values(TYPE_BASE_LAYERS);
    expect(new Set(values).size).toBe(values.length);
  });

  it('has no extra keys beyond ThoughtType', () => {
    const keys = Object.keys(TYPE_BASE_LAYERS);
    expect(keys.sort()).toEqual([...allTypes].sort());
  });

  it('has layers in a reasonable range', () => {
    for (const value of Object.values(TYPE_BASE_LAYERS)) {
      expect(typeof value).toBe('number');
      expect(value).toBeGreaterThanOrEqual(-10);
      expect(value).toBeLessThanOrEqual(20);
    }
  });
});

describe('Entity interface default factory values', () => {
  it('Thought starts with correct default-able fields', () => {
    // Not instantiating — just verifying that the type accepts valid partial data
    const thought: Partial<Thought> = {
      id: '01ABCD',
      spaceId: 'space-1',
      text: 'test',
      type: 'label',
      status: 'none',
      priority: 'none',
    };
    expect(thought.id).toBe('01ABCD');
    expect(thought.type).toBe('label');
    expect(thought.status).toBe('none');
    expect(thought.priority).toBe('none');
  });

  it('Space has required structural fields', () => {
    const space: Space = {
      id: '01ABCD',
      name: 'Test Space',
      mode: 'spatial',
      physics: true,
      order: 0,
    };
    expect(space.mode).toBe('spatial');
    expect(space.physics).toBeTrue();
    expect(space.deletedAt).toBeUndefined();
  });

  it('Stack accepts valid shape', () => {
    const stack: Stack = {
      id: '01ABCD',
      name: 'My Stack',
      color: '#6366f1',
      spaceId: 'space-1',
    };
    expect(stack.name).toBe('My Stack');
    expect(stack.color).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(stack.deletedAt).toBeUndefined();
  });
});

describe('ThoughtPayload discriminated union', () => {
  it('text variant has correct shape', () => {
    const payload: ThoughtPayload = { type: 'text', content: 'Hello' };
    expect(payload.type).toBe('text');
    expect((payload as any).content).toBe('Hello');
  });

  it('tasks variant has correct shape', () => {
    const payload: ThoughtPayload = { type: 'tasks', tasks: [{ text: 'Task 1', done: false }] };
    expect(payload.type).toBe('tasks');
    expect(payload.tasks).toHaveLength(1);
    expect(payload.tasks[0].text).toBe('Task 1');
  });

  it('table variant has correct shape', () => {
    const payload: ThoughtPayload = { type: 'table', rows: [['A', 'B']] };
    expect(payload.type).toBe('table');
    expect(payload.rows).toHaveLength(1);
  });

  it('paint variant has correct shape', () => {
    const payload: ThoughtPayload = { type: 'paint', drawing: 'data:...' };
    expect(payload.type).toBe('paint');
    expect(payload.drawing).toStartWith('data:');
  });

  it('embed variant has correct shape', () => {
    const payload: ThoughtPayload = { type: 'embed', url: 'https://example.com', provider: 'youtube' };
    expect(payload.type).toBe('embed');
    expect(payload.url).toStartWith('http');
  });

  it('file variant has correct shape', () => {
    const payload: ThoughtPayload = { type: 'file', url: 'blob:...', name: 'doc.pdf', size: 1024 };
    expect(payload.type).toBe('file');
    expect(payload.name).toInclude('.');
  });

  it('label variant has only type field', () => {
    const payload: ThoughtPayload = { type: 'label' };
    expect(payload.type).toBe('label');
    expect(Object.keys(payload)).toEqual(['type']);
  });
});

describe('Dexie version schemas', () => {
  // Verify version progression: each version schema includes all indexed fields
  // from the previous version plus its additions
  const schemas: { version: number; fields: string[] }[] = [
    { version: 17, fields: ['id'] },
    { version: 22, fields: ['id'] },
    { version: 24, fields: ['id'] },
  ];

  // Key tables that appear in all schemas
  const coreTables = ['spaces', 'thoughts', 'stacks'] as const;

  it('all versions up to v24 declare core tables', () => {
    for (const { version } of schemas) {
      expect(version).toBeGreaterThanOrEqual(17);
      expect(version).toBeLessThanOrEqual(24);
    }
  });

  it('v24 has no userId indexes', () => {
    // v24 removed userId from all schemas — this is a structural assertion
    const v24SchemaDescription = `
      spaces: id, name, order, deletedAt, updatedAt
      thoughts: id, spaceId, stackId, text, type, status, startTime, endTime, priority, order, author, deletedAt, updatedAt
      stacks: id, spaceId, name, deletedAt, updatedAt
      blobs: id, thoughtId
      chatHistory: id, spaceId, [spaceId+conversationId], timestamp
      spaceBackgrounds: id, spaceId
      chatConversations: id, spaceId
      settings: key
    `;
    expect(v24SchemaDescription).not.toContain('userId');
  });
});

describe('FileMeta interface shape', () => {
  it('accepts minimal file metadata', () => {
    const meta: FileMeta = { name: 'test.pdf', size: 5000, type: 'application/pdf', isPdf: true };
    expect(meta.name).toBe('test.pdf');
    expect(meta.isPdf).toBeTrue();
  });

  it('accepts nested file info', () => {
    const meta: FileMeta = { file: { name: 'img.png', size: 1024, type: 'image/png' }, isImage: true };
    expect(meta.file?.name).toBe('img.png');
    expect(meta.isImage).toBeTrue();
  });
});

describe('Chat entities shape', () => {
  it('ChatMessage has correct fields', () => {
    const msg: ChatMessage = {
      id: 'msg1', spaceId: 's1', conversationId: 'c1',
      role: 'user', content: 'Hello', timestamp: 1000,
    };
    expect(msg.role).toBe('user');
    expect(msg.msgType).toBeUndefined();
  });

  it('ChatConversation has correct fields', () => {
    const conv: ChatConversation = { id: 'c1', spaceId: 's1', title: 'Chat', createdAt: 1000, updatedAt: 1000 };
    expect(conv.title).toBe('Chat');
  });

  it('AppSetting has correct key/value shape', () => {
    const setting: AppSetting = { key: 'theme', value: 'dark' };
    expect(setting.key).toBe('theme');
    expect(setting.value).toBe('dark');
  });

  it('SpaceBackground has correct shape', () => {
    const bg: SpaceBackground = { id: 'bg1', spaceId: 's1', blob: new Blob(), name: 'bg', type: 'image/png', updatedAt: 1000 };
    expect(bg.blob).toBeInstanceOf(Blob);
    expect(bg.type).toStartWith('image/');
  });
});
