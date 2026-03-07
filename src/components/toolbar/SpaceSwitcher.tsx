import React from 'react';
import { Settings, Edit3, Share2, ChevronLeft, ChevronRight, Trash2, Plus } from 'lucide-react';
import ShareDialog from '../ShareDialog';
import { getStatusColor, formatLastUpdated } from './helpers';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SpaceSwitcherProps {
  spaces: any[];
  activeSpaceId: string | null;
  setActiveSpace: (id: string) => Promise<void>;
  isReadOnly: boolean;
  isSpaceLoading: boolean;
  creatorName: string | null;
  lastUpdated: string | null;
  activeSpace: any | null;
  isSpaceMenuOpen: boolean;
  setIsSpaceMenuOpen: (val: boolean) => void;
  limits: any;
  handleCreateSpace: () => void;
  handleRenameSpace: () => void;
  handleMoveSpace: (dir: number) => void;
  handleDeleteSpace: () => void;
  openModal: (cfg: any) => void;
}

export const SpaceSwitcher: React.FC<SpaceSwitcherProps> = ({ 
  spaces, activeSpaceId, setActiveSpace, isReadOnly, isSpaceLoading, 
  creatorName, lastUpdated, activeSpace, isSpaceMenuOpen, setIsSpaceMenuOpen, 
  limits, handleCreateSpace, handleRenameSpace, handleMoveSpace, handleDeleteSpace, openModal 
}) => (
  <div className="lg:absolute lg:left-1/2 lg:-translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none z-10 w-auto">
    <div className="max-w-full flex items-center h-[48px] md:h-[52px] glass rounded-full shadow-2xl transition-all pointer-events-auto border border-white/5 px-2 md:px-3">
      {isReadOnly ? (
        <div className="px-6 flex items-center justify-center gap-2">
          {isSpaceLoading ? (
            <div className="flex items-center gap-3 animate-pulse"><div className="w-2 h-2 rounded-full bg-blue-500/50" /><div className="h-2 w-32 bg-white/10 rounded-full" /><div className="h-5 w-12 bg-white/5 rounded-full border border-white/5" /></div>
          ) : (
            <>
              <div className={cn("w-2 h-2 rounded-full", getStatusColor(activeSpace, isReadOnly))} />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/90 truncate max-w-[300px]">{creatorName}'s {activeSpace?.name || 'Space'}</span>
              <div className="flex items-center justify-center px-2 py-0.5 rounded-full bg-white/5 border border-white/10 ml-2 h-5"><span className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none">Public</span></div>
              {lastUpdated && (
                <div className="flex items-center gap-1.5 ml-3 pl-3 border-l border-white/5 h-4 group/updated"><div className="w-1 h-1 rounded-full bg-slate-600 group-hover/updated:bg-blue-400 transition-colors" /><span className="text-[8px] font-bold text-slate-500 uppercase tracking-[0.15em] whitespace-nowrap">Updated {formatLastUpdated(lastUpdated)}</span></div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 h-full min-w-max">
          <button onClick={() => setIsSpaceMenuOpen(!isSpaceMenuOpen)} className={cn("w-9 h-9 rounded-full transition-all flex-shrink-0 flex items-center justify-center border", isSpaceMenuOpen ? "bg-[var(--accent)] text-white border-[var(--accent)] shadow-[0_0_15px_var(--accent-glow)]" : "text-slate-600 hover:text-white hover:bg-white/10 border-white/10")} title="Space Settings"><Settings className={cn("w-3.5 h-3.5", isSpaceMenuOpen && "animate-spin-slow")} /></button>
          <div className="w-[1px] h-4 bg-white/10 flex-shrink-0"></div>
          <div id="space-switcher-list" className="flex items-center gap-2 overflow-x-auto switcher-scrollbar pb-0 max-w-[calc(100vw-180px)] md:max-w-[450px] 2xl:max-w-[750px] pointer-events-auto" onWheel={(e) => { e.stopPropagation(); e.currentTarget.scrollLeft += e.deltaY; }}>
            {spaces.map((space) => {
              const isActive = space.id === activeSpaceId;
              return (
                <button key={space.id} onClick={() => setActiveSpace(space.id)} className={cn("px-4 h-9 min-w-max md:min-w-[120px] rounded-full text-[10px] uppercase font-black tracking-widest flex-shrink-0 transition-all duration-500 flex items-center justify-center gap-2.5 border", isActive ? "bg-white/10 text-white border-white/10 shadow-[0_0_20px_rgba(255,255,255,0.05)]" : "text-slate-500 hover:text-slate-300 hover:bg-white/[0.03] border-transparent")}>
                  <div className={cn("w-1 h-1 rounded-full shadow-[0_0_8px_currentColor]", getStatusColor(space, isReadOnly))} style={{ color: isActive ? 'var(--accent-secondary)' : 'transparent' }} />
                  <span className={cn("truncate", !isActive && "hidden md:inline")}>{space.name}</span>
                </button>
              );
            })}
          </div>
          {spaces.length < limits.MAX_SPACES && (
            <>
              <div className="w-[1px] h-4 bg-white/10 flex-shrink-0"></div>
              <button onClick={handleCreateSpace} className="w-9 h-9 rounded-full text-slate-600 hover:text-white hover:bg-white/10 transition-all flex-shrink-0 flex items-center justify-center border border-white/10"><Plus className="w-3.5 h-3.5" /></button>
            </>
          )}
        </div>
      )}
    </div>

    {activeSpace && isSpaceMenuOpen && (
      <div className="absolute top-full mt-2 flex flex-col items-center gap-1.5 transition-all animate-in fade-in slide-in-from-top-2 duration-300 pointer-events-auto">
        {!isReadOnly && (
          <div className="glass px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-1 shadow-2xl">
            <button onClick={handleRenameSpace} className="p-1.5 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition-all flex items-center gap-2 group" title="Rename Space"><Edit3 className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" /><span className="text-[8px] font-black uppercase tracking-widest hidden sm:inline">Rename</span></button>
            <div className="w-px h-3 bg-white/5 mx-1" />
            <button onClick={() => { openModal({ title: 'Share Space', type: 'custom', content: <ShareDialog spaceId={activeSpace.id} /> }); setIsSpaceMenuOpen(false); }} className="p-1.5 hover:bg-white/5 rounded-lg text-blue-400 hover:text-blue-300 transition-all flex items-center gap-2 group" title="Share Space"><Share2 className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" /><span className="text-[8px] font-black uppercase tracking-widest hidden sm:inline">Share Link</span></button>
            <div className="w-px h-3 bg-white/5 mx-1" />
            <button onClick={() => handleMoveSpace(-1)} className="p-1.5 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition-all group" title="Move Left"><ChevronLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" /></button>
            <button onClick={() => handleMoveSpace(1)} className="p-1.5 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition-all group" title="Move Right"><ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" /></button>
            <div className="w-px h-3 bg-white/10 mx-1" />
            <button onClick={handleDeleteSpace} className="p-1.5 hover:bg-red-500/10 rounded-lg text-slate-500 hover:text-red-400 transition-all flex items-center gap-2 group" title="Delete Space"><Trash2 className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" /><span className="text-[8px] font-black uppercase tracking-widest hidden sm:inline">Delete</span></button>
          </div>
        )}
      </div>
    )}
  </div>
);
