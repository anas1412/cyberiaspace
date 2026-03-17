import React from 'react';
import { useStore } from '../store/useStore';
import { useModalStore } from '../store/useModalStore';
import { X, Trash2, Calendar, ChevronLeft, ChevronRight, Palette } from 'lucide-react';
import { STACK_COLORS } from '../constants';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

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
                    value === color ? "border-white" : "border-transparent"
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
              <p className="text-[7px] font-black uppercase tracking-widest text-slate-500 mt-1 text-center">Custom Hex</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const BatchDatePicker: React.FC<{ onSelect: (val: string) => void }> = ({ onSelect }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [viewDate, setViewDate] = React.useState(new Date());
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

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-[var(--bg-page)]/20 border border-[var(--glass-border)] rounded-xl p-3 text-[10px] font-black uppercase tracking-widest text-[var(--text-dimmed)] hover:text-[var(--text-primary)] flex items-center justify-between transition-all group"
      >
        <span>Set Batch Date</span>
        <Calendar className="w-3.5 h-3.5 text-slate-500 group-hover:text-[var(--accent)] transition-colors" />
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
              <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1))} className="p-1 hover:bg-[var(--glass-border)] rounded-lg text-slate-400">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <h4 className="text-[9px] font-black uppercase tracking-widest text-[var(--text-primary)]">{monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}</h4>
              <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1))} className="p-1 hover:bg-[var(--glass-border)] rounded-lg text-slate-400">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDayOfMonth(viewDate.getFullYear(), viewDate.getMonth()) }).map((_, i) => <div key={i} />)}
              {Array.from({ length: daysInMonth(viewDate.getFullYear(), viewDate.getMonth()) }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => { onSelect(new Date(viewDate.getFullYear(), viewDate.getMonth(), i + 1).toLocaleDateString('en-CA')); setIsOpen(false); }}
                  className="w-full aspect-square rounded-lg text-[9px] font-bold text-slate-400 hover:bg-[var(--accent)]/20 hover:text-[var(--text-primary)] transition-all"
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <button 
              onClick={() => { onSelect(""); setIsOpen(false); }} 
              className="w-full mt-4 py-2 bg-[var(--bg-main)]/20 border border-[var(--glass-border)] rounded-lg text-[8px] font-black uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all"
            >
              Unschedule All
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const MultiSelectionMenu: React.FC = () => {
  const selectedThoughtIds = useStore((state) => state.selectedThoughtIds);
  const isReadOnly = useStore((state) => state.isReadOnly);
  const clearSelection = useStore((state) => state.clearSelection);
  const updateThoughts = useStore((state) => state.updateThoughts);
  const linkSelectedThoughts = useStore((state) => state.linkSelectedThoughts);
  const unlinkSelectedThoughts = useStore((state) => state.unlinkSelectedThoughts);
  const deleteSelectedThoughts = useStore((state) => state.deleteSelectedThoughts);
  const thoughts = useStore((state) => state.thoughts);
  const stacks = useStore((state) => state.stacks);
  const isInspectorOpen = useStore((state) => state.isInspectorOpen);

  const isChatOpen = useStore((state) => state.isChatOpen);

  const { openModal } = useModalStore();
  const isMobile = typeof window !== 'undefined' ? window.innerWidth < 768 : false;

  const sharedStack = React.useMemo(() => {
    if (!selectedThoughtIds || selectedThoughtIds.length < 2) return null;
    const selectedThoughts = thoughts.filter(t => selectedThoughtIds.includes(t.id));
    const firstStackId = selectedThoughts[0]?.stackId;
    if (!firstStackId) return null;
    return selectedThoughts.every(t => t.stackId === firstStackId) ? stacks.find(s => s.id === firstStackId) || null : null;
  }, [selectedThoughtIds, thoughts, stacks]);

  const [localStackName, setLocalStackName] = React.useState('');
  React.useEffect(() => setLocalStackName(sharedStack?.name || ''), [sharedStack]);

  const sharedStatus = React.useMemo(() => {
    if (!selectedThoughtIds || selectedThoughtIds.length === 0) return null;
    const selected = thoughts.filter(t => selectedThoughtIds.includes(t.id));
    const first = selected[0]?.status;
    return selected.every(t => t.status === first) ? first : null;
  }, [selectedThoughtIds, thoughts]);

  const sharedPriority = React.useMemo(() => {
    if (!selectedThoughtIds || selectedThoughtIds.length === 0) return null;
    const selected = thoughts.filter(t => selectedThoughtIds.includes(t.id));
    const first = selected[0]?.priority;
    return selected.every(t => t.priority === first) ? first : null;
  }, [selectedThoughtIds, thoughts]);

  const showMenu = selectedThoughtIds && selectedThoughtIds.length >= 2 && !isReadOnly;

  return (
    <AnimatePresence>
      {showMenu && (
        <motion.div
          initial={isMobile ? { y: '100%' } : { x: '100%', opacity: 0 }}
          animate={isMobile ? (isInspectorOpen || isChatOpen ? { y: '100%', opacity: 0 } : { y: 0, opacity: 1 }) : { x: 0, opacity: 1 }}
          exit={isMobile ? { y: '100%' } : { x: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 200 }}
          className="ui-layer focus-box fixed top-4 md:top-24 bottom-4 md:bottom-24 right-4 md:right-8 w-[calc(100%-32px)] md:w-[400px] glass rounded-2xl shadow-[0_0_80px_rgba(0,0,0,0.5)] pointer-events-auto z-[9999] border border-[var(--glass-border)] flex flex-col overflow-hidden"
        >
          {/* MATCHING HEADER STYLE */}
          <div className="p-4 md:p-5 border-b border-[var(--glass-border)] bg-[var(--bg-main)]/20 backdrop-blur-md sticky top-0 z-20">
            <div className="flex justify-between items-center relative">
              <div className="w-8" /> {/* Spacer to help center */}
              <div className="flex-1 flex flex-col items-center">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[var(--text-primary)] leading-none">Selection</h3>
                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest leading-none mt-1">{selectedThoughtIds.length} Items Selected</span>
              </div>
              <button onClick={clearSelection} className="p-2 hover:bg-[var(--glass-border)] rounded-lg text-slate-400 transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scroll p-4 md:p-6 space-y-6">
            {/* 1. Status Batch */}
            <div className="space-y-3">
              <label className="text-[9px] uppercase font-black tracking-widest text-[var(--text-muted)] ml-1">Progress</label>
              <div className="grid grid-cols-4 gap-1.5">
                {(['none', 'todo', 'doing', 'done'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => updateThoughts(selectedThoughtIds, { status: s })}
                    className={cn(
                      "py-2.5 rounded-xl border text-[9px] font-black uppercase tracking-[0.2em] transition-all",
                      sharedStatus === s
                        ? {
                          'none': 'bg-[var(--glass-border)] border-white/30 text-[var(--text-primary)] shadow-lg',
                          'todo': 'bg-[var(--status-todo)]/10 border-[var(--status-todo)] text-[var(--status-todo)] shadow-[0_0_15px_rgba(99,102,241,0.1)]',
                          'doing': 'bg-[var(--status-doing)]/10 border-[var(--status-doing)] text-[var(--status-doing)] shadow-[0_0_15px_rgba(234,179,8,0.1)]',
                          'done': 'bg-[var(--status-done)]/10 border-[var(--status-done)] text-[var(--status-done)] shadow-[0_0_15px_rgba(34,197,94,0.1)]',
                        }[s]
                        : "bg-white/[0.03] border-[var(--glass-border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-border)] hover:border-white/20"
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Priority Batch */}
            <div className="space-y-3">
              <label className="text-[9px] uppercase font-black tracking-widest text-[var(--text-muted)] ml-1">Priority</label>
              <div className="grid grid-cols-5 gap-1.5">
                {(['none', 'low', 'medium', 'high', 'urgent'] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => updateThoughts(selectedThoughtIds, { priority: p })}
                    className={cn(
                      "py-2.5 rounded-xl border text-[9px] font-black uppercase tracking-[0.2em] transition-all",
                      sharedPriority === p
                        ? {
                          'none': 'bg-[var(--glass-border)] border-white/30 text-[var(--text-primary)] shadow-lg',
                          'low': 'bg-[var(--prio-low)]/10 border-[var(--prio-low)] text-[var(--prio-low)] shadow-[0_0_15px_rgba(148,163,184,0.1)]',
                          'medium': 'bg-[var(--prio-medium)]/10 border-[var(--prio-medium)] text-[var(--prio-medium)] shadow-[0_0_15px_rgba(168,85,247,0.1)]',
                          'high': 'bg-[var(--prio-high)]/10 border-[var(--prio-high)] text-[var(--prio-high)] shadow-[0_0_15px_rgba(245,158,11,0.1)]',
                          'urgent': 'bg-[var(--prio-urgent)]/10 border-[var(--prio-urgent)] text-[var(--prio-urgent)] shadow-[0_0_15px_rgba(239,68,68,0.1)]',
                        }[p]
                        : "bg-white/[0.03] border-[var(--glass-border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-border)] hover:border-white/20"
                    )}
                  >
                    {p === 'medium' ? 'Med' : p[0].toUpperCase() + p.slice(1, 3)}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Date Batch */}
            <div className="space-y-3">
              <label className="text-[9px] uppercase font-black tracking-widest text-[var(--text-muted)] ml-1">Date</label>
              <BatchDatePicker onSelect={(date) => updateThoughts(selectedThoughtIds, { date })} />
            </div>

            {/* 4. Stack Management */}
            <div className="space-y-3 pt-4 border-t border-[var(--glass-border)]">
              <label className="text-[9px] uppercase font-black tracking-widest text-[var(--text-muted)] ml-1">Group</label>
              <div className="p-4 bg-[var(--bg-page)]/20 border border-[var(--glass-border)] rounded-2xl space-y-4">
                <div className="flex items-center gap-3">
                  {sharedStack ? (
                    <ColorPicker 
                      value={sharedStack.color} 
                      onChange={(color) => useStore.getState().updateStack(sharedStack.id, { color })} 
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full border border-[var(--glass-border)] bg-[var(--glass-border)] flex items-center justify-center">
                      <Palette className="w-3.5 h-3.5 text-slate-600" />
                    </div>
                  )}
                  <input
                    type="text"
                    value={localStackName}
                    onChange={(e) => setLocalStackName(e.target.value)}
                    placeholder="Name your group..."
                    className="bg-transparent text-[10px] font-black uppercase tracking-widest text-[var(--text-primary)] outline-none flex-1"
                  />
                </div>
                <button
                  onClick={async () => {
                    if (sharedStack && localStackName.trim() !== sharedStack.name) {
                      await linkSelectedThoughts(localStackName.trim());
                    } else if (!sharedStack) {
                      await linkSelectedThoughts(localStackName.trim());
                    }
                  }}
                  disabled={!!sharedStack && localStackName.trim() === sharedStack.name}
                  className="w-full py-3 bg-[var(--accent)]/5 hover:bg-[var(--accent)]/10 border border-[var(--accent)]/20 hover:border-[var(--accent)]/50 text-[var(--accent-secondary)] rounded-xl text-[9px] font-black uppercase tracking-[0.2em] transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-[var(--accent-glow)]/5"
                >
                  <span>{sharedStack ? 'RENAME' : 'LINK'}</span>
                </button>

                {stacks.length > 0 && !sharedStack && (
                  <div className="space-y-1.5 pt-2">
                    <label className="text-[7px] uppercase font-black tracking-[0.2em] text-slate-600 ml-1">Add to Existing</label>
                    <div className="flex flex-col gap-1.5 max-h-[160px] overflow-y-auto custom-scroll pr-1">
                      {stacks.map(s => (
                        <button
                          key={s.id}
                          onClick={() => updateThoughts(selectedThoughtIds, { stackId: s.id })}
                          className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-transparent hover:border-[var(--glass-border)] transition-all text-left group/btn"
                        >
                          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color, boxShadow: `0 0 8px ${s.color}44` }} />
                          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] group-hover/btn:text-[var(--text-primary)] transition-colors">{s.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {sharedStack && (
                  <button 
                    onClick={unlinkSelectedThoughts} 
                    className="w-full py-2.5 bg-red-500/5 hover:bg-red-500/10 text-red-400 border border-red-500/20 hover:border-red-500/40 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] transition-all"
                  >
                    <span>DISSOLVE</span>
                  </button>
                )}
              </div>
            </div>

          </div>

          {/* FOOTER ACTIONS */}
          <div className="p-4 md:p-6 bg-[var(--bg-main)]/40 border-t border-[var(--glass-border)] mt-auto">
            <button
              onClick={() => openModal({ title: `Delete ${selectedThoughtIds.length} Nodes?`, description: 'This action is permanent and clears them from all views.', type: 'delete_thought', confirmText: 'DELETE', onConfirm: () => deleteSelectedThoughts() })}
              className="w-full py-4 bg-red-500/5 hover:bg-red-500/10 text-red-400 border border-red-500/20 hover:border-red-500/40 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2.5 group"
            >
              <Trash2 className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
              <span>DELETE</span>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default MultiSelectionMenu;
