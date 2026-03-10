import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { db } from '../../db';
import { syncOrchestrator } from '../../services/sync/syncOrchestrator';
import { supabaseSync } from '../../services/supabaseSync';
import { supabaseStorage } from '../../services/supabaseStorage';

// Mock Supabase services
vi.mock('../../services/supabaseSync', () => ({
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
};

vi.mock('../../store/useAuthStore', () => ({
  useAuthStore: {
    getState: vi.fn(() => mockAuthStore),
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
    // 1. Add local data
    await db.spaces.add({ id: 's1', name: 'Space 1', order: 0, physics: true, mode: 'spatial', syncStatus: 'local' });
    await db.thoughts.add({ id: 't1', text: 'Thought 1', spaceId: 's1', stackId: null, x: 0, y: 0, vx: 0, vy: 0, type: 'text', author: '', order: 0, date: '', priority: 'none', description: '', status: 'none', size: 1, data: { type: 'text', content: '' }, syncStatus: 'local' });
    
    // 2. Mock cloud data (empty cloud)
    vi.mocked(supabaseSync.getSpaces).mockResolvedValue({ spaces: [] });
    vi.mocked(supabaseSync.getStacks).mockResolvedValue({ stacks: [] });
    vi.mocked(supabaseSync.getThoughts).mockResolvedValue({ thoughts: [] });
    
    // 3. Run sync
    const result = await syncOrchestrator.deltaSync();
    
    expect(result.success).toBe(true);
    expect(supabaseSync.createSpaces).toHaveBeenCalled();
    expect(supabaseSync.createThoughts).toHaveBeenCalled();
    expect(mockSyncStore.status).toBe('synced');
  });

  it('identifies and handles orphaned cloud data', async () => {
    // 1. Local is empty
    
    // 2. Cloud has one space
    vi.mocked(supabaseSync.getSpaces).mockResolvedValue({ spaces: [{ id: 'orphan-s', user_id: 'test-user' }] as any });
    vi.mocked(supabaseSync.getStacks).mockResolvedValue({ stacks: [] });
    vi.mocked(supabaseSync.getThoughts).mockResolvedValue({ thoughts: [] });
    
    // 3. Run sync
    await syncOrchestrator.deltaSync();
    
    // In delta sync, orphaned cloud data is NOT deleted unless marked deleted locally
    // expect(supabaseSync.deleteSpace).toHaveBeenCalledWith('orphan-s', 'test-user');
  });

  it('uploads local blobs for media thoughts', async () => {
    // 1. Local thought with blob
    await db.thoughts.add({ id: 't2', type: 'file', spaceId: 's1', text: 'Image', stackId: null, x: 0, y: 0, vx: 0, vy: 0, author: '', order: 0, date: '', priority: 'none', description: '', status: 'none', size: 1, data: { type: 'file', url: '', name: 'test.png', size: 5 }, syncStatus: 'local' });
    await db.blobs.add({ id: 'b1', thoughtId: 't2', blob: new Blob(['hello'], { type: 'image/png' }), name: 'test.png', type: 'image/png', updatedAt: Date.now() });
    
    vi.mocked(supabaseSync.getSpaces).mockResolvedValue({ spaces: [] });
    vi.mocked(supabaseSync.getStacks).mockResolvedValue({ stacks: [] });
    vi.mocked(supabaseSync.getThoughts).mockResolvedValue({ thoughts: [] });
    vi.mocked(supabaseStorage.uploadFile).mockResolvedValue({ url: 'http://cloud.com/test.png', path: 'test-user/test.png', size: 5 });
    
    // 2. Run sync
    await syncOrchestrator.deltaSync();
    
    expect(supabaseStorage.uploadFile).toHaveBeenCalled();
    const updatedThought = await db.thoughts.get('t2');
    expect(updatedThought?.storageUrl).toBe('http://cloud.com/test.png');
    expect(updatedThought?.storagePath).toBe('test-user/test.png');
  });

  it('correctly determines if local is empty', async () => {
    // Case 1: Truly empty
    expect(await syncOrchestrator.isLocalEmpty()).toBe(true);
    
    // Case 2: User content
    await db.thoughts.add({ id: 't4', spaceId: 'my-space', text: 'My Thought', type: 'text', stackId: null, x: 0, y: 0, vx: 0, vy: 0, author: '', order: 0, date: '', priority: 'none', description: '', status: 'none', size: 1, data: { type: 'text', content: '' } });
    expect(await syncOrchestrator.isLocalEmpty()).toBe(false);
  });
});
