import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { useThoughtPayload } from '../thought/hooks/useThoughtPayload';
import { syncOrchestrator } from '../../services/sync/syncOrchestrator';
import { Plus, Trash2, GripVertical, CheckSquare, Square } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, Reorder } from 'framer-motion';
import { FocusEditorShell } from './FocusEditorShell';
import { ulid } from 'ulid';


function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Task {
  id: string;
  text: string;
  done: boolean;
}

const EditorContent: React.FC<{
  tasks: Task[];
  onReorder: (tasks: Task[]) => void;
  onUpdate: (id: string, updates: { text?: string; done?: boolean }) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
  isReadOnly: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}> = ({ tasks, onReorder, onUpdate, onDelete, onAdd, isReadOnly, onDragStart, onDragEnd }) => (
  <div className="flex-1 overflow-y-auto custom-scroll p-6 md:p-12 bg-[var(--glass-bg)]">
    <div className="max-w-4xl mx-auto w-full">
      <Reorder.Group
        axis="y"
        values={tasks}
        onReorder={onReorder}
        className="space-y-2 md:space-y-3"
      >
        {tasks.map((task) => (
          <Reorder.Item
            key={task.id}
            value={task}
            className="group flex items-center gap-3 md:gap-4 bg-white/[0.03] hover:bg-white/[0.05] border border-[var(--glass-border)] p-3 md:p-4 rounded-xl md:rounded-2xl transition-colors"
            dragElastic={0.15}
            layout
            whileDrag={{ scale: 1.02, boxShadow: "0 20px 40px rgba(0,0,0,0.3)" }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          >
            <div className="cursor-grab active:cursor-grabbing text-[var(--text-muted)] p-1">
              <GripVertical className="w-4 h-4 md:w-5 md:h-5" />
            </div>
            <input
              type="checkbox"
              checked={task.done}
              onChange={(e) => !isReadOnly && onUpdate(task.id, { done: e.target.checked })}
              className="w-5 h-5 md:w-6 md:h-6 rounded-lg border-2 flex items-center justify-center transition-all cursor-pointer flex-shrink-0 accent-transparent"
              style={{
                background: task.done ? 'var(--status-todo)' : 'transparent',
                borderColor: task.done ? 'var(--status-todo)' : 'var(--glass-border)'
              }}
            />
            <input
              type="text"
              value={task.text}
              onChange={(e) => !isReadOnly && onUpdate(task.id, { text: e.target.value })}
              placeholder="What needs to be done?"
              className={cn(
                "flex-1 text-base md:text-lg outline-none border-none bg-transparent p-0 transition-all min-w-0 break-words",
                task.done ? "text-[var(--text-muted)] line-through" : "text-[var(--text-primary)]"
              )}
            />
            {!isReadOnly && (
              <button
                onClick={() => onDelete(task.id)}
                className="p-2 text-[var(--text-muted)] hover:text-red-400 transition-all flex-shrink-0 opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
              </button>
            )}
          </Reorder.Item>
        ))}
        {!isReadOnly && (
          <button
            onClick={onAdd}
            className="w-full flex items-center justify-center gap-2 p-4 rounded-xl md:rounded-2xl border-2 border-dashed border-[var(--glass-border)] text-[var(--text-muted)] hover:border-[var(--accent)]/50 hover:text-[var(--accent-secondary)] transition-all mt-4"
          >
            <Plus className="w-5 h-5" />
            <span className="text-[10px] md:text-xs font-semibold tracking-widest">Add New Task</span>
          </button>
        )}
      </Reorder.Group>
    </div>
  </div>
);

const TasksFocusEditor: React.FC = () => {
  const activeFocusId = useStore((state) => state.activeFocusId);
  const focusType = useStore((state) => state.focusType);
  const setActiveFocus = useStore((state) => state.setActiveFocus);
  const thoughts = useStore((state) => state.thoughts);
  const stacks = useStore((state) => state.stacks);
  const updateThought = useStore((state) => state.updateThought);
  const isReadOnly = useStore((state) => state.isReadOnly);
  
  const [localTitle, setLocalTitle] = useState('');
  const [localTasks, setLocalTasks] = useState<Task[]>([]);
  const isDraggingRef = React.useRef(false);
  const loadedThoughtIdRef = React.useRef<string | null>(null);

  const thought = thoughts.find((t) => t.id === activeFocusId);
  const { tasks } = useThoughtPayload(thought as any);
  const stack = stacks.find((s) => s.id === thought?.stackId);
  const isVisible = focusType === 'tasks' && !!thought;

  React.useEffect(() => {
    if (thought && loadedThoughtIdRef.current !== thought.id) {
      loadedThoughtIdRef.current = thought.id;
      setLocalTitle(thought.text);
      const tasksWithIds = (tasks || []).map((t) => ({
        ...t,
        id: (t as Task).id || ulid()
      }));
      setLocalTasks(tasksWithIds);
    }
  }, [thought?.id, tasks]);

  React.useEffect(() => {
    if (thought?.id) {
      syncOrchestrator.setFocusEditing(true, thought.id);
    }
    return () => {
      syncOrchestrator.setFocusEditing(false, null);
    };
  }, [thought?.id]);

  const saveTasks = (tasksToSaveRaw: Task[]) => {
    if (!thought) return;
    updateThought(thought.id, { 
      data: { type: 'tasks', tasks: tasksToSaveRaw } 
    });
  };

  const handleAddTask = () => {
    if (!thought || isReadOnly) return;
    const newTask = { id: ulid(), text: '', done: false };
    const newTasks = [...localTasks, newTask];
    setLocalTasks(newTasks);
    saveTasks(newTasks);
  };

  const handleUpdateTask = (id: string, updates: { text?: string; done?: boolean }) => {
    if (!thought || isReadOnly) return;
    const newTasks = localTasks.map(t => t.id === id ? { ...t, ...updates } : t);
    setLocalTasks(newTasks);
    saveTasks(newTasks);
  };

  const handleDeleteTask = (id: string) => {
    if (!thought || isReadOnly) return;
    const newTasks = localTasks.filter(t => t.id !== id);
    setLocalTasks(newTasks);
    saveTasks(newTasks);
  };

  const handleReorder = (newTasks: Task[]) => {
    if (!thought || isReadOnly) return;
    setLocalTasks(newTasks);
    saveTasks(newTasks);
  };

  const handleCheckAll = () => {
    if (!thought || isReadOnly) return;
    const newTasks = localTasks.map(t => ({ ...t, done: true }));
    setLocalTasks(newTasks);
    saveTasks(newTasks);
  };

  const handleUncheckAll = () => {
    if (!thought || isReadOnly) return;
    const newTasks = localTasks.map(t => ({ ...t, done: false }));
    setLocalTasks(newTasks);
    saveTasks(newTasks);
  };

  if (!thought) return null;

  return (
    <FocusEditorShell
      isVisible={isVisible}
      onClose={() => setActiveFocus(null, null)}
      title={localTitle}
      onTitleChange={(val) => {
        setLocalTitle(val);
        if (!isReadOnly) {
          updateThought(thought.id, { text: val });
        }
      }}
      description={thought.description}
      isReadOnly={isReadOnly}
      stack={stack}
      footerStatus={
        <div className="flex items-center gap-3">
          <p className="text-[8px] md:text-[10px] uppercase font-black tracking-widest text-[var(--text-muted)]">
            {localTasks.filter(t => t.done).length} / {localTasks.length} Completed
          </p>
          <div className="w-20 md:w-32 h-1 bg-white/5 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-[var(--status-done)]"
              initial={{ width: 0 }}
              animate={{ width: `${(localTasks.filter(t => t.done).length / (localTasks.length || 1)) * 100}%` }}
            />
          </div>
          {!isReadOnly && localTasks.length > 0 && (
            <>
              <button
                onClick={handleCheckAll}
                className="flex items-center gap-1 text-[8px] md:text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)] hover:text-[var(--status-done)] transition-colors"
                disabled={localTasks.every(t => t.done)}
              >
                <CheckSquare className="w-3 h-3" />
                All
              </button>
              <button
                onClick={handleUncheckAll}
                className="flex items-center gap-1 text-[8px] md:text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                disabled={localTasks.every(t => !t.done)}
              >
                <Square className="w-3 h-3" />
                None
              </button>
            </>
          )}
        </div>
      }
    >
      <EditorContent 
        tasks={localTasks}
        onReorder={handleReorder}
        onUpdate={handleUpdateTask}
        onDelete={handleDeleteTask}
        onAdd={handleAddTask}
        isReadOnly={isReadOnly}
        onDragStart={() => { isDraggingRef.current = true; }}
        onDragEnd={() => { isDraggingRef.current = false; }}
      />
    </FocusEditorShell>
  );
};

export const TasksEditorContent = EditorContent;

export default TasksFocusEditor;
