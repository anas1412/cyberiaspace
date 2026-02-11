import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { CheckSquare, X, Plus, Trash2, GripVertical } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence, Reorder } from 'framer-motion';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Task {
  id: string;
  text: string;
  done: boolean;
}

const TasksFocusEditor: React.FC = () => {
  const activeFocusId = useStore((state) => state.activeFocusId);
  const focusType = useStore((state) => state.focusType);
  const setActiveFocus = useStore((state) => state.setActiveFocus);
  const thoughts = useStore((state) => state.thoughts);
  const stacks = useStore((state) => state.stacks);
  const updateThought = useStore((state) => state.updateThought);
  const isReadOnly = useStore((state) => state.isReadOnly);

  const [isEditMode, setIsEditMode] = useState(false);

  // Local state for instant feedback
  const [localTitle, setLocalTitle] = useState('');
  const [localTasks, setLocalTasks] = useState<Task[]>([]);

  const thought = thoughts.find((t) => t.id === activeFocusId);
  const stack = stacks.find((s) => s.id === thought?.stackId);
  const isVisible = focusType === 'tasks' && !!thought;

  // Sync local state when thought changes
  React.useEffect(() => {
    if (thought) {
      setLocalTitle(thought.text);
      // Ensure each task has a unique ID for smooth reordering
      const tasksWithIds = (thought.tasks || []).map((t, i) => ({
        ...t,
        id: (t as Task & { id?: string }).id || `task-${i}-${Date.now()}`
      }));
      setLocalTasks(tasksWithIds);
    }
  }, [thought]);

  const handleAddTask = () => {
    if (!thought || isReadOnly) return;
    const newTask = { id: `task-${Date.now()}`, text: '', done: false };
    const newTasks = [...localTasks, newTask];
    setLocalTasks(newTasks);
    // Remove IDs before saving to store to keep data clean
    const tasksToSave = newTasks.map(({ id: _, ...rest }) => rest);
    updateThought(thought.id, { tasks: tasksToSave });
  };

  const handleUpdateTask = (id: string, updates: { text?: string; done?: boolean }) => {
    if (!thought || isReadOnly) return;
    const newTasks = localTasks.map(t => t.id === id ? { ...t, ...updates } : t);
    setLocalTasks(newTasks);

    // If it's a checkbox toggle, update immediately. 
    // If it's text, debounce the global store update to prevent lag.
    if (updates.done !== undefined) {
      const tasksToSave = newTasks.map(({ id: _, ...rest }) => rest);
      updateThought(thought.id, { tasks: tasksToSave });
    } else {
      const timerKey = `task-save-${thought.id}`;
      if ((window as any)[timerKey]) clearTimeout((window as any)[timerKey]);

      (window as any)[timerKey] = setTimeout(() => {
        const tasksToSave = newTasks.map(({ id: _, ...rest }) => rest);
        updateThought(thought.id, { tasks: tasksToSave });
        delete (window as any)[timerKey];
      }, 1000); // Wait 1 second of inactivity before updating global state
    }
  };

  const handleDeleteTask = (id: string) => {
    if (!thought || isReadOnly) return;
    const newTasks = localTasks.filter(t => t.id !== id);
    setLocalTasks(newTasks);
    const tasksToSave = newTasks.map(({ id: _, ...rest }) => rest);
    updateThought(thought.id, { tasks: tasksToSave });
  };

  const handleReorderTasks = (newTasks: Task[]) => {
    if (!thought || isReadOnly) return;
    setLocalTasks(newTasks);
    // Debounce the store update or only save when the order actually changes
    const tasksToSave = newTasks.map(({ id: _, ...rest }) => rest);
    updateThought(thought.id, { tasks: tasksToSave });
  };

  const completedCount = localTasks.filter(t => t.done).length || 0;
  const totalCount = localTasks.length || 0;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <AnimatePresence>
      {isVisible && thought && (
        <motion.div
          id="tasks-focus-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[10001] bg-[var(--bg-main)]/70 backdrop-blur-[40px] flex items-center justify-center p-4 md:p-10"
          onClick={() => setActiveFocus(null, null)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="focus-box glass rounded-[2rem] md:rounded-[3rem] overflow-hidden border border-white/10 shadow-2xl w-full max-w-[800px] h-full max-h-[95vh] md:max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 md:p-8 border-b border-white/5 bg-black/20 gap-4 md:gap-0">
              <div className="flex items-center gap-4 md:gap-6 w-full md:w-auto">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-[var(--accent)]/10 rounded-xl md:rounded-2xl flex items-center justify-center text-[var(--accent-secondary)] flex-shrink-0">
                  <CheckSquare className="w-5 h-5 md:w-6 md:h-6" />
                </div>
                <div className="flex flex-col flex-1 min-w-0">
                  <input
                    type="text"
                    value={localTitle}
                    onChange={(e) => {
                      setLocalTitle(e.target.value);
                      if (!isReadOnly) updateThought(thought.id, { text: e.target.value });
                    }}
                    placeholder="Task List Title"
                    readOnly={isReadOnly}
                  />
                  <div className="flex items-center gap-3 mt-1">
                    <div className="w-20 md:w-32 h-1 bg-white/5 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        className="h-full bg-[var(--accent)] shadow-[0_0_10px_var(--accent-glow)]"
                      />
                    </div>
                    <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-slate-500 whitespace-nowrap">
                      {completedCount}/{totalCount} Tasks Complete
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto">
                <div className="flex bg-white/5 p-1 rounded-xl md:rounded-2xl border border-white/5">
                  <button
                    onClick={() => setIsEditMode(false)}
                    className={cn(
                      "px-4 md:px-6 py-2 md:py-2.5 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all",
                      !isEditMode ? "bg-slate-700 text-white" : "text-slate-500 hover:text-white"
                    )}
                  >
                    View
                  </button>
                  <button
                    onClick={() => setIsEditMode(true)}
                    disabled={isReadOnly}
                    className={cn(
                      "px-4 md:px-6 py-2 md:py-2.5 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all",
                      isEditMode ? "bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent-glow)]" : "text-slate-500 hover:text-white",
                      isReadOnly && "opacity-30 cursor-not-allowed"
                    )}
                  >
                    Manage
                  </button>
                </div>
                <button
                  onClick={() => setActiveFocus(null, null)}
                  className="p-3 md:p-4 hover:bg-red-500/10 rounded-xl md:rounded-2xl text-slate-400 hover:text-red-400 transition-all"
                >
                  <X className="w-5 h-5 md:w-6 md:h-6" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scroll p-6 md:p-12 bg-black/10">
              {isEditMode ? (
                <Reorder.Group
                  axis="y"
                  values={localTasks}
                  onReorder={handleReorderTasks}
                  className="space-y-2 md:space-y-3"
                >
                  {localTasks.map((task) => (
                    <Reorder.Item
                      key={task.id}
                      value={task}
                      className="group flex items-center gap-3 md:gap-4 bg-white/[0.03] hover:bg-white/[0.05] border border-white/5 p-3 md:p-4 rounded-xl md:rounded-2xl transition-colors"
                    >
                      <div className="cursor-grab active:cursor-grabbing text-slate-600 p-1">
                        <GripVertical className="w-4 h-4 md:w-5 md:h-5" />
                      </div>
                      <input
                        type="checkbox"
                        checked={task.done}
                        onChange={(e) => handleUpdateTask(task.id, { done: e.target.checked })}
                        className="w-5 h-5 rounded-lg border-2 border-white/20 bg-transparent checked:bg-[var(--status-todo)] checked:border-[var(--status-todo)] transition-all cursor-pointer accent-[var(--status-todo)] flex-shrink-0"
                      />
                      <input
                        type="text"
                        value={task.text}
                        onChange={(e) => handleUpdateTask(task.id, { text: e.target.value })}
                        className={cn(
                          "flex-1 bg-transparent text-base md:text-lg outline-none border-none p-0 transition-all min-w-0",
                          task.done ? "text-slate-500 line-through" : "text-slate-200"
                        )}
                        placeholder="What needs to be done?"
                      />
                      <button
                        onClick={() => handleDeleteTask(task.id)}
                        className="p-2 text-slate-500 hover:text-red-400 transition-all flex-shrink-0"
                      >
                        <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
                      </button>
                    </Reorder.Item>
                  ))}
                  <button
                    onClick={handleAddTask}
                    className="w-full flex items-center justify-center gap-2 p-4 rounded-xl md:rounded-2xl border-2 border-dashed border-white/5 text-slate-500 hover:border-[var(--accent)]/50 hover:text-[var(--accent-secondary)] transition-all mt-4"
                  >
                    <Plus className="w-5 h-5" />
                    <span className="text-[10px] md:text-xs font-black uppercase tracking-widest">Add New Task</span>
                  </button>
                </Reorder.Group>
              ) : (
                <div className="space-y-3 md:space-y-4 max-w-2xl mx-auto">
                  {localTasks.length === 0 ? (
                    <div className="text-center py-10 md:py-20">
                      <CheckSquare className="w-12 h-12 md:w-16 md:h-16 text-slate-800 mx-auto mb-4" />
                      <p className="text-slate-500 font-medium italic text-sm">No tasks yet. Click Manage to add some.</p>
                    </div>
                  ) : (
                    localTasks.map((task) => (
                      <div
                        key={task.id}
                        onClick={!isReadOnly ? () => handleUpdateTask(task.id, { done: !task.done }) : undefined}
                        className={cn(
                          "flex items-center gap-4 md:gap-6 p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] border transition-all",
                          !isReadOnly && "cursor-pointer",
                          task.done
                            ? "bg-[var(--accent)]/5 border-[var(--accent)]/20"
                            : "bg-white/[0.02] border-white/5 hover:bg-white/[0.04] hover:border-white/10"
                        )}
                      >
                        <div className={cn(
                          "w-6 h-6 md:w-8 md:h-8 rounded-lg md:rounded-xl border-2 flex items-center justify-center transition-all flex-shrink-0",
                          task.done
                            ? "bg-[var(--status-todo)] border-[var(--status-todo)] text-white"
                            : "border-white/20 text-transparent"
                        )}>
                          <Plus className={cn("w-4 h-4 md:w-5 md:h-5 transition-transform", task.done ? "rotate-45" : "rotate-0")} />
                        </div>
                        <span className={cn(
                          "text-base md:text-xl transition-all break-words min-w-0 flex-1",
                          task.done ? "text-slate-500 line-through" : "text-slate-200 font-medium"
                        )}>
                          {task.text || <span className="text-slate-700 italic text-sm">Empty task...</span>}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="p-4 md:p-6 bg-black/40 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 md:gap-0">
              <div className="flex flex-wrap justify-center md:justify-start gap-2">
                {stack && (
                  <span
                    className="tag-pill text-[8px] md:text-[9px] font-700 px-2 md:px-2.5 py-1 rounded-lg border border-white/10"
                    style={{
                      backgroundColor: stack.color.replace('1)', '0.15)'),
                      color: stack.color,
                      borderColor: stack.color.replace('1)', '0.3)')
                    }}
                  >
                    {stack.name}
                  </span>
                )}
              </div>
              <p className="text-[8px] md:text-[10px] uppercase font-black tracking-widest text-slate-600">
                {isReadOnly ? "Read-only view" : "Click a task in View mode to toggle it"}
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TasksFocusEditor;
