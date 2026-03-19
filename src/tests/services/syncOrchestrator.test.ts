import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { db } from '../../db';
import { syncOrchestrator } from '../../services/sync/syncOrchestrator';
import { supabaseSync } from '../../services/supabaseSync';
import { supabaseStorage } from '../../services/supabaseStorage';

// Mock Supabase services
vi.mock('../../services/supabaseSync', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
    })),
  },
  supabaseSync: {
    getSpaces: vi.fn(),
    getStacks: vi.fn(),
    getThoughts: vi.fn(),
    createSpaces: vi.fn(),
    createStacks: vi.fn(),
    createThoughts: vi.fn(),
    deleteSpace: vi.fn(),
    deleteStack: vi.fn(),
    deleteThought: vi.fn(),
  },
  toCamelCase: (obj: any) => {
    const newObj: any = {};
    for (const key in obj) {
      newObj[key.replace(/(_\w)/g, (m) => m[1].toUpperCase())] = obj[key];
    }
    return newObj;
  },
}));

vi.mock('../../services/supabaseStorage', () => ({
  supabaseStorage: {
    uploadFile: vi.fn(),
    deleteFile: vi.fn(),
    cleanupOrphanedFiles: vi.fn(),
    listFiles: vi.fn(),
  },
}));

// Mock Auth Store
const mockAuthStore = {
  user: { id: 'test-user' },
  status: 'authenticated',
  isOnline: true,
  autoSync: true,
  lastSync: null as Date | null,
  downloadSingleBlob: vi.fn(),
};

vi.mock('../../store/useAuthStore', () => ({
  useAuthStore: {
    getState: vi.fn(() => mockAuthStore),
    setState: vi.fn((update) => Object.assign(mockAuthStore, update)),
  },
}));

// Mock Sync Store
const mockSyncStore = {
  status: 'idle',
  setStatus: vi.fn((status) => { mockSyncStore.status = status; }),
  setSyncBlocked: vi.fn(),
  setState: vi.fn((update) => Object.assign(mockSyncStore, update)),
};

vi.mock('../../store/useSyncStore', () => ({
  useSyncStore: {
    getState: vi.fn(() => mockSyncStore),
    setState: vi.fn((update) => Object.assign(mockSyncStore, update)),
  },
}));

