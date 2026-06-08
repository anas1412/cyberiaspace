import { describe, expect, it } from 'bun:test';
import Dexie from 'dexie';
import { ulid } from 'ulid';

const db = new Dexie('MiniUpdate') as any;
db.version(1).stores({ items: 'id' });

describe('minimal update test', () => {
  it('t1 - add', async () => {
    await db.items.add({ id: 'a', val: 1 });
    expect((await db.items.get('a'))!.val).toBe(1);
  });
  
  it('t2 - update', async () => {
    // This uses the SAME shared db instance
    await db.items.add({ id: 'b', val: 2 });
    await db.items.update('b', { val: 99 });
    expect((await db.items.get('b'))!.val).toBe(99);
  });
});
