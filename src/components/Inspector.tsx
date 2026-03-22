import React from 'react';
import { getThoughtConfig } from './thought/registry';
import { useStore } from '../store/useStore';
import { useModalStore } from '../store/useModalStore';
import type { ThoughtType } from '../db';
import { 
  X, ChevronLeft, ChevronRight, Calendar, ArrowUp, ArrowDown, Save, Maximize2, Trash2, Palette
} from 'lucide-react';
import { STACK_COLORS } from '../constants';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence } from 'framer-motion';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const ColorPicker: React.FC<{ value: string; onChange: (val: string) => void; disabled?: boolean }> = ({ value, onChange, disabled }) => {
  const [isOpen, setIsOpen] = React.useState(false);
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

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={cn(
          "w-8 h-8 rounded-full border border-white/20 transition-all flex items-center justify-center group relative overflow-hidden",
          disabled && "opacity-50 cursor-default"
        )}
        style={{ backgroundColor: value, boxShadow: `0 0 15px ${value}44` }}
      >
        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Palette className="w-3 h-3 text-white" />
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute bottom-full mb-3 left-0 z-[100] glass border border-[var(--glass-border)] rounded-2xl p-3 shadow-2xl min-w-[180px]"
          >
                          <div className="grid grid-cols-4 gap-2 mb-3">
                            {STACK_COLORS.map(color => (
                              <button
                                key={color}
                                onClick={() => { onChange(color); setIsOpen(false); }}
                                className={cn(
                                  "w-8 h-8 rounded-lg border-2 transition-all hover:scale-110",
                                  value === color ? "border-[var(--text-primary)]" : "border-transparent"
                                )}
                                style={{ backgroundColor: color }}
                              />
                            ))}
                          </div>
                          <div className="relative pt-2 border-t border-[var(--glass-border)]">
                            <input 
                              type="color" 
                              value={value.startsWith('#') ? value : '#6366f1'} 
                              onChange={(e) => onChange(e.target.value)}
                              className="w-full h-8 bg-transparent cursor-pointer rounded-lg overflow-hidden"
                            />
                            <p className="text-[7px] font-black uppercase tracking-widest text-[var(--text-muted)] mt-1 text-center">Custom Hex</p>
                          </div>
            <div className="relative pt-2 border-t border-[var(--glass-border)]">
              <input 
                type="color" 
                value={value.startsWith('#') ? value : '#6366f1'} 
                onChange={(e) => onChange(e.target.value)}
                className="w-full h-8 bg-transparent cursor-pointer rounded-lg overflow-hidden"
              />
              <p className="text-[7px] font-black uppercase tracking-widest text-slate-500 mt-1 text-center">Custom Hex</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
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
          "w-full bg-[var(--bg-page)]/20 border border-[var(--glass-border)] rounded-xl p-3 text-xs outline-none focus:border-[var(--accent)] text-[var(--text-primary)] font-mono uppercase flex items-center justify-between group transition-all",
          disabled && "opacity-50 cursor-default"
        )}
      >
        <span className="flex-1 text-center">{value || "Pick a Date"}</span>
        <Calendar className="w-4 h-4 text-slate-500 group-hover:text-[var(--accent)] transition-colors" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="absolute top-full mt-2 left-0 right-0 z-[100] glass border border-[var(--glass-border)] rounded-2xl p-4 shadow-2xl overflow-hidden"
          >
            <div className="flex justify-between items-center mb-4">
              <button onClick={handlePrevMonth} className="p-1 hover:bg-[var(--glass-border)] rounded-lg text-slate-400 hover:text-white transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <h4 className="text-[10px] font-black uppercase tracking-widest text-white">
                {monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}
              </h4>
              <button onClick={handleNextMonth} className="p-1 hover:bg-[var(--glass-border)] rounded-lg text-slate-400 hover:text-white transition-colors">
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
                          ? "bg-[var(--glass-border)] border-white/20 text-white"
                          : "bg-transparent border-transparent text-slate-400 hover:bg-[var(--glass-border)] hover:text-white"
                    )}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 pt-3 border-t border-[var(--glass-border)] flex justify-between gap-2">
              <button
                onClick={() => { onChange(""); setIsOpen(false); }}
                className="flex-1 py-1.5 rounded-lg bg-[var(--glass-border)] hover:bg-[var(--glass-border)] text-[8px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-all"
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
  const setActiveFocus = useStore((state) => state.setActiveFocus);
  const unlinkSelectedThoughts = useStore((state) => state.unlinkSelectedThoughts);
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
  const [pendingType, setPendingType] = React.useState<ThoughtType | null>(null);
  const [activeTab, setActiveTab] = React.useState<'content' | 'status' | 'layout'>('content');

  const titleInputRef = React.useRef<HTMLInputElement>(null);

  // Sync local state when selected thought changes
  React.useEffect(() => {
    if (thought) {
      setLocalText(thought.text || '');
      setLocalDesc(thought.description || '');
      setLocalDate(thought.date || '');
      setPendingType(null);
    }
    if (stack) {
      setLocalStackName(stack.name || '');
    }
  }, [selectedThoughtId, stack?.id]);

  // Auto-focus title input when new thought is created
  React.useEffect(() => {
    const focusId = useStore.getState().inspectorTitleFocusId;
    if (focusId && focusId === selectedThoughtId && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
      useStore.getState().setInspectorTitleFocusId(null);
    }
  }, [selectedThoughtId]);

  const handleDeleteThought = () => {
    if (!thought) return;
    openModal({
      title: 'Delete Thought?',
      description: 'This action cannot be undone.',
      type: 'delete_thought',
      confirmText: 'Delete',
      onConfirm: () => {
        deleteThought(thought.id);
        setInspectorOpen(false);
      }
    });
  };

  const handleTypeChange = (type: any) => {
    if (isReadOnly || !thought) return;
    const config = getThoughtConfig(type);
    const payload = config?.createPayload();
    updateThought(thought.id, { type, data: payload });
  };

  const handlePriorityChange = (priority: 'none' | 'low' | 'medium' | 'high' | 'urgent') => {
    if (isReadOnly || !thought) return;
    updateThought(thought.id, { priority });
  };

  const config = thought ? getThoughtConfig(thought.type) : null;
  const InspectorPanel = config?.inspectorPanel;

  return (
    <AnimatePresence>
      {isInspectorOpen && thought && (
        <motion.div
          id="inspector"
          initial={{ x: '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 200 }}
          className="ui-layer focus-box fixed top-4 md:top-24 bottom-4 md:bottom-24 right-4 md:right-8 w-[calc(100%-32px)] md:w-[400px] glass rounded-2xl shadow-[0_0_80px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden z-[9999] border border-[var(--glass-border)]"
        >
          {/* HEADER AREA */}
          <div className="p-4 md:p-5 border-b border-[var(--glass-border)] bg-[var(--bg-main)]/20 backdrop-blur-md sticky top-0 z-20">
            <div className="flex justify-between items-center relative">
              <div className="w-8" /> {/* Spacer to help center */}
              <div className="flex-1 flex justify-center">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[var(--text-primary)] leading-none">
                  {isReadOnly ? 'Published' : 'Editor'}
                </h3>
              </div>
              <button onClick={() => setInspectorOpen(false)} className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* TAB NAVIGATION */}
          <div className="flex bg-[var(--bg-main)]/10 backdrop-blur-sm sticky top-[61px] md:top-[69px] z-20 border-b border-[var(--glass-border)]">
            {(['content', 'status', 'layout'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "flex-1 py-4 text-[10px] font-black uppercase tracking-[0.2em] relative transition-all duration-300",
                  activeTab === tab ? "text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                )}
              >
                {tab}
                {activeTab === tab && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent)] shadow-[0_0_10px_var(--accent-glow)]"
                    initial={false}
                  />
                )}
              </button>
            ))}
          </div>

          {/* SCROLLABLE CONTENT AREA */}
          <div className="flex-1 overflow-y-auto custom-scroll scrollbar-none">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="p-4 md:p-6 space-y-8"
              >
                {activeTab === 'content' && (
                  <div className="space-y-6">
                    {thought.type !== 'file' && (
                      <div className="space-y-2">
                        <div className="grid grid-cols-3 gap-2">
                          {(['label', 'text', 'tasks', 'table', 'paint', 'embed'] as const)
                            .map((type) => {
                              const tConfig = getThoughtConfig(type);
                              const isActive = (pendingType || thought.type) === type;
                              return (
                                <button
                                  key={type}
                                  onClick={() => setPendingType(type)}
                                  className={cn(
                                    "p-3 rounded-xl flex flex-col items-center justify-center transition-all border gap-1.5",
                                    isActive
                                      ? "bg-[var(--accent)]/10 border-[var(--accent)] text-[var(--text-primary)] shadow-[0_0_15px_var(--accent-glow)]"
                                      : "bg-white/[0.03] border-transparent text-[var(--text-muted)] hover:bg-white/[0.06] hover:text-[var(--text-primary)]",
                                    isReadOnly && thought.type !== type && "opacity-30 grayscale cursor-default"
                                  )}
                                  disabled={isReadOnly}
                                  title={tConfig?.label || type}
                                >
                                  {tConfig?.icon && <tConfig.icon className="w-3.5 h-3.5" />}
                                  <span className="text-[7px] font-black uppercase tracking-tighter">{type === 'tasks' ? 'Task' : type}</span>
                                </button>
                              );
                            })}
                        </div>
                        
                        <button
                          onClick={() => {
                            if (pendingType) {
                              handleTypeChange(pendingType);
                              setPendingType(null);
                            }
                          }}
                          disabled={!(pendingType !== null && pendingType !== thought.type)}
                          className={cn(
                            "w-full p-3 rounded-xl flex items-center justify-center gap-2 transition-all border",
                            (pendingType !== null && pendingType !== thought.type)
                              ? "bg-[var(--accent)] border-[var(--accent)] text-[var(--accent-contrast)] shadow-[0_0_20px_var(--accent-glow)] scale-100 opacity-100 font-black"
                              : "bg-[var(--bg-main)]/20 border-[var(--glass-border)] text-[var(--text-muted)] scale-95 opacity-30 cursor-default"
                          )}
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span className="text-[8px] font-black uppercase tracking-widest">Save Change</span>
                        </button>
                      </div>
                    )}

                    <div className="space-y-5">
                      <div className="space-y-2">
                        <label className="text-[9px] uppercase font-black tracking-widest text-[var(--text-muted)] ml-1">Name</label>
                        <input
                          ref={titleInputRef}
                          type="text"
                          readOnly={isReadOnly}
                          value={localText}
                          onChange={(e) => {
                            setLocalText(e.target.value);
                            updateThought(thought.id, { text: e.target.value });
                          }}
                          maxLength={100}
                          className={cn(
                            "w-full bg-[var(--bg-page)]/20 border border-[var(--glass-border)] rounded-xl p-3 text-sm outline-none focus:border-[var(--accent)] text-[var(--text-primary)] placeholder:text-slate-500",
                            isReadOnly && "pointer-events-none opacity-80"
                          )}
                          placeholder={"Name"}
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[9px] uppercase font-black tracking-widest text-[var(--text-muted)] ml-1">Note</label>
                        <textarea
                          readOnly={isReadOnly}
                          value={localDesc}
                          onChange={(e) => {
                            setLocalDesc(e.target.value);
                            updateThought(thought.id, { description: e.target.value });
                          }}
                          rows={4}
                          maxLength={150}
                          className={cn(
                            "w-full bg-[var(--bg-page)]/20 border border-[var(--glass-border)] rounded-xl p-3 text-xs outline-none focus:border-[var(--accent)] text-[var(--text-primary)] placeholder:text-slate-500",
                            isReadOnly && "pointer-events-none opacity-80"
                          )}
                          placeholder="Note"
                        />
                      </div>
                    </div>

                    {/* Modular Panel Extension */}
                    {InspectorPanel && (
                      <div className="pt-6 border-t border-[var(--glass-border)]">
                        <InspectorPanel thought={thought} isReadOnly={isReadOnly} />
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'status' && (
                  <div className="space-y-8">
                    <div className="space-y-3">
                      <label className="text-[9px] uppercase font-black tracking-widest text-[var(--text-muted)] ml-1">Date</label>
                      <DatePicker
                        value={localDate}
                        disabled={isReadOnly}
                        onChange={(val) => {
                          setLocalDate(val);
                          updateThought(thought.id, { date: val });
                        }}
                      />
                    </div>

                    <div className="space-y-3">
                      <label className="text-[9px] uppercase font-black tracking-widest text-[var(--text-muted)] ml-1">Progress</label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {(['none', 'todo', 'doing', 'done'] as const).map((s) => (
                          <button
                            key={s}
                            disabled={isReadOnly}
                            onClick={() => !isReadOnly && updateThought(thought.id, { status: s })}
                            className={cn(
                              "border rounded-xl py-2.5 text-[9px] font-black uppercase tracking-[0.2em] transition-all",
                              thought.status === s
                                ? {
                                  'none': 'bg-[var(--glass-border)] border-white/30 text-[var(--text-primary)] shadow-lg',
                                  'todo': 'bg-[var(--status-todo)]/10 border-[var(--status-todo)] text-[var(--status-todo)] shadow-[0_0_15px_rgba(99,102,241,0.1)]',
                                  'doing': 'bg-[var(--status-doing)]/10 border-[var(--status-doing)] text-[var(--status-doing)] shadow-[0_0_15px_rgba(234,179,8,0.1)]',
                                  'done': 'bg-[var(--status-done)]/10 border-[var(--status-done)] text-[var(--status-done)] shadow-[0_0_15px_rgba(34,197,94,0.1)]',
                                }[s]
                                : "bg-white/[0.03] border-[var(--glass-border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-border)] hover:border-white/20",
                              isReadOnly && thought.status !== s && "opacity-30 grayscale cursor-default"
                            )}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[9px] uppercase font-black tracking-widest text-[var(--text-muted)] ml-1">Priority</label>
                      <div className="grid grid-cols-5 gap-1.5">
                        {(['none', 'low', 'medium', 'high', 'urgent'] as const).map((p) => (
                          <button
                            key={p}
                            disabled={isReadOnly}
                            onClick={() => handlePriorityChange(p)}
                            className={cn(
                              "border rounded-xl py-2.5 text-[9px] font-black uppercase tracking-[0.2em] transition-all",
                              thought.priority === p
                                ? {
                                  'none': 'bg-[var(--glass-border)] border-white/30 text-[var(--text-primary)] shadow-lg',
                                  'low': 'bg-[var(--prio-low)]/10 border-[var(--prio-low)] text-[var(--prio-low)] shadow-[0_0_15px_rgba(148,163,184,0.1)]',
                                  'medium': 'bg-[var(--prio-medium)]/10 border-[var(--prio-medium)] text-[var(--prio-medium)] shadow-[0_0_15px_rgba(168,85,247,0.1)]',
                                  'high': 'bg-[var(--prio-high)]/10 border-[var(--prio-high)] text-[var(--prio-high)] shadow-[0_0_15px_rgba(245,158,11,0.1)]',
                                  'urgent': 'bg-[var(--prio-urgent)]/10 border-[var(--prio-urgent)] text-[var(--prio-urgent)] shadow-[0_0_15px_rgba(239,68,68,0.1)]',
                                }[p]
                                : "bg-white/[0.03] border-[var(--glass-border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-border)] hover:border-white/20",
                              isReadOnly && thought.priority !== p && "opacity-30 grayscale cursor-default"
                            )}
                          >
                            {p === 'medium' ? 'Med' : p[0].toUpperCase() + p.slice(1, 3)}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3 pt-6 border-t border-[var(--glass-border)]">
                      <div className="flex items-center mb-2 px-1">
                        <span className="text-[9px] uppercase font-black tracking-widest text-[var(--text-primary)]">Group</span>
                      </div>

                      {stack ? (
                        <div className="p-4 bg-[var(--bg-page)]/20 border border-[var(--glass-border)] rounded-2xl space-y-4">
                          <div className="flex items-center gap-3">
                            <ColorPicker 
                              value={stack.color} 
                              disabled={isReadOnly}
                              onChange={(color) => updateStack(stack.id, { color })} 
                            />
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
                              placeholder="Group Name"
                            />
                          </div>
                          {!isReadOnly && (
                            <button
                              onClick={() => unlinkSelectedThoughts()}
                              className="w-full py-2.5 bg-red-500/5 hover:bg-red-500/10 text-red-400/80 hover:text-red-400 border border-red-500/10 hover:border-red-500/20 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] transition-all"
                            >
                              Remove
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
                              className="w-full bg-[var(--bg-page)]/20 border border-[var(--glass-border)] rounded-xl p-3 text-xs outline-none focus:border-[var(--accent)] text-[var(--text-primary)] placeholder:text-slate-500 transition-all"
                            />
                          </div>

                          {stacks.length > 0 && (
                            <div className="space-y-1.5">
                              <label className="text-[7px] uppercase font-black tracking-[0.2em] text-slate-600 ml-1">Groups</label>
                              <div className="flex flex-col gap-1 max-h-[160px] overflow-y-auto custom-scroll pr-1">
                                {stacks.map(s => (
                                  <div key={s.id} className="relative group/s">
                                    <button
                                      onClick={() => updateThought(thought.id, { stackId: s.id })}
                                      className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-transparent hover:border-[var(--glass-border)] transition-all"
                                    >
                                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color, boxShadow: `0 0 8px ${s.color}44` }} />
                                      <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 group-hover/s:text-white transition-colors">{s.name}</span>
                                    </button>
                                    {!isReadOnly && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            openModal({
                                              title: 'Dissolve Group?',
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
                  </div>
                )}

                {activeTab === 'layout' && (
                  <div className="space-y-8">
                    <div className="space-y-4">
                      <div className="flex justify-between items-center ml-1">
                        <label className="text-[9px] uppercase font-bold tracking-widest text-slate-500">Scale</label>
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
                          "w-full h-1.5 bg-[var(--glass-border)] rounded-lg appearance-none cursor-pointer accent-[var(--accent)]",
                          isReadOnly && "opacity-30 pointer-events-none"
                        )}
                      />
                    </div>

                    <div className="space-y-3 pt-6 border-t border-[var(--glass-border)]">
                      <div className="flex items-center mb-2 px-1">
                        <span className="text-[9px] uppercase font-black tracking-widest text-white">Layers</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          disabled={isReadOnly}
                          onClick={() => !isReadOnly && bringToFront(thought.id)}
                          className={cn(
                            "flex items-center justify-center gap-2 py-3 bg-[var(--glass-border)] border border-[var(--glass-border)] rounded-xl text-[8px] font-black uppercase tracking-widest text-slate-300 hover:bg-[var(--glass-border)] hover:text-white transition-all",
                            isReadOnly && "opacity-30 cursor-default"
                          )}
                        >
                          <ArrowUp className="w-3 h-3" />
                          Bring to Front
                        </button>
                        <button
                          disabled={isReadOnly}
                          onClick={() => !isReadOnly && sendToBack(thought.id)}
                          className={cn(
                            "flex items-center justify-center gap-2 py-3 bg-[var(--glass-border)] border border-[var(--glass-border)] rounded-xl text-[8px] font-black uppercase tracking-widest text-slate-300 hover:bg-[var(--glass-border)] hover:text-white transition-all",
                            isReadOnly && "opacity-30 cursor-default"
                          )}
                        >
                          <ArrowDown className="w-3 h-3" />
                          Send to Back
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* STICKY FOOTER */}
          {!isReadOnly && (
            <div className="bg-[var(--bg-main)]/40 border-t border-[var(--glass-border)] p-4 md:p-6 mt-auto flex items-center gap-3">
              <button
                onClick={handleDeleteThought}
                className="flex-1 bg-red-500/5 hover:bg-red-500/10 text-red-400 py-3.5 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] transition-all border border-red-500/20 hover:border-red-500/40 flex items-center justify-center gap-2.5 group"
              >
                <Trash2 className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                <span>DELETE</span>
              </button>
              {thought.type !== 'label' && (
                <button
                  onClick={() => {
                    const triggers: Record<string, string> = {
                      text: 'text', tasks: 'tasks', table: 'table', paint: 'paint', embed: 'embed', file: 'file', image: 'file'
                    };
                    const focusType = (triggers[thought.type] || 'text') as any;
                    setActiveFocus(thought.id, focusType);
                  }}
                  className="flex-1 bg-[var(--accent)]/5 hover:bg-[var(--accent)]/10 border border-[var(--accent)]/20 hover:border-[var(--accent)]/50 text-[var(--accent-secondary)] py-3.5 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2.5 shadow-lg shadow-[var(--accent-glow)]/5 group"
                >
                  <Maximize2 className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                  <span>OPEN</span>
                </button>
              )}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Inspector;
