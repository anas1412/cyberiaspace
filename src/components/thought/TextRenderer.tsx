import React from 'react';
import { Type } from 'lucide-react';
import { type Thought } from '../../db';
import { useThoughtPayload } from './hooks/useThoughtPayload';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface TextRendererProps {
  thought: Thought;
  isCalendar: boolean;
  isSpatial: boolean;
  isArchived?: boolean;
  parsedContent: string | Promise<string>;
  setActiveFocus: (id: string, type: 'text' | 'tasks' | 'paint' | 'table' | 'embed' | 'file' | 'image') => void;
}

export const TextRenderer: React.FC<TextRendererProps> = ({ 
  thought, 
  isCalendar, 
  isArchived = false,
  parsedContent, 
  setActiveFocus 
}) => {
  const { content } = useThoughtPayload(thought);
  
  const hasContent = content && content.trim().length > 0;

  if (!hasContent) {
    if (isCalendar) return null;
    return (
      <div 
        data-trigger="text" 
        className={cn(
          "flex flex-col items-center justify-center py-5 gap-1.5 group/text relative cursor-pointer",
          isArchived && "pointer-events-none"
        )}
        onClick={(e) => { e.stopPropagation(); setActiveFocus(thought.id, 'text'); }}
      >
        <Type className="w-5 h-5 text-[var(--text-muted)]/30" />
        <span className="text-[9px] text-[var(--text-muted)]/40 font-medium tracking-widest">
          Write Note
        </span>
      </div>
    );
  }

  return (
    <div className={cn("overflow-hidden relative group/text cursor-pointer", hasContent && "max-h-[140px]")}>
      <div
        className="markdown-body text-[11px] leading-relaxed text-[var(--text-dimmed)] select-none pointer-events-none break-words"
        dangerouslySetInnerHTML={{ __html: parsedContent as string }}
        onDragStart={(e) => e.preventDefault()}
      />
      {content.length > 150 && (
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[var(--node-bg)] via-[var(--node-bg)]/80 to-transparent pointer-events-none" />
      )}
    </div>
  );
};
