import React from 'react';
import { useStore } from '../store/useStore';

const KanbanOverlay: React.FC = () => {
  const activeSpaceId = useStore((state) => state.activeSpaceId);
  const spaces = useStore((state) => state.spaces);
  const activeSpace = spaces.find((s) => s.id === activeSpaceId);

  if (activeSpace?.mode !== 'kanban') return null;

  return (
    <div className="kanban-overlay fixed inset-0 flex flex-col md:flex-row pointer-events-none z-[50] opacity-100 transition-opacity duration-400 overflow-y-auto md:overflow-hidden">
      {/* Top Mask: Hides thoughts that scroll above the headers */}
      <div className="absolute top-0 left-0 right-0 h-[120px] md:h-[140px] bg-[var(--bg-page)] z-[60]" />
      
      <div className="col-section flex-1 border-b md:border-b-0 md:border-r border-dashed border-white/[0.05] min-h-[200px] md:min-h-0">
        <div className="col-header-box h-[50px] md:h-[60px] mt-[120px] md:mt-[140px] flex items-center justify-center bg-[var(--bg-main)]/85 backdrop-blur-[12px] border-b border-white/[0.05]">
          <span className="col-label text-[10px] md:text-[11px] font-900 text-slate-500 tracking-[0.4em] uppercase">Unplanned</span>
        </div>
      </div>
      <div className="col-section flex-1 border-b md:border-b-0 md:border-r border-dashed border-white/[0.05] min-h-[200px] md:min-h-0">
        <div className="col-header-box h-[50px] md:h-[60px] mt-0 md:mt-[140px] flex items-center justify-center bg-[var(--bg-main)]/85 backdrop-blur-[12px] border-b border-white/[0.05]">
          <span className="col-label text-[10px] md:text-[11px] font-900 text-[var(--accent-secondary)] tracking-[0.4em] uppercase">Todo</span>
        </div>
      </div>
      <div className="col-section flex-1 border-b md:border-b-0 md:border-r border-dashed border-white/[0.05] min-h-[200px] md:min-h-0">
        <div className="col-header-box h-[50px] md:h-[60px] mt-0 md:mt-[140px] flex items-center justify-center bg-[var(--bg-main)]/85 backdrop-blur-[12px] border-b border-white/[0.05]">
          <span className="col-label text-[10px] md:text-[11px] font-900 text-[var(--accent-secondary)] tracking-[0.4em] uppercase">Doing</span>
        </div>
      </div>
      <div className="col-section flex-1 border-none min-h-[200px] md:min-h-0">
        <div className="col-header-box h-[50px] md:h-[60px] mt-0 md:mt-[140px] flex items-center justify-center bg-[var(--bg-main)]/85 backdrop-blur-[12px] border-b border-white/[0.05]">
          <span className="col-label text-[10px] md:text-[11px] font-900 text-[var(--accent-secondary)] tracking-[0.4em] uppercase">Done</span>
        </div>
      </div>
    </div>
  );
};

export default KanbanOverlay;
