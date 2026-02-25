export type SyncTableName = 'spaces' | 'stacks' | 'thoughts';
export type SyncAction = 'create' | 'update' | 'delete';
export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

export interface SyncChange {
  id?: number;
  tableName: SyncTableName;
  action: SyncAction;
  localId: string | number;
  data?: Record<string, unknown>;
  createdAt: number;
  retryCount: number;
}

export interface SyncConflictData {
  spaces: unknown[];
  thoughts: unknown[];
  stacks: unknown[];
  activeSpaceId?: string;
}

export interface SyncResult {
  success: boolean;
  syncedCount?: number;
  error?: string;
}

export interface QueueStats {
  total: number;
  pending: number;
  failed: number;
}
