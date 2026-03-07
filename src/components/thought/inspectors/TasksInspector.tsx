import React from 'react';
import { useStore } from '../../../store/useStore';
import { useThoughtPayload } from '../hooks/useThoughtPayload';
import { type InspectorPanelProps } from '../registry';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Trash2 } from 'lucide-react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const TasksInspector: React.FC<InspectorPanelProps> = ({ thought, isReadOnly }) => {
  const updateThought = useStore(state => state.updateThought);
  const { tasks } = useThoughtPayload(thought);

  const handleUpdateTasks = (newTasks: { text: string; done: boolean }[]) => {
    updateThought(thought.id, { 
      data: { type: 'tasks', tasks: newTasks } 
    });
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {tasks.map((task, i) => (
          <div key={i} className="flex items-center gap-3">
            <div
              className={cn("checkbox w-[18px] h-[18px] border-2 border-white/10 rounded-[6px] flex-shrink-0 cursor-pointer transition-all", task.done && "bg-[var(--status-todo)] border-[var(--status-todo)]")}
              onClick={() => {
                if (isReadOnly) return;
                const newTasks = [...tasks];
                newTasks[i].done = !newTasks[i].done;
                handleUpdateTasks(newTasks);
              }}
            >
              {task.done && <span className="text-white text-[12px] flex items-center justify-center">✓</span>}
            </div>
            <input
              type="text"
              readOnly={isReadOnly}
              value={task.text}
              onChange={(e) => {
                const newTasks = [...tasks];
                newTasks[i].text = e.target.value;
                handleUpdateTasks(newTasks);
              }}
              className={cn(
                "flex-1 bg-black/20 border border-white/5 rounded-xl p-2 text-xs outline-none text-white focus:border-[var(--accent)]",
                isReadOnly && "pointer-events-none opacity-80"
              )}
            />
            {!isReadOnly && (
              <button
                onClick={() => {
                  const newTasks = [...tasks];
                  newTasks.splice(i, 1);
                  handleUpdateTasks(newTasks);
                }}
                className="text-red-400 p-2 hover:bg-red-500/10 rounded-lg transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
      {!isReadOnly && (
        <button
          onClick={() => handleUpdateTasks([...tasks, { text: 'Task', done: false }])}
          className="w-full py-2 border border-dashed border-white/10 rounded-xl text-[10px] uppercase font-bold text-slate-500 hover:text-white"
        >
          + Add Task
        </button>
      )}
    </div>
  );
};
