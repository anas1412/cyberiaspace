import React, { useRef, useState, useEffect } from 'react';
import {
  ChevronDown, ChevronUp, FileIcon, FileAudio,
  Edit2,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { type Thought } from '../../db';
import { PROVIDER_CONFIG } from '../thought/constants';
import { getEmbedInfo } from '../../utils/embeds';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ──────────────────────────────────────────────
// StackItemThumbnail
// ──────────────────────────────────────────────

const StackItemThumbnail: React.FC<{
  item: Thought;
  isActive: boolean;
  onClick: (type: string) => void;
  color?: string;
}> = ({ item, isActive, onClick, color }) => {
  const accentColor = color || '#6366f1';

  // File-type thumbnail
  const fileUrl = item.data?.type === 'file' ? item.data.url : undefined;
  const fileName = (item.text || '').toLowerCase();
  const mimeType = ((item.data as any)?.meta?.type || '').toLowerCase();
  const extension = fileName.split('.').pop() || '';
  const isPdf = mimeType.includes('pdf') || extension === 'pdf';
  const isAudio = mimeType.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(extension);

  // Embed-type thumbnail
  const embedUrl = item.data?.type === 'embed' ? item.data.url : (item as any).content || '';
  const embedInfo = getEmbedInfo(embedUrl);
  const embedConfig = PROVIDER_CONFIG[embedInfo.provider] || PROVIDER_CONFIG.unknown;
  const embedThumb = (item as any).meta?.thumbnail_url
    || (embedInfo.provider === 'youtube' && embedInfo.id
      ? `https://img.youtube.com/vi/${embedInfo.id}/mqdefault.jpg`
      : null);

  // Determine thumbnail source
  const thumb = fileUrl || embedThumb;

  // Video detection (for icon fallback)
  const isVideo = mimeType.startsWith('video/') || ['mp4', 'webm', 'mov', 'm4v'].includes(extension);

  const Icon = embedConfig.icon;

  return (
    <button
      onClick={() => onClick(item.type)}
      data-active={isActive}
      className={cn(
        "flex-shrink-0 w-28 md:w-36 aspect-video rounded-xl overflow-hidden border transition-all duration-500 group/item snap-start relative bg-white/[0.03]",
        isActive
          ? "z-10"
          : "border-white/5 hover:border-white/20 opacity-40 grayscale hover:opacity-100 hover:grayscale-0"
      )}
      style={isActive ? {
        borderColor: accentColor,
        boxShadow: `0 0 30px ${accentColor}66`,
      } : {}}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        {thumb && !isPdf && !isAudio ? (
          <img
            src={thumb}
            alt={item.text}
            className={cn(
              "w-full h-full object-cover transition-all duration-500",
              isActive ? "opacity-100" : "opacity-60 group-hover/item:opacity-100"
            )}
          />
        ) : (
          <div className="flex flex-col items-center gap-1 opacity-20 group-hover/item:opacity-60 transition-opacity">
            {isPdf ? (
              <FileIcon className="w-6 h-6 text-red-400" />
            ) : isAudio ? (
              <FileAudio className="w-6 h-6 text-blue-400" />
            ) : isVideo ? (
              <div className="w-8 h-8 rounded-full bg-black/30 border border-white/10 flex items-center justify-center">
                <div className="w-0 h-0 border-t-[6px] border-b-[6px] border-l-[10px] border-t-transparent border-b-transparent border-l-white/70 ml-0.5" />
              </div>
            ) : (
              <Icon className="w-6 h-6 text-[var(--text-muted)]" />
            )}
          </div>
        )}
      </div>

      {isActive && (
        <div
          className="absolute inset-0 border-2 pointer-events-none rounded-xl"
          style={{ borderColor: accentColor }}
        />
      )}

      {/* Gradient overlay with label */}
      <div className={cn(
        "absolute inset-0 bg-gradient-to-t from-[var(--bg-page)]/90 via-[var(--bg-page)]/20 to-transparent transition-opacity flex items-end p-2 text-left",
        isActive ? "opacity-100" : "opacity-0 group-hover/item:opacity-100"
      )}>
        <p className="text-[7px] md:text-[8px] font-semibold tracking-widest text-[var(--text-primary)] truncate w-full">
          {item.text || "Untitled"}
        </p>
      </div>

      {isActive && (
        <div
          className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full animate-pulse z-20"
          style={{ backgroundColor: accentColor, boxShadow: `0 0 10px ${accentColor}` }}
        />
      )}
    </button>
  );
};

// ──────────────────────────────────────────────
// StackFilmstrip
// ──────────────────────────────────────────────

interface StackFilmstripProps {
  thought: Thought;
  stackItems: Thought[];
  currentIndex: number;
}

const COLLAPSE_DURATION = 350;

const StackFilmstrip: React.FC<StackFilmstripProps> = ({ thought, stackItems, currentIndex }) => {
  const [expanded, setExpanded] = useState(false);
  const [isRenamingStack, setIsRenamingStack] = useState(false);
  const [tempStackName, setTempStackName] = useState('');
  const [contentHeight, setContentHeight] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const stacks = useStore((state) => state.stacks);
  const setActiveFocus = useStore((state) => state.setActiveFocus);
  const isReadOnly = useStore((state) => state.isReadOnly);

  const stack = stacks.find((s) => s.id === thought.stackId);

  // Re-measure content when it changes (only while expanded)
  useEffect(() => {
    if (expanded && contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [expanded, stackItems.length, thought.id]);

  // Focus rename input when it appears
  useEffect(() => {
    if (isRenamingStack && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenamingStack]);

  const handleStackRename = async () => {
    if (!stack || isReadOnly) return;
    const finalName = tempStackName.trim();
    if (finalName && finalName !== stack.name) {
      await useStore.getState().updateStack(stack.id, { name: finalName });
    }
    setIsRenamingStack(false);
  };

  const handleClose = () => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
    requestAnimationFrame(() => setExpanded(false));
  };

  const handleOpen = () => {
    setExpanded(true);
  };

  // Scroll active item into view when filmstrip opens
  useEffect(() => {
    if (expanded && scrollerRef.current) {
      const activeEl = scrollerRef.current.querySelector('[data-active="true"]');
      if (activeEl) {
        setTimeout(() => {
          activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }, 100);
      }
    }
  }, [expanded, thought.id]);

  // Horizontal scroll via wheel
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || !expanded) return;
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY === 0) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [expanded, stackItems.length]);

  if (stackItems.length === 0) return null;

  return (
    <div className="border-t border-[var(--glass-border)] relative bg-[var(--glass-bg)]/80 backdrop-blur-xl">
      {/* ── Content: always rendered, only maxHeight transitions ── */}
      <div
        ref={contentRef}
        className="overflow-hidden transition-[max-height] ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{
          maxHeight: expanded ? `${contentHeight}px` : '0',
          transitionDuration: expanded ? '300ms' : `${COLLAPSE_DURATION}ms`,
        }}
      >
        {/* Header row */}
        <div className="flex items-center justify-between px-6 py-4 select-none">
          <div className="flex items-center gap-4">
            <div
              className="w-3 h-3 rounded-full border border-white/20"
              style={{
                backgroundColor: stack?.color || '#6366f1',
                boxShadow: `0 0 10px ${stack?.color || '#6366f1'}88`
              }}
            />
            <div className="flex items-center gap-2 group/stackname relative min-w-0 flex-1">
              <div className="relative flex items-center min-w-0">
                {/* Mirror span defines the width */}
                <span 
                  className={cn(
                    "invisible whitespace-pre text-[10px] font-bold uppercase tracking-[0.4em] select-none",
                    isRenamingStack ? "px-2" : ""
                  )}
                  aria-hidden="true"
                >
                  {isRenamingStack ? (tempStackName || ' ') : (stack?.name || 'Collection')}
                </span>
                
                <input
                  ref={renameInputRef}
                  readOnly={isReadOnly || !isRenamingStack}
                  className={cn(
                    "absolute inset-0 bg-transparent text-[10px] font-bold uppercase tracking-[0.4em] text-[var(--text-secondary)] border-none outline-none pt-[1px] transition-all",
                    isRenamingStack 
                      ? "opacity-100 bg-white/[0.03] px-2 py-1 rounded-lg border border-white/10" 
                      : "opacity-100 cursor-default pointer-events-none"
                  )}
                  value={isRenamingStack ? tempStackName : (stack?.name || 'Collection')}
                  onChange={(e) => setTempStackName(e.target.value)}
                  onBlur={handleStackRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleStackRename();
                    if (e.key === 'Escape') {
                      setIsRenamingStack(false);
                      setTempStackName(stack?.name || '');
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              {!isRenamingStack && !isReadOnly && (
                <button
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    setTempStackName(stack?.name || 'Collection'); 
                    setIsRenamingStack(true); 
                  }}
                  className="p-1 opacity-0 group-hover/stackname:opacity-100 hover:bg-[var(--glass-bg)] rounded transition-all flex-shrink-0"
                >
                  <Edit2 className="w-2.5 h-2.5 text-[var(--text-muted)]" />
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em]">
              {currentIndex + 1} / {stackItems.length}
            </span>
            <button
              onClick={handleClose}
              className="flex items-center gap-1.5 p-1.5 hover:bg-[var(--glass-bg)] rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all"
            >
              <span className="text-[9px] font-semibold tracking-widest">Hide</span>
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable filmstrip */}
        <div
          ref={scrollerRef}
          className="flex gap-6 overflow-x-auto no-scrollbar pb-4 px-6 w-full snap-x snap-center scroll-smooth"
        >
          {stackItems.map((item) => (
            <StackItemThumbnail
              key={item.id}
              item={item}
              isActive={item.id === thought.id}
              color={stack?.color}
              onClick={(type) => setActiveFocus(item.id, type as any)}
            />
          ))}
        </div>
      </div>

      {/* ── Button: always in DOM, revealed as content shrinks ── */}
      <div
        className="transition-all ease-in overflow-hidden"
        style={{
          maxHeight: expanded ? '0' : '44px',
          opacity: expanded ? 0 : 1,
          pointerEvents: expanded ? 'none' : 'auto',
          transitionDuration: '220ms',
          transitionDelay: expanded ? '0ms' : '80ms',
        }}
      >
        <button
          onClick={handleOpen}
          className="w-full flex items-center justify-center gap-2 px-6 py-2.5 text-[9px] font-semibold tracking-widest text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all"
        >
          <ChevronUp className="w-3 h-3" />
          Show Collection
        </button>
      </div>
    </div>
  );
};

export { StackFilmstrip };
export default StackFilmstrip;
