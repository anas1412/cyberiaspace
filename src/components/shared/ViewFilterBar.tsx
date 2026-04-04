import React, { useRef, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { useModalStore } from '../../store/useModalStore';
import { Search, X, Layers, Archive, Eye, EyeOff } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ViewFilterBarProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  stackFilter: string[] | null;
  setStackFilter: (ids: string[] | null) => void;
  /** Layout style: 'vertical' for sidebar (Calendar), 'horizontal' for top bar */
  layout?: 'vertical' | 'horizontal';
  /** Whether to show archived thoughts */
  showArchived?: boolean;
  /** Toggle showing archived thoughts */
  onToggleArchived?: () => void;
}

export const ViewFilterBar: React.FC<ViewFilterBarProps> = ({
  searchQuery,
  setSearchQuery,
  stackFilter,
  setStackFilter,
  layout = 'vertical',
  showArchived = false,
  onToggleArchived,
}) => {
  const stacks = useStore((state) => state.stacks);
  const activeSpaceId = useStore((state) => state.activeSpaceId);
  const isReadOnly = useStore((state) => state.isReadOnly);

  const reelRef = useRef<HTMLDivElement>(null);
  const activeStacks = isReadOnly ? stacks : stacks.filter(s => s.spaceId === activeSpaceId);

  // Enable horizontal scrolling with mouse wheel
  useEffect(() => {
    const el = reelRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY === 0) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const isVertical = layout === 'vertical';

  return (
    <div className={cn(
      isVertical 
        ? "flex flex-col gap-4 p-4 border-b border-[var(--glass-border)]" 
        : "flex items-center gap-4 px-6 h-14 w-full"
    )}>
      {/* Search Input */}
      <div className={cn("relative group", isVertical ? "w-full" : "w-64")}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)] group-focus-within:text-[var(--accent)] transition-colors" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search..."
          className="w-full h-9 bg-[var(--bg-page)] border border-[var(--glass-border)] rounded-xl pl-9 pr-9 text-[11px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent)]/10 transition-all placeholder:text-[var(--text-muted)]"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-[var(--text-primary)]/10 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Stack Reel */}
      <div className={cn(isVertical ? "space-y-2" : "flex items-center gap-3 flex-1 overflow-hidden")}>
        {isVertical && (
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Layers className="w-3 h-3 text-[var(--text-muted)]" />
              <span className="text-[8px] font-semibold tracking-widest text-[var(--text-muted)]">Stacks</span>
            </div>
            {stackFilter && stackFilter.length > 0 && (
              <button
                onClick={() => setStackFilter(null)}
                className="text-[8px] font-medium tracking-widest text-[var(--accent)] hover:underline"
              >
                Clear
              </button>
            )}
          </div>
        )}

        {!isVertical && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <Layers className="w-3 h-3 text-[var(--text-muted)]" />
            <span className="text-[8px] font-semibold tracking-widest text-[var(--text-muted)]">Stacks</span>
          </div>
        )}
        
        <div 
          ref={reelRef}
          className={cn(
            "flex gap-1.5 overflow-x-auto custom-scroll pb-2",
            !isVertical && "no-scrollbar pb-0.5 items-center"
          )}
        >
          <button
            onClick={() => setStackFilter(null)}
            className={cn(
              "flex-shrink-0 px-3 py-1.5 rounded-lg text-[9px] font-medium tracking-widest border transition-all",
              !stackFilter || stackFilter.length === 0
                ? "bg-[var(--accent)]/20 border-[var(--accent)] text-[var(--text-primary)] shadow-[0_0_10px_var(--accent-glow)]"
                : "bg-[var(--bg-page)] border-transparent text-[var(--text-muted)] hover:text-[var(--text-dimmed)]"
            )}
          >
            All
          </button>
          {activeStacks.map((stack) => {
            const isActive = stackFilter?.includes(stack.id) ?? false;
            return (
            <div key={stack.id} className="relative group/stack flex-shrink-0">
              <button
                onClick={() => {
                  const current = stackFilter ?? [];
                  const next = isActive ? current.filter(s => s !== stack.id) : [...current, stack.id];
                  setStackFilter(next.length ? next : null);
                }}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[9px] font-medium tracking-widest border transition-all truncate max-w-[120px]",
                  !isReadOnly && "pr-6",
                  isActive
                    ? "border-current text-[var(--text-primary)] shadow-lg"
                    : "bg-[var(--bg-page)] border-transparent text-[var(--text-muted)] hover:text-[var(--text-dimmed)]"
                )}
                style={isActive ? { 
                  backgroundColor: stack.color.replace('1)', '0.3)'),
                  color: stack.color 
                } : {}}
              >
                {stack.name}
              </button>
              {!isReadOnly && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    useModalStore.getState().openModal({
                      title: 'Dissolve Stack?',
                      description: `This will unlink all thoughts from "${stack.name}".`,
                      type: 'delete_stack',
                      confirmText: 'Dissolve',
                      onConfirm: () => {
                        useStore.getState().deleteStack(stack.id);
                        if (stackFilter?.includes(stack.id)) {
                          const next = stackFilter.filter(s => s !== stack.id);
                          setStackFilter(next.length ? next : null);
                        }
                      }
                    });
                  }}
                  className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-[var(--text-muted)] hover:text-red-400 opacity-0 group-hover/stack:opacity-100 transition-all z-10"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
            );
          })}
        </div>

        {!isVertical && stackFilter && stackFilter.length > 0 && (
          <button
            onClick={() => setStackFilter(null)}
            className="text-[8px] font-medium tracking-widest text-[var(--accent-secondary)] hover:underline flex-shrink-0"
          >
            Clear Stacks
          </button>
        )}
      </div>

      {/* Show Archived Toggle */}
      {onToggleArchived && (
        <div className={cn(isVertical ? "pt-2 border-t border-[var(--glass-border)]" : "ml-auto")}>
          <button
            onClick={onToggleArchived}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-[9px] font-medium tracking-widest border transition-all",
              showArchived
                ? "bg-amber-500/10 border-amber-500/30 text-amber-400/90 hover:bg-amber-500/20"
                : "bg-[var(--bg-page)] border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg)]"
            )}
          >
            <Archive className="w-3 h-3" />
            {showArchived ? (
              <>
                <Eye className="w-3 h-3" />
                <span>Showing Archived</span>
              </>
            ) : (
              <>
                <EyeOff className="w-3 h-3" />
                <span>Hide Archived</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
