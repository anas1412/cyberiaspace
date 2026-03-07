import React from 'react';
import { type Thought } from '../../db';
import { PRIO_COLORS, STATUS_COLORS } from './constants';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatRelativeDate } from '../../utils/date';
import { Calendar, Globe, RefreshCw, AlertCircle, CloudOff } from 'lucide-react';

import { useAuthStore } from '../../store/useAuthStore';

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
  const isAuthenticated = useAuthStore(state => state.status === 'authenticated');

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
        {thought.date && formattedDate && !isCalendar && (
          <div className="flex items-center gap-1 text-[9px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-lg shadow-[0_0_15px_rgba(99,102,241,0.1)]">
            <Calendar className="w-2.5 h-2.5" />
            <span className="uppercase tracking-wider">{formattedDate}</span>
          </div>
        )}
        {isAuthenticated && thought.syncStatus && thought.type !== 'label' && (
          <div className="flex items-center justify-center ml-1 group/sync relative">
            {thought.syncStatus === 'synced' ? (
              <div className="w-3 h-3 flex items-center justify-center rounded-full bg-green-500/10 border border-green-500/20 shadow-[0_0_8px_rgba(34,197,94,0.2)]">
                <Globe className="w-2 h-2 text-green-500 opacity-80" />
              </div>
            ) : thought.syncStatus === 'pending' || thought.syncStatus === 'syncing' ? (
              <div className="relative">
                <RefreshCw className="w-2.5 h-2.5 text-blue-400 animate-spin opacity-80" />
                <div className="absolute inset-0 bg-blue-400/20 blur-sm rounded-full animate-pulse" />
              </div>
            ) : thought.syncStatus === 'error' ? (
              <div className="relative">
                <AlertCircle className="w-3 h-3 text-red-500 animate-pulse" />
                {/* Tooltip for error */}
                <div className="absolute bottom-full right-0 mb-2 hidden group-hover/sync:block z-[100] pointer-events-none">
                  <div className="bg-red-950/90 backdrop-blur-md border border-red-500/30 rounded-lg p-2 shadow-2xl min-w-[120px]">
                    <p className="text-[7px] font-black uppercase tracking-widest text-red-400">Sync Failure</p>
                    <p className="text-[8px] font-bold text-red-200/70 mt-0.5 leading-tight">Media asset missing or Drive connection interrupted.</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="group/local relative">
                <CloudOff className="w-3 h-3 text-slate-600 opacity-40 hover:opacity-100 transition-opacity" />
                <div className="absolute bottom-full right-0 mb-2 hidden group-hover/local:block z-[100] pointer-events-none">
                  <div className="glass p-2 rounded-lg shadow-2xl min-w-[100px]">
                    <p className="text-[7px] font-black uppercase tracking-widest text-slate-400">Local Only</p>
                    <p className="text-[8px] font-bold text-slate-500 mt-0.5 leading-tight uppercase">Connect Drive to backup media assets.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

