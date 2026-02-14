import React, { useRef, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { Search, X, Layers } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const CalendarFilterBar: React.FC = () => {
  const calendarSearchQuery = useStore((state) => state.calendarSearchQuery);
  const setCalendarSearchQuery = useStore((state) => state.setCalendarSearchQuery);
  const calendarStackFilter = useStore((state) => state.calendarStackFilter);
  const setCalendarStackFilter = useStore((state) => state.setCalendarStackFilter);
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
    <div className="flex flex-col gap-4 p-4 border-b border-white/5 bg-black/20">
      {/* Search Input */}
      <div className="relative group">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 group-focus-within:text-[var(--accent-secondary)] transition-colors" />
        <input
          type="text"
          value={calendarSearchQuery}
          onChange={(e) => setCalendarSearchQuery(e.target.value)}
          placeholder="Search scheduled..."
          className="w-full h-9 bg-white/5 border border-white/5 rounded-xl pl-9 pr-9 text-[11px] text-white outline-none focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent)]/10 transition-all placeholder:text-slate-600"
        />
        {calendarSearchQuery && (
          <button
            onClick={() => setCalendarSearchQuery('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-white/10 rounded-lg text-slate-500 hover:text-white transition-all"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Stack Reel */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Layers className="w-3 h-3 text-slate-500" />
            <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">Stacks</span>
          </div>
          {calendarStackFilter && (
            <button
              onClick={() => setCalendarStackFilter(null)}
              className="text-[8px] font-bold uppercase tracking-widest text-[var(--accent-secondary)] hover:underline"
            >
              Clear
            </button>
          )}
        </div>
        <div 
          ref={reelRef}
          className="flex gap-1.5 overflow-x-auto custom-scroll pb-2"
        >
          <button
            onClick={() => setCalendarStackFilter(null)}
            className={cn(
              "flex-shrink-0 px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest border transition-all",
              !calendarStackFilter
                ? "bg-[var(--accent)]/20 border-[var(--accent)] text-white shadow-[0_0_10px_var(--accent-glow)]"
                : "bg-white/5 border-transparent text-slate-500 hover:text-slate-300"
            )}
          >
            All
          </button>
          {activeStacks.map((stack) => (
            <button
              key={stack.id}
              onClick={() => setCalendarStackFilter(stack.id)}
              className={cn(
                "flex-shrink-0 px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest border transition-all truncate max-w-[120px]",
                calendarStackFilter === stack.id
                  ? "border-current text-white shadow-lg"
                  : "bg-white/5 border-transparent text-slate-500 hover:text-slate-300"
              )}
              style={calendarStackFilter === stack.id ? { 
                backgroundColor: stack.color.replace('1)', '0.3)'),
                color: stack.color 
              } : {}}
            >
              {stack.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
