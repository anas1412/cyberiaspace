import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { useThoughtPayload } from '../thought/hooks/useThoughtPayload';
import { Plus, Trash2, GripVertical, CheckSquare, Square, X } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Reorder } from 'framer-motion';
import { ulid } from 'ulid';
import type { Thought } from '../../db';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Task {
  id: string;
  text: string;
  done: boolean;
}

interface TasksEditorProps {
  thought: Thought;
  onClose: () => void;
}

const ProgressRing: React.FC<{ done: number; total: number }> = ({
  done,
  total,
}) => {
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const progress = total > 0 ? done / total : 0;
  const offset = circumference * (1 - progress);

  return (
    <div className="relative w-[52px] h-[52px] flex items-center justify-center flex-shrink-0">
      <svg
        className="transform -rotate-90 w-[52px] h-[52px]"
        viewBox="0 0 52 52"
      >
        <circle
          cx="26"
          cy="26"
          r={radius}
          fill="none"
          stroke="var(--glass-border)"
          strokeWidth="4"
        />
        <circle
          cx="26"
          cy="26"
          r={radius}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-500 ease-out"
        />
      </svg>
      <span className="absolute text-xs font-semibold text-[var(--text-primary)]">
        {done}/{total}
      </span>
    </div>
  );
};

const TasksEditor: React.FC<TasksEditorProps> = ({ thought, onClose }) => {
  const updateThought = useStore((state) => state.updateThought);
  const isReadOnly = useStore((state) => state.isReadOnly);

  const [localTitle, setLocalTitle] = useState('');
  const [localTasks, setLocalTasks] = useState<Task[]>([]);
  const isDraggingRef = React.useRef(false);
  const loadedThoughtIdRef = React.useRef<string | null>(null);

  const { tasks } = useThoughtPayload(thought);

  // Initialize local state when the thought changes
  React.useEffect(() => {
    if (loadedThoughtIdRef.current !== thought.id) {
      loadedThoughtIdRef.current = thought.id;
      setLocalTitle(thought.text || '');
      const tasksWithIds = (tasks || []).map((t) => ({
        ...t,
        id: (t as Task).id || ulid(),
      }));
      setLocalTasks(tasksWithIds);
    }
  }, [thought.id, tasks]);

  const saveTasks = (tasksToSave: Task[]) => {
    updateThought(thought.id, {
      data: { type: 'tasks', tasks: tasksToSave },
    });
  };

  const handleAddTask = () => {
    if (isReadOnly) return;
    const newTask: Task = { id: ulid(), text: '', done: false };
    const newTasks = [...localTasks, newTask];
    setLocalTasks(newTasks);
    saveTasks(newTasks);
  };

  const handleUpdateTask = (
    id: string,
    updates: { text?: string; done?: boolean },
  ) => {
    if (isReadOnly) return;
    const newTasks = localTasks.map((t) =>
      t.id === id ? { ...t, ...updates } : t,
    );
    setLocalTasks(newTasks);
    saveTasks(newTasks);
  };

  const handleDeleteTask = (id: string) => {
    if (isReadOnly) return;
    const newTasks = localTasks.filter((t) => t.id !== id);
    setLocalTasks(newTasks);
    saveTasks(newTasks);
  };

  const handleReorder = (newTasks: Task[]) => {
    if (isReadOnly) return;
    setLocalTasks(newTasks);
    saveTasks(newTasks);
  };

  const handleCheckAll = () => {
    if (isReadOnly) return;
    const newTasks = localTasks.map((t) => ({ ...t, done: true }));
    setLocalTasks(newTasks);
    saveTasks(newTasks);
  };

  const handleUncheckAll = () => {
    if (isReadOnly) return;
    const newTasks = localTasks.map((t) => ({ ...t, done: false }));
    setLocalTasks(newTasks);
    saveTasks(newTasks);
  };

  const doneCount = localTasks.filter((t) => t.done).length;
  const totalCount = localTasks.length;

  return (
    <div className="flex flex-col h-full">
      {/* Title + Progress Ring + Close */}
      <div className="flex items-start justify-between px-5 pt-5 pb-3 gap-4">
        <input
          type="text"
          value={localTitle}
          onChange={(e) => {
            const val = e.target.value;
            setLocalTitle(val);
            if (!isReadOnly) {
              updateThought(thought.id, { text: val });
            }
          }}
          placeholder="Untitled"
          className="flex-1 text-base font-semibold bg-transparent border-none outline-none text-[var(--text-primary)] placeholder:text-[var(--text-muted)] min-w-0"
        />
        <div className="flex items-center gap-2">
          <ProgressRing done={doneCount} total={totalCount} />
          <button
            onClick={onClose}
            className="self-start p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-page)]/30 transition-all mt-1"
            title="Close (Esc)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto px-5 pb-2">
        {localTasks.length > 0 && (
          <Reorder.Group
            axis="y"
            values={localTasks}
            onReorder={handleReorder}
            className="space-y-0.5"
          >
            {localTasks.map((task) => (
              <Reorder.Item
                key={task.id}
                value={task}
                className="group flex items-center gap-2 px-3 py-2 rounded-xl transition-colors hover:bg-white/[0.03]"
                dragElastic={0.15}
                layout
                whileDrag={{
                  scale: 1.02,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                onDragStart={() => {
                  isDraggingRef.current = true;
                }}
                onDragEnd={() => {
                  isDraggingRef.current = false;
                }}
              >
                {/* Grip handle */}
                <div className="cursor-grab active:cursor-grabbing text-[var(--text-muted)] p-0.5 flex-shrink-0">
                  <GripVertical className="w-3.5 h-3.5" />
                </div>

                {/* Custom checkbox */}
                <input
                  type="checkbox"
                  checked={task.done}
                  onChange={(e) =>
                    !isReadOnly &&
                    handleUpdateTask(task.id, { done: e.target.checked })
                  }
                  className="w-4 h-4 rounded border-2 appearance-none flex items-center justify-center transition-all cursor-pointer flex-shrink-0 accent-transparent"
                  style={{
                    background: task.done
                      ? 'var(--status-todo)'
                      : 'transparent',
                    borderColor: task.done
                      ? 'var(--status-todo)'
                      : 'var(--glass-border)',
                  }}
                />

                {/* Task text input */}
                <input
                  type="text"
                  value={task.text}
                  onChange={(e) =>
                    !isReadOnly &&
                    handleUpdateTask(task.id, { text: e.target.value })
                  }
                  placeholder="What needs to be done?"
                  className={cn(
                    'flex-1 text-sm outline-none border-none bg-transparent p-0 transition-all min-w-0',
                    task.done
                      ? 'text-[var(--text-muted)] line-through'
                      : 'text-[var(--text-primary)]',
                  )}
                />

                {/* Delete button (visible on hover) */}
                {!isReadOnly && (
                  <button
                    onClick={() => handleDeleteTask(task.id)}
                    className="p-1.5 text-[var(--text-muted)] hover:text-red-400 transition-all flex-shrink-0 opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </Reorder.Item>
            ))}
          </Reorder.Group>
        )}

        {/* Empty state */}
        {localTasks.length === 0 && !isReadOnly && (
          <div className="flex flex-col items-center justify-center py-8 text-[var(--text-muted)]">
            <p className="text-xs font-medium mb-4">No tasks yet</p>
          </div>
        )}

        {/* Add task button */}
        {!isReadOnly && (
          <button
            onClick={handleAddTask}
            className="w-full flex items-center justify-center gap-2 py-3 mt-2 rounded-xl border-2 border-dashed border-[var(--glass-border)] text-[var(--text-muted)] hover:border-[var(--accent)]/50 hover:text-[var(--accent-secondary)] transition-all"
          >
            <Plus className="w-4 h-4" />
            <span className="text-[10px] font-semibold tracking-widest uppercase">
              Add New Task
            </span>
          </button>
        )}
      </div>

      {/* Bottom bar */}
      <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--glass-border)]">
        <div className="flex items-center gap-3">
          {!isReadOnly && totalCount > 0 && (
            <>
              <button
                onClick={handleCheckAll}
                disabled={localTasks.every((t) => t.done)}
                className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)] hover:text-[var(--status-done)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <CheckSquare className="w-3 h-3" />
                All
              </button>
              <button
                onClick={handleUncheckAll}
                disabled={localTasks.every((t) => !t.done)}
                className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Square className="w-3 h-3" />
                None
              </button>
            </>
          )}
        </div>
        <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)]">
          {doneCount}/{totalCount} done
        </span>
      </div>
    </div>
  );
};

export default TasksEditor;
