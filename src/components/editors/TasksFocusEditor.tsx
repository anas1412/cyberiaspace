import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { useThoughtPayload } from '../thought/hooks/useThoughtPayload';
import { CheckSquare, Plus, Trash2, GripVertical } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, Reorder } from 'framer-motion';
import { FocusEditorShell } from './FocusEditorShell';


function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Task {
  id: string;
  text: string;
  done: boolean;
}

const EditorContent: React.FC<{
  isEditMode: boolean;
  tasks: Task[];
  onReorder: (tasks: Task[]) => void;
  onUpdate: (id: string, updates: { text?: string; done?: boolean }) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
  isReadOnly: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}> = ({ isEditMode, tasks, onReorder, onUpdate, onDelete, onAdd, isReadOnly, onDragStart, onDragEnd }) => (
  <div className="flex-1 overflow-y-auto custom-scroll p-6 md:p-12 bg-black/10">
    <div className="max-w-4xl mx-auto w-full">
      {isEditMode ? (
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
                onChange={(e) => onUpdate(task.id, { done: e.target.checked })}
                className="w-5 h-5 rounded-lg border-2 border-white/20 bg-transparent checked:bg-[var(--status-todo)] checked:border-[var(--status-todo)] transition-all cursor-pointer accent-[var(--status-todo)] flex-shrink-0"
              />
              <input
                type="text"
                value={task.text}
                onChange={(e) => onUpdate(task.id, { text: e.target.value })}
                className={cn(
                  "flex-1 bg-transparent text-base md:text-lg outline-none border-none p-0 transition-all min-w-0",
                  task.done ? "text-[var(--text-muted)] line-through" : "text-[var(--text-primary)]"
                )}
                placeholder="What needs to be done?"
              />
              <button
                onClick={() => onDelete(task.id)}
                className="p-2 text-[var(--text-muted)] hover:text-red-400 transition-all flex-shrink-0"
              >
                <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
              </button>
            </Reorder.Item>
          ))}
          <button
            onClick={onAdd}
            disabled={isReadOnly}
            className="w-full flex items-center justify-center gap-2 p-4 rounded-xl md:rounded-2xl border-2 border-dashed border-[var(--glass-border)] text-[var(--text-muted)] hover:border-[var(--accent)]/50 hover:text-[var(--accent-secondary)] transition-all mt-4"
          >
            <Plus className="w-5 h-5" />
            <span className="text-[10px] md:text-xs font-black uppercase tracking-widest">Add New Task</span>
          </button>
        </Reorder.Group>
      ) : (
        <div className="space-y-3 md:space-y-4 max-w-2xl mx-auto">
          {tasks.length === 0 ? (
            <div className="text-center py-10 md:py-20">
              <CheckSquare className="w-12 h-12 md:w-16 md:h-16 text-slate-800 mx-auto mb-4" />
              <p className="text-slate-500 font-medium italic text-sm">No tasks yet. Click Manage to add some.</p>
            </div>
          ) : (
            tasks.map((task) => (
              <div
                key={task.id}
                onClick={!isReadOnly ? () => onUpdate(task.id, { done: !task.done }) : undefined}
                className={cn(
                  "flex items-center gap-4 md:gap-6 p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] border transition-all",
                  !isReadOnly && "cursor-pointer",
                  task.done
                    ? "bg-[var(--accent)]/5 border-[var(--accent)]/20"
                    : "bg-white/[0.02] border-[var(--glass-border)] hover:bg-white/[0.04] hover:border-[var(--accent)]/20"
                )}
              >
                <div className={cn(
                  "w-6 h-6 md:w-8 md:h-8 rounded-lg md:rounded-xl border-2 flex items-center justify-center transition-all flex-shrink-0",
                  task.done
                    ? "bg-[var(--status-todo)] border-[var(--status-todo)] text-white"
                    : "border-[var(--glass-border)] text-transparent"
                )}>
                  <Plus className={cn("w-4 h-4 md:w-5 md:h-5 transition-transform", task.done ? "rotate-45" : "rotate-0")} />
                </div>
                <span className={cn(
                  "text-base md:text-xl transition-all break-words min-w-0 flex-1",
                  task.done ? "text-[var(--text-muted)] line-through" : "text-[var(--text-primary)] font-medium"
                )}>
                  {task.text || <span className="text-[var(--text-muted)] opacity-50 italic text-sm">Empty task...</span>}
                </span>
              </div>
            ))
          )}
        </div>
      )}
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
  
  const [isEditMode, setIsEditMode] = useState(false);
  const [localTitle, setLocalTitle] = useState('');
  const [localTasks, setLocalTasks] = useState<Task[]>([]);
  const isDraggingRef = React.useRef(false);

  const thought = thoughts.find((t) => t.id === activeFocusId);
  const { tasks } = useThoughtPayload(thought as any);
  const stack = stacks.find((s) => s.id === thought?.stackId);
  const isVisible = focusType === 'tasks' && !!thought;

  React.useEffect(() => {
    if (thought) {
      setLocalTitle(thought.text);
      const tasksWithIds = (tasks || []).map((t, i) => ({
        ...t,
        id: (t as Task & { id?: string }).id || `task-${i}-${Date.now()}`
      }));
      setLocalTasks(tasksWithIds);
    }
  }, [thought, tasks]);

  const saveTasks = (tasksToSaveRaw: Task[]) => {
    if (!thought) return;
    const tasksToSave = tasksToSaveRaw.map(({ id: _, ...rest }) => rest);
    updateThought(thought.id, { 
      data: { type: 'tasks', tasks: tasksToSave } 
    });
  };

  const handleAddTask = () => {
    if (!thought || isReadOnly) return;
    const newTask = { id: `task-${Date.now()}`, text: '', done: false };
    const newTasks = [...localTasks, newTask];
    setLocalTasks(newTasks);
    saveTasks(newTasks);
  };

  const handleUpdateTask = (id: string, updates: { text?: string; done?: boolean }) => {
    if (!thought || isReadOnly) return;
    const newTasks = localTasks.map(t => t.id === id ? { ...t, ...updates } : t);
    setLocalTasks(newTasks);
    if (updates.done !== undefined) {
      saveTasks(newTasks);
    } else {
      const timerKey = `task-save-${thought.id}`;
      if ((window as any)[timerKey]) clearTimeout((window as any)[timerKey]);
      (window as any)[timerKey] = setTimeout(() => {
        saveTasks(newTasks);
        delete (window as any)[timerKey];
      }, 1000);
    }
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

  if (!thought) return null;

  return (
    <FocusEditorShell
      isVisible={isVisible}
      onClose={() => setActiveFocus(null, null)}
      title={localTitle}
      onTitleChange={(val) => {
        setLocalTitle(val);
        if (!isReadOnly) updateThought(thought.id, { text: val });
      }}
      description={thought.description}
      isReadOnly={isReadOnly}
      stack={stack}
      headerActions={
        <div className="flex bg-[var(--bg-main)]/40 p-1 rounded-xl md:rounded-2xl border border-[var(--glass-border)] relative">
          {[
            { id: false, label: 'View' },
            { id: true, label: 'Manage' }
          ].map((mode) => (
            <button
              key={mode.label}
              onClick={() => setIsEditMode(mode.id)}
              disabled={mode.id === true && isReadOnly}
                className={cn(
                  "relative px-4 md:px-6 py-2 md:py-2.5 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all duration-300 z-10",
                  isEditMode === mode.id 
                    ? (mode.id === true ? "text-[var(--accent-contrast)]" : "text-[var(--text-primary)]")
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]",
                  mode.id === true && isReadOnly && "opacity-30 cursor-not-allowed"
                )}
            >
              {isEditMode === mode.id && (
                <motion.div
                  layoutId="activeTab"
                  className={cn(
                    "absolute inset-0 rounded-lg md:rounded-xl shadow-lg z-[-1]",
                    mode.id === true 
                      ? "bg-[var(--accent)] shadow-[var(--accent-glow)]" 
                      : "bg-white/10 border border-white/10"
                  )}
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              {mode.label}
            </button>
          ))}
        </div>
      }
      footerStatus={
        <div className="flex items-center gap-4">
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
        </div>
      }
    >
      <EditorContent 
        isEditMode={isEditMode}
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

export default TasksFocusEditor;
