import React from 'react';
import { type Thought } from '../../db';
import { PRIO_COLORS, STATUS_COLORS } from './constants';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatRelativeDate } from '../../utils/date';
import { Calendar, Globe, RefreshCw, AlertCircle, CloudOff } from 'lucide-react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ThoughtHeaderProps {
  thought: Thought;
  isCalendar: boolean;
  isExpanded: boolean;
}

export const ThoughtHeader: React.FC<ThoughtHeaderProps> = ({ thought, isCalendar, isExpanded }) => {
  const formattedDate = React.useMemo(() => formatRelativeDate(thought.date), [thought.date]);

  return (
    <div className={cn("flex items-start justify-between gap-4", isCalendar && !isExpanded ? "min-h-0" : "min-h-[24px]")}>
      <div className="flex items-start gap-2.5 flex-1 min-w-0">
        {thought.priority !== 'none' && (
          <div
            className="w-1.5 h-1.5 rounded-full mt-[7px] flex-shrink-0"
            style={{
              backgroundColor: PRIO_COLORS[thought.priority as keyof typeof PRIO_COLORS],
              boxShadow: `0 0 10px ${PRIO_COLORS[thought.priority as keyof typeof PRIO_COLORS]}, 0 0 8px rgba(0,0,0,0.5)`
            }}
          />
        )}
        <p className={cn(
          "text-[13px] font-bold leading-tight break-all",
          thought.text ? "text-[var(--text-primary)]" : "text-slate-600 italic",
          isCalendar && !isExpanded && "truncate max-w-[180px]"
        )}>
          {thought.text || thought.placeholder || "Untitled"}
        </p>
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
        {thought.status !== 'none' && !isCalendar && (
          <div
            className="text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full border border-white/10 shadow-sm"
            style={{
              color: 'white',
              backgroundColor: STATUS_COLORS[thought.status as keyof typeof STATUS_COLORS],
            }}
          >
            {thought.status}
          </div>
        )}
        {thought.date && (
          <div className="flex items-center gap-1 text-[9px] font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-lg shadow-[0_0_15px_rgba(99,102,241,0.1)]">
            <Calendar className="w-2.5 h-2.5" />
            <span className="uppercase tracking-wider">{formattedDate}</span>
          </div>
        )}
        {thought.syncStatus && thought.type !== 'label' && (
          <div className="flex items-center justify-center ml-1">
            {thought.syncStatus === 'synced' ? (
              <div className="w-3 h-3 flex items-center justify-center rounded-full bg-green-500/10 border border-green-500/20 shadow-[0_0_8px_rgba(34,197,94,0.2)]">
                <Globe className="w-2 h-2 text-green-500 opacity-80" />
              </div>
            ) : thought.syncStatus === 'pending' ? (
              <RefreshCw className="w-2.5 h-2.5 text-indigo-400 animate-spin opacity-80" />
            ) : thought.syncStatus === 'error' ? (
              <AlertCircle className="w-3 h-3 text-red-500 animate-pulse" />
            ) : (
              <CloudOff className="w-3.5 h-3.5 text-slate-600 opacity-40" />
            )}
          </div>
        )}
      </div>
    </div>
  );
};
