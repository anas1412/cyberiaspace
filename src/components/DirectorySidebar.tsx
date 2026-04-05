import React, { useCallback, useState } from 'react';
import { useStore } from '../store/useStore';
import { type DirectoryGroup } from '../utils/treeTransformation';
import { getThoughtConfig } from './thought/registry';
import {
  ChevronDown,
  ChevronRight,
  FolderTree,
  ListTodo,
  Calendar,
  Flag,
  Tag,
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const GROUP_BY_OPTIONS = [
  { id: 'stack' as const, label: 'Stacks', icon: FolderTree },
  { id: 'status' as const, label: 'Status', icon: ListTodo },
  { id: 'date' as const, label: 'Date', icon: Calendar },
  { id: 'priority' as const, label: 'Priority', icon: Flag },
  { id: 'type' as const, label: 'Type', icon: Tag },
] as const;

const SORT_OPTIONS = [
  { id: 'order' as const, label: 'Manual' },
  { id: 'alpha' as const, label: 'A → Z' },
  { id: 'alpha-reverse' as const, label: 'Z → A' },
  { id: 'date-newest' as const, label: 'Newest' },
  { id: 'date-oldest' as const, label: 'Oldest' },
] as const;

const STATUS_COLORS: Record<string, string> = {
  todo: 'text-blue-400',
  doing: 'text-amber-400',
  done: 'text-green-400',
  none: 'text-[var(--text-muted)]',
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'text-red-500',
  high: 'text-orange-400',
  medium: 'text-amber-400',
  low: 'text-blue-400',
  none: 'text-[var(--text-muted)]',
};

interface DirectorySidebarProps {
  groups: DirectoryGroup[];
}

export const DirectorySidebar: React.FC<DirectorySidebarProps> = ({ groups }) => {
  const thoughts = useStore((state) => state.thoughts);
  const directoryGroupBy = useStore((state) => state.directoryGroupBy);
  const directorySortBy = useStore((state) => state.directorySortBy);
  const directoryCollapsedGroups = useStore((state) => state.directoryCollapsedGroups);
  const directorySelectedThoughtId = useStore((state) => state.directorySelectedThoughtId);
  const selectedThoughtId = useStore((state) => state.selectedThoughtId);
  const setDirectoryGroupBy = useStore((state) => state.setDirectoryGroupBy);
  const setDirectorySortBy = useStore((state) => state.setDirectorySortBy);
  const toggleDirectoryGroupCollapse = useStore((state) => state.toggleDirectoryGroupCollapse);
  const setDirectorySelectedThoughtId = useStore((state) => state.setDirectorySelectedThoughtId);
  const setSelectedThoughtId = useStore((state) => state.setSelectedThoughtId);

  const [groupByOpen, setGroupByOpen] = useState(false);
  const [sortByOpen, setSortByOpen] = useState(false);

  const thoughtsMap = React.useMemo(() => new Map(thoughts.map((t) => [t.id, t])), [thoughts]);

  const handleSelectThought = useCallback(
    (id: string) => {
      setDirectorySelectedThoughtId(id);
      setSelectedThoughtId(id);
    },
    [setDirectorySelectedThoughtId, setSelectedThoughtId],
  );
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="directory-sidebar-header p-4 md:p-5 border-b border-[var(--glass-border)] text-[9px] md:text-[10px] font-black tracking-[0.2em] uppercase text-[var(--accent)] bg-[var(--glass-bg)] z-[40] flex-shrink-0 flex items-center justify-between">
        <span>Directory</span>
        <span className="text-[8px] text-[var(--text-muted)] tracking-normal normal-case font-medium">Search in Filters</span>
      </div>

      {/* Controls */}
      <div className="p-3 border-b border-[var(--glass-border)] flex-shrink-0">
        <div className="flex gap-2">
          {/* Group By */}
          <div className="flex-1 relative">
            <button
              onClick={() => setGroupByOpen(!groupByOpen)}
              className="w-full flex items-center justify-between gap-1.5 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl px-2.5 py-2 text-[10px] text-[var(--text-primary)] hover:border-[var(--accent)]/50 transition-colors"
            >
              <span className="flex items-center gap-1.5 truncate">
                {GROUP_BY_OPTIONS.find(o => o.id === directoryGroupBy) && (
                  React.createElement(GROUP_BY_OPTIONS.find(o => o.id === directoryGroupBy)!.icon, { className: "w-3 h-3 text-[var(--accent)] flex-shrink-0" })
                )}
                <span className="truncate">{GROUP_BY_OPTIONS.find(o => o.id === directoryGroupBy)?.label}</span>
              </span>
              <ChevronDown className={cn("w-3 h-3 text-[var(--text-muted)] flex-shrink-0 transition-transform", groupByOpen && "rotate-180")} />
              </button>
            {groupByOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--bg-page)] border border-[var(--glass-border)] rounded-xl shadow-xl shadow-black/20 z-50 overflow-hidden">
                {GROUP_BY_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => { setDirectoryGroupBy(opt.id); setGroupByOpen(false); }}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2 text-[11px] text-left transition-colors",
                        directoryGroupBy === opt.id
                          ? "bg-[var(--accent)]/10 text-[var(--accent)]"
                          : "text-[var(--text-primary)] hover:bg-[var(--glass-bg)]"
                      )}
                    >
                      <Icon className="w-3 h-3" />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sort By */}
          <div className="flex-1 relative">
            <button
              onClick={() => setSortByOpen(!sortByOpen)}
              className="w-full flex items-center justify-between gap-1.5 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl px-2.5 py-2 text-[10px] text-[var(--text-primary)] hover:border-[var(--accent)]/50 transition-colors"
            >
              <span className="truncate">{SORT_OPTIONS.find(o => o.id === directorySortBy)?.label}</span>
              <ChevronDown className={cn("w-3 h-3 text-[var(--text-muted)] flex-shrink-0 transition-transform", sortByOpen && "rotate-180")} />
            </button>
            {sortByOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--bg-page)] border border-[var(--glass-border)] rounded-xl shadow-xl shadow-black/20 z-50 overflow-hidden">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => { setDirectorySortBy(opt.id); setSortByOpen(false); }}
                    className={cn(
                      "w-full px-3 py-2 text-[11px] text-left transition-colors",
                      directorySortBy === opt.id
                        ? "bg-[var(--accent)]/10 text-[var(--accent)]"
                        : "text-[var(--text-primary)] hover:bg-[var(--glass-bg)]"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Groups List */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden relative p-2 custom-scroll overscroll-y-contain">
        {groups.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)]">
            <FolderTree className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-[11px] text-center">No thoughts yet</p>
          </div>
        )}

        {groups.map((group) => {
          const isCollapsed = directoryCollapsedGroups.has(group.id);
          const groupThoughts = group.thoughtIds
            .map((id) => thoughtsMap.get(id))
            .filter((t): t is NonNullable<typeof t> => !!t);

          return (
            <div key={group.id} className="mb-1">
              {/* Group Header */}
              <button
                onClick={() => toggleDirectoryGroupCollapse(group.id)}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-[var(--text-primary)]/5 transition-colors text-left"
              >
                {isCollapsed ? (
                  <ChevronRight className="w-3 h-3 text-[var(--text-muted)] flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-3 h-3 text-[var(--text-muted)] flex-shrink-0" />
                )}
                {group.color && (
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: group.color }}
                  />
                )}
                <span className="text-[11px] font-semibold text-[var(--text-primary)] truncate flex-1">
                  {group.label}
                </span>
                <span className="text-[9px] text-[var(--text-muted)] flex-shrink-0">
                  {group.thoughtIds.length}
                </span>
              </button>

              {/* Group Items */}
              {!isCollapsed &&
                groupThoughts.map((thought) => {
                  const config = getThoughtConfig(thought.type);
                  const Icon = config.icon;
                  const isSelected =
                    thought.id === directorySelectedThoughtId ||
                    thought.id === selectedThoughtId;

                  return (
                    <button
                      key={thought.id}
                      onClick={() => handleSelectThought(thought.id)}
                      className={cn(
                        'w-full flex items-center gap-2 px-2 py-1.5 pl-7 rounded-lg transition-colors text-left group/thought',
                        isSelected
                          ? 'bg-[var(--accent)]/10 border border-[var(--accent)]/30'
                          : 'hover:bg-[var(--text-primary)]/5 border border-transparent',
                      )}
                    >
                      <Icon className="w-3 h-3 text-[var(--text-muted)] flex-shrink-0 group-hover/thought:text-[var(--text-primary)] transition-colors" />
                      <span className="text-[12px] text-[var(--text-primary)] truncate flex-1">
                        {thought.text || 'Untitled'}
                      </span>
                      {/* Status dot */}
                      {thought.status && thought.status !== 'none' && (
                        <span
                          className={cn(
                            'w-1.5 h-1.5 rounded-full flex-shrink-0',
                            STATUS_COLORS[thought.status] ?? 'text-[var(--text-muted)]',
                          )}
                        />
                      )}
                      {/* Priority indicator */}
                      {thought.priority && thought.priority !== 'none' && (
                        <span
                          className={cn(
                            'text-[8px] font-bold uppercase tracking-wider flex-shrink-0',
                            PRIORITY_COLORS[thought.priority] ?? 'text-[var(--text-muted)]',
                          )}
                        >
                          {thought.priority[0]}
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>
          );
        })}
      </div>
    </div>
  );
};
