import React, { useMemo } from 'react';
import { Link2, Link2Off, Circle, Clock, CheckCircle2, CircleDot } from 'lucide-react';
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
  linkingSourceId: string | null;
  handleLinkAction: (e: React.MouseEvent) => void;
  isArchived?: boolean;
}

export const ThoughtFooter: React.FC<ThoughtFooterProps> = ({ 
  thought, 
  isReadOnly, 
  isSpatial,
  linkingSourceId, 
  handleLinkAction,
  isArchived = false
}) => {
  const formattedDate = useMemo(() => formatRelativeDate(thought.startTime), [thought.startTime]);
  const kanbanColumns = useStore((state) => {
    const space = state.spaces.find(s => s.id === state.activeSpaceId);
    return space?.kanbanColumns;
  });

  const statusBadge = useMemo(() => {
    if (thought.status !== 'none') {
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

  const showMetadata = statusBadge || (thought.startTime && formattedDate);
  if (!showMetadata && isReadOnly) return null;

  return (
    <div className={cn("relative", isArchived && "pointer-events-none")}>
      {/* Inline metadata row — always visible */}
      {(statusBadge || (thought.startTime && formattedDate)) && (
        <div className="flex items-center gap-1.5 flex-wrap pt-2.5">
          {statusBadge && (
            <div 
              className="flex items-center gap-1 text-[8px] font-bold px-1.5 py-0.5 rounded-md"
              style={{
                color: statusBadge.color,
                backgroundColor: `color-mix(in srgb, ${statusBadge.color} 12%, transparent)`,
              }}
            >
              {statusBadge.icon}
              <span className="uppercase tracking-wider">{statusBadge.label}</span>
            </div>
          )}
          {thought.startTime && formattedDate && (
            <span className="text-[8px] font-semibold text-[var(--text-muted)] tracking-wide">
              {formattedDate}
            </span>
          )}
        </div>
      )}

      {/* Floating link button — appears on node hover */}
      {isSpatial && !isReadOnly && (
        <button
          onClick={handleLinkAction}
          disabled={isArchived}
          className={cn(
            "absolute -bottom-1.5 -right-1.5 p-1.5 rounded-xl transition-all opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
            isArchived && "pointer-events-none opacity-50",
            linkingSourceId === thought.id
              ? "bg-[var(--accent)] text-white shadow-[0_0_20px_var(--accent-glow)] opacity-100"
              : "bg-[var(--glass-bg)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-page)] border border-[var(--glass-border)] shadow-sm",
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
            <Link2Off className="w-3.5 h-3.5" />
          ) : (
            <Link2 className="w-3.5 h-3.5" />
          )}
        </button>
      )}
    </div>
  );
};
