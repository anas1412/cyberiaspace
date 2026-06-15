import React from 'react';
import { type Thought } from '../../db';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

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
    <div className={cn("flex items-start justify-between pointer-events-none", isArchived && "pointer-events-none", isCalendar && !isExpanded ? "min-h-0" : "min-h-[24px]")}>
      <p className={cn(
        "text-[13px] font-bold leading-tight break-all flex-1",
        thought.text ? "text-[var(--text-primary)]" : "text-[var(--text-muted)] italic",
        isCalendar && !isExpanded && "truncate max-w-[180px]"
      )}>
        {thought.text || thought.placeholder || "Untitled"}
      </p>
    </div>
  );
};
