import React from 'react';
import { Zap, Undo2, Redo2, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface StatusBarProps {
  thoughtsCount: number;
  limits: any;
  activeSpace: any;
  handleTogglePhysics: () => void;
  undo: () => void;
  redo: () => void;
  historyIndex: number;
  historyLength: number;
  zoomIn: () => void;
  zoomOut: () => void;
  resetTransform: () => void;
  performanceMode: boolean;
}

export const StatusBar: React.FC<StatusBarProps> = ({ 
  thoughtsCount, limits, activeSpace, handleTogglePhysics, undo, redo, 
  historyIndex, historyLength, zoomIn, zoomOut, resetTransform,
  performanceMode
}) => (
  <div className="fixed bottom-4 md:bottom-8 left-4 md:left-8 z-[9999] flex items-center gap-2 pointer-events-none">
    <div className="glass px-3 md:px-4 h-[40px] md:h-[48px] rounded-2xl flex items-center gap-2 md:gap-4 border border-white/5 pointer-events-auto">
      <div className="group relative flex items-center justify-center gap-2 md:gap-3 cursor-default">
        <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 pointer-events-none whitespace-nowrap z-[10001]"><div className="glass px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2 shadow-2xl bg-[var(--bg-main)]/90 backdrop-blur-xl"><span className="text-[10px] font-black uppercase tracking-widest text-white/80">Capacity</span><div className="w-[1px] h-2 bg-white/10 mx-0.5" /><span className="text-[10px] font-black text-[var(--accent-secondary)]">{limits.MAX_THOUGHTS_PER_SPACE} Max</span></div></div>
        <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0 transition-all shadow-[0_0_10px_currentColor]", thoughtsCount > limits.MAX_THOUGHTS_PER_SPACE ? "bg-red-500 text-red-500" : "bg-green-500 text-green-500")}></span>
        <span className={cn("text-[9px] md:text-[10px] uppercase font-black tracking-widest transition-colors", thoughtsCount > limits.MAX_THOUGHTS_PER_SPACE ? "text-red-400" : "text-white/80")}><span>{thoughtsCount}</span><span className="hidden sm:inline">/{limits.MAX_THOUGHTS_PER_SPACE} {thoughtsCount > limits.MAX_THOUGHTS_PER_SPACE ? 'Overflow' : 'Thoughts'}</span></span>
      </div>
      <div className="h-3 w-[1px] bg-white/10 mx-0.5"></div>
      <button 
        onClick={handleTogglePhysics} 
        disabled={performanceMode}
        className={cn(
          "group relative flex items-center gap-2 transition-all text-[9px] md:text-[10px] font-black uppercase tracking-widest", 
          performanceMode ? "text-slate-500 opacity-50 cursor-not-allowed" : activeSpace?.physics ? "text-[var(--accent-secondary)]" : "text-slate-600"
        )}
      >
        <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 pointer-events-none whitespace-nowrap z-[10001]"><div className="glass px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2 shadow-2xl bg-[var(--bg-main)]/90 backdrop-blur-xl"><span className="text-[10px] font-black uppercase tracking-widest text-white/80">Physics</span><div className="w-[1px] h-2 bg-white/10 mx-0.5" /><span className={cn("text-[8px] font-black uppercase tracking-widest", performanceMode ? "text-amber-400" : activeSpace?.physics ? "text-green-400" : "text-slate-400")}>{performanceMode ? "Auto-Disabled" : activeSpace?.physics ? "Enabled" : "Disabled"}</span></div></div>
        <Zap className="w-3.5 h-3.5 md:w-4 md:h-4" /><span className="hidden xl:inline">Physics</span>
      </button>
      <div className="hidden sm:flex h-3 w-[1px] bg-white/10 mx-0.5"></div>
      <div className="hidden sm:flex items-center gap-1">
        <button onClick={undo} disabled={historyIndex <= 0} className="group relative p-1.5 md:p-2 hover:bg-white/10 text-slate-400 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-all rounded-lg"><div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 pointer-events-none whitespace-nowrap z-[10001]"><div className="glass px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2 shadow-2xl bg-[var(--bg-main)]/90 backdrop-blur-xl"><span className="text-[10px] font-black uppercase tracking-widest text-white/80">Undo</span><div className="w-[1px] h-2 bg-white/10 mx-0.5" /><kbd className="bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-[8px] font-black text-[var(--accent-secondary)]">CTRL+Z</kbd></div></div><Undo2 className="w-3.5 h-3.5 md:w-4 md:h-4" /></button>
        <button onClick={redo} disabled={historyIndex >= historyLength - 1} className="group relative p-1.5 md:p-2 hover:bg-white/10 text-slate-400 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-all rounded-lg"><div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 pointer-events-none whitespace-nowrap z-[10001]"><div className="glass px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2 shadow-2xl bg-[var(--bg-main)]/90 backdrop-blur-xl"><span className="text-[10px] font-black uppercase tracking-widest text-white/80">Redo</span><div className="w-[1px] h-2 bg-white/10 mx-0.5" /><kbd className="bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-[8px] font-black text-[var(--accent-secondary)]">CTRL+Y</kbd></div></div><Redo2 className="w-3.5 h-3.5 md:w-4 md:h-4" /></button>
      </div>
      {activeSpace?.mode === 'spatial' && (
        <><div className="h-3 w-[1px] bg-white/10 mx-0.5"></div><div className="flex items-center gap-1"><button onClick={zoomIn} className="group relative p-2 hover:bg-white/10 text-slate-400 hover:text-white transition-colors rounded-lg"><div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 pointer-events-none whitespace-nowrap z-[10001]"><div className="glass px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2 shadow-2xl bg-[var(--bg-main)]/90 backdrop-blur-xl"><span className="text-[10px] font-black uppercase tracking-widest text-white/80">Zoom In</span><div className="w-[1px] h-2 bg-white/10 mx-0.5" /><kbd className="bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-[8px] font-black text-[var(--accent-secondary)]">WHEEL UP</kbd></div></div><ZoomIn className="w-4 h-4" /></button><button onClick={zoomOut} className="group relative p-2 hover:bg-white/10 text-slate-400 hover:text-white transition-colors rounded-lg"><div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 pointer-events-none whitespace-nowrap z-[10001]"><div className="glass px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2 shadow-2xl bg-[var(--bg-main)]/90 backdrop-blur-xl"><span className="text-[10px] font-black uppercase tracking-widest text-white/80">Zoom Out</span><div className="w-[1px] h-2 bg-white/10 mx-0.5" /><kbd className="bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-[8px] font-black text-[var(--accent-secondary)]">WHEEL DN</kbd></div></div><ZoomOut className="w-4 h-4" /></button><button onClick={resetTransform} className="group relative p-2 hover:bg-white/10 text-slate-400 hover:text-white transition-colors rounded-lg"><div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 pointer-events-none whitespace-nowrap z-[10001]"><div className="glass px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2 shadow-2xl bg-[var(--bg-main)]/90 backdrop-blur-xl"><span className="text-[10px] font-black uppercase tracking-widest text-white/80">Reset View</span></div></div><RotateCcw className="w-4 h-4" /></button></div></>
      )}
    </div>
  </div>
);
