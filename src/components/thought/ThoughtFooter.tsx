import React, { useMemo } from 'react';
import { Link2, Link2Off, Calendar, Circle, Clock, CheckCircle2 } from 'lucide-react';
import { type Thought } from '../../db';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { STATUS_COLORS } from './constants';
import { formatRelativeDate } from '../../utils/date';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ThoughtFooterProps {
  thought: Thought;
  isReadOnly: boolean;
  isSpatial: boolean;
  isSelected: boolean;
  linkingSourceId: string | null;
  handleLinkAction: (e: React.MouseEvent) => void;
}

export const ThoughtFooter: React.FC<ThoughtFooterProps> = ({ 
  thought, 
  isReadOnly, 
  isSpatial,
  isSelected,
  linkingSourceId, 
  handleLinkAction 
}) => {
  const formattedDate = useMemo(() => formatRelativeDate(thought.date), [thought.date]);

  return (
    <div className={cn(
      "grid transition-all duration-300 ease-in-out",
      isSelected ? "grid-rows-[1fr] opacity-100 mt-auto" : "grid-rows-[0fr] opacity-0 pointer-events-none mt-0"
    )}>
      <div className="overflow-hidden">
        {/* The "Label" style line - Always visible for all thought types */}
        <div className="py-1 opacity-20 mt-2 flex justify-center">
          <div className="h-[1px] w-[100%] bg-blue-500/50 rounded-full" />
        </div>
        
        <div className="flex items-center justify-between min-h-[15px] pt-3 gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            {thought.status !== 'none' && (
              <div 
                className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-lg border shadow-sm"
                style={{
                  color: STATUS_COLORS[thought.status as keyof typeof STATUS_COLORS],
                  borderColor: `color-mix(in srgb, ${STATUS_COLORS[thought.status as keyof typeof STATUS_COLORS]} 20%, transparent)`,
                  backgroundColor: `color-mix(in srgb, ${STATUS_COLORS[thought.status as keyof typeof STATUS_COLORS]} 10%, transparent)`,
                }}
              >
                {thought.status === 'todo' && <Circle className="w-2.5 h-2.5" />}
                {thought.status === 'doing' && <Clock className="w-2.5 h-2.5" />}
                {thought.status === 'done' && <CheckCircle2 className="w-2.5 h-2.5" />}
                <span className="uppercase tracking-wider">{thought.status}</span>
              </div>
            )}
            {thought.date && formattedDate && (
              <div className="flex items-center gap-1 text-[9px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-lg shadow-[0_0_15px_rgba(99,102,241,0.1)]">
                <Calendar className="w-2.5 h-2.5" />
                <span className="uppercase tracking-wider">{formattedDate}</span>
              </div>
            )}
          </div>

          {!isReadOnly && isSpatial && (
            <button
              onClick={handleLinkAction}
              className={cn(
                "p-1.5 rounded-xl transition-all relative shrink-0",
                linkingSourceId === thought.id
                  ? "bg-[var(--accent)] text-white shadow-[0_0_20px_var(--accent-glow)]"
                  : "bg-white/5 text-slate-500 hover:text-white hover:bg-white/10 border border-white/5",
                thought.stackId && !linkingSourceId && "hover:text-red-400 hover:bg-red-500/10"
              )}
              title={
                linkingSourceId === thought.id 
                  ? "Cancel Linking" 
                  : thought.stackId 
                    ? "Remove from collection" 
                    : "Link to another thought"
              }
            >
              {thought.stackId && linkingSourceId !== thought.id ? (
                <Link2Off className="w-4 h-4" />
              ) : (
                <Link2 className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
