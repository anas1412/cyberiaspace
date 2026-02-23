import { db } from '../../db';
import type { SyncChange, QueueStats } from './syncTypes';

const MAX_RETRIES = 3;

export const syncQueue = {
  async add(change: Omit<SyncChange, 'id' | 'createdAt' | 'retryCount'>): Promise<number | undefined> {
    const id = await db.pendingChanges.add({
      tableName: change.tableName,
      action: change.action,
      localId: change.localId,
      data: change.data,
      createdAt: Date.now(),
      retryCount: 0,
    });
    return id as number | undefined;
  },

  async addBulk(changes: Omit<SyncChange, 'id' | 'createdAt' | 'retryCount'>[]): Promise<void> {
    const records = changes.map(change => ({
      tableName: change.tableName,
      action: change.action,
      localId: change.localId,
      data: change.data,
      createdAt: Date.now(),
      retryCount: 0,
    }));
    await db.pendingChanges.bulkAdd(records);
  },

  async getAll(): Promise<SyncChange[]> {
    return db.pendingChanges.toArray();
  },

  async getPending(): Promise<SyncChange[]> {
    return db.pendingChanges.filter(c => c.retryCount < MAX_RETRIES).toArray();
  },

  async getFailed(): Promise<SyncChange[]> {
    return db.pendingChanges.filter(c => c.retryCount >= MAX_RETRIES).toArray();
  },

  async remove(id: number): Promise<void> {
    await db.pendingChanges.delete(id);
  },

  async removeMultiple(ids: number[]): Promise<void> {
    await db.pendingChanges.bulkDelete(ids);
  },

  async clear(): Promise<void> {
    await db.pendingChanges.clear();
  },

  async incrementRetry(id: number): Promise<void> {
    const change = await db.pendingChanges.get(id);
    if (change) {
      await db.pendingChanges.update(id, { retryCount: change.retryCount + 1 });
    }
  },

  async resetStuck(): Promise<number> {
    const all = await db.pendingChanges.toArray();
    const stuck = all.filter(c => c.retryCount >= MAX_RETRIES);
    
    for (const item of stuck) {
      if (item.id) {
        await db.pendingChanges.update(item.id, { retryCount: 0 });
      }
    }
    
    return stuck.length;
  },

  async getStats(): Promise<QueueStats> {
    const all = await db.pendingChanges.toArray();
    return {
      total: all.length,
      pending: all.filter(c => c.retryCount < MAX_RETRIES).length,
      failed: all.filter(c => c.retryCount >= MAX_RETRIES).length,
    };
  },

  async hasPendingChanges(): Promise<boolean> {
    const count = await db.pendingChanges.filter(c => c.retryCount < MAX_RETRIES).count();
    return count > 0;
  },
};
