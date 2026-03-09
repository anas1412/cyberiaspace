import React from 'react';
import { ListTodo, Maximize2 } from 'lucide-react';
import { type Thought } from '../../db';
import { useThoughtPayload } from './hooks/useThoughtPayload';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface TasksRendererProps {
  thought: Thought;
  isReadOnly: boolean;
  setActiveFocus: (id: string, type: 'text' | 'tasks' | 'paint' | 'table' | 'embed' | 'file' | 'image') => void;

}

export const TasksRenderer: React.FC<TasksRendererProps> = ({ 
  thought, 
  isReadOnly, 
  setActiveFocus 
}) => {
  // Use the dual-read hook for backward compatibility
  const { tasks } = useThoughtPayload(thought);
  
  const done = tasks.filter((t) => t.done).length;
  const progress = tasks.length > 0 ? (done / tasks.length) * 100 : 0;
  const previewTasks = tasks.slice(0, 3);
  const hasRemoteContent = thought.storageUrl && tasks.length === 0 && thought.syncStatus !== 'synced' && !isReadOnly;

  if (tasks.length === 0) {
    return (
      <div data-trigger="tasks" className="mt-1 flex flex-col items-center gap-2 py-4 bg-black/20 rounded-xl border border-white/5 group/tasks relative cursor-pointer transition-colors hover:bg-white/[0.05]">
        <ListTodo className="w-6 h-6 text-white/20" />
        <span className="text-[10px] text-white/20 font-bold uppercase tracking-widest">
          {hasRemoteContent ? 'Sync Pending' : 'Create Tasks'}
        </span>
        {hasRemoteContent && (
          <p className="text-[7px] text-amber-500/40 font-black uppercase tracking-[0.2em] text-center px-4">
            Items on other device
          </p>
        )}
        {!isReadOnly && (

          <div className="absolute inset-0 bg-[var(--accent)]/10 opacity-0 group-hover/tasks:opacity-100 transition-opacity rounded-xl flex items-center justify-center pointer-events-none">
            <button
              onClick={(e) => { e.stopPropagation(); setActiveFocus(thought.id, 'tasks'); }}
              className="pointer-events-auto prevent-drag bg-[var(--accent)] text-white p-2 rounded-lg shadow-xl transform scale-90 group-hover/tasks:scale-100 transition-all hover:scale-110 active:scale-95"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div data-trigger="tasks" className="mt-1 space-y-2 group/tasks relative cursor-pointer min-h-[60px] flex flex-col justify-center">
      <div className="space-y-1.5 pr-10">
        {previewTasks.map((task, i) => (
          <div key={i} className="flex items-center gap-2 min-w-0">
            <div className={cn(
              "w-3 h-3 rounded-sm border-[1.5px] flex-shrink-0 transition-colors prevent-drag",
              task.done ? "bg-[var(--status-todo)] border-[var(--status-todo)]" : "border-white/20"
            )} />
            <span className={cn(
              "text-[10px] truncate",
              task.done ? "text-slate-600 line-through" : "text-slate-300"
            )}>
              {task.text || "Untitled Task"}
            </span>
          </div>
        ))}
        {tasks.length > 3 && (
          <div className="text-[8px] text-slate-600 pl-5">
            + {tasks.length - 3} more...
          </div>
        )}
      </div>
      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden mt-3">
        <div
          className="h-full bg-[var(--accent)] transition-all duration-500 shadow-[0_0_10px_var(--accent-glow)]"
          style={{ width: `${progress}%` }}
        />
      </div>
      {!isReadOnly && (
        <div className="absolute inset-0 bg-[var(--accent)]/10 opacity-0 group-hover/tasks:opacity-100 transition-opacity rounded-xl flex items-center justify-center pointer-events-none">
          <button
            onClick={(e) => { e.stopPropagation(); setActiveFocus(thought.id, 'tasks'); }}
            className="pointer-events-auto prevent-drag bg-[var(--accent)] text-white p-2 rounded-lg shadow-xl transform scale-90 group-hover/tasks:scale-100 transition-all hover:scale-110 active:scale-95"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
