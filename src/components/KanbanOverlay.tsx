import React from 'react';
import { useStore } from '../store/useStore';

const KanbanOverlay: React.FC = () => {
  const activeSpaceId = useStore((state) => state.activeSpaceId);
  const spaces = useStore((state) => state.spaces);
  const activeSpace = spaces.find((s) => s.id === activeSpaceId);

  if (activeSpace?.mode !== 'kanban') return null;

  return (
    <div className="kanban-overlay fixed inset-0 flex pointer-events-none z-[50] opacity-100 transition-opacity duration-400">
      <div className="col-section flex-1 border-r border-dashed border-white/[0.05]">
        <div className="col-header-box h-[60px] mt-[140px] flex items-center justify-center bg-[var(--bg-main)]/85 backdrop-blur-[12px] border-b border-white/[0.05]">
          <span className="col-label text-[11px] font-900 text-slate-500 tracking-[0.4em] uppercase">Unplanned</span>
        </div>
      </div>
      <div className="col-section flex-1 border-r border-dashed border-white/[0.05]">
        <div className="col-header-box h-[60px] mt-[140px] flex items-center justify-center bg-[var(--bg-main)]/85 backdrop-blur-[12px] border-b border-white/[0.05]">
          <span className="col-label text-[11px] font-900 text-[var(--accent-secondary)] tracking-[0.4em] uppercase">Todo</span>
        </div>
      </div>
      <div className="col-section flex-1 border-r border-dashed border-white/[0.05]">
        <div className="col-header-box h-[60px] mt-[140px] flex items-center justify-center bg-[var(--bg-main)]/85 backdrop-blur-[12px] border-b border-white/[0.05]">
          <span className="col-label text-[11px] font-900 text-[var(--accent-secondary)] tracking-[0.4em] uppercase">Doing</span>
        </div>
      </div>
      <div className="col-section flex-1 border-none">
        <div className="col-header-box h-[60px] mt-[140px] flex items-center justify-center bg-[var(--bg-main)]/85 backdrop-blur-[12px] border-b border-white/[0.05]">
          <span className="col-label text-[11px] font-900 text-[var(--accent-secondary)] tracking-[0.4em] uppercase">Done</span>
        </div>
      </div>
    </div>
  );
};

export default KanbanOverlay;
