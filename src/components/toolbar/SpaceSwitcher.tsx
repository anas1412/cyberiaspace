import React from 'react';
import { 
  Edit3, Share2, 
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
  handleDeleteSpace: () => void;
  openModal: (cfg: any) => void;
}

export const SpaceSwitcher: React.FC<SpaceSwitcherProps> = ({ 
  spaces, activeSpaceId, setActiveSpace, isReadOnly, isSpaceLoading, 
  creatorName, lastUpdated, activeSpace, isSpaceMenuOpen, setIsSpaceMenuOpen, 
  limits, handleCreateSpace, handleRenameSpace, handleDeleteSpace, openModal
}) => {
  const isActive = (id: string) => id === activeSpaceId;

  return (
    <div className="space-switcher-container flex flex-col items-center pointer-events-none z-[9999] w-auto relative">
      <div className="max-w-full flex items-center h-[48px] glass rounded-2xl shadow-2xl transition-all pointer-events-auto border border-white/5 p-1.5">
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
                    <span className="text-[7px] font-bold text-[var(--text-muted)] uppercase tracking-[0.15em] whitespace-nowrap leading-none mt-0.5">
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
                "w-1.5 h-1.5 rounded-full transition-transform duration-500 group-hover:scale-125 shadow-[0_0_8px_currentColor]", 
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
          </div>
        )}
      </div>

      {/* Dropdown Menu - Positioned relative to the wrapper */}
      <AnimatePresence>
        {isSpaceMenuOpen && (
          <motion.div 
            id="space-switcher-menu"
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="absolute top-full mt-4 left-0 min-w-[300px] glass rounded-2xl border border-white/10 shadow-[0_0_80px_rgba(0,0,0,0.5)] overflow-hidden pointer-events-auto z-50 flex flex-col"
          >
            {/* Header Area */}
            <div className="p-4 md:p-5 border-b border-[var(--glass-border)] flex items-center justify-between bg-[var(--bg-main)]/40 backdrop-blur-md sticky top-0 z-20">
              <div className="flex items-center gap-2.5 text-slate-400">
                <Layers className="w-3.5 h-3.5" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/90">Switch Space</span>
              </div>
              <span className="text-[8px] font-bold text-[var(--text-muted)] bg-white/5 px-2 py-0.5 rounded-md border border-white/5">
                {spaces.length} / {limits.MAX_SPACES}
              </span>
            </div>
            
            {/* Space List Area */}
            <div className="flex-1 max-h-[320px] overflow-y-auto custom-scroll p-2 space-y-1">
              {spaces.map((space) => {
                const active = isActive(space.id);
                return (
                  <div 
                    key={space.id} 
                    className={cn(
                      "w-full px-3 py-2.5 rounded-xl text-[10px] uppercase font-black tracking-[0.15em] flex items-center justify-between transition-all group",
                      active 
                        ? "bg-white/10 text-white shadow-[inset_0_0_20px_rgba(255,255,255,0.02)] border border-white/5" 
                        : "text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent"
                    )}
                  >
                    <div 
                      className="flex-1 flex items-center gap-3 cursor-pointer py-1 h-full"
                      onClick={() => { setActiveSpace(space.id); setIsSpaceMenuOpen(false); }}
                    >
                      <div className={cn(
                        "w-1.5 h-1.5 rounded-full transition-all duration-300 shadow-[0_0_8px_currentColor]", 
                        getStatusColor(space, isReadOnly),
                        active ? "scale-125" : "group-hover:scale-110"
                      )} />
                      <span className="truncate max-w-[120px] md:max-w-[150px]">{space.name}</span>
                    </div>

                    {active && (
                      <div className="flex items-center gap-0.5 animate-in fade-in slide-in-from-right-2 duration-300">
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleRenameSpace(); }}
                          className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-all"
                          title="Rename"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); openModal({ title: 'Share Space', type: 'custom', content: <ShareDialog spaceId={space.id} /> }); setIsSpaceMenuOpen(false); }}
                          className="p-1.5 rounded-lg hover:bg-blue-500/10 text-blue-400/60 hover:text-blue-400 transition-all"
                          title="Share"
                        >
                          <Share2 className="w-3 h-3" />
                        </button>
                        <div className="w-px h-3 bg-white/10 mx-0.5" />
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDeleteSpace(); }}
                          className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-500/40 hover:text-red-400 transition-all"
                          title="Delete"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                    
                    {!active && <Check className="w-3.5 h-3.5 text-white/0 group-hover:text-white/10 transition-colors" />}
                  </div>
                );
              })}

              {/* Inline Create Space Button - Free users can create spaces too, up to their limit */}
              {spaces.length < limits.MAX_SPACES && (
                <button 
                  onClick={() => { handleCreateSpace(); setIsSpaceMenuOpen(false); }} 
                  className="w-full px-3 py-2 rounded-xl text-[10px] uppercase font-black tracking-[0.2em] flex items-center gap-3 text-[var(--text-muted)] hover:text-white hover:bg-white/5 transition-all group border border-dashed border-white/5 mt-1"
                >
                  <div className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-[var(--accent)] group-hover:text-white transition-all shadow-inner">
                    <Plus className="w-3 h-3" />
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="leading-tight">Create Space</span>
                  </div>
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
