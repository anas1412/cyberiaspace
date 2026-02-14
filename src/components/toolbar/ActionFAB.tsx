import React from 'react';
import { Plus, ArrowLeft } from 'lucide-react';

interface ActionFABProps {
  isReadOnly: boolean;
  handleAddThought: () => void;
}

export const ActionFAB: React.FC<ActionFABProps> = ({ isReadOnly, handleAddThought }) => (
  !isReadOnly ? (
    <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[10000] pointer-events-none flex flex-col items-center transition-all duration-300">
      <button onClick={handleAddThought} className="group relative flex items-center justify-center w-16 h-16 bg-[var(--bg-gradient-to)]/40 backdrop-blur-2xl text-white rounded-full border border-white/10 shadow-[0_0_50px_var(--accent-glow)] transition-all hover:scale-110 active:scale-95 hover:border-[var(--accent)]/40 pointer-events-auto">
        <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 pointer-events-none whitespace-nowrap"><div className="glass px-3 py-1.5 rounded-xl border border-white/10 flex flex-col items-center gap-1 shadow-2xl bg-[var(--bg-main)]/90 backdrop-blur-xl"><div className="flex items-center gap-2"><span className="text-[10px] font-black uppercase tracking-widest text-white/80">New Thought</span><div className="w-[1px] h-2 bg-white/10 mx-0.5" /><kbd className="bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-[8px] font-black text-[var(--accent-secondary)]">SPACE</kbd></div><span className="text-[7px] font-black uppercase tracking-[0.2em] text-white/30 italic">or drag files to import</span></div></div>
        <div className="absolute inset-0 rounded-full bg-[var(--accent)]/5 opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />
        <Plus className="w-8 h-8 text-slate-400 group-hover:text-white transition-all group-hover:rotate-90 relative z-10" />
      </button>
    </div>
  ) : (
    <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[10000] pointer-events-none flex flex-col items-center transition-all duration-300">
      <button onClick={() => window.location.href = '/'} className="group relative flex items-center gap-3 px-6 py-3 bg-[var(--bg-gradient-to)]/40 backdrop-blur-2xl text-white rounded-full border border-white/10 shadow-[0_0_50px_var(--accent-glow)] transition-all hover:scale-105 active:scale-95 hover:border-[var(--accent)]/40 pointer-events-auto">
        <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 pointer-events-none whitespace-nowrap"><div className="glass px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2 shadow-2xl bg-[var(--bg-main)]/90 backdrop-blur-xl"><span className="text-[10px] font-black uppercase tracking-widest text-white/80">Return to Your Workspace</span></div></div>
        <div className="absolute inset-0 rounded-full bg-[var(--accent)]/5 opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />
        <ArrowLeft className="w-5 h-5 text-slate-400 group-hover:text-white transition-all relative z-10" /><span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-white transition-all relative z-10">Exit</span>
      </button>
    </div>
  )
);
