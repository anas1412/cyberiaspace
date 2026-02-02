import React, { useRef, useEffect, useState, useMemo } from 'react';
import { type Thought } from '../db';
import { useStore } from '../store/useStore';
import { Maximize2, Palette } from 'lucide-react';
import { marked } from 'marked';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ThoughtNodeProps {
  thought: Thought;
  registerElement: (id: number, el: HTMLDivElement | null) => void;
  onMouseDown: (id: number, e: React.MouseEvent) => void;
  isDragging: boolean;
}

const getTagStyle = (tag: string) => {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = tag.charCodeAt(i) + ((h << 5) - h);
  const hue = Math.abs(h * 137.5) % 360;
  return {
    backgroundColor: `hsla(${hue}, 70%, 50%, 0.15)`,
    color: `hsla(${hue}, 90%, 75%, 1)`,
    borderColor: `hsla(${hue}, 70%, 50%, 0.3)`,
  };
};

const PRIO_COLORS = {
  none: 'transparent',
  low: '#3b82f6',
  medium: '#eab308',
  high: '#f97316',
  urgent: '#ef4444',
};

const STATUS_COLORS = {
  none: 'transparent',
  todo: '#6366f1',
  doing: '#eab308',
  done: '#22c55e',
};

const ThoughtNode: React.FC<ThoughtNodeProps> = React.memo(({ thought, registerElement, onMouseDown, isDragging }) => {
  const elRef = useRef<HTMLDivElement>(null);
  const selectedThoughtId = useStore((state) => state.selectedThoughtId);
  const isSelected = selectedThoughtId === thought.id;
  const setSelectedThoughtId = useStore((state) => state.setSelectedThoughtId);
  const setInspectorOpen = useStore((state) => state.setInspectorOpen);
  const setActiveFocus = useStore((state) => state.setActiveFocus);
  const openLightbox = useStore((state) => state.openLightbox);
  
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  
  const parsedContent = useMemo(() => {
    return thought.content ? marked.parse(thought.content) : '';
  }, [thought.content]);

  useEffect(() => {
    registerElement(thought.id, elRef.current);
    return () => registerElement(thought.id, null);
  }, [thought.id, registerElement]);

  const handleLocalMouseDown = (e: React.MouseEvent) => {
    setStartPos({ x: e.clientX, y: e.clientY });
    onMouseDown(thought.id, e);
  };

  const handleClick = (e: React.MouseEvent) => {
    const dist = Math.sqrt(Math.pow(e.clientX - startPos.x, 2) + Math.pow(e.clientY - startPos.y, 2));
    if (dist > 5) return;

    const target = e.target as HTMLElement;
    if (target.closest('.checkbox')) return;
    
    const textTrigger = target.closest('[data-trigger="text"]');
    const tableTrigger = target.closest('[data-trigger="table"]');
    const imageTrigger = target.closest('[data-trigger="image"]');
    const paintTrigger = target.closest('[data-trigger="paint"]');

    if (textTrigger) {
        setActiveFocus(thought.id, 'text');
    } else if (tableTrigger) {
        setActiveFocus(thought.id, 'table');
    } else if (paintTrigger) {
        setActiveFocus(thought.id, 'paint');
    } else if (imageTrigger) {
        if (thought.image) openLightbox(thought.image);
    } else {
        setSelectedThoughtId(thought.id);
        setInspectorOpen(true);
    }
  };

  const renderContent = () => {
    switch (thought.type) {
      case 'text': {
        const hasContent = thought.content && thought.content.trim().length > 0;
        return (
          <div data-trigger="text" className="relative group/text overflow-hidden rounded-xl prevent-drag cursor-pointer">
            <div className={cn("overflow-hidden relative", hasContent && "max-h-[120px]")}>
              {hasContent && (
                <div 
                  className="markdown-body mt-1 line-clamp-6"
                  dangerouslySetInnerHTML={{ __html: parsedContent as string }}
                />
              )}
              {hasContent && (
                <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[#0f172a] to-transparent pointer-events-none" />
              )}
            </div>
            {hasContent && thought.content.length > 200 && (
              <div className="text-[8px] opacity-30 text-center mt-1">Read more...</div>
            )}
            <div className="absolute inset-0 bg-indigo-500/10 opacity-0 group-hover/text:opacity-100 transition-opacity rounded-xl flex items-center justify-center pointer-events-none">
              <button 
                onClick={(e) => { e.stopPropagation(); setActiveFocus(thought.id, 'text'); }}
                className="pointer-events-auto bg-indigo-500 text-white p-2 rounded-lg shadow-xl transform scale-90 group-hover/text:scale-100 transition-all"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      }
      case 'tasks': {
        if (!thought.tasks.length) return null;
        const done = thought.tasks.filter((t) => t.done).length;
        const progress = (done / thought.tasks.length) * 100;
        return (
          <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden mt-1 prevent-drag">
            <div 
              className="h-full bg-indigo-500 transition-all duration-500" 
              style={{ width: `${progress}%` }} 
            />
          </div>
        );
      }
      case 'paint': {
        return (
          <div data-trigger="paint" className="paint-container bg-black/40 rounded-xl p-2 mt-1 border border-white/5 prevent-drag cursor-pointer group/paint relative overflow-hidden min-h-[60px] flex items-center justify-center">
            {thought.drawing ? (
              <img src={thought.drawing} className="w-full rounded-lg object-contain max-h-[140px]" alt="Drawing" />
            ) : (
              <div className="flex flex-col items-center gap-2 py-4">
                <Palette className="w-6 h-6 text-white/20" />
                <span className="text-[10px] text-white/20 font-bold uppercase tracking-widest">Start Painting</span>
              </div>
            )}
            <div className="absolute inset-0 bg-indigo-500/10 opacity-0 group-hover/paint:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
              <button className="pointer-events-auto bg-indigo-500 text-white p-2 rounded-lg shadow-xl transform scale-90 group-hover/paint:scale-100 transition-all">
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      }
      case 'table': {
        const maxCols = 3;
        const maxRows = 4;
        const hasMoreRows = thought.table.length > maxRows;
        const hasMoreCols = thought.table[0]?.length > maxCols;
        const visibleRows = thought.table.slice(0, maxRows);

        return (
          <div data-trigger="table" className="relative group/table overflow-hidden rounded-xl prevent-drag cursor-pointer">
            <div className="overflow-x-auto custom-scroll pb-1">
              <table className="thought-table mt-1 border-collapse w-full text-[10px]">
                <tbody>
                  {visibleRows.map((row, r) => (
                    <tr key={r} className={cn(r % 2 === 0 ? "bg-white/[0.01]" : "")}>
                      {row.slice(0, maxCols).map((cell, c) => (
                        <td key={c} className="p-2 border-b border-white/[0.03] text-white/60 whitespace-nowrap">
                          {cell}
                        </td>
                      ))}
                      {hasMoreCols && <td className="p-2 border-b border-white/[0.03] text-[8px] opacity-30">...</td>}
                    </tr>
                  ))}
                  {hasMoreRows && (
                    <tr>
                      <td colSpan={Math.min(maxCols, thought.table[0]?.length || 0) + (hasMoreCols ? 1 : 0)} className="text-center text-[8px] opacity-30 py-1">
                        ... and {thought.table.length - maxRows} more rows
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="absolute inset-0 bg-indigo-500/10 opacity-0 group-hover/table:opacity-100 transition-opacity rounded-xl flex items-center justify-center pointer-events-none">
              <button 
                onClick={(e) => { e.stopPropagation(); setActiveFocus(thought.id, 'table'); }}
                className="pointer-events-auto bg-indigo-500 text-white p-2 rounded-lg shadow-xl transform scale-90 group-hover/table:scale-100 transition-all"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      }
      case 'image': {
        if (!thought.image) return null;
        return (
          <div data-trigger="image" className="mt-2 relative group prevent-drag cursor-pointer">
            <img 
              src={thought.image} 
              onClick={(e) => { e.stopPropagation(); if (thought.image) openLightbox(thought.image); }}
              className="w-full rounded-xl border border-white/10 max-h-[160px] object-cover bg-black/50 cursor-zoom-in" 
              alt="Thought" 
            />
            <button 
              onClick={(e) => { e.stopPropagation(); if (thought.image) openLightbox(thought.image); }}
              className="expand-img absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
            >
              <Maximize2 />
            </button>
          </div>
        );
      }
      default:
        return null;
    }
  };

  return (
    <div
      ref={elRef}
      data-unscheduled={!thought.date ? "true" : "false"}
      className={cn(
        "thought-bulb absolute select-none touch-none will-change-transform w-[280px] pointer-events-auto",
        isDragging ? "z-[1000] cursor-grabbing" : "z-20 cursor-grab"
      )}
      onMouseDown={handleLocalMouseDown}
      onClick={handleClick}
    >
      <div className={cn(
        "thought-bulb-content bg-[#0f172a]/96 backdrop-blur-[20px] border p-6 rounded-[32px] flex flex-col gap-3 relative transition-all duration-300",
        isSelected 
          ? "border-indigo-500/50 shadow-[0_0_40px_rgba(99,102,241,0.2)]" 
          : "border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.5)]"
      )}>
        
        {/* Header Area: Title + Priority + Badges */}
        <div className="flex items-start justify-between gap-4 min-h-[24px]">
          <div className="flex items-start gap-2.5 flex-1 min-w-0">
            {thought.priority !== 'none' && (
              <div 
                className="w-1.5 h-1.5 rounded-full mt-[7px] flex-shrink-0"
                style={{ 
                  backgroundColor: PRIO_COLORS[thought.priority],
                  boxShadow: `0 0 10px ${PRIO_COLORS[thought.priority]}88`
                }}
              />
            )}
            <p className={cn(
              "text-[13px] font-bold leading-tight break-all", 
              thought.text ? "text-white" : "text-slate-600 italic"
            )}>
              {thought.text || "Untitled"}
            </p>
          </div>

          {/* Metadata Row (Status & Date) */}
          <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
            {thought.status !== 'none' && (
              <div 
                className="text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full border border-white/10 shadow-sm"
                style={{ 
                  color: 'white',
                  backgroundColor: STATUS_COLORS[thought.status],
                }}
              >
                {thought.status}
              </div>
            )}
            {thought.date && (
              <div className="text-[8px] font-mono text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 rounded bg-indigo-500/5">
                {thought.date}
              </div>
            )}
          </div>
        </div>

        {thought.description && (
          <p className="text-[10px] text-slate-500 italic pr-10">{thought.description}</p>
        )}
        {renderContent()}
        <div className="flex flex-wrap gap-1.5 mt-1">
          {thought.tags.map((tag, i) => (
            <span key={i} className="tag-pill text-[9px] font-700 px-2.5 py-1 rounded-lg border border-white/10 flex items-center gap-1.5 whitespace-nowrap" style={getTagStyle(tag)}>
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
});

export default ThoughtNode;
