import React, { useRef, useEffect, useState, useMemo } from 'react';
import { type Thought } from '../db';
import { useStore } from '../store/useStore';
import { Maximize2, Palette, Link as LinkIcon } from 'lucide-react';
import { marked } from 'marked';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ThoughtNodeProps {
  thought: Thought;
  registerElement: (id: number, el: HTMLDivElement | null) => void;
  onMouseDown: (id: number, e: React.MouseEvent | React.TouchEvent) => void;
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
  low: 'var(--prio-low)',
  medium: 'var(--prio-medium)',
  high: 'var(--prio-high)',
  urgent: 'var(--prio-urgent)',
};

const STATUS_COLORS = {
  none: 'transparent',
  todo: 'var(--status-todo)',
  doing: 'var(--status-doing)',
  done: 'var(--status-done)',
};

const ThoughtNode: React.FC<ThoughtNodeProps> = React.memo(({ thought, registerElement, onMouseDown, isDragging }) => {
  const elRef = useRef<HTMLDivElement>(null);
  const selectedThoughtId = useStore((state) => state.selectedThoughtId);
  const isSelected = selectedThoughtId === thought.id;
  const setSelectedThoughtId = useStore((state) => state.setSelectedThoughtId);
  const setInspectorOpen = useStore((state) => state.setInspectorOpen);
  const setActiveFocus = useStore((state) => state.setActiveFocus);
  const openLightbox = useStore((state) => state.openLightbox);
  const linkingSourceId = useStore((state) => state.linkingSourceId);
  const setLinkingSourceId = useStore((state) => state.setLinkingSourceId);
  const updateThought = useStore((state) => state.updateThought);
  const thoughts = useStore((state) => state.thoughts);
  
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

  const handleLocalTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setStartPos({ x: touch.clientX, y: touch.clientY });
    onMouseDown(thought.id, e);
  };

  const handleLinkClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (linkingSourceId === thought.id) {
      setLinkingSourceId(null);
    } else {
      setLinkingSourceId(thought.id);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    const dist = Math.sqrt(Math.pow(e.clientX - startPos.x, 2) + Math.pow(e.clientY - startPos.y, 2));
    if (dist > 5) return;

    if (linkingSourceId && linkingSourceId !== thought.id) {
      // Complete the link
      const sourceThought = thoughts.find(t => t.id === linkingSourceId);
      if (sourceThought) {
        // Check if they already share a stack tag
        const existingStackTag = sourceThought.tags.find(tag => tag.startsWith('stack-')) || 
                               thought.tags.find(tag => tag.startsWith('stack-'));
        
        const stackTag = existingStackTag || `stack-${Math.random().toString(36).substr(2, 6)}`;
        
        if (!sourceThought.tags.includes(stackTag)) {
          updateThought(sourceThought.id, { tags: [...sourceThought.tags, stackTag] });
        }
        if (!thought.tags.includes(stackTag)) {
          updateThought(thought.id, { tags: [...thought.tags, stackTag] });
        }
      }
      setLinkingSourceId(null);
      return;
    }

    const target = e.target as HTMLElement;
    if (target.closest('.checkbox')) return;
    
    const textTrigger = target.closest('[data-trigger="text"]');
    const tableTrigger = target.closest('[data-trigger="table"]');
    const tasksTrigger = target.closest('[data-trigger="tasks"]');
    const imageTrigger = target.closest('[data-trigger="image"]');
    const paintTrigger = target.closest('[data-trigger="paint"]');

    if (textTrigger) {
        setActiveFocus(thought.id, 'text');
    } else if (tableTrigger) {
        setActiveFocus(thought.id, 'table');
    } else if (tasksTrigger) {
        setActiveFocus(thought.id, 'tasks');
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
                <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[var(--bg-main)] to-transparent pointer-events-none" />
              )}
            </div>
            {hasContent && thought.content.length > 200 && (
              <div className="text-[8px] opacity-30 text-center mt-1">Read more...</div>
            )}
            <div className="absolute inset-0 bg-[var(--accent)]/10 opacity-0 group-hover/text:opacity-100 transition-opacity rounded-xl flex items-center justify-center pointer-events-none">
              <button 
                onClick={(e) => { e.stopPropagation(); setActiveFocus(thought.id, 'text'); }}
                className="pointer-events-auto bg-[var(--accent)] text-white p-2 rounded-lg shadow-xl transform scale-90 group-hover/text:scale-100 transition-all"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      }
      case 'tasks': {
        if (!thought.tasks.length) return (
          <div data-trigger="tasks" className="p-3 bg-black/20 rounded-xl border border-white/5 mt-1 cursor-pointer hover:bg-white/[0.05] transition-colors group/tasks relative">
            <div className="flex items-center gap-2 text-slate-600">
              <Maximize2 className="w-3 h-3" />
              <span className="text-[10px] font-bold uppercase tracking-widest">No tasks yet</span>
            </div>
          </div>
        );
        const done = thought.tasks.filter((t) => t.done).length;
        const progress = (done / thought.tasks.length) * 100;
        const previewTasks = thought.tasks.slice(0, 3);

        return (
          <div data-trigger="tasks" className="mt-1 space-y-2 group/tasks relative cursor-pointer prevent-drag">
            <div className="space-y-1.5">
              {previewTasks.map((task, i) => (
                <div key={i} className="flex items-center gap-2 min-w-0">
                  <div className={cn(
                    "w-3 h-3 rounded-sm border-[1.5px] flex-shrink-0 transition-colors",
                    task.done ? "bg-[var(--status-todo)] border-[var(--status-todo)]" : "border-white/20"
                  )} />
                  <span className={cn(
                    "text-[10px] truncate",
                    task.done ? "text-slate-600 line-through" : "text-slate-300"
                  )}>
                    {task.text || "Untitled Task"}
                  </span>
                </div>
              ))}
              {thought.tasks.length > 3 && (
                <div className="text-[8px] text-slate-600 pl-5">
                  + {thought.tasks.length - 3} more...
                </div>
              )}
            </div>
            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden mt-3">
              <div 
                className="h-full bg-[var(--accent)] transition-all duration-500 shadow-[0_0_10px_var(--accent-glow)]" 
                style={{ width: `${progress}%` }} 
              />
            </div>
            <div className="absolute inset-0 bg-[var(--accent)]/10 opacity-0 group-hover/tasks:opacity-100 transition-opacity rounded-xl flex items-center justify-center pointer-events-none">
              <button 
                onClick={(e) => { e.stopPropagation(); setActiveFocus(thought.id, 'tasks'); }}
                className="pointer-events-auto bg-[var(--accent)] text-white p-2 rounded-lg shadow-xl transform scale-90 group-hover/tasks:scale-100 transition-all"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
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
            <div className="absolute inset-0 bg-[var(--accent)]/10 opacity-0 group-hover/paint:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
              <button className="pointer-events-auto bg-[var(--accent)] text-white p-2 rounded-lg shadow-xl transform scale-90 group-hover/paint:scale-100 transition-all">
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
            <div className="absolute inset-0 bg-[var(--accent)]/10 opacity-0 group-hover/table:opacity-100 transition-opacity rounded-xl flex items-center justify-center pointer-events-none">
              <button 
                onClick={(e) => { e.stopPropagation(); setActiveFocus(thought.id, 'table'); }}
                className="pointer-events-auto bg-[var(--accent)] text-white p-2 rounded-lg shadow-xl transform scale-90 group-hover/table:scale-100 transition-all"
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
      data-id={thought.id}
      data-unscheduled={!thought.date ? "true" : "false"}
      className={cn(
        "thought-bulb absolute select-none touch-none will-change-transform w-[280px] pointer-events-auto",
        isDragging ? "z-[1000] cursor-grabbing" : "z-20 cursor-grab"
      )}
      onMouseDown={handleLocalMouseDown}
      onTouchStart={handleLocalTouchStart}
      onClick={handleClick}
    >
      <div className={cn(
        "thought-bulb-content backdrop-blur-[20px] border p-6 rounded-[32px] flex flex-col gap-3 relative transition-all duration-300",
        isSelected 
          ? "border-[var(--accent)]/50 shadow-[0_0_40px_var(--accent-glow)] bg-[var(--node-bg)]" 
          : "border-[var(--glass-border)] shadow-[0_10px_40px_rgba(0,0,0,0.5)] bg-[var(--node-bg)]",
        linkingSourceId === thought.id && "ring-2 ring-[var(--accent)] ring-offset-4 ring-offset-[var(--bg-page)]",
        linkingSourceId && linkingSourceId !== thought.id && "hover:scale-105 hover:border-[var(--accent)]/50 cursor-pointer"
      )}>
        
        {/* Header Area: Title + Priority + Badges */}
        <div className="flex items-start justify-between gap-4 min-h-[24px]">
          <div className="flex items-start gap-2.5 flex-1 min-w-0">
            {thought.priority !== 'none' && (
              <div 
                className="w-1.5 h-1.5 rounded-full mt-[7px] flex-shrink-0"
                style={{ 
                  backgroundColor: PRIO_COLORS[thought.priority],
                  boxShadow: `0 0 10px ${PRIO_COLORS[thought.priority]}, 0 0 8px rgba(0,0,0,0.5)`
                }}
              />
            )}
            <p className={cn(
              "text-[13px] font-bold leading-tight break-all", 
              thought.text ? "text-[var(--text-primary)]" : "text-slate-600 italic"
            )}>
              {thought.text || "Untitled"}
            </p>
          </div>

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
              <div className="text-[8px] font-mono text-[var(--accent)] border border-[var(--accent)]/20 px-1.5 py-0.5 rounded bg-[var(--accent)]/5">
                {thought.date}
              </div>
            )}
          </div>
        </div>

        {thought.description && (
          <p className="text-[10px] text-[var(--text-dimmed)] italic pr-10">{thought.description}</p>
        )}
        {renderContent()}
        <div className="flex flex-wrap gap-1.5 mt-1">
          {thought.tags.map((tag, i) => (
            <span key={i} className="tag-pill text-[9px] font-700 px-2.5 py-1 rounded-lg border border-white/10 flex items-center gap-1.5 whitespace-nowrap" style={getTagStyle(tag)}>
              {tag}
            </span>
          ))}
        </div>

        {/* Bottom Right Link Button */}
        <button 
          onClick={handleLinkClick}
          className={cn(
            "absolute bottom-4 right-4 p-2 rounded-xl transition-all z-10",
            linkingSourceId === thought.id 
              ? "bg-[var(--accent)] text-white shadow-[0_0_20px_var(--accent-glow)]" 
              : "bg-white/5 text-slate-500 hover:text-white hover:bg-white/10 border border-white/5"
          )}
          title="Link to another thought"
        >
          <LinkIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
});

export default ThoughtNode;
