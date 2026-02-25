import React, { useRef, useEffect, useState, useMemo } from 'react';
import { type Thought } from '../db';
import { useStore } from '../store/useStore';
import { marked } from 'marked';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Modular Components
import { ThoughtHeader } from './thought/ThoughtHeader';
import { ThoughtFooter } from './thought/ThoughtFooter';
import { TextRenderer } from './thought/TextRenderer';
import { TasksRenderer } from './thought/TasksRenderer';
import { PaintRenderer } from './thought/PaintRenderer';
import { TableRenderer } from './thought/TableRenderer';
import { ImageRenderer } from './thought/ImageRenderer';
import { EmbedRenderer } from './thought/EmbedRenderer';
import { FileRenderer } from './thought/FileRenderer';
import { LabelRenderer } from './thought/LabelRenderer';
import { Loader2, Trash2 } from 'lucide-react';


function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ThoughtNodeProps {
  thought: Thought;
  registerElement: (id: number, el: HTMLDivElement | null) => void;
  onMouseDown: (id: number, e: React.MouseEvent) => void;
  onTouchStart: (id: number, e: React.TouchEvent) => void;
  isDragging: boolean;
}

const ThoughtNode: React.FC<ThoughtNodeProps> = React.memo(({ thought, registerElement, onMouseDown, onTouchStart, isDragging }) => {
  const elRef = useRef<HTMLDivElement>(null);
  const selectedThoughtId = useStore((state) => state.selectedThoughtId);
  const selectedThoughtIds = useStore((state) => state.selectedThoughtIds);
  const isSelected = selectedThoughtId === thought.id || selectedThoughtIds.includes(thought.id);
  const isInspectorOpen = useStore((state) => state.isInspectorOpen);
  const layerActionTrigger = useStore((state) => state.layerActionTrigger);
  const isReadOnly = useStore((state) => state.isReadOnly);
  const isDemo = useStore((state) => state.isDemo);
  const performanceMode = useStore((state) => state.performanceMode);


  const setSelectedThoughtId = useStore((state) => state.setSelectedThoughtId);
  const setInspectorOpen = useStore((state) => state.setInspectorOpen);
  const setActiveFocus = useStore((state) => state.setActiveFocus);
  const linkingSourceId = useStore((state) => state.linkingSourceId);

  const setLinkingSourceId = useStore((state) => state.setLinkingSourceId);
  const stacks = useStore((state) => state.stacks);
  const spaces = useStore((state) => state.spaces);
  const activeSpaceId = useStore((state) => state.activeSpaceId);
  const setHoveredCalDate = useStore((state) => state.setHoveredCalDate);
  const hoveredCalDate = useStore((state) => state.hoveredCalDate);
  const deletingThoughtIds = useStore((state) => state.deletingThoughtIds);
  const isDeleting = deletingThoughtIds.includes(thought.id);

  const activeSpace = useMemo(() => spaces.find(s => s.id === activeSpaceId), [spaces, activeSpaceId]);

  const isSpatial = activeSpace?.mode === 'spatial';
  const isCalendar = activeSpace?.mode === 'calendar';
  const isDateHovered = isCalendar && thought.date === hoveredCalDate;
  const isExpanded = isDateHovered || (isCalendar && isSelected);

  const stack = useMemo(() => stacks.find(s => s.id === thought.stackId), [stacks, thought.stackId]);

  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [showPing, setShowPing] = useState(false);

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
    if (!thought.layer) return {};
    if (performanceMode) {
      return {
        boxShadow: isSelected ? `0 0 20px var(--accent-glow)` : `0 4px 12px rgba(0,0,0,0.4)`,
        transform: 'scale(1)',
      };
    }
    const shadowSize = isDragging ? 60 : Math.min(50, (thought.layer % 100) + 10);
    const altitudeScale = 1 + (Math.min(10, (thought.layer % 10)) / 200);
    return {
      boxShadow: `0 ${shadowSize / 2}px ${shadowSize}px rgba(0,0,0,0.6)`,
      transform: `scale(${altitudeScale})`,
    };
  }, [thought.layer, isDragging, performanceMode, isSelected]);

  const parsedContent = useMemo(() => {
    return thought.content ? marked.parse(thought.content) : '';
  }, [thought.content]);

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

  const handleLinkAction = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (thought.stackId) {
      const store = useStore.getState();
      store.setSelectedThoughtIds([thought.id]);
      store.unlinkSelectedThoughts();
      store.setSelectedThoughtIds([]);
    } else {
      if (linkingSourceId === thought.id) setLinkingSourceId(null);
      else setLinkingSourceId(thought.id);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    const dist = Math.sqrt(Math.pow(e.clientX - startPos.x, 2) + Math.pow(e.clientY - startPos.y, 2));
    if (dist > 10) return;
    if (e.ctrlKey || e.metaKey) { e.stopPropagation(); return; }

    // On mobile, selection happens on touchend (usePhysics).
    // This click fires after. To avoid opening both inspector and focus editor,
    // we require the thought to be already selected to open the focus editor on mobile.
    if (!isSelected && (window.innerWidth < 1024)) return;

    if (linkingSourceId && linkingSourceId !== thought.id) {
      const store = useStore.getState();
      store.setSelectedThoughtIds([linkingSourceId, thought.id]);
      store.linkSelectedThoughts();
      store.setSelectedThoughtId(thought.id);
      setLinkingSourceId(null);
      return;
    }
    if (linkingSourceId === thought.id) return;
    const target = e.target as HTMLElement;
    if (target.closest('.checkbox')) return;

    const triggers = ['label', 'text', 'table', 'tasks', 'image', 'paint', 'embed', 'file'];
    for (const t of triggers) {
      if (target.closest(`[data-trigger="${t}"]`)) {
        if (t === 'label') return; // Labels don't have focus mode
        setActiveFocus(thought.id, t as any);
        return;
      }
    }
  };

  const renderContent = () => {
    const commonProps = { thought, isReadOnly, setActiveFocus };
    switch (thought.type) {
      case 'label': return <LabelRenderer thought={thought} />;
      case 'text': return <TextRenderer {...commonProps} isCalendar={isCalendar} isSpatial={isSpatial} parsedContent={parsedContent} />;
      case 'tasks': return <TasksRenderer {...commonProps} />;
      case 'paint': return <PaintRenderer {...commonProps} />;
      case 'table': return <TableRenderer {...commonProps} />;
      case 'image': return <ImageRenderer {...commonProps} setSelectedThoughtId={setSelectedThoughtId} setInspectorOpen={setInspectorOpen} />;
      case 'embed': return <EmbedRenderer thought={thought} />;
      case 'file': return <FileRenderer thought={thought} />;
      default: return null;
    }
  };

  return (
    <div
      ref={elRef}
      data-id={thought.id}
      data-unscheduled={!thought.date ? "true" : "false"}
      className={cn(
        "thought-bulb absolute select-none touch-none will-change-transform w-[280px] pointer-events-auto",
        isDragging ? "z-[1000] cursor-grabbing" : "z-20 cursor-grab",
        ((isReadOnly && !isSpatial && !isDemo) || isDeleting) && "cursor-default pointer-events-none"
      )}


      onMouseDown={handleLocalMouseDown}
      onTouchStart={handleLocalTouchStart}
      onDragStart={(e) => e.preventDefault()}
      onClick={handleClick}
      onMouseEnter={() => {
        if (isCalendar && thought.date) {
          if ((window as any)._calLeaveTimer) clearTimeout((window as any)._calLeaveTimer);
          setHoveredCalDate(thought.date);
        }
      }}
      onMouseLeave={() => {
        if (isCalendar && thought.date) {
          if ((window as any)._calLeaveTimer) clearTimeout((window as any)._calLeaveTimer);
          (window as any)._calLeaveTimer = setTimeout(() => setHoveredCalDate(null), 150);
        }
      }}
    >
      {showPing && <div className="absolute inset-0 rounded-[32px] border-2 border-[var(--accent)] animate-sonar pointer-events-none z-0" />}
      
      {/* DELETING OVERLAY */}
      {isDeleting && (
        <div className="absolute inset-0 z-[50] rounded-3xl bg-black/60 backdrop-blur-sm border border-red-500/30 flex flex-col items-center justify-center gap-3 animate-in fade-in duration-300">
          <div className="relative">
            <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
            <Trash2 className="w-4 h-4 text-red-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <span className="text-[8px] font-black uppercase tracking-[0.2em] text-red-400">Purging Data</span>
        </div>
      )}

      <div
        className={cn(
          "thought-bulb-content group backdrop-blur-[20px] border rounded-3xl flex flex-col relative transition-all duration-300",

          isCalendar && !isExpanded ? "p-3 gap-0" : "p-4.5 gap-2",
          isSelected
            ? "border-[var(--accent)]/50 shadow-[0_0_40px_var(--accent-glow)] bg-[var(--node-bg)]/80"
            : "border-[var(--glass-border)] shadow-[0_10px_40px_rgba(0,0,0,0.5)] bg-[var(--node-bg)]/60",
          linkingSourceId === thought.id && "ring-2 ring-[var(--accent)] ring-offset-4 ring-offset-[var(--bg-page)]",
          linkingSourceId && linkingSourceId !== thought.id && "hover:scale-105 hover:border-[var(--accent)]/50 cursor-pointer",
          isSelected && isInspectorOpen && "animate-breathe"
        )}
        style={altitudeStyles}
      >
        <ThoughtHeader thought={thought} isCalendar={isCalendar} isExpanded={isExpanded} />
        <div
          data-trigger={thought.type === 'text' ? 'text' : undefined}
          className={cn(
            "flex flex-col relative transition-all duration-300",
            thought.type === 'text' && "cursor-pointer rounded-xl overflow-hidden",
            (isCalendar && !isExpanded) ? "h-0 opacity-0 pointer-events-none"
              : (thought.type === 'text' && (thought.content || thought.description || !thought.stackId)) 
                ? "min-h-0 justify-center gap-2 mt-0.5 pointer-events-auto" : "min-h-0 gap-0 pointer-events-auto"
          )}
        >
          {thought.description && thought.description !== 'No description available.' && thought.description !== thought.text && (
            <p className="text-[10px] text-[var(--text-dimmed)] italic pr-10 line-clamp-2">{thought.description}</p>
          )}
          {renderContent()}
        </div>
        <ThoughtFooter 
          thought={thought} 
          stack={stack} 
          isReadOnly={isReadOnly} 
          isSpatial={isSpatial}
          linkingSourceId={linkingSourceId} 
          handleLinkAction={handleLinkAction} 
        />
      </div>
    </div>
  );
});

export default ThoughtNode;