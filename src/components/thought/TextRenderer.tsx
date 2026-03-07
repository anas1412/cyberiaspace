import React from 'react';
import { Maximize2, Type } from 'lucide-react';
import { type Thought } from '../../db';
import { useThoughtPayload } from './hooks/useThoughtPayload';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface TextRendererProps {
  thought: Thought;
  isReadOnly: boolean;
  isCalendar: boolean;
  isSpatial: boolean;
  parsedContent: string | Promise<string>;
  setActiveFocus: (id: number, type: 'text' | 'tasks' | 'paint' | 'table' | 'embed' | 'file' | 'image') => void;
}

export const TextRenderer: React.FC<TextRendererProps> = ({ 
  thought, 
  isReadOnly, 
  isCalendar, 
  parsedContent, 
  setActiveFocus 
}) => {
  // Use the dual-read hook for backward compatibility
  const { content } = useThoughtPayload(thought);
  
  const hasContent = content && content.trim().length > 0;
  const hasRemoteContent = thought.storageUrl && !hasContent && thought.syncStatus !== 'synced' && !isReadOnly;

  if (!hasContent) {
    if (isCalendar) return null;
    return (
      <div 
        data-trigger="text" 
        className="mt-1 flex flex-col items-center gap-2 py-4 bg-black/20 rounded-xl border border-white/5 group/text relative cursor-pointer transition-colors hover:bg-white/[0.05]"
      >
        <Type className="w-6 h-6 text-white/20" />
        <span className="text-[10px] text-white/20 font-bold uppercase tracking-widest">
          {hasRemoteContent ? 'Sync Pending' : 'Write Note'}
        </span>
        {hasRemoteContent && (
          <p className="text-[7px] text-amber-500/40 font-black uppercase tracking-[0.2em] text-center px-4">
            Content on other device
          </p>
        )}
        {!isReadOnly && (
          <div className="absolute inset-0 bg-[var(--accent)]/10 opacity-0 group-hover/text:opacity-100 transition-opacity rounded-xl flex items-center justify-center pointer-events-none">
            <button
              onClick={(e) => { e.stopPropagation(); setActiveFocus(thought.id, 'text'); }}
              className="pointer-events-auto prevent-drag bg-[var(--accent)] text-white p-2 rounded-lg shadow-xl transform scale-90 group-hover/text:scale-100 transition-all hover:scale-110 active:scale-95"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn("overflow-hidden relative", hasContent && "max-h-[140px]")}>
      <div
        className="markdown-body text-[11px] leading-relaxed text-slate-300/90 select-none pointer-events-none break-words"
        dangerouslySetInnerHTML={{ __html: parsedContent as string }}
        onDragStart={(e) => e.preventDefault()}
      />
      {content.length > 150 && (
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[var(--bg-main)] via-[var(--bg-main)]/80 to-transparent pointer-events-none" />
      )}
      {!isReadOnly && (
        <div className="absolute inset-0 bg-[var(--accent)]/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
          <button
            onClick={(e) => { e.stopPropagation(); setActiveFocus(thought.id, 'text'); }}
            className="pointer-events-auto bg-[var(--accent)] text-white p-2 rounded-lg shadow-xl transform scale-90 group-hover:scale-100 transition-all hover:scale-110 active:scale-95"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
