import React from 'react';
import { useStore } from '../store/useStore';
import { useModalStore } from '../store/useModalStore';
import { X, Maximize2, Image as ImageIcon, Link, Trash2, Youtube, Type, ListTodo, Palette, Table, Calendar, ChevronLeft, ChevronRight, Layers, ArrowDown, Share2 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchEmbedMeta } from '../utils/embeds';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const typeIcons = {
  text: Type,
  tasks: ListTodo,
  paint: Palette,
  table: Table,
  image: ImageIcon,
  embed: Youtube,
};

const DatePicker: React.FC<{ value: string; onChange: (val: string) => void; disabled?: boolean }> = ({ value, onChange, disabled }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [viewDate, setViewDate] = React.useState(() => value ? new Date(value) : new Date());
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const handlePrevMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1));
  const handleNextMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1));

  const selectDate = (day: number) => {
    const selected = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    onChange(selected.toLocaleDateString('en-CA'));
    setIsOpen(false);
  };

  const isSelected = (day: number) => {
    if (!value) return false;
    const d = new Date(value);
    return d.getDate() === day && d.getMonth() === viewDate.getMonth() && d.getFullYear() === viewDate.getFullYear();
  };

  const isToday = (day: number) => {
    const today = new Date();
    return today.getDate() === day && today.getMonth() === viewDate.getMonth() && today.getFullYear() === viewDate.getFullYear();
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={cn(
          "w-full bg-[var(--bg-page)]/20 border border-white/10 rounded-xl p-3 text-xs outline-none focus:border-[var(--accent)] text-[var(--text-primary)] font-mono uppercase flex items-center justify-between group transition-all",
          disabled && "opacity-50 cursor-default"
        )}
      >
        <span>{value || "Pick a Date"}</span>
        <Calendar className="w-4 h-4 text-slate-500 group-hover:text-[var(--accent)] transition-colors" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="absolute top-full mt-2 left-0 right-0 z-[100] glass border border-white/10 rounded-2xl p-4 shadow-2xl overflow-hidden"
          >
            <div className="flex justify-between items-center mb-4">
              <button onClick={handlePrevMonth} className="p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <h4 className="text-[10px] font-black uppercase tracking-widest text-white">
                {monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}
              </h4>
              <button onClick={handleNextMonth} className="p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-1">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                <div key={d} className="text-center text-[8px] font-black uppercase text-slate-600 py-1">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDayOfMonth(viewDate.getFullYear(), viewDate.getMonth()) }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {Array.from({ length: daysInMonth(viewDate.getFullYear(), viewDate.getMonth()) }).map((_, i) => {
                const day = i + 1;
                return (
                  <button
                    key={day}
                    onClick={() => selectDate(day)}
                    className={cn(
                      "w-full aspect-square rounded-lg text-[9px] font-bold transition-all flex items-center justify-center border",
                      isSelected(day)
                        ? "bg-[var(--accent)] border-[var(--accent)] text-white shadow-[0_0_10px_var(--accent-glow)]"
                        : isToday(day)
                          ? "bg-white/10 border-white/20 text-white"
                          : "bg-transparent border-transparent text-slate-400 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 pt-3 border-t border-white/5 flex justify-between gap-2">
              <button
                onClick={() => { onChange(""); setIsOpen(false); }}
                className="flex-1 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[8px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-all"
              >
                Clear
              </button>
              <button
                onClick={() => { selectDate(new Date().getDate()); setViewDate(new Date()); }}
                className="flex-1 py-1.5 rounded-lg bg-[var(--accent)]/20 hover:bg-[var(--accent)]/30 text-[8px] font-black uppercase tracking-widest text-[var(--accent-secondary)] transition-all"
              >
                Today
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

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
  const bringToFront = useStore((state) => state.bringToFront);
  const sendToBack = useStore((state) => state.sendToBack);
  const isReadOnly = useStore((state) => state.isReadOnly);

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
          <div className="px-8 pt-8 pb-4">
            <div className="flex justify-between items-center">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-primary)] select-none">
                {isReadOnly ? 'Published Snapshot' : 'Thought Editor'}
              </h3>
              <button onClick={() => setInspectorOpen(false)} className="text-slate-500 hover:text-white relative z-10">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* SCROLLABLE CONTENT AREA */}
          <div className="flex-1 overflow-y-auto custom-scroll px-8 pb-8 max-h-[70vh]">
            <div className="grid grid-cols-6 gap-1 mb-6">
              {(['text', 'tasks', 'paint', 'table', 'image', 'embed'] as const).map((type) => {
                const Icon = typeIcons[type];
                return (
                  <button
                    key={type}
                    onClick={() => !isReadOnly && handleTypeChange(type)}
                    className={cn(
                      "p-2.5 rounded-xl flex flex-col items-center justify-center gap-1 transition-all border",
                      thought.type === type
                        ? "bg-[var(--accent)]/10 border-[var(--accent)] text-white shadow-[0_0_15px_rgba(99,102,241,0.2)]"
                        : "bg-white/[0.03] border-transparent text-slate-500 hover:bg-white/[0.06] hover:text-slate-300",
                      isReadOnly && thought.type !== type && "opacity-30 grayscale cursor-default"
                    )}
                    disabled={isReadOnly}
                    title={type.charAt(0).toUpperCase() + type.slice(1)}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-[7px] font-black uppercase tracking-tighter">{type === 'tasks' ? 'Task' : type}</span>
                  </button>
                );
              })}
            </div>

            <div className="space-y-5">
              <input
                type="text"
                readOnly={isReadOnly}
                value={localText}
                onChange={(e) => {
                  setLocalText(e.target.value);
                  updateThought(thought.id, { text: e.target.value });
                }}
                maxLength={100}
                className={cn(
                  "w-full bg-[var(--bg-page)]/20 border border-white/10 rounded-xl p-3 text-sm outline-none focus:border-[var(--accent)] text-[var(--text-primary)] placeholder:text-slate-500",
                  isReadOnly && "pointer-events-none opacity-80"
                )}
                placeholder={thought.placeholder || "Name"}
              />
              <textarea
                readOnly={isReadOnly}
                value={localDesc}
                onChange={(e) => {
                  setLocalDesc(e.target.value);
                  updateThought(thought.id, { description: e.target.value });
                }}
                rows={2}
                maxLength={150}
                className={cn(
                  "w-full bg-[var(--bg-page)]/20 border border-white/10 rounded-xl p-3 text-xs outline-none focus:border-[var(--accent)] text-[var(--text-primary)] placeholder:text-slate-500",
                  isReadOnly && "pointer-events-none opacity-80"
                )}
                placeholder="Description"
              />

              <DatePicker
                value={localDate}
                disabled={isReadOnly}
                onChange={(val) => {
                  setLocalDate(val);
                  updateThought(thought.id, { date: val });
                }}
              />

              <div className="space-y-2">
                <label className="text-[9px] uppercase font-bold tracking-widest text-slate-500 ml-1">Status</label>
                <div className="grid grid-cols-4 gap-1">
                  {(['none', 'todo', 'doing', 'done'] as const).map((s) => (
                    <button
                      key={s}
                      disabled={isReadOnly}
                      onClick={() => !isReadOnly && updateThought(thought.id, { status: s })}
                      className={cn(
                        "border rounded-lg py-2 text-[8px] font-bold uppercase transition-colors",
                        thought.status === s
                          ? {
                            'none': 'bg-white/10 border-white/30 text-white',
                            'todo': 'bg-[var(--status-todo)]/30 border-[var(--status-todo)] text-white',
                            'doing': 'bg-[var(--status-doing)]/30 border-[var(--status-doing)] text-white',
                            'done': 'bg-[var(--status-done)]/30 border-[var(--status-done)] text-white',
                          }[s]
                          : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10",
                        isReadOnly && thought.status !== s && "opacity-30 grayscale cursor-default"
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
                      disabled={isReadOnly}
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
                          : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10",
                        isReadOnly && thought.priority !== p && "opacity-30 grayscale cursor-default"
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
                  disabled={isReadOnly}
                  onChange={(e) => updateThought(thought.id, { size: parseFloat(e.target.value) })}
                  className={cn(
                    "w-full h-1.5 bg-white/5 rounded-lg appearance-none cursor-pointer accent-[var(--accent)]",
                    isReadOnly && "opacity-30 pointer-events-none"
                  )}
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
                                if (isReadOnly) return;
                                const newTasks = [...thought.tasks];
                                newTasks[i].done = !newTasks[i].done;
                                updateThought(thought.id, { tasks: newTasks });
                              }}
                            >
                              {task.done && <span className="text-white text-[12px] flex items-center justify-center">✓</span>}
                            </div>
                            <input
                              type="text"
                              readOnly={isReadOnly}
                              value={task.text}
                              onChange={(e) => {
                                const newTasks = [...thought.tasks];
                                newTasks[i].text = e.target.value;
                                updateThought(thought.id, { tasks: newTasks });
                              }}
                              className={cn(
                                "flex-1 bg-black/20 border border-white/5 rounded-xl p-2 text-xs outline-none text-white focus:border-[var(--accent)]",
                                isReadOnly && "pointer-events-none opacity-80"
                              )}
                            />
                            {!isReadOnly && (
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
                            )}
                          </div>
                        ))}
                      </div>
                      {!isReadOnly && (
                        <button
                          onClick={() => updateThought(thought.id, { tasks: [...thought.tasks, { text: 'Task', done: false }] })}
                          className="w-full py-2 border border-dashed border-white/10 rounded-xl text-[10px] uppercase font-bold text-slate-500 hover:text-white"
                        >
                          + Add Task
                        </button>
                      )}
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
                      className="w-full bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-[var(--accent-secondary)] py-6 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex flex-col items-center gap-3"
                    >
                      <Share2 className="w-5 h-5" />
                      Open Interaction Layer
                    </button>

                    <div className="space-y-2">
                      <label className="text-[9px] uppercase font-bold tracking-widest text-slate-500 ml-1">Universal URL</label>
                      <input
                        type="text"
                        readOnly={isReadOnly}
                        value={thought.content}
                        onChange={(e) => {
                          const newUrl = e.target.value;
                          updateThought(thought.id, { content: newUrl });

                          if (newUrl.startsWith('http')) {
                            // Fetch metadata for the new URL (Spotify, YT, etc)
                            fetchEmbedMeta(newUrl)
                              .then(metadata => {
                                if (metadata && metadata.title) {
                                  updateThought(thought.id, {
                                    text: metadata.title,
                                    author: metadata.author_name || "",
                                    description: metadata.description || ""
                                  });
                                }
                              })
                              .catch(err => {
                                console.warn("Embed metadata fetch failed:", err);
                              });
                          }
                        }}
                        placeholder="Paste Spotify, YouTube, X, or Reddit link..."
                        className={cn(
                          "w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs outline-none focus:border-[var(--accent)] text-white",
                          isReadOnly && "opacity-50 pointer-events-none"
                        )}
                      />
                    </div>
                  </div>
                )}

                {thought.type === 'image' && (
                  <div className="space-y-3">
                    {!isReadOnly && (
                      <div className="border border-dashed border-white/10 rounded-xl p-4 text-center hover:bg-white/5 transition-colors cursor-pointer relative">
                        <input
                          type="file"
                          accept="image/*"
                          className="absolute inset-0 opacity-0 cursor-pointer"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              if (file.size > 2 * 1024 * 1024) {
                                useModalStore.getState().openModal({
                                  title: 'Incompatible Mass',
                                  description: 'This file exceeds the 2MB transmission limit. Compress your assets before uploading to cloud storage.',
                                  type: 'alert',
                                  confirmText: 'Understood'
                                });
                                return;
                              }
                              const reader = new FileReader();
                              reader.onload = (ev) => updateThought(thought.id, { image: ev.target?.result as string });
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                        <ImageIcon className="w-6 h-6 mx-auto text-slate-500 mb-2" />
                        <p className="text-[9px] text-slate-400 uppercase font-bold tracking-widest">Upload or Drag Image</p>
                      </div>
                    )}
                    {!isReadOnly && (
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
                    )}
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
                        readOnly={isReadOnly}
                        value={localStackName}
                        onChange={(e) => {
                          setLocalStackName(e.target.value);
                          updateStack(stack.id, { name: e.target.value });
                        }}
                        className={cn(
                          "bg-transparent text-[10px] font-black uppercase tracking-widest text-white outline-none flex-1",
                          isReadOnly && "pointer-events-none"
                        )}
                        placeholder="Stack Name"
                      />
                    </div>
                    {!isReadOnly && (
                      <button
                        onClick={() => unlinkSelectedThoughts()}
                        className="w-full py-2 bg-white/5 hover:bg-red-500/10 text-slate-400 hover:text-red-400 border border-white/5 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all"
                      >
                        Remove from Stack
                      </button>
                    )}
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
                            <div key={s.id} className="relative group/s">
                              <button
                                onClick={() => updateThought(thought.id, { stackId: s.id })}
                                className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-transparent hover:border-white/5 transition-all"
                              >
                                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color, boxShadow: `0 0 8px ${s.color}44` }} />
                                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 group-hover/s:text-white transition-colors">{s.name}</span>
                              </button>
                              {!isReadOnly && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openModal({
                                      title: 'Dissolve Stack?',
                                      description: `This will unlink all thoughts from "${s.name}".`,
                                      type: 'delete_stack',
                                      confirmText: 'Dissolve',
                                      onConfirm: () => useStore.getState().deleteStack(s.id)
                                    });
                                  }}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-600 hover:text-red-400 opacity-0 group-hover/s:opacity-100 transition-all"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-[9px] uppercase font-bold tracking-widest text-slate-500 ml-1">Layering</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    disabled={isReadOnly}
                    onClick={() => !isReadOnly && bringToFront(thought.id)}
                    className={cn(
                      "flex items-center justify-center gap-2 py-2.5 bg-white/5 border border-white/10 rounded-xl text-[8px] font-black uppercase tracking-widest text-slate-300 hover:bg-white/10 hover:text-white transition-all",
                      isReadOnly && "opacity-30 cursor-default"
                    )}
                  >
                    <Layers className="w-3 h-3" /> Bring to Front
                  </button>
                  <button
                    disabled={isReadOnly}
                    onClick={() => !isReadOnly && sendToBack(thought.id)}
                    className={cn(
                      "flex items-center justify-center gap-2 py-2.5 bg-white/5 border border-white/10 rounded-xl text-[8px] font-black uppercase tracking-widest text-slate-300 hover:bg-white/10 hover:text-white transition-all",
                      isReadOnly && "opacity-30 cursor-default"
                    )}
                  >
                    <ArrowDown className="w-3 h-3" /> Send to Back
                  </button>
                </div>
              </div>

              {!isReadOnly && (
                <button
                  onClick={handleDeleteThought}
                  className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 py-4 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-colors"
                >
                  Delete Thought
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Inspector;
