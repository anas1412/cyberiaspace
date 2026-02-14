import React, { useRef, useEffect } from 'react';
import { useStore } from '../../store/useStore';
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

  const reelRef = useRef<HTMLDivElement>(null);
  const activeStacks = stacks.filter(s => s.spaceId === activeSpaceId);

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
    <div className="flex items-center gap-4 px-6 h-14 border-b border-white/5 bg-black/40 backdrop-blur-md w-full">
      {/* Search Input */}
      <div className="relative group w-64">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 group-focus-within:text-[var(--accent-secondary)] transition-colors" />
        <input
          type="text"
          value={kanbanSearchQuery}
          onChange={(e) => setKanbanSearchQuery(e.target.value)}
          placeholder="Search..."
          className="w-full h-9 bg-white/5 border border-white/5 rounded-xl pl-9 pr-9 text-[11px] text-white outline-none focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent)]/10 transition-all placeholder:text-slate-600"
        />
        {kanbanSearchQuery && (
          <button
            onClick={() => setKanbanSearchQuery('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-white/10 rounded-lg text-slate-500 hover:text-white transition-all"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      <div className="w-px h-6 bg-white/10" />

      {/* Stack Reel */}
      <div className="flex-1 flex items-center gap-3 overflow-hidden">
        <div className="flex items-center gap-2 flex-shrink-0">
          <Layers className="w-3 h-3 text-slate-500" />
          <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">Stacks</span>
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
                : "bg-white/5 border-transparent text-slate-500 hover:text-slate-300"
            )}
          >
            All
          </button>
          {activeStacks.map((stack) => (
            <button
              key={stack.id}
              onClick={() => setKanbanStackFilter(stack.id)}
              className={cn(
                "flex-shrink-0 px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest border transition-all truncate max-w-[120px]",
                kanbanStackFilter === stack.id
                  ? "border-current text-white shadow-lg"
                  : "bg-white/5 border-transparent text-slate-500 hover:text-slate-300"
              )}
              style={kanbanStackFilter === stack.id ? { 
                backgroundColor: stack.color.replace('1)', '0.3)'),
                color: stack.color 
              } : {}}
            >
              {stack.name}
            </button>
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
