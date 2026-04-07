import React from 'react';
import { useStore } from '../store/useStore';
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
      "kanban-overlay inset-0 flex flex-col md:flex-row pointer-events-none z-[10] opacity-100 transition-opacity duration-400 p-4 md:p-10 pb-[100px] md:pb-[120px] pt-[64px] md:pt-[96px] gap-4 md:gap-5",
      isDemo ? "absolute" : "fixed"
    )}>

      {/* Sidebar - Unplanned/Unscheduled */}
      <div 
        className="kanban-sidebar w-full md:w-[260px] min-h-[200px] md:min-h-0 rounded-2xl flex flex-col overflow-hidden pointer-events-auto z-[30] relative border border-[var(--glass-border)] shadow-2xl"
        style={{ background: 'var(--bg-page)' }}
      >
        <div className="kanban-sidebar-header p-4 md:p-5 border-b border-[var(--glass-border)] text-[9px] md:text-[10px] font-black tracking-[0.2em] uppercase text-[var(--accent)] z-[40] sticky top-0 shadow-[var(--shadow-elevation-2)]">
          Unplanned
        </div>
        <div id="cal-sidebar-content" className="cal-sidebar-content flex-1 overflow-y-auto overflow-x-hidden relative p-4 md:p-5 custom-scroll overscroll-y-contain">
          <div id="cal-sidebar-spacer" style={{ height: '0px' }} />
        </div>
      </div>
      
      {/* Main Columns */}
      <div className="kanban-main flex-1 flex flex-col min-h-[400px] md:min-h-0 glass backdrop-blur-xl rounded-2xl overflow-hidden pointer-events-auto z-[5] relative border border-[var(--glass-border)] shadow-xl">
        {/* Column Headers */}
        <div className="flex flex-col md:flex-row h-[50px] md:h-[60px] border-b border-[var(--glass-border)] bg-[var(--glass-bg)]">
          <div className="flex-1 flex items-center justify-center border-b md:border-b-0 md:border-r border-dashed border-[var(--glass-border)]">
            <span className="col-label text-[10px] md:text-[11px] font-black text-[var(--accent)] tracking-[0.3em] uppercase">To Do</span>
          </div>
          <div className="flex-1 flex items-center justify-center border-b md:border-b-0 md:border-r border-dashed border-[var(--glass-border)]">
            <span className="col-label text-[10px] md:text-[11px] font-black text-[var(--accent)] tracking-[0.3em] uppercase">Doing</span>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <span className="col-label text-[10px] md:text-[11px] font-black text-[var(--accent)] tracking-[0.3em] uppercase">Done</span>
          </div>
        </div>
        
        {/* Column Content - Each column scrolls independently */}
        <div id="kanban-column-content" className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-y-auto relative custom-scroll overscroll-y-contain">
          <div className="col-section flex-1 border-b md:border-b-0 md:border-r border-dashed border-[var(--glass-border)] min-h-[200px] md:min-h-0 overflow-y-auto" />
          <div className="col-section flex-1 border-b md:border-b-0 md:border-r border-dashed border-[var(--glass-border)] min-h-[200px] md:min-h-0 overflow-y-auto" />
          <div className="col-section flex-1 min-h-[200px] md:min-h-0 overflow-y-auto" />
          <div id="kanban-column-spacer" className="absolute bottom-0 left-0 right-0" style={{ height: '0px' }} />
        </div>
      </div>
    </div>
  );
};

export default KanbanOverlay;
