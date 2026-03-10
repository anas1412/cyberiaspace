import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../../store/useStore';
import { useThoughtPayload } from '../thought/hooks/useThoughtPayload';
import { Youtube, ExternalLink, Music, MessageCircle, Share2, Link as LinkIcon, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getEmbedInfo } from '../../utils/embeds';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { FocusEditorShell } from './FocusEditorShell';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const PROVIDER_CONFIG: Record<string, { icon: any, color: string, label: string, themeColor: string }> = {
  youtube: { icon: Youtube, color: 'text-red-500', themeColor: 'bg-red-500/10', label: 'YouTube' },
  spotify: { icon: Music, color: 'text-[#1db954]', themeColor: 'bg-[#1db954]/10', label: 'Spotify' },
  twitter: { icon: MessageCircle, color: 'text-[#1da1f2]', themeColor: 'bg-[#1da1f2]/10', label: 'Twitter' },
  reddit: { icon: MessageCircle, color: 'text-[#ff4500]', themeColor: 'bg-[#ff4500]/10', label: 'Reddit' },
  facebook: { icon: Share2, color: 'text-[#1877f2]', themeColor: 'bg-[#1877f2]/10', label: 'Facebook' },
  instagram: { icon: Share2, color: 'text-[#e1306c]', themeColor: 'bg-[#e1306c]/10', label: 'Instagram' },
  tiktok: { icon: Share2, color: 'text-[#ff0050]', themeColor: 'bg-[#ff0050]/10', label: 'TikTok' },
  unknown: { icon: LinkIcon, color: 'text-slate-400', themeColor: 'bg-white/10', label: 'Link' }
};

