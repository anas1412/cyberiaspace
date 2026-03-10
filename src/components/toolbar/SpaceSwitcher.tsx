import React from 'react';
import { 
  Edit3, Share2, ChevronLeft, ChevronRight, 
  Trash2, Plus, ChevronDown, Check, Layers
} from 'lucide-react';
import ShareDialog from '../ShareDialog';
import { getStatusColor, formatLastUpdated } from './helpers';
import { motion, AnimatePresence } from 'framer-motion';
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
}) => {
  const isActive = (id: string) => id === activeSpaceId;

  return (
    <div className="lg:absolute lg:left-1/2 lg:-translate-x-1/2 flex flex-col items-center pointer-events-none z-[9999] w-auto">
      <div className="max-w-full flex items-center h-[48px] md:h-[52px] glass rounded-2xl shadow-[0_0_80px_rgba(0,0,0,0.5)] transition-all pointer-events-auto border border-white/10 p-1.5 relative">
        {isReadOnly ? (
          <div className="px-6 flex items-center justify-center gap-3">
            {isSpaceLoading ? (
              <div className="flex items-center gap-3 animate-pulse">
                <div className="w-2 h-2 rounded-full bg-blue-500/50" />
                <div className="h-2 w-32 bg-white/10 rounded-full" />
              </div>
            ) : (
              <>
                <div className={cn("w-2 h-2 rounded-full", getStatusColor(activeSpace, isReadOnly))} />
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/90 truncate max-w-[200px] leading-tight">
                    {creatorName}'s {activeSpace?.name || 'Space'}
                  </span>
                  {lastUpdated && (
                    <span className="text-[7px] font-bold text-slate-500 uppercase tracking-[0.15em] whitespace-nowrap leading-none mt-0.5">
                      Updated {formatLastUpdated(lastUpdated)}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-center px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 h-5">
                  <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest leading-none">Public</span>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex items-center h-full gap-1">
            {/* Trigger Button */}
            <button 
              onClick={() => setIsSpaceMenuOpen(!isSpaceMenuOpen)} 
              className={cn(
                "h-full px-4 rounded-xl flex items-center gap-3 transition-all group relative overflow-hidden",
                isSpaceMenuOpen 
                  ? "bg-white/10 text-white shadow-[0_0_20px_rgba(255,255,255,0.05)]" 
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              )}
            >
              <div className={cn(
                "w-1.5 h-1.5 rounded-full transition-transform duration-500 group-hover:scale-125", 
                getStatusColor(activeSpace, isReadOnly)
              )} />
              <span className="text-[10px] font-black uppercase tracking-[0.25em] max-w-[120px] md:max-w-[200px] truncate">
                {activeSpace?.name || 'Workspace'}
              </span>
              <ChevronDown className={cn(
                "w-3 h-3 transition-transform duration-300 opacity-50 group-hover:opacity-100", 
                isSpaceMenuOpen && "rotate-180 opacity-100"
              )} />
            </button>

            {/* Dropdown Menu */}
            <AnimatePresence>
              {isSpaceMenuOpen && (
                <motion.div 
                  initial={{ opacity: 0, y: -8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.95 }}
                  transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                  className="absolute top-[calc(100%+12px)] left-0 md:left-1/2 md:-translate-x-1/2 min-w-[280px] glass bg-black/40 backdrop-blur-3xl rounded-2xl border border-white/10 shadow-[0_0_80px_rgba(0,0,0,0.5)] overflow-hidden pointer-events-auto z-50 flex flex-col"
                >
                  {/* Header */}
                  <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between bg-black/20 backdrop-blur-md sticky top-0 z-20">
                    <div className="flex items-center gap-2 text-slate-500">
                      <Layers className="w-3 h-3" />
                      <span className="text-[9px] font-black uppercase tracking-[0.25em]">Switch Space</span>
                    </div>
                    <span className="text-[8px] font-bold text-slate-600 bg-white/5 px-1.5 py-0.5 rounded-md">
                      {spaces.length} / {limits.MAX_SPACES}
                    </span>
                  </div>
                  
                  {/* Space List */}
                  <div className="max-h-[240px] overflow-y-auto space-y-0.5 switcher-scrollbar pr-1 px-1.5 py-1.5">
                    {spaces.map((space) => {
                      const active = isActive(space.id);
                      return (
                        <button 
                          key={space.id} 
                          onClick={() => { setActiveSpace(space.id); setIsSpaceMenuOpen(false); }} 
                          className={cn(
                            "w-full px-3 py-2.5 rounded-xl text-[10px] uppercase font-black tracking-[0.15em] flex items-center justify-between transition-all group",
                            active 
                              ? "bg-white/10 text-white shadow-[inset_0_0_20px_rgba(255,255,255,0.02)] border border-white/5" 
                              : "text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-1 h-1 rounded-full transition-all duration-300", 
                              getStatusColor(space, isReadOnly),
                              active ? "scale-125" : "group-hover:scale-110"
                            )} />
                            <span className="truncate max-w-[160px]">{space.name}</span>
                          </div>
                          {active && <Check className="w-3 h-3 text-[var(--accent)]" />}
                        </button>
                      );
                    })}
                  </div>

                  {/* Add Space Action */}
                  {spaces.length < limits.MAX_SPACES && (
                    <div className="mt-1 pt-1 border-t border-white/5 px-1.5 pb-1.5">
                      <button 
                        onClick={() => { handleCreateSpace(); setIsSpaceMenuOpen(false); }} 
                        className="w-full px-3 py-3 rounded-xl text-[10px] uppercase font-black tracking-[0.2em] flex items-center gap-3 text-slate-400 hover:text-white hover:bg-white/5 transition-all group"
                      >
                        <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-[var(--accent)] group-hover:text-white transition-all shadow-inner">
                          <Plus className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex flex-col items-start">
                          <span className="leading-tight">Create New Space</span>
                          <span className="text-[7px] font-bold text-slate-600 group-hover:text-slate-400 transition-colors uppercase tracking-[0.1em]">Add more room for thoughts</span>
                        </div>
                      </button>
                    </div>
                  )}

                  {/* Active Space Settings */}
                  {activeSpace && (
                    <div className="mt-auto pt-4 border-t border-white/5 bg-black/40 backdrop-blur-md px-4 pb-4">
                      <div className="px-2 mb-2 flex items-center justify-between">
                         <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">Settings: {activeSpace.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={handleRenameSpace} 
                          className="flex-1 h-9 rounded-lg bg-white/5 border border-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center group" 
                          title="Rename Space"
                        >
                          <Edit3 className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                        </button>
                        <button 
                          onClick={() => { openModal({ title: 'Share Space', type: 'custom', content: <ShareDialog spaceId={activeSpace.id} /> }); setIsSpaceMenuOpen(false); }} 
                          className="flex-1 h-9 rounded-lg bg-blue-500/5 border border-blue-500/10 text-blue-400/70 hover:text-blue-300 hover:bg-blue-500/10 transition-all flex items-center justify-center group" 
                          title="Share Space"
                        >
                          <Share2 className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                        </button>
                        <div className="w-px h-4 bg-white/10 mx-1" />
                        <button 
                          onClick={() => handleMoveSpace(-1)} 
                          className="flex-1 h-9 rounded-lg bg-white/5 border border-white/5 text-slate-500 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center group" 
                          title="Move Left"
                        >
                          <ChevronLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
                        </button>
                        <button 
                          onClick={() => handleMoveSpace(1)} 
                          className="flex-1 h-9 rounded-lg bg-white/5 border border-white/5 text-slate-500 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center group" 
                          title="Move Right"
                        >
                          <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                        </button>
                        <div className="w-px h-4 bg-white/10 mx-1" />
                        <button 
                          onClick={handleDeleteSpace} 
                          className="flex-1 h-9 rounded-lg bg-red-500/5 border border-red-500/10 text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all flex items-center justify-center group" 
                          title="Delete Space"
                        >
                          <Trash2 className="w-3.5 h-3.5 group-hover:scale-110 group-hover:rotate-6 transition-transform" />
                        </button>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};
