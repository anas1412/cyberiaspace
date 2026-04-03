import React from 'react';
import { useStore } from '../store/useStore';
import { useModalStore } from '../store/useModalStore';
import { X, Trash2, Palette, Archive, ArchiveRestore } from 'lucide-react';
import { STACK_COLORS } from '../constants';
import { syncOrchestrator } from '../services/sync/syncOrchestrator';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { DateTimePicker } from './common/DateTimePicker';

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
          "w-8 h-8 rounded-full border border-[var(--glass-border)] transition-all flex items-center justify-center group relative overflow-hidden",
          disabled && "opacity-50 cursor-default"
        )}
        style={{ backgroundColor: value, boxShadow: `0 0 15px ${value}44` }}
      >
        <div className="absolute inset-0 bg-[var(--glass-bg)] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Palette className="w-3.5 h-3.5 text-[var(--text-primary)]" />
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute bottom-full mb-3 left-0 z-[100] bg-[var(--bg-main)] border border-[var(--glass-border)] rounded-2xl p-3 shadow-[0_10px_40px_rgba(0,0,0,0.8)] min-w-[180px]"
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
              <p className="text-[9px] font-medium tracking-widest text-[var(--text-muted)] mt-1 text-center">Custom Hex</p>
            </div>
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
  const archiveThoughts = useStore((state) => state.archiveThoughts);
  const unarchiveThoughts = useStore((state) => state.unarchiveThoughts);
  const thoughts = useStore((state) => state.thoughts);
  const stacks = useStore((state) => state.stacks);
  const updateStack = useStore((state) => state.updateStack);
  const isInspectorOpen = useStore((state) => state.isInspectorOpen);
  const isChatOpen = useStore((state) => state.isChatOpen);

  const { openModal } = useModalStore();
  const isMobile = typeof window !== 'undefined' ? window.innerWidth < 768 : false;

  // --- DERIVED DATA (Protected against undefined array access) ---
  const sharedStatus = React.useMemo(() => {
    const selected = thoughts.filter(t => selectedThoughtIds.includes(t.id));
    if (selected.length === 0) return null;
    const first = selected[0].status;
    return selected.every(t => t.status === first) ? (first || null) : null;
  }, [selectedThoughtIds, thoughts]);

  const sharedPriority = React.useMemo(() => {
    const selected = thoughts.filter(t => selectedThoughtIds.includes(t.id));
    if (selected.length === 0) return null;
    const first = selected[0].priority;
    return selected.every(t => t.priority === first) ? (first || null) : null;
  }, [selectedThoughtIds, thoughts]);

  const sharedReminder = React.useMemo(() => {
    const selected = thoughts.filter(t => selectedThoughtIds.includes(t.id));
    if (selected.length === 0) return [];
    const firstJson = JSON.stringify(selected[0].reminders || []);
    return selected.every(t => JSON.stringify(t.reminders || []) === firstJson) ? (selected[0].reminders || []) : [];
  }, [selectedThoughtIds, thoughts]);

  const sharedRecurrence = React.useMemo(() => {
    const selected = thoughts.filter(t => selectedThoughtIds.includes(t.id));
    if (selected.length === 0) return null;
    const first = selected[0].recurrenceRule;
    return selected.every(t => t.recurrenceRule === first) ? (first || null) : null;
  }, [selectedThoughtIds, thoughts]);

  const sharedLocation = React.useMemo(() => {
    const selected = thoughts.filter(t => selectedThoughtIds.includes(t.id));
    if (selected.length === 0) return null;
    const first = selected[0].location;
    return selected.every(t => t.location === first) ? (first || null) : null;
  }, [selectedThoughtIds, thoughts]);

  const sharedDate = React.useMemo(() => {
    const selected = thoughts.filter(t => selectedThoughtIds.includes(t.id));
    if (selected.length === 0) return null;
    const first = selected[0].startTime;
    return selected.every(t => t.startTime === first) ? (first || null) : null;
  }, [selectedThoughtIds, thoughts]);

  const allArchivedSelected = React.useMemo(() => {
    const selected = thoughts.filter(t => selectedThoughtIds.includes(t.id));
    return selected.length > 0 && selected.every(t => t.archivedAt);
  }, [selectedThoughtIds, thoughts]);
  // --- LOCAL STATE ---
  const [localDate, setLocalDate] = React.useState<number | null>(sharedDate);
  const [pendingReminders, setPendingReminders] = React.useState<any[]>(sharedReminder);
  const [pendingRecurrence, setPendingRecurrence] = React.useState<string | null>(sharedRecurrence);
  const [pendingLocation, setPendingLocation] = React.useState<string | null>(sharedLocation);

  // Sync state if selection changes
  React.useEffect(() => {
    setLocalDate(sharedDate ?? null);
    setPendingReminders(sharedReminder);
    setPendingRecurrence(sharedRecurrence ?? null);
    setPendingLocation(sharedLocation ?? null);
  }, [selectedThoughtIds, sharedDate, sharedReminder, sharedRecurrence, sharedLocation]);

  // Register all selected thoughts as being edited for sync protection
  React.useEffect(() => {
    // Register all selected thoughts as being edited
    selectedThoughtIds.forEach(id => syncOrchestrator.startEditing(id));

    return () => {
      // Unregister when selection changes or component unmounts
      selectedThoughtIds.forEach(id => syncOrchestrator.stopEditing(id));
    };
  }, [selectedThoughtIds]);

  const sharedStack = React.useMemo(() => {
    if (!selectedThoughtIds || selectedThoughtIds.length < 2) return null;
    const selectedThoughts = thoughts.filter(t => selectedThoughtIds.includes(t.id));
    if (selectedThoughts.length === 0) return null;
    const firstStackId = selectedThoughts[0].stackId;
    if (!firstStackId) return null;
    return selectedThoughts.every(t => t.stackId === firstStackId) ? stacks.find(s => s.id === firstStackId) || null : null;
  }, [selectedThoughtIds, thoughts, stacks]);

  const [localStackName, setLocalStackName] = React.useState('');
  React.useEffect(() => setLocalStackName(sharedStack?.name || ''), [sharedStack]);

  const showMenu = selectedThoughtIds && selectedThoughtIds.length >= 2 && !isReadOnly;

  const handleSaveAdvanced = () => {
    updateThoughts(selectedThoughtIds, {
      reminders: pendingReminders,
      recurrenceRule: pendingRecurrence,
      location: pendingLocation
    });
  };

  return (
    <AnimatePresence>
      {showMenu && (
        <motion.div
          initial={isMobile ? { y: '100%' } : { x: '100%', opacity: 0 }}
          animate={isMobile ? (isInspectorOpen || isChatOpen ? { y: '100%', opacity: 0 } : { y: 0, opacity: 1 }) : { x: 0, opacity: 1 }}
          exit={isMobile ? { y: '100%' } : { x: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 200 }}
          className="ui-layer focus-box fixed top-4 md:top-24 bottom-4 md:bottom-24 right-4 md:right-8 w-[calc(100%-32px)] md:w-[400px] glass rounded-2xl shadow-2xl pointer-events-auto z-[9999] border border-[var(--glass-border)] flex flex-col overflow-hidden"
        >
          {/* HEADER */}
          <div className="px-4 py-3 md:px-5 border-b border-[var(--glass-border)] bg-[var(--bg-main)]/60 backdrop-blur-xl sticky top-0 z-30">
            <div className="flex justify-between items-center relative min-h-[44px]">
              <div className="flex-1" />
              <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center justify-center pointer-events-none mt-0.5">
                <h3 className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-[var(--text-primary)] leading-none">Selection</h3>
                <span className="text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-widest leading-none mt-1.5">{selectedThoughtIds.length} Items Selected</span>
              </div>
              <div className="flex-1 flex justify-end">
                <button onClick={clearSelection} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--text-primary)]/10 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all"><X className="w-4 h-4" /></button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scroll scrollbar-none p-5 md:p-6 space-y-8">
            
            {/* 1. Status Batch */}
            <div className="space-y-3">
              <label className="text-[10px] uppercase font-bold tracking-widest text-[var(--text-muted)] ml-1">Batch Progress</label>
              <div className="grid grid-cols-4 gap-1.5">
                {(['none', 'todo', 'doing', 'done'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => updateThoughts(selectedThoughtIds, { status: s })}
                    className={cn(
                      "py-2.5 rounded-xl border text-[9px] font-medium tracking-[0.2em] transition-all",
                      sharedStatus === s
                        ? {
                          'none': 'bg-[var(--glass-bg)] border-[var(--glass-border)] text-[var(--text-primary)] shadow-md',
                          'todo': 'bg-[var(--status-todo)]/10 border-[var(--status-todo)] text-[var(--status-todo)] shadow-[0_0_15px_rgba(99,102,241,0.15)]',
                          'doing': 'bg-[var(--status-doing)]/10 border-[var(--status-doing)] text-[var(--status-doing)] shadow-[0_0_15px_rgba(234,179,8,0.15)]',
                          'done': 'bg-[var(--status-done)]/10 border-[var(--status-done)] text-[var(--status-done)] shadow-[0_0_15px_rgba(34,197,94,0.15)]',
                        }[s]
                        : "bg-[var(--bg-page)]/50 border-[var(--glass-border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg)] hover:border-[var(--glass-border)]"
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Priority Batch */}
            <div className="space-y-3">
              <label className="text-[10px] uppercase font-bold tracking-widest text-[var(--text-muted)] ml-1">Batch Priority</label>
              <div className="grid grid-cols-5 gap-1.5">
                {(['none', 'low', 'medium', 'high', 'urgent'] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => updateThoughts(selectedThoughtIds, { priority: p })}
                    className={cn(
                      "py-2.5 rounded-xl border text-[9px] font-medium tracking-[0.2em] transition-all",
                      sharedPriority === p
                        ? {
                          'none': 'bg-[var(--glass-bg)] border-[var(--glass-border)] text-[var(--text-primary)] shadow-md',
                          'low': 'bg-[var(--prio-low)]/10 border-[var(--prio-low)] text-[var(--prio-low)] shadow-[0_0_15px_rgba(148,163,184,0.15)]',
                          'medium': 'bg-[var(--prio-medium)]/10 border-[var(--prio-medium)] text-[var(--prio-medium)] shadow-[0_0_15px_rgba(168,85,247,0.15)]',
                          'high': 'bg-[var(--prio-high)]/10 border-[var(--prio-high)] text-[var(--prio-high)] shadow-[0_0_15px_rgba(245,158,11,0.15)]',
                          'urgent': 'bg-[var(--prio-urgent)]/10 border-[var(--prio-urgent)] text-[var(--prio-urgent)] shadow-[0_0_15px_rgba(239,68,68,0.15)]',
                        }[p]
                        : "bg-[var(--bg-page)]/50 border-[var(--glass-border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg)] hover:border-[var(--glass-border)]"
                    )}
                  >
                    {p === 'medium' ? 'Med' : p[0].toUpperCase() + p.slice(1, 3)}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Schedule Batch */}
            <div className="space-y-3">
              <label className="text-[10px] uppercase font-bold tracking-widest text-[var(--text-muted)] ml-1">Schedule Batch</label>
              <div className="calendar-theme-override [&_.calendar-done-button]:!text-[var(--bg-main)]">
                <DateTimePicker
                  startTime={localDate}
                  endTime={null}
                  isAllDay={true}
                  showReminder={true}
                  showRepeat={true}
                  showLocation={true}
                  reminder={pendingReminders}
                  recurrenceRule={pendingRecurrence}
                  location={pendingLocation}
                  onChange={(updates) => {
                    updateThoughts(selectedThoughtIds, updates);
                    if (updates.startTime !== undefined) setLocalDate(updates.startTime);
                  }}
                  onDone={handleSaveAdvanced}
                  onReminderChange={setPendingReminders}
                  onRecurrenceChange={setPendingRecurrence}
                  onLocationChange={setPendingLocation}
                />
              </div>
            </div>

            {/* 4. Group Management */}
            <div className="space-y-3 pt-6 border-t border-[var(--glass-border)]">
              <label className="text-[10px] uppercase font-bold tracking-widest text-[var(--text-muted)] ml-1">Group Actions</label>
              <div className="p-4 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-2xl space-y-4 shadow-inner">
                <div className="flex items-center gap-4">
                  {sharedStack ? (
                    <ColorPicker value={sharedStack.color} onChange={(color) => useStore.getState().updateStack(sharedStack.id, { color })} />
                  ) : (
                    <div className="w-8 h-8 rounded-full border border-[var(--glass-border)] bg-[var(--bg-page)]/50 flex items-center justify-center">
                      <Palette className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                    </div>
                  )}
                  <input
                    type="text"
                    value={localStackName}
                    onChange={(e) => setLocalStackName(e.target.value)}
                    placeholder="Name your group..."
                    className="bg-transparent text-[11px] font-extrabold uppercase tracking-widest text-[var(--text-primary)] outline-none flex-1 border-b border-transparent focus:border-[var(--accent)]/50 pb-1 transition-colors"
                  />
                </div>
                <button
                  onClick={async () => {
                    if (sharedStack && localStackName.trim() !== sharedStack.name) {
                      await updateStack(sharedStack.id, { name: localStackName.trim() });
                    } else if (!sharedStack) {
                      await linkSelectedThoughts(localStackName.trim());
                    }
                  }}
                  disabled={!!sharedStack && localStackName.trim() === sharedStack.name}
                  className="w-full py-3 bg-[var(--accent)]/10 hover:bg-[var(--accent)]/20 border border-[var(--accent)]/30 hover:border-[var(--accent)]/60 text-[var(--accent-secondary)] rounded-xl text-[10px] font-extrabold uppercase tracking-[0.2em] transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-[var(--accent-glow)]/10"
                >
                  <span>{sharedStack ? 'Rename Group' : 'Create Group'}</span>
                </button>

                {stacks.length > 0 && !sharedStack && (
                  <div className="space-y-2 pt-2">
                    <label className="text-[9px] uppercase font-bold tracking-[0.2em] text-[var(--text-muted)] ml-1">Add to Existing</label>
                    <div className="flex flex-col gap-1.5 max-h-[160px] overflow-y-auto custom-scroll pr-1">
                      {stacks.map(s => (
                        <button
                          key={s.id}
                          onClick={() => updateThoughts(selectedThoughtIds, { stackId: s.id })}
                          className="w-full flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-page)]/50 hover:bg-[var(--glass-bg)] border border-transparent hover:border-[var(--glass-border)] transition-all text-left group/btn"
                        >
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color, boxShadow: `0 0 8px ${s.color}44` }} />
                          <span className="text-[10px] font-medium tracking-widest text-[var(--text-muted)] group-hover/btn:text-[var(--text-primary)] transition-colors">{s.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {sharedStack && (
                  <button onClick={unlinkSelectedThoughts} className="w-full py-2.5 bg-red-500/5 hover:bg-red-500/10 text-red-400/90 hover:text-red-400 border border-red-500/20 hover:border-red-500/40 rounded-xl text-[9px] font-medium tracking-[0.2em] transition-all">
                    Remove from Group
                  </button>
                )}
              </div>
            </div>
          </div>
          
          {/* FOOTER */}
          <div className="bg-[var(--bg-main)]/60 backdrop-blur-md border-t border-[var(--glass-border)] p-4 md:p-5 flex items-center gap-3">
            {allArchivedSelected ? (
              <button
                onClick={() => unarchiveThoughts(selectedThoughtIds)}
                className="flex-1 bg-amber-500/5 hover:bg-amber-500/10 text-amber-400/90 py-3 rounded-xl text-[10px] font-extrabold uppercase tracking-[0.2em] transition-all border border-amber-500/20 hover:border-amber-500/40 flex items-center justify-center gap-2 group"
              >
                <ArchiveRestore className="w-4 h-4 group-hover:scale-110 transition-transform" />
                <span>Restore Selection</span>
              </button>
            ) : (
              <button
                onClick={() => archiveThoughts(selectedThoughtIds)}
                className="flex-1 bg-amber-500/5 hover:bg-amber-500/10 text-amber-400/90 py-3 rounded-xl text-[10px] font-extrabold uppercase tracking-[0.2em] transition-all border border-amber-500/20 hover:border-amber-500/40 flex items-center justify-center gap-2 group"
              >
                <Archive className="w-4 h-4 group-hover:scale-110 transition-transform" />
                <span>Archive Selection</span>
              </button>
            )}
            <button
              onClick={() => openModal({ 
                title: `Delete ${selectedThoughtIds.length} Nodes?`, 
                description: 'This action is permanent and clears them from all views.', 
                type: 'delete_thought', 
                confirmText: 'DELETE', 
                onConfirm: () => deleteSelectedThoughts() 
              })}
              className="flex-1 bg-red-500/5 hover:bg-red-500/10 text-red-400/90 py-3 rounded-xl text-[10px] font-extrabold uppercase tracking-[0.2em] transition-all border border-red-500/20 hover:border-red-500/40 flex items-center justify-center gap-2 group"
            >
              <Trash2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
              <span>Delete Selection</span>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default MultiSelectionMenu;