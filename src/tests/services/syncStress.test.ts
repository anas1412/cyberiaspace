import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { db } from '../../db';
import { syncOrchestrator } from '../../services/sync/syncOrchestrator';
import { supabaseSync, supabase } from '../../services/supabaseSync';
import { ulid } from 'ulid';

// Mock Supabase services
vi.mock('../../services/supabaseSync', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    supabase: {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: null, error: null })),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              select: vi.fn(() => ({
                maybeSingle: vi.fn(() => Promise.resolve({ data: { id: 'test' }, error: null })),
              })),
            })),
          })),
        })),
        upsert: vi.fn(() => ({
          select: vi.fn(() => ({
            maybeSingle: vi.fn(() => Promise.resolve({ data: { id: 'test' }, error: null })),
            eq: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
        delete: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ error: null })),
            in: vi.fn(() => Promise.resolve({ error: null })),
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
  };
});

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
  user: { id: 'stress-user' },
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

// Mock Main Store
const mockStore = {
  activeSpaceId: 'space-1',
  refreshSpaces: vi.fn(),
  refreshThoughts: vi.fn(),
  refreshStacks: vi.fn(),
};

vi.mock('../../store/useStore', () => ({
  useStore: {
    getState: vi.fn(() => mockStore),
    setState: vi.fn((update) => Object.assign(mockStore, update)),
  },
}));

describe('Sync Stress Test', () => {
  beforeEach(async () => {
    await db.thoughts.clear();
    await db.spaces.clear();
    await db.stacks.clear();
    await db.blobs.clear();
    localStorage.clear();
    
    vi.clearAllMocks();
    mockSyncStore.status = 'idle';
    mockAuthStore.lastSync = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('spawns 100 thoughts, syncs them, then handles 50 remote deletions', async () => {
    const spaceId = 'space-1';
    const userId = 'stress-user';
    const now = Date.now();

    // 0. Setup Space
    await db.spaces.add({
      id: spaceId,
      userId: userId,
      name: 'Stress Test Space',
      mode: 'spatial',
      physics: true,
      order: 0,
      syncStatus: 'synced',
      updatedAt: now,
    });

    // 1. Create 100 thoughts locally
    const thoughts: any[] = [];
    for (let i = 0; i < 100; i++) {
      thoughts.push({
        id: ulid(),
        spaceId,
        stackId: null,
        text: `Thought ${i}`,
        type: 'text' as const,
        x: Math.random() * 1000,
        y: Math.random() * 1000,
        vx: 0,
        vy: 0,
        author: userId,
        order: i,
        date: '',
        priority: 'none' as const,
        description: '',
        status: 'none' as const,
        size: 1,
        syncStatus: 'local' as const,
        updatedAt: now,
        data: { type: 'text' as const, content: `Content ${i}` },
      });
    }
    await db.thoughts.bulkAdd(thoughts);

    // Mock initial cloud state (empty)
    vi.mocked(supabaseSync.getSpaces).mockResolvedValue({ spaces: [{ id: spaceId, updated_at: new Date(now).toISOString() }] as any });
    vi.mocked(supabaseSync.getStacks).mockResolvedValue({ stacks: [] });
    vi.mocked(supabaseSync.getThoughts).mockResolvedValue({ thoughts: [] });
    vi.mocked(supabaseSync.createThoughts).mockResolvedValue({ thoughts: [] });

    // 2. Trigger delta sync (Push 100 thoughts)
    await syncOrchestrator.deltaSync();

    expect(supabaseSync.createThoughts).toHaveBeenCalled();
    const firstPushArgs = vi.mocked(supabaseSync.createThoughts).mock.calls[0][0];
    expect(firstPushArgs.length).toBe(100);

    // Verify local status is synced
    const localThoughtsAfterFirstSync = await db.thoughts.toArray();
    expect(localThoughtsAfterFirstSync.every(t => t.syncStatus === 'synced')).toBe(true);

    // 3. Simulate remote deletion of 50 thoughts
    // We do this by returning them with deleted_at set in getThoughts
    const deletedThoughts = thoughts.slice(0, 50);
    const activeThoughts = thoughts.slice(50);
    
    const cloudUpdateAt = now + 1000;
    const cloudUpdateTimeStr = new Date(cloudUpdateAt).toISOString();

    const cloudMetadata = [
      ...deletedThoughts.map(t => ({ id: t.id, updatedAt: cloudUpdateTimeStr, spaceId, type: 'text' })),
      ...activeThoughts.map(t => ({ id: t.id, updatedAt: new Date(now).toISOString(), spaceId, type: 'text' }))
    ];

    vi.mocked(supabaseSync.getThoughts).mockResolvedValue({ thoughts: cloudMetadata as any });

    // Mock supabase.from('thoughts').select('*').eq('id', id).single()
    const singleMock = vi.fn();
    const requestedIds = new Set<string>();
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'thoughts') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation((col: string, val: string) => {
              if (col === 'id') {
                const thought = thoughts.find(t => t.id === val);
                const isDeleted = deletedThoughts.some(dt => dt.id === val);
                return {
                  single: singleMock.mockImplementation(() => {
                    requestedIds.add(val);
                    return Promise.resolve({
                      data: thought ? {
                        id: thought.id,
                        user_id: userId,
                        space_id: spaceId,
                        text: thought.text,
                        type: thought.type,
                        updated_at: isDeleted ? cloudUpdateTimeStr : new Date(now).toISOString(),
                        deleted_at: isDeleted ? cloudUpdateTimeStr : null,
                        content: (thought.data as any).content,
                      } : null,
                      error: null
                    });
                  })
                };
              }
              return { single: vi.fn().mockResolvedValue({ data: null, error: null }) };
            })
          })
        } as any;
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null })
          })
        })
      } as any;
    });

    // 4. Run another delta sync
    await syncOrchestrator.deltaSync();

    // 5. Verify local state
    const localThoughtsAfterSecondSync = await db.thoughts.toArray();
    const localDeletedCount = localThoughtsAfterSecondSync.filter(t => t.deletedAt).length;
    const localActiveCount = localThoughtsAfterSecondSync.filter(t => !t.deletedAt).length;

    expect(localDeletedCount).toBe(50);
    expect(localActiveCount).toBe(50);

    // 6. Verify no duplicate network requests for the same entity ID
    // Each of the 50 deleted thoughts should have been fetched exactly once
    expect(singleMock).toHaveBeenCalledTimes(50);
    expect(requestedIds.size).toBe(50);
  });
});
