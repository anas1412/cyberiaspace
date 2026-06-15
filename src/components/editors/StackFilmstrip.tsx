import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown, ChevronUp, FileIcon, FileAudio,
  Palette, Edit2, Check,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { type Thought } from '../../db';
import { STACK_COLORS } from '../../constants';
import { PROVIDER_CONFIG } from '../thought/constants';
import { getEmbedInfo } from '../../utils/embeds';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ──────────────────────────────────────────────
// Color Picker
// ──────────────────────────────────────────────

const StackColorPicker: React.FC<{ value: string; onChange: (val: string) => void; disabled?: boolean }> = ({ value, onChange, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={(e) => { e.stopPropagation(); if (!disabled) setIsOpen(!isOpen); }}
        className={cn(
          "w-3 h-3 rounded-full border border-white/20 transition-all flex items-center justify-center group relative overflow-hidden",
          disabled && "opacity-50 cursor-default"
        )}
        style={{ backgroundColor: value, boxShadow: `0 0 10px ${value}88` }}
      >
        <div className="absolute inset-0 bg-[var(--glass-bg)] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Palette className="w-1.5 h-1.5 text-[var(--text-primary)]" />
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-full mb-3 left-0 z-[var(--z-popover)] glass border border-white/10 rounded-2xl p-3 shadow-2xl min-w-[180px]"
          >
            <div className="grid grid-cols-4 gap-2 mb-3">
              {STACK_COLORS.map((color: string) => (
                <button
                  key={color}
                  onClick={() => { onChange(color); setIsOpen(false); }}
                  className={cn(
                    "w-8 h-8 rounded-xl border transition-all",
                    value === color
                      ? "border-white/80 scale-110 shadow-lg"
                      : "border-white/10 hover:scale-110"
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

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
            <StackColorPicker
              value={stack?.color || '#6366f1'}
              disabled={isReadOnly}
              onChange={(color) => useStore.getState().updateStack(stack!.id, { color })}
            />
            <div className="flex items-center gap-2 group/stackname">
              {isRenamingStack ? (
                <div className="flex items-center gap-1 bg-[var(--glass-bg)] rounded-lg px-2 py-1 border border-[var(--glass-border)]">
                  <input
                    ref={renameInputRef}
                    autoFocus
                    className="bg-transparent text-[10px] font-semibold tracking-[0.4em] text-[var(--text-secondary)] border-none outline-none w-24 pt-[1px]"
                    value={tempStackName}
                    onChange={(e) => setTempStackName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleStackRename();
                      if (e.key === 'Escape') {
                        setIsRenamingStack(false);
                        setTempStackName(stack?.name || '');
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <button
                    onClick={(e) => { e.stopPropagation(); handleStackRename(); }}
                    className="p-0.5 hover:bg-[var(--glass-bg)] rounded transition-colors"
                  >
                    <Check className="w-2 h-2 text-emerald-500" />
                  </button>
                </div>
              ) : (
                <>
                  <span
                    className="text-[10px] font-semibold tracking-[0.4em] text-[var(--text-secondary)] transition-colors pt-[1px]"
                    onDoubleClick={() => { if (!isReadOnly) { setTempStackName(stack?.name || ''); setIsRenamingStack(true); } }}
                  >
                    {stack?.name || 'Collection'}
                  </span>
                  {!isReadOnly && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setTempStackName(stack?.name || ''); setIsRenamingStack(true); }}
                      className="p-1 opacity-0 group-hover/stackname:opacity-100 hover:bg-[var(--glass-bg)] rounded transition-all"
                    >
                      <Edit2 className="w-2 h-2 text-[var(--text-muted)] hover:text-[var(--text-primary)]" />
                    </button>
                  )}
                </>
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
