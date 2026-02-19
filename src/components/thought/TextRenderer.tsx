import React from 'react';
import { motion } from 'framer-motion';
import { Maximize2, Type } from 'lucide-react';
import { type Thought } from '../../db';
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
  setActiveFocus: (id: number, type: 'text' | 'tasks' | 'paint' | 'table' | 'embed' | 'file') => void;
}

export const TextRenderer: React.FC<TextRendererProps> = ({ 
  thought, 
  isReadOnly, 
  isCalendar, 
  isSpatial, 
  parsedContent, 
  setActiveFocus 
}) => {
  const hasContent = thought.content && thought.content.trim().length > 0;
  return (
    <div className={cn("overflow-hidden relative", hasContent && "max-h-[140px]")}>
      {hasContent ? (
        <div
          className="markdown-body text-[11px] leading-relaxed text-slate-300/90 select-none pointer-events-none"
          dangerouslySetInnerHTML={{ __html: parsedContent as string }}
          onDragStart={(e) => e.preventDefault()}
        />
      ) : (
        !isReadOnly && (
          <motion.div
            whileHover={{ scale: 1.05, backgroundColor: 'rgba(255,255,255,0.08)' }}
            whileTap={{ scale: 0.95 }}
            className={cn(
              "flex items-center gap-2 px-3 rounded-xl bg-white/5 border border-white/5 w-fit transition-all duration-500",
              isCalendar 
                ? "h-0 opacity-0 overflow-hidden"
                : (thought.stackId || !isSpatial)
                  ? "h-0 opacity-0 group-hover:h-8 group-hover:opacity-100 overflow-hidden"
                  : "h-8 opacity-100"
            )}
          >
            <Type className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">Write Note...</span>
          </motion.div>
        )
      )}
      {hasContent && thought.content.length > 150 && (
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[var(--bg-main)] via-[var(--bg-main)]/80 to-transparent pointer-events-none" />
      )}
      {!isReadOnly && hasContent && (
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
