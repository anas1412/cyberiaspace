import React from 'react';
import { ListTodo } from 'lucide-react';
import { type Thought } from '../../db';
import { useThoughtPayload } from './hooks/useThoughtPayload';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface TasksRendererProps {
  thought: Thought;
  isArchived?: boolean;
  setActiveFocus: (id: string, type: 'text' | 'tasks' | 'paint' | 'table' | 'embed' | 'file' | 'image') => void;
}

export const TasksRenderer: React.FC<TasksRendererProps> = ({ 
  thought, 
  isArchived = false,
  setActiveFocus 
}) => {
  const { tasks } = useThoughtPayload(thought);
  
  const done = tasks.filter((t) => t.done).length;
  const progress = tasks.length > 0 ? (done / tasks.length) * 100 : 0;
  const previewTasks = tasks.slice(0, 3);

  if (tasks.length === 0) {
    return (
      <div data-trigger="tasks" className={cn(
        "flex flex-col items-center justify-center py-5 gap-1.5 group/tasks relative cursor-pointer",
        isArchived && "pointer-events-none"
      )}
        onClick={(e) => { e.stopPropagation(); setActiveFocus(thought.id, 'tasks'); }}
      >
        <ListTodo className="w-5 h-5 text-[var(--text-muted)]/30" />
        <span className="text-[9px] text-[var(--text-muted)]/40 font-medium tracking-widest">
          Create Tasks
        </span>
      </div>
    );
  }

  return (
    <div data-trigger="tasks" className={cn(
      "space-y-2 group/tasks relative cursor-pointer min-h-[60px] flex flex-col justify-center",
      isArchived && "pointer-events-none"
    )}>
      <div className="space-y-1.5 pr-10">
        {previewTasks.map((task, i) => (
          <div key={i} className="flex items-center gap-2 min-w-0">
            <div className={cn(
              "w-3 h-3 rounded-sm border-[1.5px] flex-shrink-0 transition-colors prevent-drag",
              task.done ? "bg-[var(--accent)] border-[var(--accent)]" : "border-[var(--glass-border)]"
            )} />
            <span className={cn(
              "text-[10px] truncate",
              task.done ? "text-[var(--text-muted)] line-through" : "text-[var(--text-dimmed)]"
            )}>
              {task.text || "Untitled Task"}
            </span>
          </div>
        ))}
        {tasks.length > 3 && (
          <div className="text-[8px] text-[var(--text-muted)] pl-5">
            + {tasks.length - 3} more
          </div>
        )}
      </div>
      <div className="h-1 w-full bg-[var(--node-bg)]/40 rounded-full overflow-hidden">
        <div
          className="h-full bg-[var(--secondary)] transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};
