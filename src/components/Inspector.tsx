
import React from 'react';
import { getThoughtConfig } from './thought/registry';
import { useStore } from '../store/useStore';
import { useModalStore } from '../store/useModalStore';
import type { ThoughtType } from '../db';
import { 
  X, ArrowUp, ArrowDown, Save, Maximize2, Trash2, Palette
} from 'lucide-react';
import { STACK_COLORS } from '../constants';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence } from 'framer-motion';
import { DateTimePicker } from './common/DateTimePicker';
import { syncOrchestrator } from '../services/sync/syncOrchestrator';

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
              <p className="text-[9px] font-medium tracking-wide text-[var(--text-muted)] mt-1 text-center">Custom Hex</p>
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

  const [localText, setLocalText] = React.useState('');
  const [localDesc, setLocalDesc] = React.useState('');
  const [localStartTime, setLocalStartTime] = React.useState<number | null>(null);
  const [localEndTime, setLocalEndTime] = React.useState<number | null>(null);
  const [localIsAllDay, setLocalIsAllDay] = React.useState(false);
  const [localReminders, setLocalReminders] = React.useState<any[]>([]);
  const [localRecurrenceRule, setLocalRecurrenceRule] = React.useState<string | null>(null);
  const [localLocation, setLocalLocation] = React.useState<string | null>(null);
  const [localStackName, setLocalStackName] = React.useState('');
  const [pendingType, setPendingType] = React.useState<ThoughtType | null>(null);
  const [activeTab, setActiveTab] = React.useState<'content' | 'status' | 'layout'>('content');

  const titleInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (selectedThoughtId) {
      syncOrchestrator.setFocusEditing(true, selectedThoughtId);
    }
    return () => {
      if (selectedThoughtId) {
        syncOrchestrator.setFocusEditing(false, selectedThoughtId);
      }
    };
  }, [selectedThoughtId]);

  // Reset local state when selected thought changes
  React.useEffect(() => {
    if (thought) {
      setLocalText(thought.text || '');
      setLocalDesc(thought.description || '');
      setLocalStartTime(thought.startTime || null);
      setLocalEndTime(thought.endTime || null);
      setLocalIsAllDay(thought.isAllDay ?? true);
      setLocalReminders(thought.reminders || []);
      setLocalRecurrenceRule(thought.recurrenceRule || null);
      setLocalLocation(thought.location || null);
      setPendingType(null);
    }
    if (stack) {
      setLocalStackName(stack.name || '');
    }
  }, [selectedThoughtId, stack?.id]);

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

  const handleDateTimeChange = (updates: { startTime?: number | null; endTime?: number | null; isAllDay?: boolean }) => {
    if (!thought) return;
    const newUpdates: Partial<typeof thought> = {};
    if (updates.startTime !== undefined) {
      setLocalStartTime(updates.startTime);
      newUpdates.startTime = updates.startTime;
    }
    if (updates.endTime !== undefined) {
      setLocalEndTime(updates.endTime);
      newUpdates.endTime = updates.endTime;
    }
    if (updates.isAllDay !== undefined) {
      setLocalIsAllDay(updates.isAllDay);
      newUpdates.isAllDay = updates.isAllDay;
    }
    updateThought(thought.id, newUpdates);
  };

  const handleReminderChange = (reminders: any[]) => {
    if (!thought) return;
    setLocalReminders(reminders);
    updateThought(thought.id, { reminders });
  };

  const handleRecurrenceChange = (recurrenceRule: string | null) => {
    if (!thought) return;
    setLocalRecurrenceRule(recurrenceRule);
    updateThought(thought.id, { recurrenceRule });
  };

  const handleLocationChange = (location: string) => {
    if (!thought) return;
    setLocalLocation(location);
    updateThought(thought.id, { location });
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
          className="ui-layer focus-box fixed top-4 md:top-24 bottom-4 md:bottom-24 right-4 md:right-8 w-[calc(100%-32px)] md:w-[400px] glass rounded-2xl shadow-2xl flex flex-col overflow-hidden z-[9999] border border-[var(--glass-border)]"
        >
          {/* Header & Tabs Container - Single Sticky Wrapper! */}
          <div className="sticky top-0 z-30 bg-[var(--bg-main)]/60 backdrop-blur-xl border-b border-[var(--glass-border)] flex flex-col">
            {/* Top Bar */}
            <div className="px-4 py-3 md:px-5 flex justify-between items-center relative min-h-[44px]">
              {/* Left Placeholder */}
              <div className="flex-1" />

              {/* Absolute Center - Perfectly aligned */}
              <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-none mt-0.5">
                <div className="flex items-center gap-2">
                  <div className={cn("w-1.5 h-1.5 rounded-full", isReadOnly ? "bg-slate-400" : "bg-[var(--accent)] shadow-[0_0_8px_var(--accent-glow)]")} />
                  <h3 className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-[var(--text-primary)] leading-none">
                    {isReadOnly ? 'Published' : 'Editor'}
                  </h3>
                </div>
              </div>

              {/* Right Action */}
              <div className="flex-1 flex justify-end">
                <button
                  onClick={() => setInspectorOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--glass-bg)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Tabs Row */}
            <div className="flex px-2">
              {(['content', 'status', 'layout'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "flex-1 py-3.5 text-[10px] font-medium tracking-wide relative transition-all duration-300",
                    activeTab === tab ? "text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  )}
                >
                  {tab}
                  {activeTab === tab && (
                    <motion.div
                      layoutId="inspectorTab"
                      className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--accent)] shadow-[0_0_10px_var(--accent-glow)] rounded-t-full"
                      initial={false}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scroll scrollbar-none">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="p-5 md:p-6 space-y-8"
              >
                {activeTab === 'content' && (
                  <div className="space-y-6">
                    <div className="space-y-5">
                      <div className="space-y-2.5">
                        <label className="text-[10px] uppercase font-bold tracking-widest text-[var(--text-muted)] ml-1">Name</label>
                        <input
                          ref={titleInputRef}
                          type="text"
                          readOnly={isReadOnly}
                          value={localText}
                          onChange={(e) => {
                            setLocalText(e.target.value);
                            if (!isReadOnly && thought) {
                              updateThought(thought.id, { text: e.target.value });
                            }
                          }}
                          maxLength={100}
className={cn(
                             "w-full bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl p-3 text-[13px] outline-none focus:border-[var(--accent)] focus:bg-[var(--bg-page)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-colors shadow-inner",
                             isReadOnly && "pointer-events-none opacity-80"
                           )}
                          placeholder="Thought Name"
                        />
                      </div>

                      <div className="space-y-2.5">
                        <label className="text-[10px] uppercase font-bold tracking-widest text-[var(--text-muted)] ml-1">Note</label>
                        <textarea
                          readOnly={isReadOnly}
                          value={localDesc}
                          onChange={(e) => {
                            setLocalDesc(e.target.value);
                            if (!isReadOnly && thought) {
                              updateThought(thought.id, { description: e.target.value });
                            }
                          }}
                          rows={4}
                          maxLength={150}
className={cn(
                             "w-full bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl p-3 text-[12px] outline-none focus:border-[var(--accent)] focus:bg-[var(--bg-page)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-colors shadow-inner resize-none",
                             isReadOnly && "pointer-events-none opacity-80"
                           )}
                          placeholder="Add a quick note..."
                        />
                      </div>
                    </div>

                    {InspectorPanel && (
                      <div>
                        <InspectorPanel thought={thought} isReadOnly={isReadOnly} />
                      </div>
                    )}

                    {thought.type !== 'file' && (
                      <div className="pt-6 border-t border-[var(--glass-border)] space-y-3">
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
                                     "py-3 px-2 rounded-xl flex flex-col items-center justify-center transition-all border gap-1.5",
                                     isActive
                                       ? "bg-[var(--accent)]/10 border-[var(--accent)] text-[var(--text-primary)] shadow-[0_0_15px_var(--accent-glow)]"
                                       : "bg-[var(--glass-bg)] border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-page)] hover:text-[var(--text-primary)] hover:border-[var(--glass-border)]",
                                     isReadOnly && thought.type !== type && "opacity-30 grayscale cursor-default"
                                   )}
                                  disabled={isReadOnly}
                                  title={tConfig?.label || type}
                                >
                                  {tConfig?.icon && <tConfig.icon className="w-4 h-4" />}
                                  <span className="text-[9px] font-medium tracking-wide">{type === 'tasks' ? 'task' : type}</span>
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
                              ? "bg-[var(--accent)] border-[var(--accent)] text-[var(--accent-contrast)] shadow-[0_0_20px_var(--accent-glow)] scale-100 opacity-100 font-extrabold"
                              : "bg-[var(--bg-main)]/20 border-[var(--glass-border)] text-[var(--text-muted)] scale-[0.98] opacity-40 cursor-default"
                          )}
                        >
                          <Save className="w-4 h-4" />
                          <span className="text-[9px] font-medium tracking-wide">Save Change</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'status' && (
                  <div className="space-y-8">
                    <div className="space-y-3">
                      <label className="text-[10px] uppercase font-bold tracking-widest text-[var(--text-muted)] ml-1">Date & Time</label>
                      <DateTimePicker
                        startTime={localStartTime}
                        endTime={localEndTime}
                        isAllDay={localIsAllDay}
                        onChange={handleDateTimeChange}
                        disabled={isReadOnly}
                        showReminder={true}
                        showRepeat={true}
                        showLocation={true}
                        reminder={localReminders}
                        recurrenceRule={localRecurrenceRule}
                        location={localLocation}
                        onReminderChange={handleReminderChange}
                        onRecurrenceChange={handleRecurrenceChange}
                        onLocationChange={handleLocationChange}
                      />
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] uppercase font-bold tracking-widest text-[var(--text-muted)] ml-1">Progress</label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {(['none', 'todo', 'doing', 'done'] as const).map((s) => (
                          <button
                            key={s}
                            disabled={isReadOnly}
                            onClick={() => !isReadOnly && updateThought(thought.id, { status: s })}
className={cn(
                               "border rounded-xl py-2.5 text-[9px] font-medium tracking-wide transition-all",
                               thought.status === s
                                 ? {
                                   'none': 'bg-[var(--glass-bg)] border-[var(--glass-border)] text-[var(--text-primary)] shadow-md',
                                   'todo': 'bg-[var(--status-todo)]/10 border-[var(--status-todo)] text-[var(--status-todo)] shadow-[0_0_15px_rgba(99,102,241,0.15)]',
                                   'doing': 'bg-[var(--status-doing)]/10 border-[var(--status-doing)] text-[var(--status-doing)] shadow-[0_0_15px_rgba(234,179,8,0.15)]',
                                   'done': 'bg-[var(--status-done)]/10 border-[var(--status-done)] text-[var(--status-done)] shadow-[0_0_15px_rgba(34,197,94,0.15)]',
                                 }[s]
                                 : "bg-[var(--glass-bg)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-page)] hover:border-[var(--glass-border)]",
                               isReadOnly && thought.status !== s && "opacity-30 grayscale cursor-default"
                             )}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] uppercase font-bold tracking-widest text-[var(--text-muted)] ml-1">Priority</label>
                      <div className="grid grid-cols-5 gap-1.5">
                        {(['none', 'low', 'medium', 'high', 'urgent'] as const).map((p) => (
                          <button
                            key={p}
                            disabled={isReadOnly}
                            onClick={() => handlePriorityChange(p)}
className={cn(
                               "border rounded-xl py-2.5 text-[9px] font-medium tracking-wide transition-all",
                               thought.priority === p
                                 ? {
                                   'none': 'bg-[var(--glass-bg)] border-[var(--glass-border)] text-[var(--text-primary)] shadow-md',
                                   'low': 'bg-[var(--prio-low)]/10 border-[var(--prio-low)] text-[var(--prio-low)] shadow-[0_0_15px_rgba(148,163,184,0.15)]',
                                   'medium': 'bg-[var(--prio-medium)]/10 border-[var(--prio-medium)] text-[var(--prio-medium)] shadow-[0_0_15px_rgba(168,85,247,0.15)]',
                                   'high': 'bg-[var(--prio-high)]/10 border-[var(--prio-high)] text-[var(--prio-high)] shadow-[0_0_15px_rgba(245,158,11,0.15)]',
                                   'urgent': 'bg-[var(--prio-urgent)]/10 border-[var(--prio-urgent)] text-[var(--prio-urgent)] shadow-[0_0_15px_rgba(239,68,68,0.15)]',
                                 }[p]
                                 : "bg-[var(--glass-bg)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-page)] hover:border-[var(--glass-border)]",
                               isReadOnly && thought.priority !== p && "opacity-30 grayscale cursor-default"
                             )}
                          >
                            {p === 'medium' ? 'Med' : p[0].toUpperCase() + p.slice(1, 3)}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3 pt-6 border-t border-[var(--glass-border)]">
                      <label className="text-[10px] uppercase font-bold tracking-widest text-[var(--text-muted)] ml-1">Group</label>
                      {stack ? (
                        <div className="p-4 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-2xl space-y-4 shadow-inner">
                          <div className="flex items-center gap-4">
                            <ColorPicker 
                              value={stack.color} 
                              disabled={isReadOnly}
                              onChange={async (color) => {
                                if (!isReadOnly) {
                                  // Instant store update
                                  const idx = stacks.findIndex(s => s.id === stack.id);
                                  if (idx !== -1) {
                                    const newStacks = [...stacks];
                                    newStacks[idx] = { ...newStacks[idx], color };
                                    useStore.setState({ stacks: newStacks } as any);
                                  }
                                  // Debounced store update
                                  const timerKey = `stack-color-${stack.id}`;
                                  if ((window as any)[timerKey]) clearTimeout((window as any)[timerKey]);
                                  (window as any)[timerKey] = setTimeout(async () => {
                                    updateStack(stack.id, { color, updatedAt: Date.now(), syncStatus: 'local' });
                                    delete (window as any)[timerKey];
                                  }, 1000);
                                }
                              }} 
                            />
                            <input
                              type="text"
                              readOnly={isReadOnly}
                              value={localStackName}
                              onChange={(e) => {
                                setLocalStackName(e.target.value);
                                if (!isReadOnly) {
                                  // Instant store update
                                  // Use updateStack which handles Zustand + DB properly
                                  updateStack(stack.id, { name: e.target.value });
                                }
                              }}
className={cn(
                                 "bg-transparent text-[11px] font-extrabold uppercase tracking-widest text-[var(--text-primary)] outline-none flex-1 border-b border-transparent focus:border-[var(--glass-border)] pb-1 transition-colors",
                                 isReadOnly && "pointer-events-none"
                               )}
                              placeholder="Group Name"
                            />
                          </div>
                          {!isReadOnly && (
                            <button
                              onClick={() => unlinkSelectedThoughts()}
                              className="w-full py-2.5 bg-red-500/5 hover:bg-red-500/10 text-red-400/90 hover:text-red-400 border border-red-500/10 hover:border-red-500/20 rounded-xl text-[9px] font-medium tracking-wide transition-all"
                            >
                              Remove from Group
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="relative group">
                            <input
                              type="text"
                              placeholder="Type to create or join group..."
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
                              className="w-full bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl p-3 text-[12px] outline-none focus:border-[var(--accent)] focus:bg-[var(--bg-page)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-colors shadow-inner"
                            />
                          </div>

                          {stacks.length > 0 && (
                            <div className="space-y-2">
                              <label className="text-[9px] uppercase font-bold tracking-[0.2em] text-[var(--text-muted)] ml-1">Existing Groups</label>
                              <div className="flex flex-col gap-1 max-h-[160px] overflow-y-auto custom-scroll pr-1">
                                {stacks.map(s => (
                                  <div key={s.id} className="relative group/s">
<button
                                       onClick={() => updateThought(thought.id, { stackId: s.id })}
                                       className="w-full flex items-center gap-3 p-3 rounded-xl bg-[var(--glass-bg)] hover:bg-[var(--bg-page)] border border-transparent hover:border-[var(--glass-border)] transition-all"
                                     >
                                       <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color, boxShadow: `0 0 8px ${s.color}44` }} />
                                       <span className="text-[10px] font-medium tracking-wide text-[var(--text-muted)] group-hover/s:text-[var(--text-primary)] transition-colors">{s.name}</span>
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
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-[var(--accent-contrast)] opacity-0 group-hover/s:opacity-100 transition-all shadow-lg"
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
                        <label className="text-[10px] uppercase font-bold tracking-widest text-[var(--text-muted)]">Scale</label>
                        <span className="text-[10px] font-mono text-[var(--accent-secondary)] font-bold">{(thought.size || 1.0).toFixed(1)}x</span>
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

                    <div className="space-y-4 pt-6 border-t border-[var(--glass-border)]">
                      <label className="text-[10px] uppercase font-bold tracking-widest text-[var(--text-muted)] ml-1">Layers</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          disabled={isReadOnly}
                          onClick={() => !isReadOnly && bringToFront(thought.id)}
                          className={cn(
                            "flex items-center justify-center gap-2 py-3 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl text-[9px] font-medium tracking-wide text-[var(--text-muted)] hover:bg-[var(--bg-page)] hover:text-[var(--text-primary)] transition-all",
                            isReadOnly && "opacity-30 cursor-default"
                          )}
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                          Front
                        </button>
                        <button
                          disabled={isReadOnly}
                          onClick={() => !isReadOnly && sendToBack(thought.id)}
className={cn(
                             "flex items-center justify-center gap-2 py-3 bg-[var(--glass-bg)] border border-[var(--border)] rounded-xl text-[9px] font-medium tracking-wide text-[var(--text-muted)] hover:bg-[var(--bg-page)] hover:text-[var(--text-primary)] transition-all",
                             isReadOnly && "opacity-30 cursor-default"
                           )}
                         >
                           <ArrowDown className="w-3.5 h-3.5" />
                          Back
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Persistent Action Footer */}
          {!isReadOnly && (
            <div className="bg-[var(--bg-main)]/60 backdrop-blur-md border-t border-[var(--glass-border)] p-4 md:p-5 flex items-center gap-3">
              {thought.type !== 'label' && (
                <button
                  onClick={() => {
                    const triggers: Record<string, string> = {
                      text: 'text', tasks: 'tasks', table: 'table', paint: 'paint', embed: 'embed', file: 'file', image: 'file'
                    };
                    const focusType = (triggers[thought.type] || 'text') as any;
                    setActiveFocus(thought.id, focusType);
                  }}
                  className="flex-1 bg-[var(--accent)]/10 hover:bg-[var(--accent)]/20 border border-[var(--accent)]/30 hover:border-[var(--accent)]/60 text-[var(--accent-secondary)] py-3 rounded-xl text-[10px] font-extrabold uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 shadow-lg shadow-[var(--accent-glow)]/10 group"
                >
                  <Maximize2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  <span>Open</span>
                </button>
              )}
              <button
                onClick={handleDeleteThought}
                className="flex-1 bg-red-500/5 hover:bg-red-500/10 text-red-400/90 py-3 rounded-xl text-[10px] font-extrabold uppercase tracking-[0.2em] transition-all border border-red-500/20 hover:border-red-500/40 flex items-center justify-center gap-2 group"
              >
                <Trash2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                <span>Delete</span>
              </button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Inspector;