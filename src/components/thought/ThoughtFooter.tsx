import React, { useMemo } from 'react';
import { Link2, Link2Off, Calendar, Circle, Clock, CheckCircle2, CircleDot } from 'lucide-react';
import { type Thought } from '../../db';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { STATUS_COLORS, getColumnColor } from './constants';
import { useStore } from '../../store/useStore';
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
  isArchived?: boolean;
}

export const ThoughtFooter: React.FC<ThoughtFooterProps> = ({ 
  thought, 
  isReadOnly, 
  isSpatial,
  isSelected,
  linkingSourceId, 
  handleLinkAction,
  isArchived = false
}) => {
  const formattedDate = useMemo(() => formatRelativeDate(thought.startTime), [thought.startTime]);
  const kanbanColumns = useStore((state) => {
    const space = state.spaces.find(s => s.id === state.activeSpaceId);
    return space?.kanbanColumns;
  });

  // Show a status/progress badge when:
  // - Standard column (status = todo/doing/done): show existing badge
  // - Custom column (kanbanCol >= 4, status is none): show column-colored badge
  const statusBadge = useMemo(() => {
    if (thought.status !== 'none') {
      // Standard status badge (cols 1-3)
      const color = STATUS_COLORS[thought.status as keyof typeof STATUS_COLORS];
      return {
        color,
        label: thought.status,
        icon: thought.status === 'todo' ? <Circle className="w-2.5 h-2.5" />
            : thought.status === 'doing' ? <Clock className="w-2.5 h-2.5" />
            : <CheckCircle2 className="w-2.5 h-2.5" />,
      };
    }
    if (thought.kanbanCol !== undefined && thought.kanbanCol >= 4) {
      // Custom column badge (cols 4+)
      const color = getColumnColor(thought.kanbanCol);
      const colName = kanbanColumns?.[thought.kanbanCol] || `Col ${thought.kanbanCol}`;
      return {
        color,
        label: colName,
        icon: <CircleDot className="w-2.5 h-2.5" />,
      };
    }
    return null;
  }, [thought.status, thought.kanbanCol, kanbanColumns]);

  return (
    <div className={cn(
      "grid transition-all duration-300 ease-in-out",
      isArchived && "pointer-events-none",
      isSelected ? "grid-rows-[1fr] opacity-100 mt-auto" : "grid-rows-[0fr] opacity-0 pointer-events-none mt-0"
    )}>
      <div className="overflow-hidden">
        {/* The "Label" style line - Always visible for all thought types */}
        <div className="py-1 opacity-20 mt-2 flex justify-center">
          <div className="h-[1px] w-[100%] bg-blue-500/50 rounded-full" />
        </div>
        
        <div className="flex items-center justify-between min-h-[15px] pt-3 gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            {statusBadge && (
              <div 
                className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-lg border shadow-sm"
                style={{
                  color: statusBadge.color,
                  borderColor: `color-mix(in srgb, ${statusBadge.color} 20%, transparent)`,
                  backgroundColor: `color-mix(in srgb, ${statusBadge.color} 10%, transparent)`,
                }}
              >
                {statusBadge.icon}
                <span className="uppercase tracking-wider">{statusBadge.label}</span>
              </div>
            )}
            {thought.startTime && formattedDate && (
              <div className="flex items-center gap-1 text-[9px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-lg shadow-[0_0_15px_rgba(99,102,241,0.1)]">
                <Calendar className="w-2.5 h-2.5" />
                <span className="uppercase tracking-wider">{formattedDate}</span>
              </div>
            )}
          </div>

          {!isReadOnly && isSpatial && (
            <button
              onClick={handleLinkAction}
              disabled={isArchived}
              className={cn(
                "p-1.5 rounded-xl transition-all relative shrink-0",
                isArchived && "pointer-events-none opacity-50",
                linkingSourceId === thought.id
                  ? "bg-[var(--accent)] text-white shadow-[0_0_20px_var(--accent-glow)]"
                  : "bg-[var(--glass-bg)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-page)] border border-[var(--glass-border)]",
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
