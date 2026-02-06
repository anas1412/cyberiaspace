import React, { useRef, useEffect, useState, useMemo } from 'react';
import { type Thought } from '../db';
import { useStore } from '../store/useStore';
import { Maximize2, Palette, Link as LinkIcon, Link2Off } from 'lucide-react';
import { marked } from 'marked';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { getYouTubeVideoId } from '../utils/youtube';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ThoughtNodeProps {
  thought: Thought;
  registerElement: (id: number, el: HTMLDivElement | null) => void;
  onMouseDown: (id: number, e: React.MouseEvent) => void;
  isDragging: boolean;
}

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
  const selectedThoughtIds = useStore((state) => state.selectedThoughtIds);
  const isSelected = selectedThoughtId === thought.id || selectedThoughtIds.includes(thought.id);
  
  const setSelectedThoughtId = useStore((state) => state.setSelectedThoughtId);
  const setInspectorOpen = useStore((state) => state.setInspectorOpen);
  const setActiveFocus = useStore((state) => state.setActiveFocus);
  const openLightbox = useStore((state) => state.openLightbox);
  const linkingSourceId = useStore((state) => state.linkingSourceId);
  const setLinkingSourceId = useStore((state) => state.setLinkingSourceId);
  const stacks = useStore((state) => state.stacks);
  
  const stack = useMemo(() => stacks.find(s => s.id === thought.stackId), [stacks, thought.stackId]);
  
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  
  const parsedContent = useMemo(() => {
    return thought.content ? marked.parse(thought.content) : '';
  }, [thought.content]);

  useEffect(() => {
    registerElement(thought.id, elRef.current);
    return () => registerElement(thought.id, null);
  }, [thought.id, registerElement]);

  const handleLocalMouseDown = (e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.stopPropagation();
    }
    setStartPos({ x: e.clientX, y: e.clientY });
    onMouseDown(thought.id, e);
  };

  const handleLinkAction = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (thought.stackId) {
      // If already in a stack, this button unlinks it
      const store = useStore.getState();
      store.setSelectedThoughtIds([thought.id]);
      store.unlinkSelectedThoughts();
      store.setSelectedThoughtIds([]);
    } else {
      // If not in a stack, this button toggles linking mode
      if (linkingSourceId === thought.id) {
        setLinkingSourceId(null);
      } else {
        setLinkingSourceId(thought.id);
      }
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    const dist = Math.sqrt(Math.pow(e.clientX - startPos.x, 2) + Math.pow(e.clientY - startPos.y, 2));
    if (dist > 5) return;

    if (e.ctrlKey || e.metaKey) {
      e.stopPropagation();
      return;
    }

    if (linkingSourceId && linkingSourceId !== thought.id) {
      const store = useStore.getState();
      store.setSelectedThoughtIds([linkingSourceId, thought.id]);
      store.linkSelectedThoughts();
      store.setSelectedThoughtIds([thought.id]);
      setLinkingSourceId(null);
      return;
    }

    if (linkingSourceId === thought.id) {
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
          <div data-trigger="text" className="relative group/text overflow-hidden rounded-xl prevent-drag cursor-pointer pt-1">
            <div className={cn("overflow-hidden relative", hasContent && "max-h-[140px]")}>
              {hasContent && (
                <div 
                  className="markdown-body text-[11px] leading-relaxed text-slate-300/90"
                  dangerouslySetInnerHTML={{ __html: parsedContent as string }}
                />
              )}
              {hasContent && thought.content.length > 150 && (
                <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[var(--bg-main)] via-[var(--bg-main)]/80 to-transparent pointer-events-none" />
              )}
            </div>
            {hasContent && thought.content.length > 150 && (
              <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 opacity-40 group-hover/text:opacity-100 transition-opacity">
                <div className="w-8 h-0.5 bg-white/10 rounded-full" />
                <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white/40">Open Note</span>
              </div>
            )}
            <div className="absolute inset-0 bg-[var(--accent)]/5 opacity-0 group-hover/text:opacity-100 transition-opacity rounded-xl flex items-center justify-center pointer-events-none">
              <button 
                onClick={(e) => { e.stopPropagation(); setActiveFocus(thought.id, 'text'); }}
                className="pointer-events-auto bg-[var(--accent)] text-white p-2.5 rounded-xl shadow-2xl transform scale-90 group-hover/text:scale-100 transition-all hover:scale-110 active:scale-95"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      }
      case 'tasks': {
        if (!thought.tasks.length) return (
          <div data-trigger="tasks" className="p-3 bg-black/20 rounded-xl border border-white/5 mt-1 cursor-pointer hover:bg-white/[0.05] transition-colors group/tasks relative pr-10">
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
          <div data-trigger="tasks" className="mt-1 space-y-2 group/tasks relative cursor-pointer prevent-drag pr-10">
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
                className="pointer-events-auto bg-[var(--accent)] text-white p-2 rounded-lg shadow-xl transform scale-90 group-hover/tasks:scale-100 transition-all hover:scale-110 active:scale-95"
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
              <img src={thought.drawing} draggable="false" className="w-full rounded-lg object-contain max-h-[140px]" alt="Drawing" />
            ) : (
              <div className="flex flex-col items-center gap-2 py-4">
                <Palette className="w-6 h-6 text-white/20" />
                <span className="text-[10px] text-white/20 font-bold uppercase tracking-widest">Start Painting</span>
              </div>
            )}
            <div className="absolute inset-0 bg-[var(--accent)]/10 opacity-0 group-hover/paint:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
              <button 
                onClick={(e) => { e.stopPropagation(); setActiveFocus(thought.id, 'paint'); }}
                className="pointer-events-auto bg-[var(--accent)] text-white p-2 rounded-lg shadow-xl transform scale-90 group-hover/paint:scale-100 transition-all hover:scale-110 active:scale-95"
              >
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
                className="pointer-events-auto bg-[var(--accent)] text-white p-2 rounded-lg shadow-xl transform scale-90 group-hover/table:scale-100 transition-all hover:scale-110 active:scale-95"
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
              draggable="false"
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
      case 'embed': {
        const videoId = getYouTubeVideoId(thought.content);
        
        return (
          <div data-trigger="embed" className="mt-2 relative group prevent-drag cursor-pointer overflow-hidden rounded-xl border border-white/10 bg-black/50 aspect-video flex items-center justify-center">
            {videoId ? (
              <>
                <img 
                  src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`} 
                  draggable="false"
                  className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity"
                  alt="YouTube Preview" 
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center shadow-2xl transform group-hover:scale-110 transition-transform">
                    <div className="w-0 h-0 border-t-[8px] border-t-transparent border-l-[14px] border-l-white border-b-[8px] border-b-transparent ml-1" />
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 p-6 text-center">
                <Maximize2 className="w-6 h-6 text-white/20" />
                <span className="text-[10px] text-white/20 font-bold uppercase tracking-widest leading-tight">Paste YouTube Link<br/>in Editor</span>
              </div>
            )}
            <div className="absolute inset-0 bg-[var(--accent)]/10 opacity-0 group-hover/tasks:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
              <button 
                onClick={(e) => { e.stopPropagation(); setActiveFocus(thought.id, 'embed'); }}
                className="pointer-events-auto bg-[var(--accent)] text-white p-2 rounded-lg shadow-xl transform scale-90 group-hover:scale-100 transition-all hover:scale-110 active:scale-95"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
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
      onDragStart={(e) => e.preventDefault()}
      onClick={handleClick}
    >
      <div className={cn(
        "thought-bulb-content backdrop-blur-[20px] border p-6 rounded-[32px] flex flex-col gap-3 relative transition-all duration-300",
        isSelected 
          ? "border-[var(--accent)]/50 shadow-[0_0_40px_var(--accent-glow)] bg-[var(--node-bg)]/80" 
          : "border-[var(--glass-border)] shadow-[0_10px_40px_rgba(0,0,0,0.5)] bg-[var(--node-bg)]/60",
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
                  backgroundColor: PRIO_COLORS[thought.priority as keyof typeof PRIO_COLORS],
                  boxShadow: `0 0 10px ${PRIO_COLORS[thought.priority as keyof typeof PRIO_COLORS]}, 0 0 8px rgba(0,0,0,0.5)`
                }}
              />
            )}
            <p className={cn(
              "text-[13px] font-bold leading-tight break-all", 
              thought.text ? "text-[var(--text-primary)]" : "text-slate-600 italic"
            )}>
              {thought.text || thought.placeholder || "Untitled"}
            </p>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
            {thought.status !== 'none' && (
              <div 
                className="text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full border border-white/10 shadow-sm"
                style={{ 
                  color: 'white',
                  backgroundColor: STATUS_COLORS[thought.status as keyof typeof STATUS_COLORS],
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
        
        {stack && (
          <div className="flex items-center gap-2 mt-1">
            <div 
              className="px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider border border-white/10"
              style={{ 
                backgroundColor: stack.color ? stack.color.replace('1)', '0.15)') : 'rgba(255,255,255,0.1)', 
                color: stack.color || '#fff',
                borderColor: stack.color ? stack.color.replace('1)', '0.3)') : 'rgba(255,255,255,0.2)'
              }}
            >
              {stack.name || "Unnamed Stack"}
            </div>
          </div>
        )}

        {/* Bottom Right Action Button (Link or Unlink) */}
        <button 
          onClick={handleLinkAction}
          className={cn(
            "absolute bottom-4 right-4 p-2 rounded-xl transition-all z-10",
            linkingSourceId === thought.id 
              ? "bg-[var(--accent)] text-white shadow-[0_0_20px_var(--accent-glow)]" 
              : "bg-white/5 text-slate-500 hover:text-white hover:bg-white/10 border border-white/5",
            thought.stackId && "hover:text-red-400 hover:bg-red-500/10"
          )}
          title={thought.stackId ? "Remove from stack" : "Link to another thought"}
        >
          {thought.stackId ? (
            <Link2Off className="w-4 h-4" />
          ) : (
            <LinkIcon className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
});

export default ThoughtNode;