import { describe, expect, it } from 'bun:test';
import { db } from '../db';  // Use the production Dexie instance
import { ulid } from 'ulid';

describe('using production db instance', () => {
  // Use unique IDs so we don't conflict with each other or real data
  const prefix = `test_${ulid()}_`;

  it('t1 - add', async () => {
    await db.thoughts.add({
      id: `${prefix}1`, spaceId: 'test', stackId: null,
      x: 0, y: 0, vx: 0, vy: 0,
      text: 'first', description: '', type: 'label',
      status: 'none', priority: 'none', size: 0, order: 0, author: 'test',
    });
    const got = await db.thoughts.get(`${prefix}1`);
    expect(got!.text).toBe('first');
  });

  it('t2 - update', async () => {
    await db.thoughts.add({
      id: `${prefix}2`, spaceId: 'test', stackId: null,
      x: 0, y: 0, vx: 0, vy: 0,
      text: 'second', description: '', type: 'label',
      status: 'none', priority: 'none', size: 0, order: 0, author: 'test',
    });
    await db.thoughts.update(`${prefix}2`, { text: 'updated' });
    const got = await db.thoughts.get(`${prefix}2`);
    expect(got!.text).toBe('updated');
  });

  it('t3 - filter', async () => {
    const spaceId = ulid();
    await db.thoughts.bulkAdd([
      { id: `${prefix}3a`, spaceId, stackId: null, x: 0, y: 0, vx: 0, vy: 0, text: 'filter-a', description: '', type: 'label', status: 'none', priority: 'none', size: 0, order: 0, author: 'test' },
      { id: `${prefix}3b`, spaceId, stackId: null, x: 0, y: 0, vx: 0, vy: 0, text: 'filter-b', description: '', type: 'label', status: 'none', priority: 'none', size: 0, order: 0, author: 'test' },
    ]);
    const found = await db.thoughts.where('spaceId').equals(spaceId).toArray();
    expect(found.some(t => t.id === `${prefix}3a`)).toBe(true);
  });
});
