/**
 * AI Tool Executor Tests
 *
 * Tests executeAiTool() with mocked store and external dependencies.
 * Covers all tool types: CRUD, web_search, read_file, security modes.
 */
import { describe, it, expect, mock, beforeAll, afterAll } from 'bun:test';
import { executeAiTool } from '../../services/ai/executor';

// Polyfill window for create_thoughts (references window.innerWidth)
beforeAll(() => {
  if (typeof (globalThis as any).window === 'undefined') {
    (globalThis as any).window = { innerWidth: 1920, innerHeight: 1080 };
  }
});
afterAll(() => {
  delete (globalThis as any).window;
});

// ============================================
// Helpers
// ============================================

function createMockStore(overrides: Record<string, unknown> = {}) {
  return {
    thoughts: [] as Array<Record<string, unknown>>,
    stacks: [] as Array<Record<string, unknown>>,
    aiChatMode: 'action',
    addThoughts: mock(() => Promise.resolve([])),
    updateThought: mock(() => Promise.resolve()),
    deleteThoughts: mock(() => Promise.resolve()),
    linkSelectedThoughts: mock(() => Promise.resolve()),
    unlinkSelectedThoughts: mock(() => Promise.resolve()),
    setSelectedThoughtIds: mock(() => {}),
    clearSelection: mock(() => {}),
    createStack: mock(() => Promise.resolve()),
    updateStack: mock(() => Promise.resolve()),
    deleteStack: mock(() => Promise.resolve()),
    ...overrides,
  };
}

// ============================================
// Security — Chat Mode Blocks Writes
// ============================================
describe('executeAiTool — security (chat mode)', () => {
  const writeTools = [
    'create_thought',
    'create_thoughts',
    'update_thought',
    'update_thoughts',
    'delete_thoughts',
    'create_stack',
    'link_thoughts',
    'unlink_thoughts',
    'update_stack',
    'update_stacks',
    'delete_stack',
    'delete_stacks',
  ];

  for (const toolName of writeTools) {
    it(`blocks "${toolName}" in chat mode`, async () => {
      const store = createMockStore({ aiChatMode: 'chat' });
      const result = await executeAiTool({ toolName, args: {} }, store);
      expect(result.success).toBe(false);
      expect(result.error).toContain('disabled in Chat mode');
    });
  }

  it('allows web_search in chat mode', async () => {
    const store = createMockStore({ aiChatMode: 'chat' });
    const result = await executeAiTool(
      { toolName: 'web_search', args: { query: 'test' } },
      store,
    );
    // Not blocked by chat mode — should either succeed or fail for non-chat-mode reasons
    if (result.error) {
      expect(result.error).not.toContain('disabled in Chat mode');
    } else {
      expect(result.success).toBe(true);
    }
  });

  it('allows get_thought_details in chat mode', async () => {
    const store = createMockStore({
      aiChatMode: 'chat',
      thoughts: [{ id: '1', text: 'Test', type: 'text', status: 'none', priority: 'none', meta: {} }],
    });
    const result = await executeAiTool(
      { toolName: 'get_thought_details', args: { ids: ['1'] } },
      store,
    );
    expect(result.success).toBe(true);
  });

  it('allows read_file_content in chat mode', async () => {
    const store = createMockStore({
      aiChatMode: 'chat',
      thoughts: [{ id: '1', text: 'Test thought', type: 'text', status: 'none', priority: 'none', meta: {} }],
    });
    const result = await executeAiTool(
      { toolName: 'read_file_content', args: { id: '1' } },
      store,
    );
    expect(result.success).toBe(true);
  });
});

