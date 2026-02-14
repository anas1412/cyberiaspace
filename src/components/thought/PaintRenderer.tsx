import React from 'react';
import { Palette, Maximize2 } from 'lucide-react';
import { type Thought } from '../../db';

interface PaintRendererProps {
  thought: Thought;
  isReadOnly: boolean;
  setActiveFocus: (id: number, type: 'text' | 'tasks' | 'paint' | 'table' | 'embed') => void;
}

export const PaintRenderer: React.FC<PaintRendererProps> = ({ 
  thought, 
  isReadOnly, 
  setActiveFocus 
}) => {
  return (
    <div data-trigger="paint" className="paint-container bg-black/40 rounded-xl p-2 mt-1 border border-white/5 prevent-drag cursor-pointer group/paint relative overflow-hidden min-h-[60px] flex items-center justify-center">
      {thought.drawing ? (
        <img src={thought.drawing} draggable="false" className="w-full rounded-lg object-contain max-h-[140px]" alt="Drawing" />
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
            className="pointer-events-auto bg-[var(--accent)] text-white p-2 rounded-lg shadow-xl transform scale-90 group-hover/paint:scale-100 transition-all hover:scale-110 active:scale-95"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
