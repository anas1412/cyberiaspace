import React from 'react';
import { Palette, Maximize2 } from 'lucide-react';
import { type Thought } from '../../db';

interface PaintRendererProps {
  thought: Thought;
  isReadOnly: boolean;
  setActiveFocus: (id: number, type: 'text' | 'tasks' | 'paint' | 'table' | 'embed' | 'file' | 'image') => void;

}

export const PaintRenderer: React.FC<PaintRendererProps> = ({ 
  thought, 
  isReadOnly, 
  setActiveFocus 
}) => {
  const isStranded = !thought.drawing && !thought.storageUrl && thought.syncStatus !== 'synced';

  return (
    <div data-trigger="paint" className="paint-container bg-black/40 rounded-xl p-2 mt-1 border border-white/5 cursor-pointer group/paint relative overflow-hidden min-h-[60px] flex items-center justify-center">
      {thought.drawing ? (
        <img src={thought.drawing} draggable="false" className="w-full rounded-lg object-contain max-h-[140px] prevent-drag" alt="Drawing" />
      ) : isStranded ? (
        <div className="flex flex-col items-center gap-2 py-4 opacity-40">
          <Palette className="w-6 h-6 text-amber-500/40" />
          <span className="text-[8px] text-amber-500/40 font-black uppercase tracking-[0.2em] text-center px-2">
            Sketch on other device
          </span>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 py-4">
          <Palette className="w-6 h-6 text-white/20" />
          <span className="text-[10px] text-white/20 font-bold uppercase tracking-widest">Start Painting</span>
        </div>
      )}

      {!isReadOnly && (
        <div className="absolute inset-0 bg-[var(--accent)]/10 opacity-0 group-hover/paint:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
          <button
            onClick={(e) => { e.stopPropagation(); setActiveFocus(thought.id, 'paint'); }}
            className="pointer-events-auto prevent-drag bg-[var(--accent)] text-white p-2 rounded-lg shadow-xl transform scale-90 group-hover/paint:scale-100 transition-all hover:scale-110 active:scale-95"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
