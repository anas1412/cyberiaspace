import React from 'react';
import { useStore } from '../store/useStore';
import { useModalStore } from '../store/useModalStore';
import { X, Maximize2, Image as ImageIcon, Link, Trash2, Youtube } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';

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
  const dragControls = useDragControls();

  const thought = thoughts.find((t) => t.id === selectedThoughtId);

  const isMobile = typeof window !== 'undefined' ? window.innerWidth < 768 : false;

  // Local state for zero-latency typing
  const [localText, setLocalText] = React.useState('');
  const [localDesc, setLocalDesc] = React.useState('');
  const [localDate, setLocalDate] = React.useState('');

  // Sync local state when selected thought changes
  React.useEffect(() => {
    if (thought) {
      setLocalText(thought.text || '');
      setLocalDesc(thought.description || '');
      setLocalDate(thought.date || '');
    }
  }, [selectedThoughtId]);

  const handleDeleteThought = () => {
    if (!thought) return;
    openModal({
      title: 'Delete Thought?',
      description: 'This action cannot be undone.',
      type: 'delete_thought',
      confirmText: 'Delete',
      onConfirm: () => deleteThought(thought.id)
    });
  };

  const handleTypeChange = (type: 'text' | 'tasks' | 'paint' | 'table' | 'image' | 'embed') => {
    if (!thought) return;
    updateThought(thought.id, { type });
  };

  const handlePriorityChange = (priority: 'none' | 'low' | 'medium' | 'high' | 'urgent') => {
    if (!thought) return;
    updateThought(thought.id, { priority });
  };

  const handleTagInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!thought) return;
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
    if (!thought) return;
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
    <AnimatePresence>
      {isInspectorOpen && thought && (
        <motion.div 
          id="inspector" 
          initial={isMobile ? { y: '100%' } : { opacity: 0, x: 20 }}
          animate={isMobile ? { y: 0 } : { opacity: 1, x: 0 }}
          exit={isMobile ? { y: '100%' } : { opacity: 0, x: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          drag={isMobile ? "y" : false}
          dragControls={dragControls}
          dragListener={false}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0.1}
          onDragEnd={(_, info) => {
            if (isMobile && info.offset.y > 100) {
              setInspectorOpen(false);
            }
          }}
          className="ui-layer fixed bottom-0 left-0 right-0 md:bottom-auto md:left-auto md:top-[120px] md:right-8 w-full md:w-80 glass rounded-t-[2.5rem] md:rounded-[2.5rem] p-6 md:p-8 shadow-2xl overflow-y-auto max-h-[85vh] md:max-h-[70vh] custom-scroll pointer-events-auto transition-shadow"
        >
          {/* Mobile Drag Handle */}
          <div 
            className="md:hidden flex justify-center mb-4 cursor-grab active:cursor-grabbing py-2"
            onPointerDown={(e) => isMobile && dragControls.start(e)}
          >
            <div className="w-12 h-1.5 bg-white/10 rounded-full" />
          </div>

          <div 
            className={cn(
              "flex justify-between items-center mb-6",
              isMobile && "cursor-grab active:cursor-grabbing"
            )}
            onPointerDown={(e) => {
              // Only start drag if not clicking the close button and we are on mobile
              if (isMobile && !(e.target as HTMLElement).closest('button')) {
                dragControls.start(e);
              }
            }}
          >
            <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-primary)] select-none">Thought Editor</h3>
            <button onClick={() => setInspectorOpen(false)} className="text-slate-500 hover:text-white relative z-10">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-6 gap-1 mb-6">
            {(['text', 'tasks', 'paint', 'table', 'image', 'embed'] as const).map((type) => (
              <button
                key={type}
                onClick={() => handleTypeChange(type)}
                className={cn(
                  "p-2 rounded-xl text-[8px] font-800 uppercase bg-white/[0.03] border border-transparent transition-all",
                  thought.type === type ? "bg-[var(--accent)]/10 border-[var(--accent)] text-white" : "text-slate-500"
                )}
              >
                {type}
              </button>
            ))}
          </div>

          <div className="space-y-5">
            <input
              type="text"
              value={localText}
              onChange={(e) => {
                setLocalText(e.target.value);
                updateThought(thought.id, { text: e.target.value });
              }}
              maxLength={30}
              className="w-full bg-[var(--bg-page)]/20 border border-white/10 rounded-xl p-3 text-sm outline-none focus:border-[var(--accent)] text-[var(--text-primary)] placeholder:text-slate-500"
              placeholder="Name"
            />
            <textarea
              value={localDesc}
              onChange={(e) => {
                setLocalDesc(e.target.value);
                updateThought(thought.id, { description: e.target.value });
              }}
              rows={2}
              maxLength={150}
              className="w-full bg-[var(--bg-page)]/20 border border-white/10 rounded-xl p-3 text-xs outline-none focus:border-[var(--accent)] text-[var(--text-primary)] placeholder:text-slate-500"
              placeholder="Description"
            />
            <input
              type="date"
              value={localDate}
              onChange={(e) => {
                setLocalDate(e.target.value);
                updateThought(thought.id, { date: e.target.value });
              }}
              className="w-full bg-[var(--bg-page)]/20 border border-white/10 rounded-xl p-3 text-xs outline-none focus:border-[var(--accent)] text-[var(--text-primary)] font-mono uppercase"
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
                            'todo': 'bg-[var(--status-todo)]/30 border-[var(--status-todo)] text-white',
                            'doing': 'bg-[var(--status-doing)]/30 border-[var(--status-doing)] text-white',
                            'done': 'bg-[var(--status-done)]/30 border-[var(--status-done)] text-white',
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
                            'low': 'bg-[var(--prio-low)]/30 border-[var(--prio-low)] text-white',
                            'medium': 'bg-[var(--prio-medium)]/30 border-[var(--prio-medium)] text-white',
                            'high': 'bg-[var(--prio-high)]/30 border-[var(--prio-high)] text-white',
                            'urgent': 'bg-[var(--prio-urgent)]/30 border-[var(--prio-urgent)] text-white',
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
                  className="w-full bg-[var(--accent)]/10 hover:bg-[var(--accent)]/20 border border-[var(--accent)]/30 text-[var(--accent-secondary)] py-6 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex flex-col items-center gap-3"
                >
                  <Maximize2 className="w-5 h-5" />
                  Open Full-Screen Editor
                </button>
              )}
              
              {thought.type === 'tasks' && (
                <div className="space-y-4">
                  <button 
                    onClick={() => setActiveFocus(thought.id, 'tasks')}
                    className="w-full bg-[var(--accent)]/10 hover:bg-[var(--accent)]/20 border border-[var(--accent)]/30 text-[var(--accent-secondary)] py-6 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex flex-col items-center gap-3"
                  >
                    <Maximize2 className="w-5 h-5" />
                    Open Task Manager
                  </button>
                  
                  <div className="space-y-3">
                    <div className="space-y-2">
                      {thought.tasks.map((task, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div 
                            className={cn("checkbox w-[18px] h-[18px] border-2 border-white/10 rounded-[6px] flex-shrink-0 cursor-pointer transition-all", task.done && "bg-[var(--status-todo)] border-[var(--status-todo)]")}
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
                            className="flex-1 bg-black/20 border border-white/5 rounded-xl p-2 text-xs outline-none text-white focus:border-[var(--accent)]"
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
                </div>
              )}

              {thought.type === 'table' && (
                <button 
                  onClick={() => setActiveFocus(thought.id, 'table')}
                  className="w-full bg-[var(--accent)]/10 hover:bg-[var(--accent)]/20 border border-[var(--accent)]/30 text-[var(--accent-secondary)] py-6 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex flex-col items-center gap-3"
                >
                  <Maximize2 className="w-5 h-5" />
                  Open Full-Screen Editor
                </button>
              )}

              {thought.type === 'paint' && (
                <button 
                  onClick={() => setActiveFocus(thought.id, 'paint')}
                  className="w-full bg-[var(--accent)]/10 hover:bg-[var(--accent)]/20 border border-[var(--accent)]/30 text-[var(--accent-secondary)] py-6 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex flex-col items-center gap-3"
                >
                  <Maximize2 className="w-5 h-5" />
                  Open Full-Screen Editor
                </button>
              )}

              {thought.type === 'embed' && (
                <div className="space-y-4">
                  <button 
                    onClick={() => setActiveFocus(thought.id, 'embed')}
                    className="w-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 py-6 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex flex-col items-center gap-3"
                  >
                    <Youtube className="w-5 h-5" />
                    Open Video Player
                  </button>
                  
                  <div className="space-y-2">
                    <label className="text-[9px] uppercase font-bold tracking-widest text-slate-500 ml-1">YouTube URL</label>
                    <input 
                      type="text" 
                      value={thought.content}
                      onChange={(e) => updateThought(thought.id, { content: e.target.value })}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs outline-none focus:border-red-500 text-white"
                    />
                  </div>
                </div>
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
                      className="flex-1 bg-black/40 border border-white/10 rounded-xl p-2 text-xs outline-none focus:border-[var(--accent)] text-white"
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

            <div className="tag-input-wrap flex flex-wrap gap-2 p-3 bg-[var(--bg-page)]/20 border border-white/10 rounded-xl min-h-[44px]">
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
                className="bg-transparent outline-none text-[var(--text-primary)] text-xs flex-1 min-w-[60px] placeholder:text-slate-500"
              />
            </div>

            <button 
              onClick={handleDeleteThought}
              className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 py-4 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-colors"
            >
              Delete Thought
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Inspector;