describe('syncOrchestrator', () => {
  beforeEach(async () => {
    await db.thoughts.clear();
    await db.spaces.clear();
    await db.stacks.clear();
    await db.blobs.clear();
    localStorage.clear();
    
    vi.clearAllMocks();
    mockSyncStore.status = 'idle';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('triggers sync with debounce', async () => {
    vi.useFakeTimers();
    const deltaSyncSpy = vi.spyOn(syncOrchestrator, 'deltaSync').mockImplementation(async () => ({ success: true }));
    
    await syncOrchestrator.triggerSync();
    await syncOrchestrator.triggerSync();
    
    expect(deltaSyncSpy).not.toHaveBeenCalled();
    
    vi.runAllTimers();
    expect(deltaSyncSpy).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('performs delta sync correctly', async () => {
    const now = Date.now();
    // 1. Add local data
    await db.spaces.add({ id: 's1', userId: 'test-user', name: 'Space 1', order: 0, physics: true, mode: 'spatial', syncStatus: 'local', updatedAt: now });
    await db.thoughts.add({ id: 't1', userId: 'test-user', text: 'Thought 1', spaceId: 's1', stackId: null, x: 0, y: 0, vx: 0, vy: 0, type: 'text', author: '', order: 0, date: '', priority: 'none', description: '', status: 'none', size: 1, data: { type: 'text', content: '' }, syncStatus: 'local', updatedAt: now });
    
    // 2. Mock cloud data (empty cloud)
    vi.mocked(supabaseSync.getSpaces).mockResolvedValue({ spaces: [] });
    vi.mocked(supabaseSync.getStacks).mockResolvedValue({ stacks: [] });
    vi.mocked(supabaseSync.getThoughts).mockResolvedValue({ thoughts: [] });
    
    // 3. Run sync
    const result = await syncOrchestrator.deltaSync();
    
    if (!result.success) {
      console.error('Sync failed:', result.error);
    }
    
    expect(result.success).toBe(true);
    expect(supabaseSync.createSpaces).toHaveBeenCalled();
    expect(supabaseSync.createThoughts).toHaveBeenCalled();
    expect(mockSyncStore.status).toBe('synced');
  });

  it('identifies and handles orphaned cloud data', async () => {
    // 1. Local is empty
    localStorage.setItem('cyberia-last-sync', new Date().toISOString());
    
    // 2. Cloud has one space
    vi.mocked(supabaseSync.getSpaces).mockResolvedValue({ spaces: [{ id: 'orphan-s', updated_at: new Date().toISOString() }] as any });
    vi.mocked(supabaseSync.getStacks).mockResolvedValue({ stacks: [] });
    vi.mocked(supabaseSync.getThoughts).mockResolvedValue({ thoughts: [] });
    
    // Mock supabase.from().select().eq().single() for the space fetch
    const mockSingle = vi.fn().mockResolvedValue({ data: { id: 'orphan-s', name: 'Orphan Space', user_id: 'test-user' }, error: null });
    const { supabase } = await import('../../services/supabaseSync');
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: mockSingle
        })
      })
    } as any);

    // 3. Run sync
    const result = await syncOrchestrator.deltaSync();
    expect(result.success).toBe(true);
    
    // Should have added the space locally
    const localSpace = await db.spaces.get('orphan-s');
    expect(localSpace).toBeDefined();
  });

  it('uploads local blobs for media thoughts', async () => {
    const now = Date.now();
    // 1. Local thought with blob
    await db.thoughts.add({ id: 't2', userId: 'test-user', type: 'file', spaceId: 's1', text: 'Image', stackId: null, x: 0, y: 0, vx: 0, vy: 0, author: '', order: 0, date: '', priority: 'none', description: '', status: 'none', size: 1, data: { type: 'file', url: '', name: 'test.png', size: 5 }, syncStatus: 'local', updatedAt: now });
    await db.blobs.add({ id: 'b1', thoughtId: 't2', blob: new Blob(['hello'], { type: 'image/png' }), name: 'test.png', type: 'image/png', updatedAt: now, userId: 'test-user' });
    
    vi.mocked(supabaseSync.getSpaces).mockResolvedValue({ spaces: [] });
    vi.mocked(supabaseSync.getStacks).mockResolvedValue({ stacks: [] });
    vi.mocked(supabaseSync.getThoughts).mockResolvedValue({ thoughts: [] });
    vi.mocked(supabaseStorage.uploadFile).mockResolvedValue({ url: 'http://cloud.com/test.png', path: 'test-user/test.png', size: 5 });
    
    // 2. Run sync
    const result = await syncOrchestrator.deltaSync();
    expect(result.success).toBe(true);
    
    expect(supabaseStorage.uploadFile).toHaveBeenCalled();
    const updatedThought = await db.thoughts.get('t2');
    expect(updatedThought?.storageUrl).toBe('http://cloud.com/test.png');
    expect(updatedThought?.storagePath).toBe('test-user/test.png');
  });

  it('correctly determines if local is empty', async () => {
    const userId = 'test-user';
    // Case 1: Truly empty
    expect(await syncOrchestrator.isLocalEmpty(userId)).toBe(true);
    
    // Case 2: User content
    await db.thoughts.add({ id: 't4', userId: userId, spaceId: 'my-space', text: 'My Thought', type: 'text', stackId: null, x: 0, y: 0, vx: 0, vy: 0, author: '', order: 0, date: '', priority: 'none', description: '', status: 'none', size: 1, data: { type: 'text', content: '' } });
    expect(await syncOrchestrator.isLocalEmpty(userId)).toBe(false);
  });
});
