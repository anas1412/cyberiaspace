import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../../store/useStore';
import { useThoughtPayload } from '../thought/hooks/useThoughtPayload';
import { Youtube, ExternalLink, Music, MessageCircle, Share2, Link as LinkIcon, ChevronDown, ChevronUp, Palette, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getEmbedInfo } from '../../utils/embeds';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { FocusEditorShell } from './FocusEditorShell';
import { STACK_COLORS } from '../../constants';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const ColorPicker: React.FC<{ value: string; onChange: (val: string) => void; disabled?: boolean }> = ({ value, onChange, disabled }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

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
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) setIsOpen(!isOpen);
        }}
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
            className="absolute bottom-full mb-3 left-0 z-[100] glass border border-white/10 rounded-2xl p-3 shadow-2xl min-w-[180px]"
          >
            <div className="grid grid-cols-4 gap-2 mb-3">
              {STACK_COLORS.map(color => (
                <button
                  key={color}
                  onClick={() => { onChange(color); setIsOpen(false); }}
                  className={cn(
                    "w-8 h-8 rounded-lg border-2 transition-all hover:scale-110",
                    value === color ? "border-white" : "border-transparent"
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <div className="relative pt-2 border-t border-white/5">
              <input 
                type="color" 
                value={value.startsWith('#') ? value : '#6366f1'} 
                onChange={(e) => onChange(e.target.value)}
                className="w-full h-8 bg-transparent cursor-pointer rounded-lg overflow-hidden"
              />
              <p className="text-[7px] font-semibold tracking-widest text-[var(--text-muted)] mt-1 text-center">Custom Hex</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const PROVIDER_CONFIG: Record<string, { icon: any, color: string, label: string, themeColor: string }> = {
  youtube: { icon: Youtube, color: 'text-red-500', themeColor: 'bg-red-500/10', label: 'YouTube' },
  spotify: { icon: Music, color: 'text-[#1db954]', themeColor: 'bg-[#1db954]/10', label: 'Spotify' },
  twitter: { icon: MessageCircle, color: 'text-[#1da1f2]', themeColor: 'bg-[#1da1f2]/10', label: 'Twitter' },
  x: { icon: MessageCircle, color: 'text-white', themeColor: 'bg-white/10', label: 'X' },
  reddit: { icon: MessageCircle, color: 'text-[#ff4500]', themeColor: 'bg-[#ff4500]/10', label: 'Reddit' },
  facebook: { icon: Share2, color: 'text-[#1877f2]', themeColor: 'bg-[#1877f2]/10', label: 'Facebook' },
  instagram: { icon: Share2, color: 'text-[#e1306c]', themeColor: 'bg-[#e1306c]/10', label: 'Instagram' },
  tiktok: { icon: Share2, color: 'text-[#ff0050]', themeColor: 'bg-[#ff0050]/10', label: 'TikTok' },
  unknown: { icon: LinkIcon, color: 'text-[var(--text-muted)]', themeColor: 'bg-white/10', label: 'Link' }
};

const StackItemThumbnail: React.FC<{ 
  item: any; 
  isActive: boolean;
  onClick: (type: any) => void;
  color?: string;
}> = ({ item, isActive, onClick, color }) => {
  const itemPayload = (item.data?.type === 'embed' ? item.data.url : (item as any).content) || '';
  const itemInfo = getEmbedInfo(itemPayload);
  const itemConfig = PROVIDER_CONFIG[itemInfo.provider] || PROVIDER_CONFIG.unknown;
  const ItemIcon = itemConfig.icon;
  const thumb = item.data?.url && itemInfo.provider === 'youtube' && itemInfo.id
    ? `https://img.youtube.com/vi/${itemInfo.id}/mqdefault.jpg`
    : (item.data?.url || undefined);

  const accentColor = color || '#6366f1';

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
        {thumb ? (
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
            <ItemIcon className="w-6 h-6 text-[var(--text-muted)]" />
          </div>
        )}
      </div>

      {/* Active Indicator Border */}
      {isActive && (
        <div 
          className="absolute inset-0 border-2 pointer-events-none rounded-xl"
          style={{ borderColor: accentColor }}
        />
      )}

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

const EditorContent: React.FC<{
  thought: any;
  renderPlayer: () => React.ReactNode;
  stackItems: any[];
  stack: any;
  setActiveFocus: (id: string | null, type: "text" | "tasks" | "paint" | "table" | "embed" | "file" | null) => void;
  scrollerRef: React.RefObject<HTMLDivElement | null>;
  isReadOnly: boolean;
}> = ({ thought, renderPlayer, stackItems, stack, setActiveFocus, scrollerRef, isReadOnly }) => {
  const [showPreviews, setShowPreviews] = useState(false);

  const currentIndex = stackItems.findIndex(i => i.id === thought.id);
  
  const handlePrevious = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (stackItems.length <= 1) return;
    const prevIndex = (currentIndex - 1 + stackItems.length) % stackItems.length;
    const prevItem = stackItems[prevIndex];
    setActiveFocus(prevItem.id, prevItem.type);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (stackItems.length <= 1) return;
    const nextIndex = (currentIndex + 1) % stackItems.length;
    const nextItem = stackItems[nextIndex];
    setActiveFocus(nextItem.id, nextItem.type);
  };
  
  return (
  <div className="flex-1 flex flex-col min-h-0 relative">
    <div className="flex-1 relative min-h-0 z-0 bg-[var(--bg-page)] shadow-inner group/content">
      {renderPlayer()}

      {/* Navigation Buttons */}
      {stackItems.length > 1 && (
        <>
          <div className="absolute inset-y-0 left-0 flex items-center px-4 md:px-8 pointer-events-none">
            <button
              onClick={handlePrevious}
              className="w-12 h-12 rounded-full glass flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:scale-110 transition-all pointer-events-auto opacity-0 group-hover/content:opacity-100 shadow-2xl translate-x-[-20px] group-hover/content:translate-x-0"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          </div>
          <div className="absolute inset-y-0 right-0 flex items-center px-4 md:px-8 pointer-events-none">
            <button
              onClick={handleNext}
              className="w-12 h-12 rounded-full glass flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:scale-110 transition-all pointer-events-auto opacity-0 group-hover/content:opacity-100 shadow-2xl translate-x-[20px] group-hover/content:translate-x-0"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>
        </>
      )}
    </div>
    <AnimatePresence mode="wait">
      {stackItems.length > 0 && showPreviews && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-50 w-auto max-w-[90%] pointer-events-auto">
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="glass backdrop-blur-[40px] border border-[var(--glass-border)] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-4 px-6"
          >
            <div 
              className="flex items-center justify-between mb-4 px-2 select-none"
            >
                <div className="flex items-center gap-4">
                  <div className="flex items-center">
                    <ColorPicker 
                      value={stack?.color || '#6366f1'} 
                      disabled={isReadOnly}
                      onChange={(color) => useStore.getState().updateStack(stack.id, { color })} 
                    />
                  </div>
                  <span className="text-[10px] font-semibold tracking-[0.4em] text-[var(--text-secondary)] pt-[1px]">
                    {stack?.name || 'Collection'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em]">
                    {stackItems.findIndex(i => i.id === thought.id) + 1} / {stackItems.length}
                  </span>
                  <button 
                    onClick={() => setShowPreviews(false)}
                    className="p-1.5 hover:bg-[var(--glass-bg)] rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div 
                className="flex gap-6 overflow-x-auto no-scrollbar pb-2 w-full snap-x snap-center px-2 scroll-smooth" 
                ref={scrollerRef}
              >
                {stackItems.map((item) => (
                  <StackItemThumbnail 
                    key={item.id} 
                    item={item} 
                    isActive={item.id === thought.id}
                    color={stack?.color}
                    onClick={(type) => setActiveFocus(item.id, type)} 
                  />
                ))}
              </div>
          </motion.div>
        </div>
      )}

      {!showPreviews && stackItems.length > 0 && (
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 15 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50"
        >
          <button 
            onClick={() => setShowPreviews(true)}
            className="glass p-2 px-6 rounded-full flex items-center gap-2 text-[9px] font-semibold tracking-widest text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all hover:scale-105"
          >
            <ChevronUp className="w-3 h-3" />
            Show Collection
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
  );
};

const EmbedFocusEditor: React.FC = () => {
  const activeFocusId = useStore((state) => state.activeFocusId);
  const focusType = useStore((state) => state.focusType);
  const setActiveFocus = useStore((state) => state.setActiveFocus);
  const thoughts = useStore((state) => state.thoughts);
  const stacks = useStore((state) => state.stacks);
  const updateThought = useStore((state) => state.updateThought);
  const isReadOnly = useStore((state) => state.isReadOnly);

  const thought = thoughts.find((t) => t.id === activeFocusId);
  const { content } = useThoughtPayload(thought);
  const stack = stacks.find((s) => s.id === thought?.stackId);
  const isVisible = focusType === 'embed' && !!thought;

  const embedInfo = useMemo(() => getEmbedInfo(content || ''), [content]);
  const config = PROVIDER_CONFIG[embedInfo.provider] || PROVIDER_CONFIG.unknown;
  const Icon = config.icon;

  const scrollerRef = useRef<HTMLDivElement>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  const stackItems = useMemo(() => {
    if (!thought?.stackId) return [];
    const sid = thought.stackId;
    return thoughts
      .filter(t => {
        if (t.stackId !== sid) return false;
        if (t.type === 'file') return true;
        if (t.type === 'embed') {
          const url = (t.data as any)?.url || (t as any).content || '';
          const info = getEmbedInfo(url);
          return info.provider === 'youtube';
        }
        return false;
      })
      .sort((a, b) => (Number(a.createdAt) || 0) - (Number(b.createdAt) || 0));
  }, [thoughts, thought?.stackId]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => { if (e.deltaY === 0) return; e.preventDefault(); el.scrollLeft += e.deltaY; };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [isVisible, stackItems.length]);

  useEffect(() => {
    // Scroll the active item into view
    if (scrollerRef.current) {
      const activeEl = scrollerRef.current.querySelector('[data-active="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [thought?.id, stackItems.length]);

  useEffect(() => {
    if (isVisible && thought?.meta?.html) {
      setIsHydrated(false);
      const trigger = () => {
        try {
          const lowerContent = (content || "").toLowerCase();
          if (lowerContent.includes('twitter.com') || lowerContent.includes('x.com')) (window as any).twttr?.widgets?.load();
          if (lowerContent.includes('instagram.com')) (window as any).instgrm?.Embeds?.process();
          if (lowerContent.includes('tiktok.com')) (window as any).tiktok?.widgets?.load();
        } catch (err) { console.warn("[Embed Focus] Hydration failed:", err); }
        setIsHydrated(true);
      };
      trigger();
      const t = setTimeout(trigger, 1500);
      return () => clearTimeout(t);
    }
  }, [isVisible, thought?.id, thought?.meta?.html, content]);

  const renderPlayer = () => {
    const { provider, id } = embedInfo;
    const isVideoPlatform = provider === 'youtube' || provider === 'tiktok';
    const hasHtml = !!thought?.meta?.html;

    if (thought?.meta?.video_url && (isVideoPlatform || !hasHtml)) {
      const proxyUrl = `/api/utils?action=proxy-video&url=${encodeURIComponent(thought.meta.video_url)}`;
      return (
        <div className="w-full h-full flex items-center justify-center bg-black">
          <video src={proxyUrl} controls autoPlay className="max-w-[90%] max-h-[85%] shadow-[0_0_100px_rgba(0,0,0,0.5)] rounded-2xl border border-white/5" />
        </div>
      );
    }

    if (provider === 'youtube' && id) {
      return (
        <div className="w-full h-full flex items-center justify-center p-4 md:p-12 bg-black">
          <div className="w-full max-w-5xl max-h-full aspect-video shadow-[0_0_100px_rgba(0,0,0,0.8)] rounded-3xl overflow-hidden border border-white/10 bg-black">
             <iframe 
               src={`https://www.youtube.com/embed/${id}?autoplay=1&theme=dark`} 
               title="YouTube" 
               frameBorder="0" 
               allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
               allowFullScreen 
               className="w-full h-full" 
             />
          </div>
        </div>
      );
    }

    if (provider === 'spotify' && id) {
      return (
        <div className="w-full h-full flex items-center justify-center p-4 md:p-12 bg-[#050505]">
          <div className="w-full max-w-[800px] h-[352px] shadow-[0_0_80px_rgba(29,185,84,0.1)] rounded-[2rem] overflow-hidden border border-white/10 bg-[#121212]">
            <iframe 
              src={`https://open.spotify.com/embed/${id}?utm_source=generator&theme=0`} 
              width="100%" 
              height="100%" 
              frameBorder="0" 
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" 
              loading="lazy" 
              className="w-full h-full" 
            />
          </div>
        </div>
      );
    }

    if (thought?.meta?.html) {
      const isReddit = content.includes('reddit.com');
      const isTikTok = content.includes('tiktok.com');
      const isInstagram = content.includes('instagram.com');
      const html = (thought?.meta?.html || "").replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "");
      return (
        <div className="w-full h-full overflow-auto flex flex-col items-center justify-start p-4 md:p-12 md:pb-32 custom-scroll bg-black">
          {!isHydrated && <div className="flex flex-col items-center gap-4 text-[var(--text-muted)] my-20 animate-pulse"><div className="w-8 h-8 rounded-full border-2 border-current border-t-transparent animate-spin" /><span className="text-[10px] font-semibold tracking-widest">Hydrating...</span></div>}
          <div id={`embed-${thought.id}`} className={cn("w-full max-w-[550px] rounded-2xl overflow-hidden shadow-2xl transition-all duration-700", isReddit ? "bg-[#1a1a1b] p-1" : (isTikTok || isInstagram) ? "bg-black/80 backdrop-blur-xl" : "bg-white/90 backdrop-blur-xl", isHydrated ? "opacity-100 scale-100" : "opacity-60 scale-[0.98]")} style={isReddit ? { colorScheme: 'dark' } : {}} dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      );
    }

    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--bg-page)] overflow-hidden">
        {thought?.meta?.thumbnail_url ? (
          <div className="w-full h-full flex items-center justify-center p-4 md:p-12">
            <div className="relative w-full h-full flex items-center justify-center">
              <div className="absolute inset-0 blur-3xl opacity-20 bg-[var(--accent)]/10 scale-75 -z-10" />
              <img src={thought.meta.thumbnail_url} alt="Content" className="max-w-[90%] max-h-[85%] object-contain rounded-2xl shadow-2xl border border-[var(--glass-border)]" />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-10"><div className={cn("w-24 h-24 rounded-[2.5rem] flex items-center justify-center border mb-8 shadow-2xl bg-[var(--glass-bg)] border-[var(--glass-border)] group transition-all hover:scale-110", config.themeColor)}><Icon className={cn("w-10 h-10 transition-colors", config.color)} /></div><h3 className="text-xl md:text-2xl font-semibold tracking-[0.2em] text-[var(--text-primary)] mb-3">{thought?.text || 'Untitled Link'}</h3><p className="text-[10px] font-bold text-[var(--text-muted)] max-w-sm uppercase tracking-[0.2em] opacity-60 italic">"{thought?.description || 'No description available'}"</p></div>
        )}
      </div>
    );
  };

  if (!thought) return null;

  return (
    <FocusEditorShell
      isVisible={isVisible}
      onClose={() => setActiveFocus(null, null)}
      title={thought.text}
      onTitleChange={(val) => { if (!isReadOnly) updateThought(thought.id, { text: val }); }}
      description={thought.description}
      isReadOnly={isReadOnly}
      headerActions={null}
      footerStatus={
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-[7px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-0.5">Platform</span>
            <div className="flex items-center gap-1.5">
              <Icon className={cn("w-3 h-3", config.color)} />
              <span className="text-[9px] font-black text-[var(--text-dimmed)] uppercase tracking-widest">{config.label}</span>
            </div>
          </div>
          {thought.author && (
            <>
              <div className="w-px h-6 bg-white/5" />
              <div className="flex flex-col">
                <span className="text-[7px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-0.5">Author</span>
                <span className={cn("text-[9px] font-semibold tracking-widest whitespace-nowrap", config.color)}>
                  {thought.author}
                </span>
              </div>
            </>
          )}
        </div>
      }
      footerActions={
        <div className="flex items-center gap-2">
          <a 
            href={content} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all border border-[var(--glass-border)] group active:scale-95"
            title="Open in New Tab"
          >
            <ExternalLink className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
          </a>
        </div>
      }
    >
      <EditorContent 
        thought={thought}
        renderPlayer={renderPlayer}
        stackItems={stackItems}
        stack={stack}
        setActiveFocus={setActiveFocus}
        scrollerRef={scrollerRef}
        isReadOnly={isReadOnly}
      />
    </FocusEditorShell>
  );
};

export const EmbedEditorContent = EditorContent;

export default EmbedFocusEditor;
