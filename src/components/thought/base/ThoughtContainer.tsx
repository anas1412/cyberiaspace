import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Loader2, Trash2 } from 'lucide-react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ThoughtContainerProps {
  children: React.ReactNode;
  thoughtId: string;
  isDragging: boolean;
  isSelected: boolean;
  isDeleting: boolean;
  isCalendar: boolean;
  isExpanded: boolean;
  isReadOnly: boolean;
  isSpatial: boolean;
  isDemo: boolean;
  isInspectorOpen: boolean;
  linkingSourceId: string | null;
  altitudeStyles: React.CSSProperties;
  showPing: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onTouchStart: (e: React.TouchEvent) => void;
  onClick: (e: React.MouseEvent) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  elRef: React.RefObject<HTMLDivElement | null>;
}

export const ThoughtContainer = React.memo<ThoughtContainerProps>(({
  children,
  thoughtId,
  isDragging,
  isSelected,
  isDeleting,
  isCalendar,
  isExpanded,
  isReadOnly,
  isSpatial,
  isDemo,
  isInspectorOpen,
  linkingSourceId,
  altitudeStyles,
  showPing,
  onMouseDown,
  onTouchStart,
  onClick,
  onMouseEnter,
  onMouseLeave,
  elRef
}) => {
  return (
    <div
      ref={elRef}
      data-id={thoughtId}
      className={cn(
        "thought-bulb absolute select-none touch-none will-change-transform pointer-events-auto origin-top-left",
        "w-[280px]",
        isDragging ? "z-[1000] cursor-grabbing" : "z-20 cursor-grab",
        ((isReadOnly && !isSpatial && !isDemo) || isDeleting) && "cursor-default pointer-events-none"
      )}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      onDragStart={(e) => e.preventDefault()}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {showPing && (
        <div className="absolute inset-0 rounded-2xl border-2 border-[var(--accent)] animate-sonar pointer-events-none z-0" />
      )}
      
      {/* DELETING OVERLAY */}
      {isDeleting && (
        <div className="absolute inset-0 z-[50] rounded-2xl bg-black/60 backdrop-blur-sm border border-red-500/30 flex flex-col items-center justify-center gap-3 animate-in fade-in duration-300">
          <div className="relative">
            <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
            <Trash2 className="w-4 h-4 text-red-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <span className="text-[8px] font-black uppercase tracking-[0.2em] text-red-400">Purging Data</span>
        </div>
      )}

      <div
        className={cn(
          "thought-bulb-content group backdrop-blur-[20px] border rounded-2xl flex flex-col relative transition-all duration-300",
          isCalendar && !isExpanded ? "p-3 gap-0" : "p-4.5 gap-2",
          isSelected
            ? "border-[var(--accent)]/50 shadow-[0_0_40px_var(--accent-glow)] bg-[var(--node-bg)]/80"
            : "border-[var(--glass-border)] shadow-[0_10px_40px_rgba(0,0,0,0.5)] bg-[var(--node-bg)]/60",
          linkingSourceId === thoughtId && "ring-2 ring-[var(--accent)] shadow-[0_0_20px_var(--accent-glow)]",
          linkingSourceId && linkingSourceId !== thoughtId && "hover:scale-105 hover:border-[var(--accent)]/50 cursor-pointer",
          isSelected && isInspectorOpen && "animate-breathe"
        )}
        style={altitudeStyles}
      >
        {children}
      </div>
    </div>
  );
});
