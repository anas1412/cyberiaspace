import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../../store/useStore';
import { Filter, Search, Calendar, Archive, EyeOff, Eye, Circle, Clock, CheckCircle2, X, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const STATUS_OPTIONS = [
  { value: 'none', label: 'All', icon: null },
  { value: 'todo', label: 'Todo', icon: Circle, color: 'var(--status-todo)' },
  { value: 'doing', label: 'Doing', icon: Clock, color: 'var(--status-doing)' },
  { value: 'done', label: 'Done', icon: CheckCircle2, color: 'var(--status-done)' },
];

const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const DateFilterPicker: React.FC<{
  value: string | null;
  onChange: (date: string | null) => void;
}> = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => value ? new Date(value + 'T12:00:00') : new Date());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
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
  const handlePrevMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1));
  const handleNextMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1));

  const isSelected = (day: number) => {
    if (!value) return false;
    const d = new Date(value + 'T12:00:00');
    return d.getDate() === day && d.getMonth() === viewDate.getMonth() && d.getFullYear() === viewDate.getFullYear();
  };

  const isToday = (day: number) => {
    const today = new Date();
    return today.getDate() === day && today.getMonth() === viewDate.getMonth() && today.getFullYear() === viewDate.getFullYear();
  };

  const selectDate = (day: number) => {
    const y = viewDate.getFullYear();
    const m = String(viewDate.getMonth() + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    onChange(`${y}-${m}-${d}`);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
  };

  const formatDisplay = () => {
    if (!value) return 'Set Date';
    const d = new Date(value + 'T12:00:00');
    return d.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full bg-[var(--bg-page)]/20 border border-[var(--glass-border)] rounded-xl p-3 text-[11px] outline-none text-[var(--text-primary)] font-mono uppercase flex items-center justify-between group transition-all",
          value ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"
        )}
      >
        <span className="flex-1 text-center truncate">{formatDisplay()}</span>
        <Calendar className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors flex-shrink-0 ml-2" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
            className="absolute top-full mt-2 left-0 right-0 z-[10002] glass border border-[var(--glass-border)] rounded-2xl p-3 shadow-2xl"
          >
            <div className="flex justify-between items-center mb-3">
              <button onClick={handlePrevMonth} className="p-1.5 hover:bg-[var(--glass-border)] rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <h4 className="text-[9px] font-semibold tracking-widest text-[var(--text-primary)]">
                {monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}
              </h4>
              <button onClick={handleNextMonth} className="p-1.5 hover:bg-[var(--glass-border)] rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-0.5 mb-1">
              {weekDays.map(d => (
                <div key={d} className="text-center text-[7px] font-semibold text-[var(--text-muted)] py-1">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-0.5">
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
                      "w-full aspect-square rounded-lg text-[8px] font-bold transition-all flex items-center justify-center border",
                      isSelected(day)
                        ? "bg-[var(--accent)] border-[var(--accent)] text-[var(--accent-contrast)] shadow-[0_0_10px_var(--accent-glow)]"
                        : isToday(day)
                          ? "bg-[var(--glass-border)] border-white/20 text-[var(--text-primary)]"
                          : "bg-transparent border-transparent text-[var(--text-muted)] hover:bg-[var(--glass-border)] hover:text-[var(--text-primary)]"
                    )}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            {value && (
              <button
                onClick={handleClear}
                className="w-full mt-3 py-2 text-[8px] font-medium tracking-widest text-[var(--accent)] hover:underline border-t border-[var(--glass-border)] pt-2"
              >
                Clear Date
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const FilterPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const stackReelRef = useRef<HTMLDivElement>(null);

  const activeSpace = useStore((state) => state.spaces.find((s) => s.id === state.activeSpaceId));
  const mode = activeSpace?.mode ?? 'spatial';
  const stacks = useStore((state) => state.stacks);
  const activeSpaceId = useStore((state) => state.activeSpaceId);
  const isReadOnly = useStore((state) => state.isReadOnly);
  const activeStacks = isReadOnly ? stacks : stacks.filter(s => s.spaceId === activeSpaceId);

  // Mode-specific search
  const spatialSearchQuery = useStore((state) => state.spatialSearchQuery);
  const setSpatialSearchQuery = useStore((state) => state.setSpatialSearchQuery);
  const kanbanSearchQuery = useStore((state) => state.kanbanSearchQuery);
  const setKanbanSearchQuery = useStore((state) => state.setKanbanSearchQuery);
  const calendarSearchQuery = useStore((state) => state.calendarSearchQuery);
  const setCalendarSearchQuery = useStore((state) => state.setCalendarSearchQuery);

  // Mode-specific stack filter
  const spatialStackFilter = useStore((state) => state.spatialStackFilter);
  const setSpatialStackFilter = useStore((state) => state.setSpatialStackFilter);
  const kanbanStackFilter = useStore((state) => state.kanbanStackFilter);
  const setKanbanStackFilter = useStore((state) => state.setKanbanStackFilter);
  const calendarStackFilter = useStore((state) => state.calendarStackFilter);
  const setCalendarStackFilter = useStore((state) => state.setCalendarStackFilter);

  // Mode-specific status filter
  const spatialStatusFilter = useStore((state) => state.spatialStatusFilter);
  const setSpatialStatusFilter = useStore((state) => state.setSpatialStatusFilter);
  const kanbanStatusFilter = useStore((state) => state.kanbanStatusFilter);
  const setKanbanStatusFilter = useStore((state) => state.setKanbanStatusFilter);
  const calendarStatusFilter = useStore((state) => state.calendarStatusFilter);
  const setCalendarStatusFilter = useStore((state) => state.setCalendarStatusFilter);

  // Mode-specific date filter
  const spatialDateFilter = useStore((state) => state.spatialDateFilter);
  const setSpatialDateFilter = useStore((state) => state.setSpatialDateFilter);
  const kanbanDateFilter = useStore((state) => state.kanbanDateFilter);
  const setKanbanDateFilter = useStore((state) => state.setKanbanDateFilter);

  // Archive (global)
  const showArchived = useStore((state) => state.showArchived);
  const setShowArchived = useStore((state) => state.setShowArchived);

  // Resolve current values based on mode
  const searchQuery = mode === 'spatial' ? spatialSearchQuery : mode === 'kanban' ? kanbanSearchQuery : calendarSearchQuery;
  const setSearchQuery = mode === 'spatial' ? setSpatialSearchQuery : mode === 'kanban' ? setKanbanSearchQuery : setCalendarSearchQuery;

  const stackFilter = mode === 'spatial' ? spatialStackFilter : mode === 'kanban' ? kanbanStackFilter : calendarStackFilter;
  const setStackFilter = mode === 'spatial' ? setSpatialStackFilter : mode === 'kanban' ? setKanbanStackFilter : setCalendarStackFilter;

  const statusFilter = mode === 'spatial' ? spatialStatusFilter : mode === 'kanban' ? kanbanStatusFilter : calendarStatusFilter;
  const setStatusFilter = mode === 'spatial' ? setSpatialStatusFilter : mode === 'kanban' ? setKanbanStatusFilter : setCalendarStatusFilter;

  const dateFilter = mode === 'spatial' ? spatialDateFilter : mode === 'kanban' ? kanbanDateFilter : null;
  const setDateFilter = mode === 'spatial' ? setSpatialDateFilter : mode === 'kanban' ? setKanbanDateFilter : null;

  // Enable horizontal scrolling with mouse wheel on stack reel
  useEffect(() => {
    const el = stackReelRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.stopPropagation();
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    // Use capture phase to intercept before window-level zoom handler
    el.addEventListener('wheel', onWheel, { passive: false, capture: true });
    return () => el.removeEventListener('wheel', onWheel, { capture: true });
  }, []);

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (isOpen && !target.closest('.filter-panel-container')) setIsOpen(false);
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('mousedown', handleGlobalClick);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('mousedown', handleGlobalClick);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleClearFilters = () => {
    setSearchQuery('');
    setStackFilter(null);
    setStatusFilter(null);
    if (setDateFilter) setDateFilter(null);
  };

  const hasActiveFilters = searchQuery || stackFilter || statusFilter || dateFilter;

  return (
    <div className="filter-panel-container relative pointer-events-auto">
      {/* Trigger Button */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "h-[44px] glass rounded-2xl border border-[var(--glass-border)] shadow-lg shadow-[var(--glass-border)] flex items-center cursor-pointer transition-all",
          isOpen ? "pl-4 pr-4 text-[var(--text-primary)]" : "px-4 hover:border-[var(--accent)]/30 hover:text-[var(--text-primary)]"
        )}
      >
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <Filter className={cn("w-3.5 h-3.5", hasActiveFilters ? "text-[var(--accent)]" : "text-[var(--text-muted)]")} />
          <span className="text-[12px] font-semibold tracking-wide whitespace-nowrap text-[var(--text-muted)]">
            Filters
          </span>
          {hasActiveFilters && (
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
          )}
          <ChevronDown className={cn(
            "w-3.5 h-3.5 text-[var(--text-muted)] transition-transform duration-300",
            isOpen && "rotate-180"
          )} />
        </div>
      </div>

      {/* Dropdown Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="absolute top-full left-0 mt-2 w-80 glass rounded-2xl border border-[var(--glass-border)] shadow-2xl z-[10001]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--glass-border)] bg-[var(--bg-main)]/40">
              <span className="text-[9px] font-black tracking-widest uppercase text-[var(--text-muted)]">Filter Thoughts</span>
              <div className="flex items-center gap-2">
                {hasActiveFilters && (
                  <button
                    onClick={handleClearFilters}
                    className="text-[8px] font-medium tracking-widest text-[var(--accent)] hover:underline"
                  >
                    Clear All
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-[var(--text-primary)]/10 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="px-4 py-3 border-b border-[var(--glass-border)]">
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)] group-focus-within:text-[var(--accent)] transition-colors" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search thoughts..."
                  className="w-full h-9 bg-[var(--bg-page)] border border-[var(--glass-border)] rounded-xl pl-9 pr-9 text-[11px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent)]/10 transition-all placeholder:text-[var(--text-muted)]"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-[var(--text-primary)]/10 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Date (Spatial & Kanban modes) */}
            {mode !== 'calendar' && setDateFilter && (
              <div className="px-4 py-3 border-b border-[var(--glass-border)]">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-3 h-3 text-[var(--text-muted)]" />
                  <span className="text-[9px] font-black tracking-widest uppercase text-[var(--text-muted)]">Date</span>
                </div>
                <DateFilterPicker
                  value={dateFilter}
                  onChange={(date) => setDateFilter(date)}
                />
              </div>
            )}

            {/* Status (All modes except Kanban - status IS the column layout) */}
            {mode !== 'kanban' && (
            <div className="px-4 py-3 border-b border-[var(--glass-border)]">
              <div className="flex items-center gap-2 mb-2">
                <Circle className="w-3 h-3 text-[var(--text-muted)]" />
                <span className="text-[9px] font-black tracking-widest uppercase text-[var(--text-muted)]">Status</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {STATUS_OPTIONS.map((status) => {
                  const Icon = status.icon;
                  const isActive = statusFilter === status.value || (status.value === 'none' && !statusFilter);
                  return (
                    <button
                      key={status.value}
                      onClick={() => setStatusFilter(status.value === 'none' ? null : status.value as 'todo' | 'doing' | 'done')}
                      className={cn(
                        "h-7 px-2.5 rounded-lg text-[9px] font-medium tracking-wider border transition-all flex items-center gap-1.5",
                        isActive
                          ? "bg-[var(--accent)]/20 border-[var(--accent)] text-[var(--text-primary)]"
                          : "bg-[var(--bg-page)] border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      )}
                    >
                      {Icon && <Icon className="w-2.5 h-2.5" style={status.value !== 'none' ? { color: status.color } : {}} />}
                      {status.label}
                    </button>
                  );
                })}
              </div>
            </div>
            )}

            {/* Stacks */}
            <div className="px-4 py-3 border-b border-[var(--glass-border)]">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <ChevronDown className="w-3 h-3 text-[var(--text-muted)]" />
                  <span className="text-[9px] font-black tracking-widest uppercase text-[var(--text-muted)]">Stacks</span>
                </div>
                {stackFilter && (
                  <button
                    onClick={() => setStackFilter(null)}
                    className="text-[8px] font-medium tracking-widest text-[var(--accent)] hover:underline"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div
                ref={stackReelRef}
                className="flex gap-1.5 overflow-x-auto custom-scroll pb-1"
              >
                <button
                  onClick={() => setStackFilter(null)}
                  className={cn(
                    "flex-shrink-0 h-7 px-2.5 rounded-lg text-[9px] font-medium tracking-wider border transition-all",
                    !stackFilter
                      ? "bg-[var(--accent)]/20 border-[var(--accent)] text-[var(--text-primary)]"
                      : "bg-[var(--bg-page)] border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  )}
                >
                  All
                </button>
                {activeStacks.map((stack) => (
                  <button
                    key={stack.id}
                    onClick={() => setStackFilter(stack.id)}
                    className={cn(
                      "flex-shrink-0 h-7 px-2.5 rounded-lg text-[9px] font-medium tracking-wider border transition-all truncate max-w-[100px]",
                      stackFilter === stack.id
                        ? "border-current text-[var(--text-primary)]"
                        : "bg-[var(--bg-page)] border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    )}
                    style={stackFilter === stack.id ? {
                      backgroundColor: stack.color.replace('1)', '0.3)'),
                      color: stack.color
                    } : {}}
                  >
                    {stack.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Archive */}
            <div className="px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <Archive className="w-3 h-3 text-[var(--text-muted)]" />
                <span className="text-[9px] font-black tracking-widest uppercase text-[var(--text-muted)]">Archived</span>
              </div>
              <button
                onClick={() => setShowArchived(!showArchived)}
                className={cn(
                  "flex items-center gap-2 h-8 px-3 rounded-lg text-[9px] font-medium tracking-wider border transition-all",
                  showArchived
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-400/90 hover:bg-amber-500/20"
                    : "bg-[var(--bg-page)] border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                )}
              >
                {showArchived ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                {showArchived ? 'Showing Archived' : 'Hide Archived'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
