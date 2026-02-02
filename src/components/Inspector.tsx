import React from 'react';
import { useStore } from '../store/useStore';
import { useModalStore } from './Modal';
import { X, Maximize2, Image as ImageIcon, Link, Trash2 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const Inspector: React.FC = () => {
  const isInspectorOpen = useStore((state) => state.isInspectorOpen);
  const setInspectorOpen = useStore((state) => state.setInspectorOpen);
  const selectedThoughtId = useStore((state) => state.selectedThoughtId);
  const thoughts = useStore((state) => state.thoughts);
  const updateThought = useStore((state) => state.updateThought);
  const deleteThought = useStore((state) => state.deleteThought);
  const setActiveFocus = useStore((state) => state.setActiveFocus);
  
  const { openModal } = useModalStore();

  const thought = thoughts.find((t) => t.id === selectedThoughtId);

  if (!isInspectorOpen || !thought) return null;

  const handleDeleteThought = () => {
    openModal({
      title: 'Delete Thought?',
      description: 'This action cannot be undone.',
      type: 'delete_thought',
      confirmText: 'Delete',
      onConfirm: () => deleteThought(thought.id)
    });
  };

  const handleTypeChange = (type: typeof thought.type) => {
    updateThought(thought.id, { type });
  };

  const handlePriorityChange = (priority: typeof thought.priority) => {
    updateThought(thought.id, { priority });
  };

  const handleTagInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',') && e.currentTarget.value.trim()) {
      e.preventDefault();
      const newTag = e.currentTarget.value.trim().replace(',', '');
      if (!thought.tags.includes(newTag)) {
        updateThought(thought.id, { tags: [...thought.tags, newTag] });
      }
      e.currentTarget.value = '';
    }
  };

  const removeTag = (index: number) => {
    const newTags = [...thought.tags];
    newTags.splice(index, 1);
    updateThought(thought.id, { tags: newTags });
  };

  const getTagStyle = (tag: string) => {
    let h = 0;
    for (let i = 0; i < tag.length; i++) h = tag.charCodeAt(i) + ((h << 5) - h);
    const hue = Math.abs(h * 137.5) % 360;
    return {
      backgroundColor: `hsla(${hue}, 70%, 50%, 0.15)`,
      color: `hsla(${hue}, 90%, 75%, 1)`,
      borderColor: `hsla(${hue}, 70%, 50%, 0.3)`,
    };
  };

  return (
    <div 
      id="inspector" 
      className="ui-layer top-[120px] right-8 w-80 glass rounded-[2.5rem] p-8 shadow-2xl overflow-y-auto max-h-[70vh] custom-scroll pointer-events-auto"
    >
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-white">Thought Editor</h3>
        <button onClick={() => setInspectorOpen(false)} className="text-slate-500 hover:text-white">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-5 gap-1 mb-6">
        {['text', 'tasks', 'paint', 'table', 'image'].map((type) => (
          <button
            key={type}
            onClick={() => handleTypeChange(type as any)}
            className={cn(
              "p-2 rounded-xl text-[8px] font-800 uppercase bg-white/[0.03] border border-transparent transition-all",
              thought.type === type ? "bg-indigo-500/10 border-indigo-500 text-white" : "text-slate-500"
            )}
          >
            {type}
          </button>
        ))}
      </div>

      <div className="space-y-5">
        <input
          type="text"
          value={thought.text}
          onChange={(e) => updateThought(thought.id, { text: e.target.value })}
          maxLength={30}
          className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm outline-none focus:border-indigo-500 text-white"
          placeholder="Name"
        />
        <textarea
          value={thought.description}
          onChange={(e) => updateThought(thought.id, { description: e.target.value })}
          rows={2}
          maxLength={150}
          className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs outline-none focus:border-indigo-500 text-white"
          placeholder="Description"
        />
        <input
          type="date"
          value={thought.date}
          onChange={(e) => updateThought(thought.id, { date: e.target.value })}
          className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs outline-none focus:border-indigo-500 text-white font-mono uppercase"
        />

        <div className="space-y-2">
          <label className="text-[9px] uppercase font-bold tracking-widest text-slate-500 ml-1">Status</label>
          <div className="grid grid-cols-4 gap-1">
            {(['none', 'todo', 'doing', 'done'] as const).map((s) => (
              <button
                key={s}
                onClick={() => updateThought(thought.id, { status: s })}
                className={cn(
                  "border rounded-lg py-2 text-[8px] font-bold uppercase transition-colors",
                  thought.status === s 
                    ? {
                        'none': 'bg-white/10 border-white/30 text-white',
                        'todo': 'bg-indigo-500/30 border-indigo-500 text-white',
                        'doing': 'bg-yellow-500/30 border-yellow-500 text-white',
                        'done': 'bg-green-500/30 border-green-500 text-white',
                      }[s]
                    : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[9px] uppercase font-bold tracking-widest text-slate-500 ml-1">Priority</label>
          <div className="grid grid-cols-5 gap-1">
            {(['none', 'low', 'medium', 'high', 'urgent'] as const).map((p) => (
              <button
                key={p}
                onClick={() => handlePriorityChange(p)}
                className={cn(
                  "border rounded-lg py-2 text-[8px] font-bold uppercase transition-colors",
                  thought.priority === p 
                    ? {
                        'none': 'bg-white/10 border-white/30 text-white',
                        'low': 'bg-blue-500/30 border-blue-500 text-white',
                        'medium': 'bg-yellow-500/30 border-yellow-500 text-white',
                        'high': 'bg-orange-500/30 border-orange-500 text-white',
                        'urgent': 'bg-red-500/30 border-red-500 text-white',
                      }[p]
                    : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
                )}
              >
                {p === 'medium' ? 'Med' : p}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-4 border-t border-white/5">
          {thought.type === 'text' && (
            <button 
              onClick={() => setActiveFocus(thought.id, 'text')}
              className="w-full bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 py-6 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex flex-col items-center gap-3"
            >
              <Maximize2 className="w-5 h-5" />
              Open Full-Screen Editor
            </button>
          )}
          
          {thought.type === 'tasks' && (
            <div className="space-y-3">
              <div className="space-y-2">
                {thought.tasks.map((task, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div 
                      className={cn("checkbox w-[18px] h-[18px] border-2 border-white/10 rounded-[6px] flex-shrink-0 cursor-pointer transition-all", task.done && "bg-indigo-500 border-indigo-500")}
                      onClick={() => {
                        const newTasks = [...thought.tasks];
                        newTasks[i].done = !newTasks[i].done;
                        updateThought(thought.id, { tasks: newTasks });
                      }}
                    >
                      {task.done && <span className="text-white text-[12px] flex items-center justify-center">✓</span>}
                    </div>
                    <input
                      type="text"
                      value={task.text}
                      onChange={(e) => {
                        const newTasks = [...thought.tasks];
                        newTasks[i].text = e.target.value;
                        updateThought(thought.id, { tasks: newTasks });
                      }}
                      className="flex-1 bg-black/20 border border-white/5 rounded-xl p-2 text-xs outline-none text-white focus:border-indigo-500"
                    />
                    <button 
                      onClick={() => {
                        const newTasks = [...thought.tasks];
                        newTasks.splice(i, 1);
                        updateThought(thought.id, { tasks: newTasks });
                      }}
                      className="text-red-400 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <button 
                onClick={() => updateThought(thought.id, { tasks: [...thought.tasks, { text: 'Task', done: false }] })}
                className="w-full py-2 border border-dashed border-white/10 rounded-xl text-[10px] uppercase font-bold text-slate-500 hover:text-white"
              >
                + Add Task
              </button>
            </div>
          )}

          {thought.type === 'table' && (
            <button 
              onClick={() => setActiveFocus(thought.id, 'table')}
              className="w-full bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 py-6 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex flex-col items-center gap-3"
            >
              <Maximize2 className="w-5 h-5" />
              Open Full-Screen Editor
            </button>
          )}

          {thought.type === 'image' && (
            <div className="space-y-3">
              <div className="border border-dashed border-white/10 rounded-xl p-4 text-center hover:bg-white/5 transition-colors cursor-pointer relative">
                <input 
                  type="file" 
                  accept="image/*" 
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (ev) => updateThought(thought.id, { image: ev.target?.result as string });
                      reader.readAsDataURL(file);
                    }
                  }}
                />
                <ImageIcon className="w-6 h-6 mx-auto text-slate-500 mb-2" />
                <p className="text-[9px] text-slate-400 uppercase font-bold tracking-widest">Upload or Drag Image</p>
              </div>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Or paste image URL..." 
                  className="flex-1 bg-black/40 border border-white/10 rounded-xl p-2 text-xs outline-none focus:border-indigo-500 text-white"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      updateThought(thought.id, { image: e.currentTarget.value });
                    }
                  }}
                />
                <button className="p-2 bg-white/5 rounded-xl hover:bg-white/10 text-white">
                  <Link className="w-4 h-4" />
                </button>
              </div>
              {thought.image && (
                <div className="rounded-xl border border-white/10 overflow-hidden bg-black/50">
                  <img src={thought.image} className="w-full object-contain" alt="Preview" />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="tag-input-wrap flex flex-wrap gap-2 p-3 bg-black/40 border border-white/10 rounded-xl min-h-[44px]">
          {thought.tags.map((tag, i) => (
            <span key={i} className="tag-pill text-[9px] font-700 px-2 py-0.5 rounded-lg border flex items-center gap-1" style={getTagStyle(tag)}>
              {tag}
              <X className="w-2.5 h-2.5 cursor-pointer" onClick={() => removeTag(i)} />
            </span>
          ))}
          <input
            type="text"
            onKeyDown={handleTagInput}
            placeholder="Add tag..."
            className="bg-transparent outline-none text-white text-xs flex-1 min-w-[60px]"
          />
        </div>

        <button 
          onClick={handleDeleteThought}
          className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 py-4 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-colors"
        >
          Delete Thought
        </button>
      </div>
    </div>
  );
};

export default Inspector;
