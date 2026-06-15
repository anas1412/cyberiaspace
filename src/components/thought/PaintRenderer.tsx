import React from 'react';
import { Palette } from 'lucide-react';
import { type Thought } from '../../db';
import { useThoughtPayload } from './hooks/useThoughtPayload';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface PaintRendererProps {
  thought: Thought;
  isArchived?: boolean;
  setActiveFocus: (id: string, type: 'text' | 'tasks' | 'paint' | 'table' | 'embed' | 'file' | 'image') => void;
}

export const PaintRenderer: React.FC<PaintRendererProps> = ({ 
  thought, 
  isArchived = false,
  setActiveFocus 
}) => {
  const { drawing } = useThoughtPayload(thought);

  return (
    <div data-trigger="paint" className={cn(
      "paint-container rounded-xl overflow-hidden cursor-pointer group/paint relative flex items-center justify-center",
      isArchived && "pointer-events-none"
    )}>
      {drawing && (
        <img src={drawing} draggable="false" className="w-full rounded-lg object-contain max-h-[140px] prevent-drag" alt="Drawing" />
      )}
      {!drawing && (
        <div className="flex flex-col items-center justify-center py-5 gap-1.5 cursor-pointer"
          onClick={(e) => { e.stopPropagation(); setActiveFocus(thought.id, 'paint'); }}
        >
          <Palette className="w-5 h-5 text-[var(--text-muted)]/30" />
          <span className="text-[9px] text-[var(--text-muted)]/40 font-medium tracking-widest">Start Painting</span>
        </div>
      )}
    </div>
  );
};
