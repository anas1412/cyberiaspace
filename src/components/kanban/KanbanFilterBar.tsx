import React, { useRef, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { useModalStore } from '../../store/useModalStore';
import { Search, X, Layers } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const KanbanFilterBar: React.FC = () => {
  const kanbanSearchQuery = useStore((state) => state.kanbanSearchQuery);
  const setKanbanSearchQuery = useStore((state) => state.setKanbanSearchQuery);
  const kanbanStackFilter = useStore((state) => state.kanbanStackFilter);
  const setKanbanStackFilter = useStore((state) => state.setKanbanStackFilter);
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

  return (
    <div className="flex items-center gap-4 px-6 h-14 border-b border-[var(--glass-border)] bg-black/20 backdrop-blur-md w-full">
      {/* Search Input */}
      <div className="relative group w-64">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)] group-focus-within:text-[var(--accent-secondary)] transition-colors" />
        <input
          type="text"
          value={kanbanSearchQuery}
          onChange={(e) => setKanbanSearchQuery(e.target.value)}
          placeholder="Search..."
          className="w-full h-9 bg-white/5 border border-white/5 rounded-xl pl-9 pr-9 text-[11px] text-white outline-none focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent)]/10 transition-all placeholder:text-[var(--text-muted)]"
        />
        {kanbanSearchQuery && (
          <button
            onClick={() => setKanbanSearchQuery('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-white/10 rounded-lg text-[var(--text-muted)] hover:text-white transition-all"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      <div className="w-px h-6 bg-white/10" />

      {/* Stack Reel */}
      <div className="flex-1 flex items-center gap-3 overflow-hidden">
        <div className="flex items-center gap-2 flex-shrink-0">
          <Layers className="w-3 h-3 text-[var(--text-muted)]" />
          <span className="text-[8px] font-black uppercase tracking-widest text-[var(--text-muted)]">Stacks</span>
        </div>
        
        <div 
          ref={reelRef}
          className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5 items-center"
        >
          <button
            onClick={() => setKanbanStackFilter(null)}
            className={cn(
              "flex-shrink-0 px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest border transition-all",
              !kanbanStackFilter
                ? "bg-[var(--accent)]/20 border-[var(--accent)] text-white shadow-[0_0_10px_var(--accent-glow)]"
                : "bg-white/5 border-transparent text-[var(--text-muted)] hover:text-slate-300"
            )}
          >
            All
          </button>
          {activeStacks.map((stack) => (
            <div key={stack.id} className="relative group/stack flex-shrink-0">
              <button
                onClick={() => setKanbanStackFilter(stack.id)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest border transition-all truncate max-w-[120px]",
                  !isReadOnly && "pr-6",
                  kanbanStackFilter === stack.id
                    ? "border-current text-white shadow-lg"
                    : "bg-white/5 border-transparent text-[var(--text-muted)] hover:text-slate-300"
                )}
                style={kanbanStackFilter === stack.id ? { 
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
                        if (kanbanStackFilter === stack.id) setKanbanStackFilter(null);
                      }
                    });
                  }}
                  className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-[var(--text-muted)] hover:text-red-400 opacity-0 group-hover/stack:opacity-100 transition-all z-10"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {kanbanStackFilter && (
        <button
          onClick={() => setKanbanStackFilter(null)}
          className="text-[8px] font-bold uppercase tracking-widest text-[var(--accent-secondary)] hover:underline flex-shrink-0"
        >
          Clear Stacks
        </button>
      )}
    </div>
  );
};
