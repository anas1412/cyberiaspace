import React, { useEffect, useRef } from 'react';
import { useStore } from '../../store/useStore';
import { Search, X, Circle, Clock, CheckCircle2, Calendar, Tag, Archive, Eye, EyeOff, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ThoughtRegistry } from '../thought/registry';
import type { ThoughtType } from '../../db';
import type { Space } from '../../db';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const STATUS_OPTIONS = [
  { value: 'todo', label: 'Todo', icon: Circle, color: 'var(--status-todo)' },
  { value: 'doing', label: 'Doing', icon: Clock, color: 'var(--status-doing)' },
  { value: 'done', label: 'Done', icon: CheckCircle2, color: 'var(--status-done)' },
];

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

const DateFilterPicker: React.FC<{
  value: string | null;
  onChange: (date: string | null) => void;
}> = ({ value, onChange }) => {
  const formatDisplay = () => {
    if (!value) return 'Set Date';
    const d = new Date(value + 'T12:00:00');
    return d.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();
  };

  return (
    <button
      onClick={() => {
        const picker = document.createElement('input');
        picker.type = 'date';
        picker.className = 'absolute opacity-0 pointer-events-none';
        document.body.appendChild(picker);
        picker.addEventListener('change', () => {
          onChange(picker.value || null);
          document.body.removeChild(picker);
        });
        picker.addEventListener('blur', () => {
          setTimeout(() => document.body.removeChild(picker), 200);
        });
        picker.showPicker?.();
        try { picker.click?.(); } catch {}
      }}
      className={cn(
        "h-7 px-2.5 rounded-lg text-[9px] font-medium tracking-wider border transition-all flex items-center gap-1.5",
        value
          ? "bg-[var(--accent)]/20 border-[var(--accent)] text-[var(--text-primary)]"
          : "bg-[var(--bg-page)] border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
      )}
    >
      <Calendar className="w-3 h-3" />
      {formatDisplay()}
      {value && (
        <span
          onClick={(e) => { e.stopPropagation(); onChange(null); }}
          className="ml-1 p-0.5 rounded-full hover:bg-[var(--accent)]/30"
        >
          <X className="w-2.5 h-2.5" />
        </span>
      )}
    </button>
  );
};

