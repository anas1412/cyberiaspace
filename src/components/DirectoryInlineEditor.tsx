import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { useThoughtPayload } from './thought/hooks/useThoughtPayload';
import { getThoughtConfig } from './thought/registry';
import { syncOrchestrator } from '../services/sync/syncOrchestrator';
import { supabaseStorage } from '../services/supabaseStorage';
import { type Thought, db } from '../db';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, Reorder } from 'framer-motion';
import { ulid } from 'ulid';
import {
  FolderTree, Maximize2, Bold, Italic, List, ListOrdered,
  Link, Heading1, Heading2, Quote, Code, Eye, Edit3, Split,
  Plus, Trash2, GripVertical,
  Pencil, Eraser, Zap, ChevronLeft, ChevronRight,
  Upload, FileAudio, FileIcon, Play,
} from 'lucide-react';
import { marked } from 'marked';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ============================================================================
// INLINE TEXT EDITOR
// ============================================================================

interface InlineTextEditorProps {
  thought: Thought;
}

const InlineTextEditor: React.FC<InlineTextEditorProps> = ({ thought }) => {
  const updateThought = useStore((s) => s.updateThought);
  const isReadOnly = useStore((s) => s.isReadOnly);

  const [editMode, setEditMode] = useState<'edit' | 'preview' | 'split'>('edit');
  const [localTitle, setLocalTitle] = useState(thought.text);
  const [localContent, setLocalContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { content } = useThoughtPayload(thought);
  const loadedIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (loadedIdRef.current !== thought.id) {
      loadedIdRef.current = thought.id;
      setLocalTitle(thought.text);
      setLocalContent(content);
    }
  }, [thought.id, content]);

  useEffect(() => {
    if (thought.id) {
      syncOrchestrator.setFocusEditing(true, thought.id);
    }
    return () => syncOrchestrator.setFocusEditing(false, null);
  }, [thought.id]);

  const handleTitleChange = (val: string) => {
    setLocalTitle(val);
    if (!isReadOnly) updateThought(thought.id, { text: val });
  };

  const handleContentChange = (val: string) => {
    setLocalContent(val);
    if (!isReadOnly) updateThought(thought.id, { data: { type: 'text', content: val } });
  };

  const insertText = (before: string, after = '') => {
    if (!textareaRef.current) return;
    const { selectionStart, selectionEnd } = textareaRef.current;
    const selected = localContent.substring(selectionStart, selectionEnd);
    const newText =
      localContent.substring(0, selectionStart) + before + selected + after +
      localContent.substring(selectionEnd);
    handleContentChange(newText);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(
          selectionStart + before.length + selected.length + after.length,
          selectionStart + before.length + selected.length + after.length,
        );
      }
    }, 0);
  };

  const handleToolbarAction = (type: string) => {
    switch (type) {
      case 'h1': insertText('# ', ''); break;
      case 'h2': insertText('## ', ''); break;
      case 'bold': insertText('**', '**'); break;
      case 'italic': insertText('*', '*'); break;
      case 'list': insertText('- ', ''); break;
      case 'ordered-list': insertText('1. ', ''); break;
      case 'quote': insertText('> ', ''); break;
      case 'code': insertText('```\n', '\n```'); break;
      case 'link': insertText('[', '](url)'); break;
    }
  };

  const tools = [
    { id: 'h1', icon: Heading1, label: 'H1' },
    { id: 'h2', icon: Heading2, label: 'H2' },
    { id: 'bold', icon: Bold, label: 'Bold' },
    { id: 'italic', icon: Italic, label: 'Italic' },
    { id: 'list', icon: List, label: 'Bullet List' },
    { id: 'ordered-list', icon: ListOrdered, label: 'Numbered List' },
    { id: 'quote', icon: Quote, label: 'Quote' },
    { id: 'code', icon: Code, label: 'Code' },
    { id: 'link', icon: Link, label: 'Link' },
  ];

  const isSplit = editMode === 'split';
  const isPreviewOnly = editMode === 'preview';
  const isEditOnly = editMode === 'edit';

  return (
    <div className="flex flex-col h-full">
      {/* Title */}
      <div className="px-4 pt-4 pb-2 border-b border-[var(--glass-border)]">
        <input
          type="text"
          value={localTitle}
          onChange={(e) => handleTitleChange(e.target.value)}
          readOnly={isReadOnly}
          placeholder="Untitled"
          className="w-full bg-transparent text-[16px] font-semibold text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
        />
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-[var(--glass-border)] bg-white/[0.01] overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-0.5 bg-[var(--bg-main)]/40 p-0.5 rounded-lg border border-[var(--glass-border)] mr-2 flex-shrink-0">
          {(['edit', 'split', 'preview'] as const).map((mode) => {
            const icons = { edit: Edit3, split: Split, preview: Eye };
            const Icon = icons[mode];
            const labels = { edit: 'Write', split: 'Split', preview: 'Review' };
            return (
              <button
                key={mode}
                onClick={() => setEditMode(mode)}
                className={cn(
                  'relative px-2.5 py-1.5 rounded-md text-[9px] font-semibold tracking-wider transition-all z-10 flex items-center gap-1',
                  editMode === mode
                    ? 'text-[var(--accent-contrast)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]',
                  isReadOnly && mode !== 'preview' && 'opacity-30 cursor-not-allowed',
                )}
                disabled={isReadOnly && mode !== 'preview'}
              >
                {editMode === mode && (
                  <motion.div
                    layoutId="inlineModeTab"
                    className="absolute inset-0 rounded-md bg-[var(--accent)] shadow-md shadow-[var(--accent-glow)] z-[-1]"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
                  />
                )}
                <Icon className="w-3 h-3" />
                <span className="hidden sm:inline">{labels[mode]}</span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-0.5">
          {tools.map((tool) => (
            <button
              key={tool.id}
              onClick={() => handleToolbarAction(tool.id)}
              disabled={isReadOnly}
              title={tool.label}
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg)] transition-all disabled:opacity-30"
            >
              <tool.icon className="w-3.5 h-3.5" />
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {(isEditOnly || isSplit) && (
          <div className={cn(
            'h-full overflow-y-auto custom-scroll',
            isSplit ? 'w-1/2 border-r border-[var(--glass-border)]' : 'w-full',
          )}>
            <div className="p-4 h-full">
              <textarea
                ref={textareaRef}
                value={localContent}
                onChange={(e) => handleContentChange(e.target.value)}
                readOnly={isReadOnly}
                className="w-full h-full bg-transparent text-[14px] text-[var(--text-primary)] leading-relaxed outline-none border-none resize-none placeholder:text-[var(--text-muted)]/30 font-['Plus_Jakarta_Sans',_sans-serif]"
                placeholder="Dive deep into your thoughts..."
              />
            </div>
          </div>
        )}
        {(isPreviewOnly || isSplit) && (
          <div className={cn(
            'h-full overflow-y-auto custom-scroll bg-white/[0.01]',
            isSplit ? 'w-1/2' : 'w-full',
          )}>
            <div className="p-4 h-full">
              <div
                className="focus-markdown-body prose prose-invert prose-slate max-w-none text-[13px] text-[var(--text-primary)] break-words"
                dangerouslySetInnerHTML={{ __html: marked.parse(localContent || '_No content yet. Start writing..._') as string }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// INLINE TASKS EDITOR
// ============================================================================

interface Task {
  id: string;
  text: string;
  done: boolean;
}

interface InlineTasksEditorProps {
  thought: Thought;
}

const InlineTasksEditor: React.FC<InlineTasksEditorProps> = ({ thought }) => {
  const updateThought = useStore((s) => s.updateThought);
  const isReadOnly = useStore((s) => s.isReadOnly);

  const [localTitle, setLocalTitle] = useState(thought.text);
  const [localTasks, setLocalTasks] = useState<Task[]>([]);
  const { tasks } = useThoughtPayload(thought);
  const loadedIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (loadedIdRef.current !== thought.id) {
      loadedIdRef.current = thought.id;
      setLocalTitle(thought.text);
      setLocalTasks((tasks || []).map((t: any) => ({
        ...t,
        id: t.id || ulid(),
      })));
    }
  }, [thought.id]);

  useEffect(() => {
    if (thought.id) syncOrchestrator.setFocusEditing(true, thought.id);
    return () => syncOrchestrator.setFocusEditing(false, null);
  }, [thought.id]);

  const saveTasks = (tasksToSave: Task[]) => {
    updateThought(thought.id, { data: { type: 'tasks', tasks: tasksToSave } });
  };

  const handleTitleChange = (val: string) => {
    setLocalTitle(val);
    if (!isReadOnly) updateThought(thought.id, { text: val });
  };

  const handleUpdateTask = (id: string, updates: { text?: string; done?: boolean }) => {
    if (isReadOnly) return;
    const updated = localTasks.map(t => t.id === id ? { ...t, ...updates } : t);
    setLocalTasks(updated);
    saveTasks(updated);
  };

  const handleDeleteTask = (id: string) => {
    if (isReadOnly) return;
    const updated = localTasks.filter(t => t.id !== id);
    setLocalTasks(updated);
    saveTasks(updated);
  };

  const handleReorder = (newTasks: Task[]) => {
    if (isReadOnly) return;
    setLocalTasks(newTasks);
    saveTasks(newTasks);
  };

  const handleAddTask = () => {
    if (isReadOnly) return;
    const updated = [...localTasks, { id: ulid(), text: '', done: false }];
    setLocalTasks(updated);
    saveTasks(updated);
  };

  const handleCheckAll = () => {
    if (isReadOnly) return;
    const updated = localTasks.map(t => ({ ...t, done: true }));
    setLocalTasks(updated);
    saveTasks(updated);
  };

  const handleUncheckAll = () => {
    if (isReadOnly) return;
    const updated = localTasks.map(t => ({ ...t, done: false }));
    setLocalTasks(updated);
    saveTasks(updated);
  };

  const completed = localTasks.filter(t => t.done).length;
  const progress = localTasks.length > 0 ? (completed / localTasks.length) * 100 : 0;

  return (
    <div className="flex flex-col h-full">
      {/* Title */}
      <div className="px-4 pt-4 pb-2 border-b border-[var(--glass-border)]">
        <input
          type="text"
          value={localTitle}
          onChange={(e) => handleTitleChange(e.target.value)}
          readOnly={isReadOnly}
          placeholder="Untitled"
          className="w-full bg-transparent text-[16px] font-semibold text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
        />
        {/* Progress */}
        {localTasks.length > 0 && (
          <div className="flex items-center gap-3 mt-2">
            <p className="text-[9px] font-black tracking-widest uppercase text-[var(--text-muted)]">
              {completed} / {localTasks.length}
            </p>
            <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-[var(--status-done)]"
                animate={{ width: `${progress}%` }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              />
            </div>
            {!isReadOnly && localTasks.length > 0 && (
              <div className="flex items-center gap-2 ml-2">
                <button
                  onClick={handleCheckAll}
                  disabled={localTasks.every(t => t.done)}
                  className="px-2 py-1 rounded-md text-[9px] font-semibold tracking-wider text-[var(--text-muted)] hover:text-[var(--status-done)] hover:bg-[var(--status-done)]/10 transition-colors disabled:opacity-30"
                >
                  All
                </button>
                <button
                  onClick={handleUncheckAll}
                  disabled={localTasks.every(t => !t.done)}
                  className="px-2 py-1 rounded-md text-[9px] font-semibold tracking-wider text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/10 transition-colors disabled:opacity-30"
                >
                  None
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tasks List */}
      <div className="flex-1 overflow-y-auto custom-scroll p-3">
        <Reorder.Group
          axis="y"
          values={localTasks}
          onReorder={handleReorder}
          className="space-y-2"
        >
          {localTasks.map((task) => (
            <Reorder.Item
              key={task.id}
              value={task}
              className="group flex items-center gap-2 bg-white/[0.02] hover:bg-white/[0.04] border border-[var(--glass-border)] p-2.5 rounded-xl transition-colors"
              dragElastic={0.15}
              layout
            >
              {!isReadOnly && (
                <div className="cursor-grab text-[var(--text-muted)] p-0.5">
                  <GripVertical className="w-3.5 h-3.5" />
                </div>
              )}
              <input
                type="checkbox"
                checked={task.done}
                onChange={(e) => !isReadOnly && handleUpdateTask(task.id, { done: e.target.checked })}
                className="w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 cursor-pointer"
                style={{
                  background: task.done ? 'var(--status-todo)' : 'transparent',
                  borderColor: task.done ? 'var(--status-todo)' : 'var(--glass-border)',
                }}
              />
              <input
                type="text"
                value={task.text}
                onChange={(e) => !isReadOnly && handleUpdateTask(task.id, { text: e.target.value })}
                placeholder="Task..."
                className={cn(
                  'flex-1 text-[12px] outline-none border-none bg-transparent transition-all min-w-0 break-words',
                  task.done ? 'text-[var(--text-muted)] line-through' : 'text-[var(--text-primary)]',
                )}
              />
              {!isReadOnly && (
                <button
                  onClick={() => handleDeleteTask(task.id)}
                  className="p-1 text-[var(--text-muted)] hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </Reorder.Item>
          ))}
        </Reorder.Group>
        {!isReadOnly && (
          <button
            onClick={handleAddTask}
            className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl border-2 border-dashed border-[var(--glass-border)] text-[var(--text-muted)] hover:border-[var(--accent)]/50 hover:text-[var(--accent-secondary)] transition-all mt-2"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="text-[10px] font-semibold tracking-wider">Add Task</span>
          </button>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// INLINE TABLE EDITOR
// ============================================================================

interface InlineTableEditorProps {
  thought: Thought;
}

const InlineTableEditor: React.FC<InlineTableEditorProps> = ({ thought }) => {
  const updateThought = useStore((s) => s.updateThought);
  const isReadOnly = useStore((s) => s.isReadOnly);
  const [isEditMode, setIsEditMode] = useState(false);
  const { table } = useThoughtPayload(thought);

  useEffect(() => {
    if (thought.id) syncOrchestrator.setFocusEditing(true, thought.id);
    return () => syncOrchestrator.setFocusEditing(false, null);
  }, [thought.id]);

  const saveTable = (newTable: string[][]) => {
    updateThought(thought.id, { data: { type: 'table', rows: newTable } });
  };

  const handleUpdateCell = (r: number, c: number, val: string) => {
    if (isReadOnly) return;
    const newTable = table.map(row => [...row]);
    newTable[r][c] = val;
    saveTable(newTable);
  };

  const addRow = () => {
    if (isReadOnly) return;
    const colCount = table[0]?.length || 2;
    saveTable([...table, new Array(colCount).fill('')]);
  };

  const addColumn = () => {
    if (isReadOnly) return;
    saveTable(table.map(row => [...row, '']));
  };

  const deleteRow = (idx: number) => {
    if (isReadOnly || table.length <= 1) return;
    const newTable = [...table];
    newTable.splice(idx, 1);
    saveTable(newTable);
  };

  const deleteColumn = (idx: number) => {
    if (isReadOnly || table[0].length <= 1) return;
    saveTable(table.map(row => {
      const newRow = [...row];
      newRow.splice(idx, 1);
      return newRow;
    }));
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--glass-border)] bg-white/[0.01]">
        <div className="flex bg-[var(--bg-main)]/40 p-0.5 rounded-lg border border-[var(--glass-border)]">
          {([false, true] as const).map((mode) => (
            <button
              key={String(mode)}
              onClick={() => setIsEditMode(mode)}
              disabled={mode === true && isReadOnly}
              className={cn(
                'relative px-3 py-1.5 rounded-md text-[9px] font-semibold tracking-wider transition-all z-10',
                isEditMode === mode
                  ? mode ? 'text-[var(--accent-contrast)]' : 'text-[var(--text-primary)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]',
                mode && isReadOnly && 'opacity-30 cursor-not-allowed',
              )}
            >
              {isEditMode === mode && (
                <motion.div
                  layoutId="inlineTableMode"
                  className={cn(
                    'absolute inset-0 rounded-md z-[-1]',
                    mode ? 'bg-[var(--accent)] shadow-[var(--accent-glow)]' : 'bg-white/10 border border-white/10',
                  )}
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
                />
              )}
              {mode ? 'Edit' : 'View'}
            </button>
          ))}
        </div>
        {!isReadOnly && isEditMode && (
          <div className="flex items-center gap-1">
            <button onClick={addRow} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg)] transition-all" title="Add Row">
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button onClick={addColumn} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg)] transition-all" title="Add Column">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto custom-scroll p-3">
        <div className="table-wrapper mx-auto border border-[var(--glass-border)] rounded-xl bg-[var(--bg-main)]/10 overflow-hidden min-w-max">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {isEditMode && <th className="p-1 border border-[var(--glass-border)] w-6 bg-[var(--glass-bg)]" />}
                {table[0]?.map((cell: string, i: number) => (
                  <th key={i} className="p-0 border border-[var(--glass-border)] bg-[var(--glass-bg)] min-w-[80px]">
                    {isEditMode ? (
                      <div className="flex items-center group/th">
                        <input
                          value={cell}
                          onChange={(e) => handleUpdateCell(0, i, e.target.value)}
                          className="flex-1 bg-transparent p-1.5 text-[9px] font-semibold tracking-widest text-[var(--accent-secondary)] outline-none placeholder:text-[var(--accent-secondary)]/20"
                        />
                        <button onClick={() => deleteColumn(i)} className="p-1 opacity-0 group-hover/th:opacity-100 text-red-400 hover:text-red-300 transition-opacity flex-shrink-0">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="p-1.5 text-[9px] font-semibold tracking-widest text-[var(--accent-secondary)]">
                        {cell || `Col ${i + 1}`}
                      </div>
                    )}
                  </th>
                ))}
                {isEditMode && (
                  <th className="p-1 border border-[var(--glass-border)] bg-[var(--glass-bg)] w-6">
                    <button onClick={addColumn} className="w-full h-full flex items-center justify-center hover:bg-[var(--glass-border)] rounded transition-colors">
                      <Plus className="w-3 h-3 text-[var(--accent-secondary)]" />
                    </button>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {table.slice(1).map((row: string[], rIdx: number) => {
                const actualRow = rIdx + 1;
                return (
                  <tr key={actualRow} className="hover:bg-white/[0.02] transition-colors">
                    {isEditMode && (
                      <td className="p-0.5 border border-[var(--glass-border)] bg-[var(--glass-bg)] relative group w-6">
                        <span className="flex items-center justify-center text-[8px] text-[var(--text-muted)] h-full">{actualRow + 1}</span>
                        <button
                          onClick={() => deleteRow(actualRow)}
                          className="absolute inset-0 flex items-center justify-center bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity text-[8px]"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </td>
                    )}
                    {row.map((cell: string, cIdx: number) => (
                      <td key={cIdx} className="border border-[var(--glass-border)] p-0 min-w-[80px]">
                        {isEditMode ? (
                          <input
                            value={cell}
                            onChange={(e) => handleUpdateCell(actualRow, cIdx, e.target.value)}
                            className="w-full h-full bg-transparent p-1.5 text-[11px] text-[var(--text-primary)] outline-none focus:bg-[var(--accent)]/10 transition-colors"
                          />
                        ) : (
                          <div className="p-1.5 text-[11px] text-[var(--text-muted)] min-h-[28px] flex items-center">
                            {cell}
                          </div>
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
              {isEditMode && (
                <tr>
                  <td colSpan={(table[0]?.length || 0) + (isEditMode ? 1 : 0)} className="border border-[var(--glass-border)] p-1 bg-[var(--glass-bg)]">
                    <button onClick={addRow} className="w-full flex items-center justify-center gap-1 py-1 text-[var(--text-muted)] hover:text-[var(--accent-secondary)] transition-colors text-[10px]">
                      <Plus className="w-3 h-3" /> Add Row
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// DIRECTORY INLINE EDITOR (MAIN)
// ============================================================================

// ============================================================================
// INLINE PAINT EDITOR
// ============================================================================

const COLORS = [
  '#1e293b', '#6366f1', '#3b82f6', '#22c55e', '#eab308', '#f97316', '#ef4444', '#ec4899', '#a855f7', '#ffffff',
];

const MIN_BRUSH_SIZE = 1;
const MAX_BRUSH_SIZE = 50;

interface InlinePaintEditorProps {
  thought: Thought;
  groupThoughtIds: string[];
  onNavigate: (id: string) => void;
}

const InlinePaintEditor: React.FC<InlinePaintEditorProps> = ({ thought, groupThoughtIds, onNavigate }) => {
  const updateThought = useStore((s) => s.updateThought);
  const isReadOnly = useStore((s) => s.isReadOnly);
  const { drawing } = useThoughtPayload(thought);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasInit = useRef(false);

  const [color, setColor] = useState('#1e293b');
  const [brushSize, setBrushSize] = useState(4);
  const [tool, setTool] = useState<'brush' | 'eraser'>('brush');
  const [isNeon, setIsNeon] = useState(true);
  const [isPainting, setIsPainting] = useState(false);

  const CANVAS_W = 1920;
  const CANVAS_H = 1080;

  useEffect(() => {
    if (thought.id) syncOrchestrator.setFocusEditing(true, thought.id);
    return () => syncOrchestrator.setFocusEditing(false, null);
  }, [thought.id]);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current || hasInit.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (drawing) {
      const img = new Image();
      img.onload = () => {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      };
      img.src = drawing;
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    hasInit.current = true;
  }, [drawing]);

  useEffect(() => { hasInit.current = false; }, [thought.id]);

  const startPaint = (e: React.MouseEvent | React.TouchEvent) => {
    if (isReadOnly) return;
    setIsPainting(true);
    paint(e);
  };
  const stopPaint = () => {
    if (!isPainting || isReadOnly) return;
    setIsPainting(false);
    if (canvasRef.current) {
      const dataUrl = canvasRef.current.toDataURL();
      updateThought(thought.id, { data: { type: 'paint', drawing: dataUrl } });
    }
  };
  const paint = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas || !isPainting) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let cx, cy;
    if ('touches' in e) { cx = e.touches[0].clientX; cy = e.touches[0].clientY; }
    else { cx = e.clientX; cy = e.clientY; }
    const x = (cx - rect.left) * (CANVAS_W / rect.width);
    const y = (cy - rect.top) * (CANVAS_H / rect.height);

    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
      ctx.shadowBlur = isNeon ? brushSize * 2 : 0;
      ctx.shadowColor = color;
    }
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const clearCanvas = () => {
    if (!canvasRef.current || isReadOnly) return;
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      updateThought(thought.id, { data: { type: 'paint', drawing: canvasRef.current.toDataURL() } });
    }
  };

  const currentIdx = groupThoughtIds.indexOf(thought.id);
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx < groupThoughtIds.length - 1;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--glass-border)] bg-white/[0.01] flex-shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setTool('brush')}
            className={cn('p-1.5 rounded-lg transition-colors', tool === 'brush' ? 'bg-[var(--accent)]/20 text-[var(--accent)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]')}
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setTool('eraser')}
            className={cn('p-1.5 rounded-lg transition-colors', tool === 'eraser' ? 'bg-[var(--accent)]/20 text-[var(--accent)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]')}
          >
            <Eraser className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsNeon(!isNeon)}
            className={cn('p-1.5 rounded-lg transition-colors', isNeon ? 'bg-[var(--accent)]/20 text-[var(--accent)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]')}
            title="Neon mode"
          >
            <Zap className="w-3.5 h-3.5" />
          </button>
        </div>
        {/* Brush size */}
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={MIN_BRUSH_SIZE}
            max={MAX_BRUSH_SIZE}
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            className="w-20 h-1 accent-[var(--accent)]"
          />
        </div>
        <button
          onClick={clearCanvas}
          disabled={isReadOnly}
          className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-400 transition-colors disabled:opacity-30"
          title="Clear canvas"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Colors */}
        <div className="w-10 bg-[var(--bg-main)]/40 border-r border-[var(--glass-border)] p-2 flex flex-col gap-1 overflow-y-auto">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={cn('w-6 h-6 rounded-full border-2 transition-all', color === c ? 'border-[var(--accent)] scale-110' : 'border-transparent')}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        {/* Canvas */}
        <div ref={containerRef} className="flex-1 relative bg-white overflow-hidden">
          <canvas
            ref={canvasRef}
            onMouseDown={startPaint}
            onMouseUp={stopPaint}
            onMouseLeave={stopPaint}
            onMouseMove={paint}
            onTouchStart={startPaint}
            onTouchEnd={stopPaint}
            onTouchMove={paint}
            className="absolute inset-0 w-full h-full cursor-crosshair"
          />
        </div>

        {/* Navigation */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-2">
          {hasPrev && (
            <button onClick={() => onNavigate(groupThoughtIds[currentIdx - 1])} className="p-2 rounded-lg glass text-[var(--text-muted)] hover:text-[var(--text-primary)]">
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
          {hasNext && (
            <button onClick={() => onNavigate(groupThoughtIds[currentIdx + 1])} className="p-2 rounded-lg glass text-[var(--text-muted)] hover:text-[var(--text-primary)]">
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// INLINE FILE EDITOR
// ============================================================================

interface InlineFileEditorProps {
  thought: Thought;
  groupThoughtIds: string[];
  onNavigate: (id: string) => void;
}

const InlineFileEditor: React.FC<InlineFileEditorProps> = ({ thought, groupThoughtIds, onNavigate }) => {
  const isReadOnly = useStore((s) => s.isReadOnly);
  const { fileInfo } = useThoughtPayload(thought) as any;
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  // Load local blob first
  useEffect(() => {
    let url: string | null = null;
    const loadLocal = async () => {
      try {
        const entry = await db.blobs.where('thoughtId').equals(thought.id).first();
        if (entry) {
          url = URL.createObjectURL(entry.blob);
          setLocalUrl(url);
        }
      } catch (e) { /* ignore */ }
    };
    loadLocal();
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [thought.id]);

  // Fetch signed URL for cloud files
  useEffect(() => {
    if (localUrl || !thought.storagePath) return;
    let cancelled = false;
    const fetchSigned = async () => {
      try {
        const url = await supabaseStorage.getSignedUrl(thought.storagePath!);
        if (!cancelled) setSignedUrl(url);
      } catch (e) { /* ignore - will use storageUrl as fallback */ }
    };
    fetchSigned();
    return () => { cancelled = true; };
  }, [thought.storagePath, localUrl]);

  const cached: any = fileInfo || {};
  const fileName = (cached.name || thought.text || '').toLowerCase();
  const extension = fileName.split('.').pop() || '';
  const mimeType = (cached.type || '').toLowerCase();

  const isPdf = cached.isPdf ?? mimeType === 'application/pdf';
  const isVideo = cached.isVideo ?? (mimeType.startsWith('video/') || ['mp4', 'webm', 'mov', 'avi'].includes(extension));
  const isAudio = cached.isAudio ?? (mimeType.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a'].includes(extension));
  const isImage = cached.isImage ?? (mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension));

  const currentIdx = groupThoughtIds.indexOf(thought.id);
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx < groupThoughtIds.length - 1;

  const renderContent = () => {
    // Use local blob only - if sync didn't download it, cloud won't work either
    const source = localUrl || signedUrl;
    
    if (!source) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 text-[var(--text-muted)]">
          <Upload className="w-12 h-12 opacity-30" />
          <p className="text-[11px]">No file attached</p>
          {!isReadOnly && (
            <button className="px-4 py-2 rounded-xl bg-[var(--accent)]/10 text-[var(--accent)] text-[10px] font-medium hover:bg-[var(--accent)]/20">
              Upload file
            </button>
          )}
        </div>
      );
    }

    if (isImage) {
      return (
        <div className="flex items-center justify-center h-full p-4">
          <img src={source} alt={thought.text} className="max-w-full max-h-full object-contain rounded-lg shadow-lg" />
        </div>
      );
    }
    if (isPdf) {
      return <iframe src={source} className="w-full h-full border-none" title={thought.text} />;
    }
    if (isVideo) {
      return (
        <div className="flex items-center justify-center h-full">
          <video src={source} controls className="max-w-full max-h-full rounded-lg" />
        </div>
      );
    }
    if (isAudio) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <FileAudio className="w-16 h-16 text-[var(--accent)] opacity-40" />
          <audio src={source} controls className="w-3/4" />
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-[var(--text-muted)]">
        <FileIcon className="w-12 h-12 opacity-30" />
        <p className="text-[10px]">Preview unavailable</p>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--glass-border)] bg-white/[0.01] flex-shrink-0">
        <span className="text-[10px] text-[var(--text-muted)] truncate">{thought.text || 'Untitled'}</span>
        <div className="flex items-center gap-1">
          {hasPrev && (
            <button onClick={() => onNavigate(groupThoughtIds[currentIdx - 1])} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)]">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          )}
          <span className="text-[9px] text-[var(--text-muted)]">{currentIdx + 1}/{groupThoughtIds.length}</span>
          {hasNext && (
            <button onClick={() => onNavigate(groupThoughtIds[currentIdx + 1])} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)]">
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-hidden bg-[var(--bg-page)]">
        {renderContent()}
      </div>
    </div>
  );
};

// ============================================================================
// INLINE EMBED EDITOR
// ============================================================================

interface InlineEmbedEditorProps {
  thought: Thought;
  groupThoughtIds: string[];
  onNavigate: (id: string) => void;
}

const InlineEmbedEditor: React.FC<InlineEmbedEditorProps> = ({ thought, groupThoughtIds, onNavigate }) => {
  // Embed URL is stored in thought.data.url for 'embed' type
  const embedUrl = (thought.data as any)?.url || (thought as any).content || '';
  const currentIdx = groupThoughtIds.indexOf(thought.id);
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx < groupThoughtIds.length - 1;

  const renderEmbed = () => {
    if (!embedUrl) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 text-[var(--text-muted)]">
          <Play className="w-12 h-12 opacity-30" />
          <p className="text-[11px]">No embed URL</p>
        </div>
      );
    }

    // YouTube
    const ytMatch = embedUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
    if (ytMatch) {
      return (
        <iframe
          src={`https://www.youtube.com/embed/${ytMatch[1]}`}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      );
    }

    // Generic iframe
    return (
      <iframe src={embedUrl} className="w-full h-full border-none" title={thought.text} />
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--glass-border)] bg-white/[0.01] flex-shrink-0">
        <span className="text-[10px] text-[var(--text-muted)] truncate">{thought.text || 'Untitled'}</span>
        <div className="flex items-center gap-1">
          {hasPrev && (
            <button onClick={() => onNavigate(groupThoughtIds[currentIdx - 1])} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)]">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          )}
          <span className="text-[9px] text-[var(--text-muted)]">{currentIdx + 1}/{groupThoughtIds.length}</span>
          {hasNext && (
            <button onClick={() => onNavigate(groupThoughtIds[currentIdx + 1])} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)]">
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-hidden bg-black">
        {renderEmbed()}
      </div>
    </div>
  );
};

export const DirectoryInlineEditor: React.FC = () => {
  const directorySelectedThoughtId = useStore((s) => s.directorySelectedThoughtId);
  const thoughts = useStore((s) => s.thoughts);
  const setActiveFocus = useStore((s) => s.setActiveFocus);
  const setDirectorySelectedThoughtId = useStore((s) => s.setDirectorySelectedThoughtId);
  const setSelectedThoughtId = useStore((s) => s.setSelectedThoughtId);

  const thought = thoughts.find((t) => t.id === directorySelectedThoughtId);

  // Get group thought IDs for navigation - MUST be before any early returns
  const groupThoughtIds = React.useMemo(() => {
    return thoughts.filter(t => !t.deletedAt && t.type !== 'label').map(t => t.id);
  }, [thoughts]);

  const handleNavigate = (id: string) => {
    setDirectorySelectedThoughtId(id);
    setSelectedThoughtId(id);
  };

  const handleOpenModal = () => {
    if (!thought || thought.type === 'label') return;
    setActiveFocus(thought.id, thought.type);
  };

  if (!thought) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)]">
        <FolderTree className="w-12 h-12 mb-3 opacity-20" />
        <p className="text-[13px] font-medium">Select a thought to edit</p>
        <p className="text-[11px] mt-1 opacity-60">Choose from the directory list on the left</p>
      </div>
    );
  }

  const config = getThoughtConfig(thought.type);

  const renderEditor = () => {
    switch (thought.type) {
      case 'text':
        return <InlineTextEditor thought={thought} />;
      case 'tasks':
        return <InlineTasksEditor thought={thought} />;
      case 'table':
        return <InlineTableEditor thought={thought} />;
      case 'paint':
        return <InlinePaintEditor thought={thought} groupThoughtIds={groupThoughtIds} onNavigate={handleNavigate} />;
      case 'file':
        return <InlineFileEditor thought={thought} groupThoughtIds={groupThoughtIds} onNavigate={handleNavigate} />;
      case 'embed':
        return <InlineEmbedEditor thought={thought} groupThoughtIds={groupThoughtIds} onNavigate={handleNavigate} />;
      default:
        return (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <config.icon className="w-10 h-10 text-[var(--text-muted)] opacity-30" />
            <p className="text-[12px] text-[var(--text-muted)] text-center px-4">
              {config.label} editor is best used in full screen
            </p>
            <button
              onClick={handleOpenModal}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--accent)]/10 text-[var(--accent)] text-[11px] font-medium hover:bg-[var(--accent)]/20 transition-colors border border-[var(--accent)]/20"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              Open in full editor
            </button>
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Editor Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--glass-border)] bg-[var(--glass-bg)] flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <config.icon className="w-3.5 h-3.5 text-[var(--accent)] flex-shrink-0" />
          <span className="text-[10px] font-semibold text-[var(--text-primary)] uppercase tracking-wider flex-shrink-0">
            {config.label}
          </span>
          <span className="text-[10px] text-[var(--text-muted)] truncate">
            {thought.text || 'Untitled'}
          </span>
        </div>
        <button
          onClick={handleOpenModal}
          className="p-1.5 rounded-lg hover:bg-[var(--text-primary)]/10 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors flex-shrink-0"
          title="Open in full editor"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Editor Content */}
      <div className="flex-1 overflow-hidden min-h-0">
        {renderEditor()}
      </div>
    </div>
  );
};
