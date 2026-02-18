import React from 'react';
import { Image as ImageIcon, Maximize2 } from 'lucide-react';
import { type Thought } from '../../db';

interface ImageRendererProps {
  thought: Thought;
  isReadOnly: boolean;
  setSelectedThoughtId: (id: number | null) => void;
  setInspectorOpen: (open: boolean) => void;
  openLightbox: (url: string, id: number) => void;
}

export const ImageRenderer: React.FC<ImageRendererProps> = ({ 
  thought, 
  isReadOnly, 
  setSelectedThoughtId, 
  setInspectorOpen, 
  openLightbox 
}) => {
  if (!thought.image) {
    return (
      <div data-trigger="image" className="mt-1 flex flex-col items-center gap-2 py-6 bg-black/20 rounded-xl border border-white/5 group/image relative cursor-pointer transition-colors hover:bg-white/[0.05]">
        <ImageIcon className="w-6 h-6 text-white/20" />
        <span className="text-[10px] text-white/20 font-bold uppercase tracking-widest">Add Image</span>
        {!isReadOnly && (
          <div className="absolute inset-0 bg-[var(--accent)]/10 opacity-0 group-hover/image:opacity-100 transition-opacity rounded-xl flex items-center justify-center pointer-events-none">
            <button
              onClick={(e) => { e.stopPropagation(); setSelectedThoughtId(thought.id); setInspectorOpen(true); }}
              className="pointer-events-auto prevent-drag bg-[var(--accent)] text-white p-2 rounded-lg shadow-xl transform scale-90 group-hover/image:scale-100 transition-all hover:scale-110 active:scale-95"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    );
  }
  return (
    <div data-trigger="image" className="mt-2 relative group cursor-pointer">
      <img
        src={thought.image}
        draggable="false"
        onClick={(e) => { e.stopPropagation(); if (thought.image) openLightbox(thought.image, thought.id); }}
        className="w-full rounded-xl border border-white/10 max-h-[160px] object-cover bg-black/50 cursor-zoom-in"
        alt="Thought"
      />
      <button
        onClick={(e) => { e.stopPropagation(); if (thought.image) openLightbox(thought.image, thought.id); }}
        className="expand-img prevent-drag absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white rounded-xl"
      >
        <Maximize2 />
      </button>
    </div>
  );
};