export const SearchOverlay: React.FC<SearchOverlayProps> = ({ isOpen, onClose }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const activeSpace = useStore((state) => state.spaces.find((s) => s.id === state.activeSpaceId)) as Space | undefined;
  const mode = activeSpace?.mode ?? 'spatial';
  const isDirectoryMode = mode === 'directory';
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
  const directorySearchQuery = useStore((state) => state.directorySearchQuery);
  const setDirectorySearchQuery = useStore((state) => state.setDirectorySearchQuery);

  const searchQuery = mode === 'spatial' ? spatialSearchQuery : mode === 'kanban' ? kanbanSearchQuery : mode === 'calendar' ? calendarSearchQuery : directorySearchQuery;
  const setSearchQuery = mode === 'spatial' ? setSpatialSearchQuery : mode === 'kanban' ? setKanbanSearchQuery : mode === 'calendar' ? setCalendarSearchQuery : setDirectorySearchQuery;

  // Mode-specific stack filter
  const spatialStackFilter = useStore((state) => state.spatialStackFilter);
  const setSpatialStackFilter = useStore((state) => state.setSpatialStackFilter);
  const kanbanStackFilter = useStore((state) => state.kanbanStackFilter);
  const setKanbanStackFilter = useStore((state) => state.setKanbanStackFilter);
  const calendarStackFilter = useStore((state) => state.calendarStackFilter);
  const setCalendarStackFilter = useStore((state) => state.setCalendarStackFilter);

  const stackFilter = (mode === 'spatial' ? spatialStackFilter : mode === 'kanban' ? kanbanStackFilter : calendarStackFilter) as string[] | null;
  const setStackFilter = mode === 'spatial' ? setSpatialStackFilter : mode === 'kanban' ? setKanbanStackFilter : setCalendarStackFilter;

  // Mode-specific status filter
  const spatialStatusFilter = useStore((state) => state.spatialStatusFilter);
  const setSpatialStatusFilter = useStore((state) => state.setSpatialStatusFilter);
  const kanbanStatusFilter = useStore((state) => state.kanbanStatusFilter);
  const setKanbanStatusFilter = useStore((state) => state.setKanbanStatusFilter);
  const calendarStatusFilter = useStore((state) => state.calendarStatusFilter);
  const setCalendarStatusFilter = useStore((state) => state.setCalendarStatusFilter);

  const statusFilter = (mode === 'spatial' ? spatialStatusFilter : mode === 'kanban' ? kanbanStatusFilter : calendarStatusFilter) as Array<'todo' | 'doing' | 'done'> | null;
  const setStatusFilter = mode === 'spatial' ? setSpatialStatusFilter : mode === 'kanban' ? setKanbanStatusFilter : setCalendarStatusFilter;

  // Mode-specific date filter
  const spatialDateFilter = useStore((state) => state.spatialDateFilter);
  const setSpatialDateFilter = useStore((state) => state.setSpatialDateFilter);
  const spatialTypeFilter = useStore((state) => state.spatialTypeFilter);
  const setSpatialTypeFilter = useStore((state) => state.setSpatialTypeFilter);
  const kanbanDateFilter = useStore((state) => state.kanbanDateFilter);
  const setKanbanDateFilter = useStore((state) => state.setKanbanDateFilter);
  const kanbanTypeFilter = useStore((state) => state.kanbanTypeFilter);
  const setKanbanTypeFilter = useStore((state) => state.setKanbanTypeFilter);
  const calendarTypeFilter = useStore((state) => state.calendarTypeFilter);
  const setCalendarTypeFilter = useStore((state) => state.setCalendarTypeFilter);

  const dateFilter = mode === 'spatial' ? spatialDateFilter : mode === 'kanban' ? kanbanDateFilter : null;
  const setDateFilter = mode === 'spatial' ? setSpatialDateFilter : mode === 'kanban' ? setKanbanDateFilter : null;

  const typeFilter = (mode === 'spatial' ? spatialTypeFilter : mode === 'kanban' ? kanbanTypeFilter : calendarTypeFilter) as string[] | null;
  const setTypeFilter = mode === 'spatial' ? setSpatialTypeFilter : mode === 'kanban' ? setKanbanTypeFilter : setCalendarTypeFilter as any;

  // Archive
  const showArchived = useStore((state) => state.showArchived);
  const setShowArchived = useStore((state) => state.setShowArchived);

  const handleClearFilters = () => {
    setSearchQuery('');
    setStackFilter(null);
    setStatusFilter(null);
    if (setDateFilter) setDateFilter(null);
    if (setTypeFilter) setTypeFilter(null);
  };

  const hasActiveFilters = searchQuery || (stackFilter && stackFilter.length > 0) || (statusFilter && statusFilter.length > 0) || dateFilter || (typeFilter && typeFilter.length > 0);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[10001] pointer-events-auto"
          onClick={onClose}
        >
          {/* Backdrop */}
          <div className="absolute inset-0" />

          {/* Overlay Panel */}
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.97 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            onClick={e => e.stopPropagation()}
            className="absolute top-24 left-1/2 -translate-x-1/2 w-full max-w-lg mx-auto glass backdrop-blur-xl rounded-2xl border border-[var(--glass-border)] shadow-2xl overflow-hidden"
          >
            {/* Search Input */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--glass-border)]">
              <Search className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search thoughts..."
                className="flex-1 bg-transparent text-[13px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="p-1 hover:bg-[var(--text-primary)]/10 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <button onClick={onClose} className="p-1.5 hover:bg-[var(--text-primary)]/10 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Filter Chips */}
            <div className="p-5 space-y-5 max-h-[60vh] overflow-y-auto custom-scroll">
              {/* Status */}
              {!isDirectoryMode && mode !== 'kanban' && (
                <div>
                  <div className="flex items-center gap-2 mb-2.5">
                    <Circle className="w-3 h-3 text-[var(--text-muted)]" />
                    <span className="text-[9px] font-black tracking-widest uppercase text-[var(--text-muted)]">Status</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {STATUS_OPTIONS.map((status) => {
                      const Icon = status.icon;
                      const isActive = statusFilter?.includes(status.value as 'todo' | 'doing' | 'done') ?? false;
                      return (
                        <button
                          key={status.value}
                          onClick={() => {
                            const val = status.value as 'todo' | 'doing' | 'done';
                            const current = statusFilter ?? [];
                            const next = current.includes(val)
                              ? current.filter(s => s !== val)
                              : [...current, val];
                            setStatusFilter(next.length ? next : null);
                          }}
                          className={cn(
                            "h-7 px-2.5 rounded-lg text-[9px] font-medium tracking-wider border transition-all flex items-center gap-1.5",
                            isActive
                              ? "bg-[var(--accent)]/20 border-[var(--accent)] text-[var(--text-primary)]"
                              : "bg-[var(--bg-page)] border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                          )}
                        >
                          <Icon className="w-2.5 h-2.5" style={{ color: status.color }} />
                          {status.label}
                        </button>
                      );
                    })}
                    {(statusFilter && statusFilter.length > 0) && (
                      <button onClick={() => setStatusFilter(null)} className="h-7 px-2 rounded-lg text-[8px] font-medium tracking-wider text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Type */}
              {!isDirectoryMode && (
                <div>
                  <div className="flex items-center gap-2 mb-2.5">
                    <Tag className="w-3 h-3 text-[var(--text-muted)]" />
                    <span className="text-[9px] font-black tracking-widest uppercase text-[var(--text-muted)]">Type</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(Object.entries(ThoughtRegistry) as [ThoughtType, typeof ThoughtRegistry[ThoughtType]][]).map(([type, config]) => {
                      const Icon = config.icon;
                      const isActive = typeFilter?.includes(type) ?? false;
                      return (
                        <button
                          key={type}
                          onClick={() => {
                            const current: string[] = typeFilter ?? [];
                            const next = isActive ? current.filter(t => t !== type) : [...current, type];
                            setTypeFilter(next.length ? next : null);
                          }}
                          className={cn(
                            "h-7 px-2.5 rounded-lg text-[9px] font-medium tracking-wider border transition-all flex items-center gap-1.5",
                            isActive
                              ? "bg-[var(--accent)]/20 border-[var(--accent)] text-[var(--text-primary)]"
                              : "bg-[var(--bg-page)] border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                          )}
                        >
                          <Icon className="w-3 h-3" />
                          {config.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Date */}
              {!isDirectoryMode && mode !== 'calendar' && setDateFilter && (
                <div>
                  <div className="flex items-center gap-2 mb-2.5">
                    <Calendar className="w-3 h-3 text-[var(--text-muted)]" />
                    <span className="text-[9px] font-black tracking-widest uppercase text-[var(--text-muted)]">Date</span>
                  </div>
                  <DateFilterPicker value={dateFilter} onChange={(date) => setDateFilter(date)} />
                </div>
              )}

              {/* Collection */}
              {!isDirectoryMode && (
                <div>
                  <div className="flex items-center gap-2 mb-2.5">
                    <ChevronDown className="w-3 h-3 text-[var(--text-muted)]" />
                    <span className="text-[9px] font-black tracking-widest uppercase text-[var(--text-muted)]">Collection</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {activeStacks.map((stack) => {
                      const isActive = stackFilter?.includes(stack.id) ?? false;
                      return (
                        <button
                          key={stack.id}
                          onClick={() => {
                            const current = stackFilter ?? [];
                            const next = isActive ? current.filter(s => s !== stack.id) : [...current, stack.id];
                            setStackFilter(next.length ? next : null);
                          }}
                          className={cn(
                            "h-7 px-2.5 rounded-lg text-[9px] font-medium tracking-wider border transition-all",
                            isActive
                              ? "border-current text-[var(--text-primary)]"
                              : "bg-[var(--bg-page)] border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                          )}
                          style={isActive ? {
                            backgroundColor: stack.color.replace('1)', '0.3)'),
                            color: stack.color
                          } : {}}
                        >
                          {stack.name}
                        </button>
                      );
                    })}
                    {activeStacks.length === 0 && (
                      <span className="text-[10px] text-[var(--text-muted)] italic">No collections yet</span>
                    )}
                  </div>
                </div>
              )}

              {/* Archive Toggle */}
              <div>
                <div className="flex items-center gap-2 mb-2.5">
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

              {/* Clear All */}
              {hasActiveFilters && (
                <div className="pt-2 border-t border-[var(--glass-border)]">
                  <button onClick={handleClearFilters} className="text-[9px] font-semibold tracking-wider text-[var(--accent)] hover:underline">
                    Clear all filters
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