const StackItemThumbnail: React.FC<{ 
  item: any; 
  isActive: boolean;
  onClick: () => void;
}> = ({ item, isActive, onClick }) => {
  const itemPayload = (item.data?.type === 'embed' ? item.data.url : (item as any).content) || '';
  const itemInfo = getEmbedInfo(itemPayload);
  const itemConfig = PROVIDER_CONFIG[itemInfo.provider] || PROVIDER_CONFIG.unknown;
  const ItemIcon = itemConfig.icon;
  const thumb = item.data?.url && itemInfo.provider === 'youtube' && itemInfo.id
    ? `https://img.youtube.com/vi/${itemInfo.id}/mqdefault.jpg`
    : (item.data?.url || (item as any).image);

  return (
    <button
      onClick={onClick}
      data-active={isActive}
      className={cn(
        "flex-shrink-0 w-28 md:w-36 aspect-video rounded-xl overflow-hidden border transition-all duration-300 group/item snap-start relative bg-white/[0.03]",
        isActive 
          ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/30 scale-105 z-10 shadow-[0_0_20px_rgba(var(--accent-rgb),0.3)]" 
          : "border-white/5 hover:border-white/20 hover:scale-[1.02]"
      )}
    >
      {thumb ? (
        <img 
          src={thumb} 
          alt={item.text} 
          className={cn(
            "w-full h-full object-cover transition-all duration-500",
            isActive ? "opacity-100" : "opacity-40 group-hover/item:opacity-80"
          )} 
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <ItemIcon className={cn(
            "w-5 h-5 transition-colors",
            isActive ? "text-[var(--accent)]" : "opacity-20 text-slate-400"
          )} />
        </div>
      )}
      <div className={cn(
        "absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent transition-opacity flex items-end p-2 text-left",
        isActive ? "opacity-100" : "opacity-0 group-hover/item:opacity-100"
      )}>
        <p className="text-[7px] md:text-[8px] font-black uppercase tracking-widest text-white truncate w-full">
          {item.text || "Untitled"}
        </p>
      </div>
      {isActive && (
        <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[var(--accent)] shadow-[0_0_10px_var(--accent)] animate-pulse" />
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
}> = ({ thought, renderPlayer, stackItems, stack, setActiveFocus, scrollerRef }) => {
  const [showPreviews, setShowPreviews] = useState(true);
  
  return (
  <div className="flex-1 flex flex-col min-h-0 relative">
    <div className="flex-1 relative min-h-0 z-0">
      {renderPlayer()}
    </div>
    <AnimatePresence>
      {stackItems.length > 0 && (
        <div className={cn("relative z-10 mx-6", showPreviews ? "mb-6" : "mb-3")}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl transition-all duration-300",
              showPreviews ? "p-4 md:p-5" : "p-2 px-4"
            )}
          >
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-[var(--accent)] animate-pulse" />
                  <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">
                    {stack?.name || 'Collection'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[8px] font-bold text-slate-500 uppercase tracking-[0.2em]">
                    {stackItems.findIndex(i => i.id === thought.id) + 1} / {stackItems.length}
                  </span>
                  <button 
                    onClick={() => setShowPreviews(!showPreviews)}
                    className="p-1 hover:bg-white/5 rounded-md text-slate-500 hover:text-white transition-all"
                    title={showPreviews ? "Hide Previews" : "Show Previews"}
                  >
                    {showPreviews ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>
              </div>
              {showPreviews && (
                <div className="flex gap-4 overflow-x-auto custom-scroll pb-1 w-full snap-x mt-4" ref={scrollerRef}>
                  {stackItems.map((item) => (
                    <StackItemThumbnail 
                      key={item.id} 
                      item={item} 
                      isActive={item.id === thought.id}
                      onClick={() => setActiveFocus(item.id, 'embed')} 
                    />
                  ))}
                </div>
              )}
          </motion.div>
        </div>
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
  const { content, image } = useThoughtPayload(thought);
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
      .filter(t => t.stackId === sid && t.type === 'embed')
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
        <div className="w-full h-full flex items-center justify-center bg-black/20">
          <video src={proxyUrl} controls autoPlay className="max-w-full max-h-full shadow-2xl rounded-2xl border border-white/5" />
        </div>
      );
    }

    if (provider === 'youtube' && id) {
      return (
        <div className="absolute inset-0 p-4 md:p-12">
           <iframe src={`https://www.youtube.com/embed/${id}?autoplay=1&theme=dark`} title="YouTube" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen className="w-full h-full rounded-2xl shadow-2xl border border-white/5" />
        </div>
      );
    }

    if (provider === 'spotify' && id) {
      return (
        <div className="absolute inset-0 p-4 md:p-12">
          <iframe src={`https://open.spotify.com/embed/${id}?utm_source=generator&theme=0`} width="100%" height="100%" frameBorder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" className="w-full h-full rounded-2xl shadow-2xl border border-white/5" />
        </div>
      );
    }

    if (thought?.meta?.html) {
      const isReddit = content.includes('reddit.com');
      const isTikTok = content.includes('tiktok.com');
      const isInstagram = content.includes('instagram.com');
      const html = (thought?.meta?.html || "").replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "");
      return (
        <div className="w-full h-full overflow-auto flex flex-col items-center justify-start p-4 md:p-12 custom-scroll bg-black/5">
          {!isHydrated && <div className="flex flex-col items-center gap-4 text-slate-500 my-10 animate-pulse"><div className="w-8 h-8 rounded-full border-2 border-current border-t-transparent animate-spin" /><span className="text-[10px] font-black uppercase tracking-widest">Hydrating...</span></div>}
          <div id={`embed-${thought.id}`} className={cn("w-full max-w-[550px] rounded-2xl overflow-hidden shadow-2xl transition-all duration-700", isReddit ? "bg-[#1a1a1b] p-1" : (isTikTok || isInstagram) ? "bg-black/80 backdrop-blur-xl" : "bg-white/90 backdrop-blur-xl", isHydrated ? "opacity-100 scale-100" : "opacity-60 scale-[0.98]")} style={isReddit ? { colorScheme: 'dark' } : {}} dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      );
    }

    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/5 overflow-hidden">
        {image ? (
          <div className="w-full h-full flex items-center justify-center p-4 md:p-12">
            <div className="relative w-full h-full flex items-center justify-center">
              <div className="absolute inset-0 blur-3xl opacity-20 bg-[var(--accent)]/10 scale-75 -z-10" />
              <img src={image} alt="Content" className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl border border-white/5" />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-10"><div className={cn("w-24 h-24 rounded-[2.5rem] flex items-center justify-center border mb-8 shadow-2xl bg-white/5 border-white/10 group transition-all hover:scale-110", config.themeColor)}><Icon className={cn("w-10 h-10 transition-colors", config.color)} /></div><h3 className="text-xl md:text-2xl font-black uppercase tracking-[0.2em] text-white mb-3">{thought?.text || 'Untitled Link'}</h3><p className="text-[10px] font-bold text-slate-500 max-w-sm uppercase tracking-[0.2em] opacity-60 italic">"{thought?.description || 'No description available'}"</p></div>
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
      headerSubContent={
        <div className="flex items-center gap-3 mt-1.5 overflow-hidden">
          {thought.author && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/5 border border-white/10 rounded-lg">
              <span className={cn("text-[8px] font-black uppercase tracking-widest whitespace-nowrap", config.color)}>{thought.author}</span>
            </div>
          )}
          <div className="flex items-center gap-2 px-2.5 py-1 bg-white/5 border border-white/10 rounded-lg max-w-[200px] md:max-w-md">
            <p className="text-[8px] text-slate-400 uppercase font-black tracking-widest truncate">{content}</p>
          </div>
        </div>
      }
      headerActions={
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl">
             <Icon className={cn("w-3.5 h-3.5", config.color)} />
             <span className="text-[7px] font-black uppercase tracking-[0.2em] text-slate-400">{config.label}</span>
          </div>
          <a href={content} target="_blank" rel="noopener noreferrer" className="p-3 bg-white/5 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-all border border-white/5">
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      }
      footerStatus={
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Platform</span>
            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{config.label}</span>
          </div>
          <div className="w-px h-6 bg-white/5" />
          <div className="flex flex-col">
            <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Source</span>
            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest truncate max-w-[150px]">
              {new URL(content || 'https://cyberia.app').hostname.toUpperCase()}
            </span>
          </div>
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
      />
    </FocusEditorShell>
  );
};

export default EmbedFocusEditor;
