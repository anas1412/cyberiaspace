import React from 'react';
import { Image as ImageIcon, Maximize2 } from 'lucide-react';
import { type Thought } from '../../db';
import { useThoughtPayload } from './hooks/useThoughtPayload';

interface ImageRendererProps {
  thought: Thought;
  isReadOnly: boolean;
  setSelectedThoughtId: (id: number | null) => void;
  setInspectorOpen: (open: boolean) => void;
}

export const ImageRenderer: React.FC<ImageRendererProps> = ({ 
  thought, 
  isReadOnly, 
  setSelectedThoughtId, 
  setInspectorOpen
}) => {
  // Use the dual-read hook for backward compatibility
  const { image } = useThoughtPayload(thought);
  
  if (!image) {
    const hasRemoteContent = thought.storageUrl && thought.syncStatus !== 'synced' && !isReadOnly;
    
    return (
      <div data-trigger="image" className="mt-1 flex flex-col items-center gap-2 py-6 bg-black/20 rounded-xl border border-white/5 group/image relative cursor-pointer transition-colors hover:bg-white/[0.05]">
        <ImageIcon className="w-6 h-6 text-white/20" />
        <span className="text-[10px] text-white/20 font-bold uppercase tracking-widest">
          {hasRemoteContent ? 'Sync Pending' : 'Add Image'}
        </span>
        {hasRemoteContent && (
          <p className="text-[7px] text-amber-500/40 font-black uppercase tracking-[0.2em] text-center px-4 animate-pulse">
            Content on other device
          </p>
        )}
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
    <div data-trigger="image" className="mt-2 relative group cursor-pointer overflow-hidden rounded-xl border border-white/10 bg-black/50 aspect-video flex items-center justify-center">
      <img
        src={image}
        draggable="false"
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        alt={thought.text}
      />
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
        <Maximize2 className="w-6 h-6 text-white" />
        <span className="text-[8px] font-black uppercase tracking-widest text-white/80">View Asset</span>
      </div>
      
      {/* Type Badge */}
      <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md border border-white/10 text-[7px] font-black text-white/60 uppercase tracking-widest">
        {thought.meta?.file?.type?.split('/')[1]?.toUpperCase() || thought.text?.split('.').pop()?.toUpperCase() || 'IMG'}
      </div>
    </div>
  );
};
