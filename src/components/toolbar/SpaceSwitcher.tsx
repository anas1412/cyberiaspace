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
import type { Space } from '../../db';
import type { PlanLimits } from '../../constants';
import type { ModalState } from '../../store/useModalStore';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SpaceSwitcherProps {
  spaces: Space[];
  activeSpaceId: string | null;
  setActiveSpace: (id: string) => Promise<void>;
  isReadOnly: boolean;
  isSpaceLoading: boolean;
  creatorName: string | null;
  lastUpdated: string | null;
  activeSpace: Space | undefined;
  isSpaceMenuOpen: boolean;
  setIsSpaceMenuOpen: (val: boolean) => void;
  limits: PlanLimits;
  handleCreateSpace: () => void;
  handleRenameSpace: () => void;
  handleDeleteSpace: () => void;
  openModal: ModalState['openModal'];
}

export const SpaceSwitcher: React.FC<SpaceSwitcherProps> = ({ 
  spaces, activeSpaceId, setActiveSpace, isReadOnly, isSpaceLoading, 
  creatorName, lastUpdated, activeSpace, isSpaceMenuOpen, setIsSpaceMenuOpen, 
  limits, handleCreateSpace, handleRenameSpace, handleDeleteSpace, openModal
}) => {
  const isActive = (id: string) => id === activeSpaceId;

  return (
    <div className="space-switcher-container flex flex-col items-center pointer-events-none z-[9999] w-auto relative">
      <div className="max-w-full flex items-center h-[44px] glass rounded-2xl shadow-lg shadow-[var(--glass-border)] transition-all pointer-events-auto border border-[var(--glass-border)] p-1">
        {isReadOnly ? (
          <div className="px-6 flex items-center justify-center gap-3">
            {isSpaceLoading ? (
              <div className="flex items-center gap-3 animate-pulse">
                <div className="w-2 h-2 rounded-full bg-[var(--accent)]/50" />
                <div className="h-2 w-32 bg-[var(--glass-bg)] rounded-full" />
              </div>
            ) : (
              <>
                <div className={cn("w-2 h-2 rounded-full", getStatusColor(activeSpace, isReadOnly))} />
                <div className="flex flex-col">
                  <span className="text-[12px] font-semibold tracking-wide text-[var(--text-primary)]/90 truncate max-w-[200px] leading-tight">
                    {creatorName}'s {activeSpace?.name || 'Space'}
                  </span>
                  {lastUpdated && (
                    <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-[0.1em] whitespace-nowrap leading-none mt-0.5">
                      Updated {formatLastUpdated(lastUpdated)}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-center px-2 py-0.5 rounded-full bg-[var(--glass-bg)] border border-[var(--glass-border)] h-5">
                  <span className="text-[10px] font-black text-[var(--text-primary)] uppercase tracking-widest leading-none">Public</span>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex items-center h-full gap-1">
            {/* Trigger Button */}
            <button
              onClick={() => setIsSpaceMenuOpen(!isSpaceMenuOpen)}
              aria-label="Switch Space"
className={cn(
                 "h-full px-4 rounded-xl flex items-center gap-3 transition-all group relative overflow-hidden",
                 isSpaceMenuOpen
                   ? "bg-[var(--glass-bg)] text-[var(--text-primary)] shadow-[0_0_20px_rgba(255,255,255,0.05)]"
                   : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg)]"
               )}
            >
              <div className={cn(
                "w-1.5 h-1.5 rounded-full transition-transform duration-500 group-hover:scale-125 shadow-[0_0_8px_currentColor]", 
                getStatusColor(activeSpace, isReadOnly)
              )} />
              <span className="text-[12px] font-semibold tracking-wide max-w-[120px] md:max-w-[200px] truncate">
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
            className="absolute top-full mt-4 left-0 min-w-[300px] glass rounded-2xl border border-[var(--glass-border)] shadow-[0_0_80px_rgba(0,0,0,0.5)] overflow-hidden pointer-events-auto z-50 flex flex-col"
          >
            {/* Header Area */}
            <div className="p-4 md:p-5 border-b border-[var(--glass-border)] flex items-center justify-between bg-[var(--bg-main)]/40 backdrop-blur-md sticky top-0 z-20">
              <div className="flex items-center gap-2.5 text-[var(--text-muted)]">
                <Layers className="w-3.5 h-3.5" />
                <span className="text-[12px] font-semibold tracking-wide text-[var(--text-primary)]/90">Switch Space</span>
              </div>
              <span className="text-[10px] font-bold text-[var(--text-muted)] bg-[var(--glass-bg)] px-2 py-0.5 rounded-md border border-[var(--border)]">
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
                       "w-full px-3 py-2.5 rounded-xl text-[11px] uppercase font-black tracking-[0.12em] flex items-center justify-between transition-all group",
                       active
                         ? "bg-[var(--glass-bg)] text-[var(--text-primary)] shadow-[inset_0_0_20px_rgba(255,255,255,0.02)] border border-[var(--glass-border)]"
                         : "text-[var(--text-muted)] hover:text-[var(--text-dimmed)] hover:bg-[var(--glass-bg)] border border-transparent"
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
                          className="p-1.5 rounded-lg hover:bg-[var(--glass-bg)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all"
                          title="Rename"
                          aria-label="Rename Space"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
<button
                           onClick={(e) => { e.stopPropagation(); openModal({ title: 'Share Space', type: 'custom', content: <ShareDialog spaceId={space.id} /> }); setIsSpaceMenuOpen(false); }}
                           className="p-1.5 rounded-lg hover:bg-[var(--accent)]/10 text-[var(--accent)]/60 hover:text-[var(--accent)] transition-all"
                           title="Share"
                           aria-label="Share Space"
                         >
                          <Share2 className="w-3 h-3" />
                        </button>
                        <div className="w-px h-3 bg-[var(--glass-border)] mx-0.5" />
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteSpace(); }}
                          className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-500/40 hover:text-red-400 transition-all"
                          title="Delete"
                          aria-label="Delete Space"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                    
                    {!active && <Check className="w-3.5 h-3.5 text-[var(--text-primary)]/0 group-hover:text-[var(--text-primary)]/10 transition-colors" />}
                  </div>
                );
              })}

              {/* Inline Create Space Button - Free users can create spaces too, up to their limit */}
              {spaces.length < limits.MAX_SPACES && (
                <button
                  onClick={() => { handleCreateSpace(); setIsSpaceMenuOpen(false); }}
                  aria-label="Create New Space"
                  className="w-full px-3 py-2 rounded-xl text-[11px] uppercase font-black tracking-[0.15em] flex items-center gap-3 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg)] transition-all group border border-dashed border-[var(--border)] mt-1"
                >
                  <div className="w-6 h-6 rounded-lg bg-[var(--glass-bg)] flex items-center justify-center group-hover:bg-[var(--accent)] group-hover:text-[var(--accent-contrast)] transition-all shadow-inner">
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
