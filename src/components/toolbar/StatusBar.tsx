import React from 'react';
import { Undo2, Redo2, ZoomIn, ZoomOut, ScanEye, Magnet } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface StatusBarProps {
  thoughtsCount: number;
  limits: any;
  activeSpace: any;
  undo: () => void;
  redo: () => void;
  historyIndex: number;
  historyLength: number;
  zoomIn: () => void;
  zoomOut: () => void;
  resetTransform: () => void;
  performanceMode: boolean;
  handleTogglePhysics: () => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({ 
  thoughtsCount, limits, activeSpace, undo, redo, 
  historyIndex, historyLength, zoomIn, zoomOut, resetTransform,
  performanceMode, handleTogglePhysics
}) => {
  const capacity = (thoughtsCount / limits.MAX_THOUGHTS_PER_SPACE) * 100;
  
  const capacityDotColor = capacity >= 100 
    ? "bg-red-500 text-red-500" 
    : capacity >= 80 
      ? "bg-amber-500 text-amber-500" 
      : "bg-green-500 text-green-500";
      
  const capacityTextColor = capacity >= 100 
    ? "text-red-400" 
    : capacity >= 80 
      ? "text-amber-400" 
      : "text-[var(--text-primary)]/90";

  return (
  <div className="fixed bottom-4 md:bottom-8 left-4 md:left-8 z-[9999] flex items-center gap-2 pointer-events-none mobile-bottom-bar-adjust">
    <div className="glass px-3 md:px-4 h-[44px] rounded-2xl flex items-center gap-2 md:gap-4 border border-[var(--glass-border)] shadow-lg shadow-[var(--glass-border)] pointer-events-auto">

      <div className="group relative flex items-center justify-center gap-2 md:gap-3 cursor-default">
        <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 pointer-events-none whitespace-nowrap z-[10001]"><div className="glass px-3 py-1.5 rounded-xl border border-[var(--glass-border)] flex items-center gap-2 shadow-2xl bg-[var(--bg-main)]/90 backdrop-blur-xl"><span className="text-[10px] font-semibold tracking-wide text-[var(--text-primary)]/90">Capacity</span><div className="w-[1px] h-2 bg-[var(--glass-border)] mx-0.5" /><span className="text-[10px] font-semibold text-[var(--accent-secondary)]">{limits.MAX_THOUGHTS_PER_SPACE} Max</span></div></div>
        <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0 transition-all shadow-[0_0_10px_currentColor]", capacityDotColor)}></span>
        <span className={cn("text-[9px] md:text-[10px] uppercase font-semibold tracking-wide transition-colors", capacityTextColor)}><span>{thoughtsCount}</span><span className="hidden sm:inline">/{limits.MAX_THOUGHTS_PER_SPACE} {thoughtsCount > limits.MAX_THOUGHTS_PER_SPACE ? 'Overcapacity' : 'Available'}</span></span>
      </div>
      <div className="hidden sm:flex h-3 w-[1px] bg-[var(--glass-border)] mx-0.5"></div>
      <div className="hidden sm:flex items-center gap-1">
        <button onClick={undo} disabled={historyIndex <= 0} className="group relative p-1.5 md:p-2 hover:bg-[var(--glass-bg)] text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-20 disabled:cursor-not-allowed transition-all rounded-xl"><div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 pointer-events-none whitespace-nowrap z-[10001]"><div className="glass px-3 py-1.5 rounded-xl border border-[var(--glass-border)] flex items-center gap-2 shadow-2xl bg-[var(--bg-main)]/90 backdrop-blur-xl"><span className="text-[10px] font-semibold tracking-wide text-[var(--text-primary)]/90">Undo</span><div className="w-[1px] h-2 bg-[var(--glass-border)] mx-0.5" /><kbd className="bg-[var(--glass-bg)] border border-[var(--glass-border)] px-1.5 py-0.5 rounded text-[8px] font-semibold text-[var(--accent-secondary)]">CTRL+Z</kbd></div></div><Undo2 className="w-3.5 h-3.5 md:w-4 md:h-4" /></button>
        <button onClick={redo} disabled={historyIndex >= historyLength - 1} className="group relative p-1.5 md:p-2 hover:bg-[var(--glass-bg)] text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-20 disabled:cursor-not-allowed transition-all rounded-xl"><div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 pointer-events-none whitespace-nowrap z-[10001]"><div className="glass px-3 py-1.5 rounded-xl border border-[var(--glass-border)] flex items-center gap-2 shadow-2xl bg-[var(--bg-main)]/90 backdrop-blur-xl"><span className="text-[10px] font-semibold tracking-wide text-[var(--text-primary)]/90">Redo</span><div className="w-[1px] h-2 bg-[var(--glass-border)] mx-0.5" /><kbd className="bg-[var(--glass-bg)] border border-[var(--glass-border)] px-1.5 py-0.5 rounded text-[8px] font-semibold text-[var(--accent-secondary)]">CTRL+Y</kbd></div></div><Redo2 className="w-3.5 h-3.5 md:w-4 md:h-4" /></button>
      </div>

<div className="h-3 w-[1px] bg-[var(--glass-border)] mx-0.5"></div>
      
      {/* Engine Cluster - Spatial Mode Only */}
      {activeSpace?.mode === 'spatial' && (
        <div className="flex items-center gap-1">
          <div className="relative group">
            <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 pointer-events-none whitespace-nowrap z-[10001]">
              <div className="glass px-3 py-1.5 rounded-xl border border-[var(--glass-border)] flex items-center gap-2 shadow-2xl bg-[var(--bg-main)]/90 backdrop-blur-xl">
                <span className="text-[10px] font-semibold tracking-wide text-[var(--text-primary)]/90">Physics</span>
                <div className="w-[1px] h-2 bg-[var(--glass-border)] mx-0.5" />
                <span className={cn("text-[8px] font-semibold tracking-wide", performanceMode ? "text-amber-400" : activeSpace?.physics ? "text-green-400" : "text-[var(--text-muted)]")}>
                  {performanceMode ? "Auto-Disabled" : activeSpace?.physics ? "Enabled" : "Disabled"}
                </span>
              </div>
            </div>
            <button 
              onClick={handleTogglePhysics} 
              disabled={performanceMode}
              className={cn(
                "p-1.5 md:p-2 flex items-center justify-center rounded-xl transition-all",
                performanceMode ? "text-[var(--text-muted)] opacity-30 cursor-not-allowed" : activeSpace?.physics ? "text-amber-400" : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg)]"
              )}
            >
              <Magnet 
                className={cn(
                  "w-3.5 h-3.5 md:w-4 md:h-4 transition-colors", 
                  activeSpace?.physics && !performanceMode 
                    ? "text-[var(--accent)]"    // <--- THIS IS THE FIX
                    : "text-[var(--text-muted)]"          // Matches the inactive color in your FAB
                )} 
              />
            </button>
          </div>

        </div>
      )}

      {activeSpace?.mode === 'spatial' && (
        <><div className="h-3 w-[1px] bg-[var(--glass-border)] mx-0.5"></div><div className="flex items-center gap-1"><button onClick={zoomIn} className="group relative p-2 hover:bg-[var(--glass-bg)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors rounded-xl"><div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 pointer-events-none whitespace-nowrap z-[10001]"><div className="glass px-3 py-1.5 rounded-xl border border-[var(--glass-border)] flex items-center gap-2 shadow-2xl bg-[var(--bg-main)]/90 backdrop-blur-xl"><span className="text-[10px] font-semibold tracking-wide text-[var(--text-primary)]/90">Zoom In</span><div className="w-[1px] h-2 bg-[var(--glass-border)] mx-0.5" /><kbd className="bg-[var(--glass-bg)] border border-[var(--glass-border)] px-1.5 py-0.5 rounded text-[8px] font-semibold text-[var(--accent-secondary)]">WHEEL UP</kbd></div></div><ZoomIn className="w-4 h-4" /></button><button onClick={zoomOut} className="group relative p-2 hover:bg-[var(--glass-bg)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors rounded-xl"><div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 pointer-events-none whitespace-nowrap z-[10001]"><div className="glass px-3 py-1.5 rounded-xl border border-[var(--glass-border)] flex items-center gap-2 shadow-2xl bg-[var(--bg-main)]/90 backdrop-blur-xl"><span className="text-[10px] font-semibold tracking-wide text-[var(--text-primary)]/90">Zoom Out</span><div className="w-[1px] h-2 bg-[var(--glass-border)] mx-0.5" /><kbd className="bg-[var(--glass-bg)] border border-[var(--glass-border)] px-1.5 py-0.5 rounded text-[8px] font-semibold text-[var(--accent-secondary)]">WHEEL DN</kbd></div></div><ZoomOut className="w-4 h-4" /></button><button onClick={resetTransform} className="group relative p-2 hover:bg-[var(--glass-bg)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors rounded-xl"><div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 pointer-events-none whitespace-nowrap z-[10001]"><div className="glass px-3 py-1.5 rounded-xl border border-[var(--glass-border)] flex items-center gap-2 shadow-2xl bg-[var(--bg-main)]/90 backdrop-blur-xl"><span className="text-[10px] font-semibold tracking-wide text-[var(--text-primary)]/90">Reset View</span><div className="w-[1px] h-2 bg-[var(--glass-border)] mx-0.5" /><kbd className="bg-[var(--glass-bg)] border border-[var(--glass-border)] px-1.5 py-0.5 rounded text-[8px] font-semibold text-[var(--accent-secondary)]">CTRL+0</kbd></div></div><ScanEye className="w-4 h-4" /></button></div></>
      )}
    </div>
  </div>
  );
};

