import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ThoughtNode from '../../components/ThoughtNode';
import { type Thought } from '../../db';

// Mock the Zustand stores
vi.mock('../../store/useStore', () => ({
  useStore: vi.fn((selector) => selector({
    selectedThoughtId: null,
    selectedThoughtIds: [],
    deletingThoughtIds: [],
    isReadOnly: false,
    zoom: 1,
    activeFocusId: null,
    focusType: null,
    stacks: [],
    spaces: [],
    activeSpaceId: null,
    isInspectorOpen: false,
    layerActionTrigger: null,
    isDemo: false,
    performanceMode: false,
    linkingSourceId: null,
    hoveredCalDate: null,
    setSelectedThoughtId: vi.fn(),
    toggleThoughtSelection: vi.fn(),
    deleteThought: vi.fn(),
    bringToFront: vi.fn(),
    sendToBack: vi.fn(),
    updateThought: vi.fn(),
    setInspectorOpen: vi.fn(),
    setActiveFocus: vi.fn(),
    setLinkingSourceId: vi.fn(),
    setHoveredCalDate: vi.fn(),
    setSelectedThoughtIds: vi.fn(),
    unlinkSelectedThoughts: vi.fn(),
    linkSelectedThoughts: vi.fn(),
  })),
}));

vi.mock('../../store/useModalStore', () => ({
  useModalStore: {
    getState: vi.fn(() => ({
      openModal: vi.fn(),
    })),
  },
}));

const mockThought: Thought = {
  id: 't1',
  spaceId: 's1',
  stackId: null,
  x: 100,
  y: 100,
  vx: 0,
  vy: 0,
  text: 'Test Thought',
  placeholder: 'New Thought',
  description: 'Description',
  type: 'text',
  status: 'none',
  date: '',
  priority: 'none',
  size: 1.0,
  author: 'Author',
  order: 0,
  layer: 1,
  data: { type: 'text', content: 'Content' }
};

const defaultProps = {
  registerElement: vi.fn(),
  onMouseDown: vi.fn(),
  onTouchStart: vi.fn(),
  isDragging: false,
};

describe('ThoughtNode', () => {
  it('renders the thought text', () => {
    render(<ThoughtNode thought={mockThought} {...defaultProps} />);
    expect(screen.getByText('Test Thought')).toBeDefined();
  });

  it('renders a placeholder if text is empty', () => {
    const thoughtWithNoText = { ...mockThought, text: '' };
    render(<ThoughtNode thought={thoughtWithNoText} {...defaultProps} />);
    expect(screen.getByText('New Thought')).toBeDefined();
  });

  it('renders task list for "tasks" type', () => {
    const taskThought = { 
      ...mockThought, 
      type: 'tasks' as const, 
      data: { type: 'tasks', tasks: [{ text: 'Task 1', done: false }, { text: 'Task 2', done: true }] } as any
    };
    render(<ThoughtNode thought={taskThought as any} {...defaultProps} />);
    expect(screen.getByText('Task 1')).toBeDefined();
    expect(screen.getByText('Task 2')).toBeDefined();
  });

  it('renders correctly with status "done"', () => {
    const doneThought = { ...mockThought, status: 'done' as const };
    render(<ThoughtNode thought={doneThought} {...defaultProps} />);
    // Check for "done" indicator in the class or a specific element if possible
    // For now we just verify it doesn't crash
  });
});
