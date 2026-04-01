import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '../../db';
import { useStore } from '../../store/useStore';
import { useAuthStore } from '../../store/useAuthStore';
import { syncOrchestrator } from '../../services/sync/syncOrchestrator';

// Mock Modal Store
const mockOpenModal = vi.fn();
const mockOpenPricing = vi.fn();

vi.mock('../../store/useModalStore', () => ({
  useModalStore: {
    getState: vi.fn(() => ({
      openModal: mockOpenModal,
      openPricing: mockOpenPricing,
    })),
  },
}));

// Mock Auth Store
const mockAuthStore = {
  user: { id: 'test-user', plan: 'free' },
  profile: { tier: 'free' },
  status: 'authenticated',
  autoSync: true,
  deleteServiceContent: vi.fn(),
};

vi.mock('../../store/useAuthStore', () => ({
  useAuthStore: {
    getState: vi.fn(() => mockAuthStore),
    setState: vi.fn((update) => Object.assign(mockAuthStore, update)),
  },
}));

// Mock Sync Orchestrator
vi.mock('../../services/sync/syncOrchestrator', () => ({
  syncOrchestrator: {
    triggerSync: vi.fn(),
  },
}));

describe('thoughtSlice', () => {
  beforeEach(async () => {
    // Clear the database
    await db.thoughts.clear();
    await db.spaces.clear();
    await db.stacks.clear();
    
    // Reset Zustand store state
    useStore.setState({ 
      thoughts: [], 
      activeSpaceId: 'test-space',
      isReadOnly: false,
      isDemo: false,
      history: [],
      historyIndex: 0
    });
    
    // Add test space
    await db.spaces.add({ id: 'test-space', userId: 'test-user', name: 'Test Space', mode: 'spatial', physics: true, order: 0 });
    
    vi.clearAllMocks();
    
    // Ensure useAuthStore is "used" to avoid lint error
    expect(useAuthStore).toBeDefined();
  });

  it('adds a new thought to the database and store', async () => {
    const { addThought } = useStore.getState();
    const thoughtId = await addThought({ text: 'Hello Vitest', type: 'text' });
    
    expect(thoughtId).toBeTruthy();
    expect(typeof thoughtId).toBe('string');
    
    // Check IndexedDB
    const dbThought = await db.thoughts.get(thoughtId);
    expect(dbThought).toBeDefined();
    expect(dbThought?.text).toBe('Hello Vitest');
    
    // Check Store
    const { thoughts } = useStore.getState();
    expect(thoughts.some(t => t.id === thoughtId)).toBe(true);
  });

  it('enforces thought limits', async () => {
    // Override limits for testing
    useStore.setState({
      getLimits: () => ({ 
        MAX_THOUGHTS_PER_SPACE: 2, 
        MAX_SPACES: 5, 
        MAX_CLOUD_THOUGHTS: 100,
        MAX_STORAGE_MB: 100,
        AI_ENABLED: true,
        THEMES_ENABLED: ['dark', 'light']
      })
    });
    
    const { addThought } = useStore.getState();
    
    await addThought({ text: 'Thought 1', spaceId: 'test-space' });
    await addThought({ text: 'Thought 2', spaceId: 'test-space' });
    const result = await addThought({ text: 'Thought 3', spaceId: 'test-space' });
    
    expect(result).toBe('');
    
    // Check if modal was opened
    expect(mockOpenModal).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Thinking Limit Reached' })
    );
  });

  it('updates thought and triggers sync', async () => {
    const { addThought, updateThought } = useStore.getState();
    const id = await addThought({ text: 'Original' });
    
    // We need to wait for the debounce in updateThought (500ms)
    vi.useFakeTimers();
    await updateThought(id, { text: 'Updated' });
    vi.runAllTimers();
    vi.useRealTimers();
    
    // Check IndexedDB
    const dbThought = await db.thoughts.get(id);
    expect(dbThought?.text).toBe('Updated');
    
    // Check if sync was triggered
    expect(syncOrchestrator.triggerSync).toHaveBeenCalled();
  });

  it('deletes thought and cleans up stacks', async () => {
    const { addThought, deleteThought, createStack } = useStore.getState();
    const id = await addThought({ text: 'To be deleted' });
    
    // Mock createStack and cleanupStacks
    const spyCleanup = vi.spyOn(useStore.getState(), 'cleanupStacks').mockImplementation(async () => {});
    
    // Create a stack for the thought
    await createStack('Test Stack', id);
    
    await deleteThought(id);
    
    // Check IndexedDB
    const dbThought = await db.thoughts.get(id);
    expect(dbThought).toBeDefined();
    expect(dbThought?.deletedAt).toBeTruthy();
    
    // Check cleanup was called
    expect(spyCleanup).toHaveBeenCalled();
    
    // Check sync triggered
    expect(syncOrchestrator.triggerSync).toHaveBeenCalled();
  });
});
