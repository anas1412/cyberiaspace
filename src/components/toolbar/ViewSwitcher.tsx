import React from 'react';
import { Orbit, Columns3, CalendarDays, FolderTree } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const VIEW_MODES = [
  { id: 'spatial' as const, label: 'Spatial', icon: Orbit, accentClass: 'bg-[var(--accent)]' },
  { id: 'directory' as const, label: 'Directory', icon: FolderTree, accentClass: 'bg-[var(--accent)]' },
  { id: 'kanban' as const, label: 'Kanban', icon: Columns3, accentClass: 'bg-[var(--accent)]' },
  { id: 'calendar' as const, label: 'Calendar', icon: CalendarDays, accentClass: 'bg-[var(--accent)]' },
];

type ViewModeId = typeof VIEW_MODES[number]['id'];

interface ViewSwitcherProps {
  activeSpace: { mode?: ViewModeId } | null | undefined;
  setViewMode: (mode: ViewModeId) => void;
}

export const ViewSwitcher: React.FC<ViewSwitcherProps> = ({ activeSpace, setViewMode }) => (
  <div className="flex items-center h-[48px] p-1.5 glass rounded-2xl transition-all pointer-events-auto border border-[var(--glass-border)]">
    {VIEW_MODES.map((mode) => {
      const isActive = activeSpace?.mode === mode.id;
      const Icon = mode.icon;
      return (
        <button
          key={mode.id}
          onClick={() => setViewMode(mode.id)}
          className={cn(
            "px-2.5 md:px-4 h-full rounded-xl transition-all duration-300 flex items-center gap-2 group/mode",
            isActive
              ? "bg-[var(--text-primary)]/10 text-[var(--text-primary)] shadow-[var(--shadow-elevation-2)]"
              : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--text-primary)]/[0.03]"
          )}
        >
          <div className={cn(
            "hidden md:block w-1 md:w-1.5 h-1 md:h-1.5 rounded-full transition-all",
            isActive 
              ? mode.accentClass
              : "bg-[var(--text-muted)]/30 group-hover/mode:bg-[var(--text-muted)]"
          )} />
          <Icon className={cn(
            "w-3.5 h-3.5 md:w-4 md:h-4 transition-transform",
            isActive ? "scale-110" : "scale-90"
          )} />
          <span className={cn(
            "text-[8px] md:text-[9px] font-black uppercase tracking-widest transition-all overflow-hidden whitespace-nowrap hidden md:inline",
            isActive ? "max-w-[60px] opacity-100" : "max-w-0 opacity-0"
          )}>
            {mode.label}
          </span>
        </button>
      );
    })}
  </div>
);
