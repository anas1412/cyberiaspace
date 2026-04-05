import React from 'react';
import { Palette, Maximize2 } from 'lucide-react';
import { type Thought } from '../../db';
import { useThoughtPayload } from './hooks/useThoughtPayload';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface PaintRendererProps {
  thought: Thought;
  isReadOnly: boolean;
  isArchived?: boolean;
  setActiveFocus: (id: string, type: 'text' | 'tasks' | 'paint' | 'table' | 'embed' | 'file' | 'image') => void;
}

export const PaintRenderer: React.FC<PaintRendererProps> = ({ 
  thought, 
  isReadOnly,
  isArchived = false,
  setActiveFocus 
}) => {
  // Use the dual-read hook for backward compatibility
  const { drawing } = useThoughtPayload(thought);
  
  const hasRemoteContent = thought.storageUrl && !drawing && thought.syncStatus !== 'synced';

  return (
    <div data-trigger="paint" className={cn(
      "paint-container bg-[var(--node-bg)]/20 rounded-xl p-2 mt-1 border border-[var(--glass-border)] cursor-pointer group/paint relative overflow-hidden min-h-[60px] flex items-center justify-center",
      isArchived && "pointer-events-none"
    )}>
      {drawing ? (
        <img src={drawing} draggable="false" className="w-full rounded-lg object-contain max-h-[140px] prevent-drag" alt="Drawing" />
      ) : hasRemoteContent ? (
        <div className="flex flex-col items-center gap-2 py-4 opacity-40">
          <Palette className="w-6 h-6 text-[var(--accent)]/40" />
          <span className="text-[8px] text-[var(--accent)]/40 font-semibold tracking-[0.2em] text-center px-2">
            Sketch on other device
          </span>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 py-4">
          <Palette className="w-6 h-6 text-[var(--text-muted)]" />
          <span className="text-[10px] text-[var(--text-muted)] font-medium tracking-widest">Start Painting</span>
        </div>
      )}

      {!isReadOnly && !isArchived && (
        <div className="absolute inset-0 bg-[var(--accent)]/10 opacity-0 group-hover/paint:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
          <button
            onClick={(e) => { e.stopPropagation(); setActiveFocus(thought.id, 'paint'); }}
            className="pointer-events-auto prevent-drag bg-[var(--accent)] text-[var(--accent-contrast)] p-2 rounded-lg shadow-xl transform scale-90 group-hover/paint:scale-100 transition-all hover:scale-110 active:scale-95"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
