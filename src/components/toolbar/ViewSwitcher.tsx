import React from 'react';
import { Orbit, Columns3, CalendarDays } from 'lucide-react';
import AccountMenu from '../AccountMenu';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ViewSwitcherProps {
  activeSpace: any;
  setViewMode: (mode: 'spatial' | 'kanban' | 'calendar') => void;
}

export const ViewSwitcher: React.FC<ViewSwitcherProps> = ({ activeSpace, setViewMode }) => (
  <div className="flex items-center gap-2 flex-shrink-0 pointer-events-none z-20">
    <div className="flex items-center h-[48px] p-1.5 glass rounded-2xl shadow-2xl transition-all pointer-events-auto border border-white/5">
      {[
        { id: 'spatial', icon: Orbit, color: 'bg-[var(--accent)]' },
        { id: 'kanban', icon: Columns3, color: 'bg-purple-500' },
        { id: 'calendar', icon: CalendarDays, color: 'bg-amber-500' }
      ].map((mode) => {
        const isActive = activeSpace?.mode === mode.id;
        const Icon = mode.icon;
        return (
          <button key={mode.id} onClick={() => setViewMode(mode.id as 'spatial' | 'kanban' | 'calendar')} className={cn("px-3 md:px-4 h-full rounded-xl transition-all duration-300 flex items-center gap-2 group/mode", isActive ? "bg-white/10 text-white shadow-xl" : "text-slate-500 hover:text-slate-300 hover:bg-white/[0.03]")}>
            <div className={cn("w-1 h-1 md:w-1.5 md:h-1.5 rounded-full transition-all", isActive ? mode.color : "bg-white/10 group-hover/mode:bg-white/30")} />
            <Icon className={cn("w-3.5 h-3.5 md:w-4 md:h-4 transition-transform", isActive ? "scale-110" : "scale-90")} />
            <span className={cn("text-[9px] font-black uppercase tracking-widest transition-all overflow-hidden whitespace-nowrap hidden 2xl:inline", isActive ? "w-14 opacity-100" : "w-0 opacity-0")}>{mode.id}</span>
          </button>
        );
      })}
    </div>
    <div className="pointer-events-auto"><AccountMenu /></div>
  </div>
);
