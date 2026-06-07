import React from 'react';
import { type Thought } from '../../db';
import { PRIO_COLORS } from './constants';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Globe } from 'lucide-react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ThoughtHeaderProps {
  thought: Thought;
  isCalendar: boolean;
  isExpanded: boolean;
  isArchived?: boolean;
}

export const ThoughtHeader: React.FC<ThoughtHeaderProps> = ({ thought, isCalendar, isExpanded, isArchived = false }) => {
  return (
    <div className={cn("flex items-start justify-between gap-4 pointer-events-none", isArchived && "pointer-events-none", isCalendar && !isExpanded ? "min-h-0" : "min-h-[24px]")}>
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
          thought.text ? "text-[var(--text-primary)]" : "text-[var(--text-muted)] italic",
          isCalendar && !isExpanded && "truncate max-w-[180px]"
        )}>
          {thought.text || thought.placeholder || "Untitled"}
        </p>
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
        {thought.type === 'file' && (
          <div className="flex items-center justify-center ml-1">
            <div className="w-3 h-3 flex items-center justify-center rounded-full bg-green-500/10 border border-green-500/20 shadow-[0_0_8px_rgba(34,197,94,0.2)]">
              <Globe className="w-2 h-2 text-green-500 opacity-80" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

