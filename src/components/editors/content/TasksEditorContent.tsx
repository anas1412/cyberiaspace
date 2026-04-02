import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface Task {
  id: string;
  text: string;
  done: boolean;
}

interface TasksEditorContentProps {
  tasks: Task[];
  onUpdate: (id: string, updates: { text?: string; done?: boolean }) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
  isReadOnly: boolean;
}

export const TasksEditorContent: React.FC<TasksEditorContentProps> = ({
  tasks,
  onUpdate,
  onDelete,
  onAdd,
  isReadOnly
}) => {
  return (
    <div className="flex-1 overflow-y-auto custom-scroll p-4 bg-[var(--glass-bg)]">
      <div className="max-w-2xl mx-auto w-full space-y-2">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="group flex items-center gap-3 bg-white/[0.03] hover:bg-white/[0.05] border border-[var(--glass-border)] p-3 rounded-xl transition-colors"
          >
            <input
              type="checkbox"
              checked={task.done}
              onChange={(e) => !isReadOnly && onUpdate(task.id, { done: e.target.checked })}
              className="w-4 h-4 md:w-5 md:h-5 rounded-lg border-2 flex items-center justify-center transition-all cursor-pointer flex-shrink-0 accent-transparent"
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
                "flex-1 text-sm md:text-base outline-none border-none bg-transparent p-0 transition-all min-w-0 break-words",
                task.done ? "text-[var(--text-muted)] line-through" : "text-[var(--text-primary)]"
              )}
            />
            {!isReadOnly && (
              <button
                onClick={() => onDelete(task.id)}
                className="p-1.5 text-[var(--text-muted)] hover:text-red-400 transition-all flex-shrink-0 opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
        {!isReadOnly && (
          <button
            onClick={onAdd}
            className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-dashed border-[var(--glass-border)] text-[var(--text-muted)] hover:border-[var(--accent)]/50 hover:text-[var(--accent-secondary)] transition-all"
          >
            <Plus className="w-4 h-4" />
            <span className="text-[10px] font-semibold tracking-widest">Add Task</span>
          </button>
        )}
      </div>
    </div>
  );
};