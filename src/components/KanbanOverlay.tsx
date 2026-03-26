import React from 'react';
import { useStore } from '../store/useStore';
import { KanbanFilterBar } from './kanban/KanbanFilterBar';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}


const KanbanOverlay: React.FC = () => {
  const activeSpaceId = useStore((state) => state.activeSpaceId);
  const spaces = useStore((state) => state.spaces);
  const activeSpace = spaces.find((s) => s.id === activeSpaceId);
  const isDemo = useStore((state) => state.isDemo);

  if (activeSpace?.mode !== 'kanban') return null;

  return (
    <div className={cn(
      "kanban-overlay inset-0 flex flex-col pointer-events-none z-[50] opacity-100 transition-opacity duration-400",
      isDemo ? "absolute" : "fixed"
    )}>

      {/* Top Section: Filters + Mask */}
      <div className="flex-shrink-0 h-[120px] md:h-[152px] bg-[var(--bg-main)] z-[60] flex flex-col justify-end pointer-events-auto">
        <KanbanFilterBar />
      </div>
      
      {/* Columns Section */}
      <div className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden">
        <div className="col-section flex-1 border-b md:border-b-0 md:border-r border-dashed border-[var(--glass-border)] min-h-[200px] md:min-h-0">
          <div className="col-header-box h-[50px] md:h-[60px] flex items-center justify-center bg-[var(--bg-main)]/85 backdrop-blur-[12px] border-b border-[var(--glass-border)]">
            <span className="col-label text-[10px] md:text-[11px] font-900 text-[var(--text-muted)] tracking-[0.4em] uppercase">Unplanned</span>
          </div>
        </div>
        <div className="col-section flex-1 border-b md:border-b-0 md:border-r border-dashed border-[var(--glass-border)] min-h-[200px] md:min-h-0">
          <div className="col-header-box h-[50px] md:h-[60px] flex items-center justify-center bg-[var(--bg-main)]/85 backdrop-blur-[12px] border-b border-[var(--glass-border)]">
            <span className="col-label text-[10px] md:text-[11px] font-900 text-[var(--accent-secondary)] tracking-[0.4em] uppercase">To Do</span>
          </div>
        </div>
        <div className="col-section flex-1 border-b md:border-b-0 md:border-r border-dashed border-[var(--glass-border)] min-h-[200px] md:min-h-0">
          <div className="col-header-box h-[50px] md:h-[60px] flex items-center justify-center bg-[var(--bg-main)]/85 backdrop-blur-[12px] border-b border-[var(--glass-border)]">
            <span className="col-label text-[10px] md:text-[11px] font-900 text-[var(--accent-secondary)] tracking-[0.4em] uppercase">Doing</span>
          </div>
        </div>
        <div className="col-section flex-1 border-none min-h-[200px] md:min-h-0">
          <div className="col-header-box h-[50px] md:h-[60px] flex items-center justify-center bg-[var(--bg-main)]/85 backdrop-blur-[12px] border-b border-white/[0.05]">
            <span className="col-label text-[10px] md:text-[11px] font-900 text-[var(--accent-secondary)] tracking-[0.4em] uppercase">Done</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KanbanOverlay;