// ============================================
// get_thought_details
// ============================================
describe('executeAiTool — get_thought_details', () => {
  it('returns details for valid IDs', async () => {
    const thought = {
      id: 't1',
      text: 'Meeting Notes',
      type: 'text',
      description: 'Notes from the meeting',
      status: 'done',
      priority: 'high',
      meta: {},
    };
    const store = createMockStore({ thoughts: [thought] });
    const result = await executeAiTool(
      { toolName: 'get_thought_details', args: { ids: ['t1'] } },
      store,
    );
    expect(result.success).toBe(true);
    expect(result.thoughts).toHaveLength(1);
    expect(result.thoughts[0].text).toBe('Meeting Notes');
    expect(result.thoughts[0].status).toBe('done');
    expect(result.thoughts[0].priority).toBe('high');
  });

  it('returns multiple thoughts', async () => {
    const store = createMockStore({
      thoughts: [
        { id: 't1', text: 'A', type: 'text', status: 'none', priority: 'none', meta: {} },
        { id: 't2', text: 'B', type: 'text', status: 'none', priority: 'none', meta: {} },
      ],
    });
    const result = await executeAiTool(
      { toolName: 'get_thought_details', args: { ids: ['t1', 't2'] } },
      store,
    );
    expect(result.success).toBe(true);
    expect(result.thoughts).toHaveLength(2);
  });

  it('reports "Not found" for missing IDs', async () => {
    const store = createMockStore();
    const result = await executeAiTool(
      { toolName: 'get_thought_details', args: { ids: ['nonexistent'] } },
      store,
    );
    expect(result.success).toBe(true);
    expect(result.thoughts[0].error).toBe('Not found');
  });

  it('returns error for missing ids arg', async () => {
    const store = createMockStore();
    const result = await executeAiTool(
      { toolName: 'get_thought_details', args: {} },
      store,
    );
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid IDs');
  });

  it('handles comma-separated string IDs', async () => {
    const store = createMockStore({
      thoughts: [{ id: 't1', text: 'A', type: 'text', status: 'none', priority: 'none', meta: {} }],
    });
    const result = await executeAiTool(
      { toolName: 'get_thought_details', args: { ids: 't1' } },
      store,
    );
    expect(result.success).toBe(true);
    expect(result.thoughts).toHaveLength(1);
  });
});

// ============================================
// create_thought
// ============================================
describe('executeAiTool — create_thought', () => {
  it('creates a basic text thought', async () => {
    const addThoughts = mock(() => Promise.resolve(['new-id']));
    const store = createMockStore({ addThoughts });
    const result = await executeAiTool(
      { toolName: 'create_thought', args: { text: 'Hello World', status: 'todo' } },
      store,
    );
    expect(result.success).toBe(true);
    expect(result.id).toBe('new-id');
    expect(addThoughts).toHaveBeenCalledTimes(1);
    const added = addThoughts.mock.calls[0][0][0];
    expect(added.text).toBe('Hello World');
  });

  it('sanitizes status and priority (lowercase valid values pass through)', async () => {
    const addThoughts = mock(() => Promise.resolve(['id']));
    const store = createMockStore({ addThoughts });
    await executeAiTool(
      { toolName: 'create_thought', args: { text: 'Test', status: 'doing', priority: 'urgent' } },
      store,
    );
    const added = addThoughts.mock.calls[0][0][0];
    expect(added.status).toBe('doing');
    expect(added.priority).toBe('urgent');
  });

  it('maps invalid status to "none"', async () => {
    const addThoughts = mock(() => Promise.resolve(['id']));
    const store = createMockStore({ addThoughts });
    await executeAiTool(
      { toolName: 'create_thought', args: { text: 'Test', status: 'Doing' } },
      store,
    );
    const added = addThoughts.mock.calls[0][0][0];
    expect(added.status).toBe('none');
  });

  it('sanitizes kanbanCol', async () => {
    const addThoughts = mock(() => Promise.resolve(['id']));
    const store = createMockStore({ addThoughts });
    // kanbanCol=0 → Unplanned → status: 'none', kanbanCol: 0
    await executeAiTool(
      { toolName: 'create_thought', args: { text: 'Hello', kanbanCol: 0 } },
      store,
    );
    const added = addThoughts.mock.calls[0][0][0];
    expect(added.status).toBe('none');
    expect(added.kanbanCol).toBe(0);
  });

  it('handles kanbanCol 5 (custom column)', async () => {
    const addThoughts = mock(() => Promise.resolve(['id']));
    const store = createMockStore({ addThoughts });
    await executeAiTool(
      { toolName: 'create_thought', args: { text: 'Hello', kanbanCol: 5 } },
      store,
    );
    const added = addThoughts.mock.calls[0][0][0];
    expect(added.status).toBe('none'); // custom columns use status='none'
    expect(added.kanbanCol).toBe(5);
  });

  it('transforms embed type with content', async () => {
    const addThoughts = mock(() => Promise.resolve(['id']));
    const store = createMockStore({ addThoughts });
    await executeAiTool(
      { toolName: 'create_thought', args: { text: 'YouTube', type: 'embed', content: 'https://youtube.com/watch?v=123' } },
      store,
    );
    const added = addThoughts.mock.calls[0][0][0];
    expect(added.type).toBe('embed');
    expect(added.data).toEqual({ type: 'embed', url: 'https://youtube.com/watch?v=123' });
    expect(added.content).toBeUndefined();
  });

  it('transforms table type', async () => {
    const addThoughts = mock(() => Promise.resolve(['id']));
    const store = createMockStore({ addThoughts });
    await executeAiTool(
      {
        toolName: 'create_thought',
        args: { text: 'Data', type: 'table', table: [['A', 'B'], ['1', '2']] },
      },
      store,
    );
    const added = addThoughts.mock.calls[0][0][0];
    expect(added.data).toEqual({ type: 'table', rows: [['A', 'B'], ['1', '2']] });
    expect(added.table).toBeUndefined();
  });

  it('links to stack when stackName is provided', async () => {
    const addThoughts = mock(() => Promise.resolve(['id']));
    const linkSelectedThoughts = mock(() => Promise.resolve());
    const store = createMockStore({ addThoughts, linkSelectedThoughts });
    await executeAiTool(
      { toolName: 'create_thought', args: { text: 'Task', stackName: 'Project' } },
      store,
    );
    expect(linkSelectedThoughts).toHaveBeenCalledWith('Project', ['id']);
  });

  it('returns error when addThoughts returns empty', async () => {
    const addThoughts = mock(() => Promise.resolve([]));
    const store = createMockStore({ addThoughts });
    const result = await executeAiTool(
      { toolName: 'create_thought', args: { text: 'Test' } },
      store,
    );
    expect(result.success).toBe(false);
  });

  it('legacy "image" type gets mapped to "file"', async () => {
    const addThoughts = mock(() => Promise.resolve(['id']));
    const store = createMockStore({ addThoughts });
    await executeAiTool(
      { toolName: 'create_thought', args: { text: 'Photo', type: 'image' } },
      store,
    );
    const added = addThoughts.mock.calls[0][0][0];
    expect(added.type).toBe('file');
  });
});

