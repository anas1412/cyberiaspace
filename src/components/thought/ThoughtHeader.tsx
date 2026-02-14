import React from 'react';
import { type Thought } from '../../db';
import { PRIO_COLORS, STATUS_COLORS } from './constants';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ThoughtHeaderProps {
  thought: Thought;
  isCalendar: boolean;
  isExpanded: boolean;
}

export const ThoughtHeader: React.FC<ThoughtHeaderProps> = ({ thought, isCalendar, isExpanded }) => {
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
          <div className="text-[8px] font-mono text-[var(--accent)] border border-[var(--accent)]/20 px-1.5 py-0.5 rounded bg-[var(--accent)]/5">
            {thought.date}
          </div>
        )}
      </div>
    </div>
  );
};
