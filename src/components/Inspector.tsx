import React from 'react';
import { useStore } from '../store/useStore';
import { useModalStore } from '../store/useModalStore';
import { X, Maximize2, Image as ImageIcon, Link, Trash2, Youtube } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchYouTubeMeta, getYouTubeVideoId } from '../utils/youtube';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const Inspector: React.FC = () => {
  const isInspectorOpen = useStore((state) => state.isInspectorOpen);
  const setInspectorOpen = useStore((state) => state.setInspectorOpen);
  const selectedThoughtId = useStore((state) => state.selectedThoughtId);
  const thoughts = useStore((state) => state.thoughts);
  const stacks = useStore((state) => state.stacks);
  const updateThought = useStore((state) => state.updateThought);
  const updateStack = useStore((state) => state.updateStack);
  const createStack = useStore((state) => state.createStack);
  const deleteThought = useStore((state) => state.deleteThought);
  const unlinkSelectedThoughts = useStore((state) => state.unlinkSelectedThoughts);
  const setActiveFocus = useStore((state) => state.setActiveFocus);
  
  const { openModal } = useModalStore();

  const thought = thoughts.find((t) => t.id === selectedThoughtId);
  const stack = stacks.find((s) => s.id === thought?.stackId);

  // Local state for zero-latency typing
  const [localText, setLocalText] = React.useState('');
  const [localDesc, setLocalDesc] = React.useState('');
  const [localDate, setLocalDate] = React.useState('');
  const [localStackName, setLocalStackName] = React.useState('');

  // Sync local state when selected thought changes
  React.useEffect(() => {
    if (thought) {
      setLocalText(thought.text || '');
      setLocalDesc(thought.description || '');
      setLocalDate(thought.date || '');
    }
    if (stack) {
      setLocalStackName(stack.name || '');
    }
  }, [selectedThoughtId, stack?.id]);

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

  return (
    <AnimatePresence>
      {isInspectorOpen && thought && (
        <motion.div 
          id="inspector" 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="ui-layer focus-box fixed top-[120px] right-8 w-80 glass rounded-[2.5rem] shadow-2xl pointer-events-auto transition-shadow overflow-hidden flex flex-col"
        >
          {/* HEADER AREA */}
          <div className="px-8 pt-8 pb-4 bg-white/[0.02]">
            <div className="flex justify-between items-center">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-primary)] select-none">Thought Editor</h3>
              <button onClick={() => setInspectorOpen(false)} className="text-slate-500 hover:text-white relative z-10">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* SCROLLABLE CONTENT AREA */}
          <div className="flex-1 overflow-y-auto custom-scroll px-8 pb-8 max-h-[70vh]">
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
                maxLength={100}
                className="w-full bg-[var(--bg-page)]/20 border border-white/10 rounded-xl p-3 text-sm outline-none focus:border-[var(--accent)] text-[var(--text-primary)] placeholder:text-slate-500"
                placeholder={thought.placeholder || "Name"}
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

              <div className="space-y-3">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-[9px] uppercase font-bold tracking-widest text-slate-500">Node Size</label>
                  <span className="text-[9px] font-mono text-[var(--accent-secondary)]">{(thought.size || 1.0).toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={thought.size || 1.0}
                  onChange={(e) => updateThought(thought.id, { size: parseFloat(e.target.value) })}
                  className="w-full h-1.5 bg-white/5 rounded-lg appearance-none cursor-pointer accent-[var(--accent)]"
                />
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
                        onChange={(e) => {
                          const newUrl = e.target.value;
                          updateThought(thought.id, { content: newUrl });
                          
                          const videoId = getYouTubeVideoId(newUrl);
                          if (videoId) {
                            // Fetch metadata for the new URL
                            fetchYouTubeMeta(newUrl)
                              .then(metadata => {
                                if (metadata && metadata.title) {
                                  updateThought(thought.id, { 
                                    text: metadata.title,
                                    description: metadata.author_name || "" 
                                  });
                                }
                              })
                              .catch(err => {
                                console.warn("YouTube metadata fetch failed:", err);
                              });
                          }
                        }}
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

              <div className="space-y-3 pt-4 border-t border-white/5">
                <label className="text-[9px] uppercase font-bold tracking-widest text-slate-500 ml-1">Stack</label>
                
                {stack ? (
                  <div className="p-4 bg-[var(--bg-page)]/20 border border-white/10 rounded-2xl space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full shadow-[0_0_10px_currentColor]" style={{ backgroundColor: stack.color, color: stack.color }} />
                      <input
                        type="text"
                        value={localStackName}
                        onChange={(e) => {
                          setLocalStackName(e.target.value);
                          updateStack(stack.id, { name: e.target.value });
                        }}
                        className="bg-transparent text-[10px] font-black uppercase tracking-widest text-white outline-none flex-1"
                        placeholder="Stack Name"
                      />
                    </div>
                    <button 
                      onClick={() => unlinkSelectedThoughts()}
                      className="w-full py-2 bg-white/5 hover:bg-red-500/10 text-slate-400 hover:text-red-400 border border-white/5 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all"
                    >
                      Remove from Stack
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="relative group">
                      <input
                        type="text"
                        placeholder="Type to create or join..."
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                            const name = e.currentTarget.value.trim();
                            const existingStack = stacks.find(s => s.name.toLowerCase() === name.toLowerCase());
                            if (existingStack) {
                              updateThought(thought.id, { stackId: existingStack.id });
                            } else {
                              createStack(name, thought.id);
                            }
                            e.currentTarget.value = '';
                          }
                        }}
                        className="w-full bg-[var(--bg-page)]/20 border border-white/10 rounded-xl p-3 text-xs outline-none focus:border-[var(--accent)] text-[var(--text-primary)] placeholder:text-slate-500 transition-all"
                      />
                    </div>
                    
                    {stacks.length > 0 && (
                      <div className="space-y-1.5">
                        <label className="text-[7px] uppercase font-black tracking-[0.2em] text-slate-600 ml-1">Existing Stacks</label>
                        <div className="flex flex-col gap-1 max-h-[160px] overflow-y-auto custom-scroll pr-1">
                          {stacks.map(s => (
                            <button
                              key={s.id}
                              onClick={() => updateThought(thought.id, { stackId: s.id })}
                              className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-transparent hover:border-white/5 transition-all group/s"
                            >
                              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color, boxShadow: `0 0 8px ${s.color}44` }} />
                              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 group-hover/s:text-white transition-colors">{s.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button 
                onClick={handleDeleteThought}
                className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 py-4 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-colors"
              >
                Delete Thought
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Inspector;