// ============================================
// create_thoughts
// ============================================
describe('executeAiTool — create_thoughts', () => {
  it('creates multiple thoughts', async () => {
    const addThoughts = mock(() => Promise.resolve(['id1', 'id2']));
    const store = createMockStore({ addThoughts });
    const result = await executeAiTool(
      {
        toolName: 'create_thoughts',
        args: {
          items: [
            { text: 'First', status: 'todo' },
            { text: 'Second', status: 'doing' },
          ],
        },
      },
      store,
    );
    expect(result.success).toBe(true);
    expect(result.count).toBe(2);
    expect(addThoughts).toHaveBeenCalledTimes(1);
  });

  it('returns error for missing items', async () => {
    const store = createMockStore();
    const result = await executeAiTool(
      { toolName: 'create_thoughts', args: {} },
      store,
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid items array');
  });
});

// ============================================
// update_thought
// ============================================
describe('executeAiTool — update_thought', () => {
  it('updates thought text and status', async () => {
    const updateThought = mock(() => Promise.resolve());
    const store = createMockStore({ updateThought });
    const result = await executeAiTool(
      { toolName: 'update_thought', args: { id: 't1', text: 'Updated', status: 'done' } },
      store,
    );
    expect(result.success).toBe(true);
    expect(updateThought).toHaveBeenCalledWith('t1', expect.objectContaining({
      text: 'Updated',
      status: 'done',
    }));
  });

  it('returns error for missing ID', async () => {
    const store = createMockStore();
    const result = await executeAiTool(
      { toolName: 'update_thought', args: { text: 'Updated' } },
      store,
    );
    expect(result.success).toBe(false);
    expect(result.error).toBe('Missing ID');
  });

  it('accepts x/y numeric updates', async () => {
    const updateThought = mock(() => Promise.resolve());
    const store = createMockStore({ updateThought });
    await executeAiTool(
      { toolName: 'update_thought', args: { id: 't1', x: 500, y: 300 } },
      store,
    );
    expect(updateThought).toHaveBeenCalledWith('t1', expect.objectContaining({
      x: 500,
      y: 300,
    }));
  });
});

// ============================================
// update_thoughts
// ============================================
describe('executeAiTool — update_thoughts', () => {
  it('updates multiple thoughts', async () => {
    const updateThought = mock(() => Promise.resolve());
    const store = createMockStore({ updateThought });
    const result = await executeAiTool(
      { toolName: 'update_thoughts', args: { ids: ['t1', 't2'], status: 'done' } },
      store,
    );
    expect(result.success).toBe(true);
    expect(updateThought).toHaveBeenCalledTimes(2);
    expect(updateThought).toHaveBeenCalledWith('t1', expect.objectContaining({ status: 'done' }));
    expect(updateThought).toHaveBeenCalledWith('t2', expect.objectContaining({ status: 'done' }));
  });

  it('returns error for missing IDs', async () => {
    const store = createMockStore();
    const result = await executeAiTool(
      { toolName: 'update_thoughts', args: { status: 'done' } },
      store,
    );
    expect(result.success).toBe(false);
    expect(result.error).toBe('No IDs provided');
  });
});

// ============================================
// delete_thoughts
// ============================================
describe('executeAiTool — delete_thoughts', () => {
  it('deletes thoughts by IDs', async () => {
    const deleteThoughts = mock(() => Promise.resolve());
    const store = createMockStore({ deleteThoughts });
    const result = await executeAiTool(
      { toolName: 'delete_thoughts', args: { ids: ['t1', 't2'] } },
      store,
    );
    expect(result.success).toBe(true);
    expect(deleteThoughts).toHaveBeenCalledWith(['t1', 't2']);
  });

  it('returns error for no IDs', async () => {
    const store = createMockStore();
    const result = await executeAiTool(
      { toolName: 'delete_thoughts', args: {} },
      store,
    );
    expect(result.success).toBe(false);
    expect(result.error).toBe('No IDs provided');
  });
});

// ============================================
// create_stack / link_thoughts / unlink_thoughts
// ============================================
describe('executeAiTool — create_stack', () => {
  it('links thoughts into a new stack', async () => {
    const linkSelectedThoughts = mock(() => Promise.resolve());
    const setSelectedThoughtIds = mock(() => {});
    const clearSelection = mock(() => {});
    const store = createMockStore({ linkSelectedThoughts, setSelectedThoughtIds, clearSelection });
    const result = await executeAiTool(
      { toolName: 'create_stack', args: { ids: ['t1', 't2'], name: 'Project' } },
      store,
    );
    expect(result.success).toBe(true);
    expect(setSelectedThoughtIds).toHaveBeenCalledWith(['t1', 't2']);
    expect(linkSelectedThoughts).toHaveBeenCalledWith('Project');
    expect(clearSelection).toHaveBeenCalled();
  });
});

describe('executeAiTool — link_thoughts', () => {
  it('links thoughts to an existing stack', async () => {
    const linkSelectedThoughts = mock(() => Promise.resolve());
    const setSelectedThoughtIds = mock(() => {});
    const clearSelection = mock(() => {});
    const store = createMockStore({ linkSelectedThoughts, setSelectedThoughtIds, clearSelection });
    const result = await executeAiTool(
      { toolName: 'link_thoughts', args: { ids: ['t1'], name: 'Existing' } },
      store,
    );
    expect(result.success).toBe(true);
    expect(linkSelectedThoughts).toHaveBeenCalledWith('Existing');
  });
});

describe('executeAiTool — unlink_thoughts', () => {
  it('unlinks thoughts from their stack', async () => {
    const unlinkSelectedThoughts = mock(() => Promise.resolve());
    const store = createMockStore({ unlinkSelectedThoughts });
    const result = await executeAiTool(
      { toolName: 'unlink_thoughts', args: { ids: ['t1'] } },
      store,
    );
    expect(result.success).toBe(true);
    expect(unlinkSelectedThoughts).toHaveBeenCalled();
  });
});

// ============================================
// update_stack / update_stacks / delete_stack / delete_stacks
// ============================================
describe('executeAiTool — stack management', () => {
  it('update_stack renames a stack', async () => {
    const updateStack = mock(() => Promise.resolve());
    const store = createMockStore({ updateStack });
    const result = await executeAiTool(
      { toolName: 'update_stack', args: { id: 's1', name: 'New Name' } },
      store,
    );
    expect(result.success).toBe(true);
    expect(updateStack).toHaveBeenCalledWith('s1', { name: 'New Name' });
  });

  it('update_stack returns error for missing id', async () => {
    const store = createMockStore();
    const result = await executeAiTool(
      { toolName: 'update_stack', args: { name: 'New Name' } },
      store,
    );
    expect(result.success).toBe(false);
  });

  it('update_stacks updates multiple stacks', async () => {
    const updateStack = mock(() => Promise.resolve());
    const store = createMockStore({ updateStack });
    const result = await executeAiTool(
      {
        toolName: 'update_stacks',
        args: { stacks: [{ id: 's1', name: 'A' }, { id: 's2', name: 'B' }] },
      },
      store,
    );
    expect(result.success).toBe(true);
    expect(result.count).toBe(2);
  });

  it('delete_stack deletes a stack', async () => {
    const deleteStack = mock(() => Promise.resolve());
    const store = createMockStore({ deleteStack });
    const result = await executeAiTool(
      { toolName: 'delete_stack', args: { id: 's1' } },
      store,
    );
    expect(result.success).toBe(true);
    expect(deleteStack).toHaveBeenCalledWith('s1');
  });

  it('delete_stacks deletes multiple stacks', async () => {
    const deleteStack = mock(() => Promise.resolve());
    const store = createMockStore({ deleteStack });
    const result = await executeAiTool(
      { toolName: 'delete_stacks', args: { ids: ['s1', 's2'] } },
      store,
    );
    expect(result.success).toBe(true);
    expect(deleteStack).toHaveBeenCalledTimes(2);
  });
});

// ============================================
// web_search
// ============================================
describe('executeAiTool — web_search', () => {
  it('handles web_search gracefully (with or without API key)', async () => {
    const store = createMockStore();
    const result = await executeAiTool(
      { toolName: 'web_search', args: { query: 'latest news' } },
      store,
    );
    // If VITE_TAVILY_API_KEY is set in the environment, search succeeds.
    // If not, we get a graceful error about the missing key.
    if (result.success) {
      expect(Array.isArray(result.results)).toBe(true);
    } else {
      expect(result.error).toContain('API key');
    }
  });

  it('returns error for empty query', async () => {
    const store = createMockStore();
    const result = await executeAiTool(
      { toolName: 'web_search', args: { query: '' } },
      store,
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('Missing');
  });
});

// ============================================
// read_file_content
// ============================================
describe('executeAiTool — read_file_content', () => {
  it('returns content for a text thought', async () => {
    const store = createMockStore({
      thoughts: [{
        id: 't1',
        text: 'Notes',
        type: 'text',
        status: 'none',
        priority: 'none',
        meta: {},
        data: { type: 'text', content: 'Meeting notes here' },
      }],
    });
    const result = await executeAiTool(
      { toolName: 'read_file_content', args: { id: 't1' } },
      store,
    );
    expect(result.success).toBe(true);
    expect(result.name).toBe('Notes');
    expect(result.type).toBe('text');
  });

  it('reads multiple files', async () => {
    const store = createMockStore({
      thoughts: [
        { id: 't1', text: 'Doc A', type: 'text', status: 'none', priority: 'none', meta: {} },
        { id: 't2', text: 'Doc B', type: 'text', status: 'none', priority: 'none', meta: {} },
      ],
    });
    const result = await executeAiTool(
      { toolName: 'read_files_content', args: { ids: ['t1', 't2'] } },
      store,
    );
    expect(result.success).toBe(true);
    expect(result.files).toHaveLength(2);
  });
});

// ============================================
// Unknown / Error Cases
// ============================================
describe('executeAiTool — error handling', () => {
  it('returns error for unknown tool name', async () => {
    const store = createMockStore();
    const result = await executeAiTool(
      { toolName: 'nonexistent_tool', args: {} },
      store,
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown tool');
  });
});
