import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useThoughtPayload } from './thought/hooks/useThoughtPayload';
import { type Thought } from '../db';
import { useStore } from '../store/useStore';
import { marked } from 'marked';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Modular Components
import { ThoughtHeader } from './thought/ThoughtHeader';
import { ThoughtFooter } from './thought/ThoughtFooter';
import { getThoughtConfig, type ThoughtRendererProps } from './thought/registry';
import { sanitizeDate } from '../utils/date';

import { Loader2, Trash2 } from 'lucide-react';


function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ThoughtNodeProps {
  thought: Thought;
  registerElement: (id: string, el: HTMLDivElement | null) => void;
  onMouseDown: (id: string, e: React.MouseEvent) => void;
  onTouchStart: (id: string, e: React.TouchEvent) => void;
  isDragging: boolean;
  isArchived?: boolean;
  isOverDeleteZone?: boolean;
}

const ThoughtNode: React.FC<ThoughtNodeProps> = React.memo(({ thought, registerElement, onMouseDown, onTouchStart, isDragging, isArchived = false, isOverDeleteZone = false }) => {
  const elRef = useRef<HTMLDivElement>(null);
  const isSelected = useStore((state) => state.selectedThoughtId === thought.id || state.selectedThoughtIds.includes(thought.id));
  const isInspectorOpen = useStore((state) => (state.selectedThoughtId === thought.id || state.selectedThoughtIds.includes(thought.id)) && state.isInspectorOpen);
  const layerActionTrigger = useStore((state) => state.layerActionTrigger?.id === thought.id ? state.layerActionTrigger : null);
  const isReadOnly = useStore((state) => state.isReadOnly);
  const isDemo = useStore((state) => state.isDemo);


  const setSelectedThoughtId = useStore((state) => state.setSelectedThoughtId);
  const setInspectorOpen = useStore((state) => state.setInspectorOpen);
  const setActiveFocus = useStore((state) => state.setActiveFocus);
  const linkingSourceId = useStore((state) => state.linkingSourceId);

  const setLinkingSourceId = useStore((state) => state.setLinkingSourceId);
  
  const activeSpace = useStore((state) => state.spaces.find(s => s.id === state.activeSpaceId));

  const setHoveredCalDate = useStore((state) => state.setHoveredCalDate);
  const hoveredCalDate = useStore((state) => state.hoveredCalDate);
  const isDeleting = useStore((state) => state.deletingThoughtIds.includes(thought.id));

  const isSpatial = activeSpace?.mode === 'spatial';
  const isCalendar = activeSpace?.mode === 'calendar';
  const isDateHovered = isCalendar && hoveredCalDate !== null && sanitizeDate(thought.startTime) === hoveredCalDate;
  const isExpanded = (isCalendar && !thought.startTime) || isDateHovered || (isCalendar && isSelected);

  const { content } = useThoughtPayload(thought);

  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [showPing, setShowPing] = useState(false);

  // Get renderer from registry
  const thoughtConfig = useMemo(() => getThoughtConfig(thought.type), [thought.type]);
  const Renderer = thoughtConfig?.renderer;

  useEffect(() => {
    if (layerActionTrigger?.id === thought.id) {
      const timer = setTimeout(() => setShowPing(true), 0);
      const hideTimer = setTimeout(() => setShowPing(false), 800);
      return () => {
        clearTimeout(timer);
        clearTimeout(hideTimer);
      };
    }
  }, [layerActionTrigger?.id, layerActionTrigger?.time, thought.id]);


  const altitudeStyles = useMemo(() => {
    const shadowSize = isDragging ? 60 : Math.min(50, ((thought.layer || 0) % 100) + 10);
    const altitudeScale = 1 + (Math.min(10, ((thought.layer || 0) % 10)) / 200);
    
    if (isSelected) {
      return {
        boxShadow: `0 0 12px rgba(99,102,241,0.5), 0 4px 20px var(--selection-shadow)`,
        transform: `scale(${altitudeScale})`,
      };
    }
    
    if (!thought.layer) return { transform: `scale(${altitudeScale})` };
    
    return {
      boxShadow: `0 ${shadowSize / 2}px ${shadowSize}px rgba(0,0,0,0.6)`,
      transform: `scale(${altitudeScale})`,
    };
  }, [thought.layer, isDragging, isSelected]);

  const parsedContent = useMemo(() => {
    return content ? marked.parse(content) : '';
  }, [content]);

  useEffect(() => {
    registerElement(thought.id, elRef.current);
    return () => registerElement(thought.id, null);
  }, [thought.id, registerElement]);

  const handleLocalMouseDown = (e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) e.stopPropagation();
    setStartPos({ x: e.clientX, y: e.clientY });
    onMouseDown(thought.id, e);
  };

  const handleLocalTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setStartPos({ x: touch.clientX, y: touch.clientY });
    onTouchStart(thought.id, e);
  };

  const handleLinkAction = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const store = useStore.getState();
    
    // CASE 1: Someone ELSE is already the source -> Link them to this node (Join Stack)
  if (linkingSourceId && linkingSourceId !== thought.id) {
      const idsToLink = [linkingSourceId, thought.id];
      setLinkingSourceId(null); // Clear line immediately for zero-lag feel
      // Fire linking operation with explicit IDs so we don't need to change selection
      await store.linkSelectedThoughts(undefined, idsToLink);
      return;
    }

    // CASE 2: No session active OR I am the current source
    // If I have a stackId, any click on the button UNLINKS me.
    if (thought.stackId) {
      const prevSelectedIds = store.selectedThoughtIds;
      store.setSelectedThoughtIds([thought.id]); // Target this specific thought
      setLinkingSourceId(null); // Clear immediately
      await store.unlinkSelectedThoughts();
      
      // Restore previous selection if it wasn't the unlinked thought
      if (!prevSelectedIds.includes(thought.id)) {
        store.setSelectedThoughtIds(prevSelectedIds);
      }
    } else {
      // If no stackId, toggle linking mode
      if (linkingSourceId === thought.id) {
        setLinkingSourceId(null);
      } else {
        setLinkingSourceId(thought.id);
        // Ensure the source is selected when we start linking from it
        if (!isSelected) {
          store.setSelectedThoughtId(thought.id);
        }
      }
    }
  };

  const handleClick = async (e: React.MouseEvent) => {
    const dist = Math.sqrt(Math.pow(e.clientX - startPos.x, 2) + Math.pow(e.clientY - startPos.y, 2));
    if (dist > 10) return;
    if (e.ctrlKey || e.metaKey) { e.stopPropagation(); return; }

    if (!isSelected && (window.innerWidth < 1024)) return;

    if (linkingSourceId && linkingSourceId !== thought.id) {
      e.stopPropagation();
      const store = useStore.getState();
      const idsToLink = [linkingSourceId, thought.id];
      // Clear linking state immediately
      setLinkingSourceId(null);
      // Trigger linking with explicit IDs to avoid changing selection
      await store.linkSelectedThoughts(undefined, idsToLink);
      return;
    }
    
    if (linkingSourceId === thought.id) {
      e.stopPropagation();
      setLinkingSourceId(null);
      return;
    }
    const target = e.target as HTMLElement;
    if (target.closest('.checkbox')) return;

    const triggers = ['label', 'text', 'table', 'tasks', 'paint', 'embed', 'file'];
    for (const t of triggers) {
      if (target.closest(`[data-trigger="${t}"]`)) {
        if (t === 'label') return; 
        setActiveFocus(thought.id, t as any);
        return;
      }
    }
  };


  const renderContent = () => {
    if (!Renderer) return null;
    
    const rendererProps: ThoughtRendererProps = {
      thought,
      isReadOnly,
      isCalendar,
      isSpatial,
      isArchived,
      parsedContent,
      setActiveFocus,
      setSelectedThoughtId,
      setInspectorOpen
    };
    
    return <Renderer {...rendererProps} />;
  };

  // No-op handlers for archived thoughts
  const noopHandler = () => {};
  const noopMouseHandler = (e: React.MouseEvent) => { e.stopPropagation(); };
  const noopTouchHandler = (e: React.TouchEvent) => { e.stopPropagation(); };

  return (
    <div
      ref={elRef}
      data-id={thought.id}
      data-unscheduled={!thought.startTime ? "true" : "false"}
      className={cn(
        "thought-bulb absolute select-none touch-none will-change-transform origin-top-left",
        isArchived ? "pointer-events-none" : "pointer-events-auto",
        "w-[280px]",
        isDragging ? "z-[1000] cursor-grabbing" : "z-20 cursor-grab",
        ((isReadOnly && !isSpatial && !isDemo) || isDeleting) && "cursor-default pointer-events-none",
        isDragging && isOverDeleteZone && "outline outline-2 outline-red-500/80 outline-offset-2"
      )}
      onMouseDown={isArchived ? noopMouseHandler : handleLocalMouseDown}
      onTouchStart={isArchived ? noopTouchHandler : handleLocalTouchStart}
      onDragStart={(e) => e.preventDefault()}
      onClick={isArchived ? noopMouseHandler : handleClick}
      onMouseEnter={isArchived ? noopHandler : (() => {
        if (isCalendar) {
          if ((window as any)._calLeaveTimer) clearTimeout((window as any)._calLeaveTimer);
          setHoveredCalDate(sanitizeDate(thought.startTime));
        }
      })}
      onMouseLeave={isArchived ? noopHandler : (() => {
        if (isCalendar) {
          if ((window as any)._calLeaveTimer) clearTimeout((window as any)._calLeaveTimer);
          (window as any)._calLeaveTimer = setTimeout(() => setHoveredCalDate(null), 150);
        }
      })}
    >
      {showPing && <div className="absolute inset-0 rounded-2xl border-2 border-[var(--accent)] animate-sonar pointer-events-none z-0" />}
      
          {isDeleting && (
        <div className="absolute inset-0 z-[50] rounded-2xl bg-[var(--bg-page)]/60 backdrop-blur-sm border border-red-500/30 flex flex-col items-center justify-center gap-3 animate-in fade-in duration-300">
          <div className="relative">
            <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
            <Trash2 className="w-4 h-4 text-red-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <span className="text-[8px] font-semibold tracking-[0.2em] text-red-400">Purging...</span>
        </div>
      )}

      <div
        className={cn(
          "thought-bulb-content group backdrop-blur-[20px] border rounded-2xl flex flex-col relative transition-[border-color,background-color,transform,padding,gap,opacity] duration-300 overflow-hidden",
          isArchived && "pointer-events-none",
          isCalendar && !isExpanded ? "p-3 gap-0" : "p-4.5 gap-2",
          isSpatial && !isSelected && "gap-0",
          isSelected
            ? "border-2 border-[var(--accent)] bg-[var(--node-bg)]/95"
            : "border-[var(--glass-border)] shadow-[0_10px_40px_rgba(0,0,0,0.5)] bg-[var(--node-bg)]/60",
          linkingSourceId === thought.id && "ring-2 ring-[var(--accent)] shadow-[0_0_20px_var(--accent-glow)]",
          linkingSourceId && linkingSourceId !== thought.id && "hover:scale-105 hover:border-[var(--accent)]/50 cursor-pointer",
          isSelected && isInspectorOpen && "animate-breathe"
        )}
        style={{
          ...altitudeStyles,
          '--text-primary': 'var(--node-text-primary)',
          '--text-secondary': 'var(--node-text-secondary)',
          '--text-dimmed': 'var(--node-text-dimmed)',
          '--text-muted': 'var(--node-text-muted)',
        } as unknown as React.CSSProperties}
      >
        <ThoughtHeader thought={thought} isCalendar={isCalendar} isExpanded={isExpanded} isArchived={isArchived} />
        <div
          data-trigger={thought.type === 'text' ? 'text' : undefined}
          className={cn(
            "flex flex-col relative transition-all duration-300",
            (isCalendar && !isExpanded) ? "h-0 opacity-0 pointer-events-none" : "opacity-100",
            isArchived && "pointer-events-none",
            thought.type === 'text' && !isArchived && "cursor-pointer rounded-xl overflow-hidden",
            (thought.type === 'text' && (content || thought.description || !thought.stackId)) 
                ? "min-h-0 justify-center gap-2 mt-0.5" : "min-h-0 gap-0"
          )}
        >
          {thought.description && thought.description !== 'No description available.' && thought.description !== thought.text && (
            <p className="text-[10px] text-[var(--text-dimmed)] italic pr-10 line-clamp-2">{thought.description}</p>
          )}
          {renderContent()}
        </div>
        {isSpatial && (
          <ThoughtFooter 
            thought={thought} 
            isReadOnly={isReadOnly} 
            isSpatial={isSpatial}
            isSelected={isSelected}
            linkingSourceId={linkingSourceId} 
            handleLinkAction={isArchived ? noopMouseHandler : handleLinkAction}
            isArchived={isArchived}
          />
        )}
      </div>
    </div>
  );
});

export default ThoughtNode;
