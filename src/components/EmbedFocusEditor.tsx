import React, { useEffect, useMemo, useRef } from 'react';
import { useStore } from '../store/useStore';
import { Youtube, X, ExternalLink, Music, MessageCircle, Share2, Link as LinkIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getEmbedInfo } from '../utils/embeds';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

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

const EmbedFocusEditor: React.FC = () => {
  const activeFocusId = useStore((state) => state.activeFocusId);
  const focusType = useStore((state) => state.focusType);
  const setActiveFocus = useStore((state) => state.setActiveFocus);
  const thoughts = useStore((state) => state.thoughts);
  const stacks = useStore((state) => state.stacks);
  const updateThought = useStore((state) => state.updateThought);

  const thought = thoughts.find((t) => t.id === activeFocusId);
  const stack = stacks.find((s) => s.id === thought?.stackId);
  const isVisible = focusType === 'embed' && !!thought;

  const embedInfo = useMemo(() => getEmbedInfo(thought?.content || ''), [thought?.content]);
  const config = PROVIDER_CONFIG[embedInfo.provider] || PROVIDER_CONFIG.unknown;
  const Icon = config.icon;

  const scrollerRef = useRef<HTMLDivElement>(null);
  const [isHydrated, setIsHydrated] = React.useState(false);

  // Find other items in the same stack (Embeds Only)
  const stackItems = useMemo(() => {
    if (!thought?.stackId) return [];
    return thoughts
      .filter(t => t.stackId === thought.stackId && t.id !== thought.id)
      .filter(t => t.type === 'embed');
  }, [thoughts, thought]);

  // Handle horizontal scroll with mouse wheel
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (e.deltaY === 0) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [isVisible, stackItems.length]);

  // Robust widget hydration logic
  useEffect(() => {
    if (isVisible && thought?.meta?.html) {
      setIsHydrated(false);

      const trigger = () => {
        try {
          const content = (thought.content || "").toLowerCase();
          if (content.includes('twitter.com') || content.includes('x.com')) (window as any).twttr?.widgets?.load();
          if (content.includes('instagram.com')) (window as any).instgrm?.Embeds?.process();
          if (content.includes('tiktok.com')) {
            const el = document.getElementById(`embed-${thought.id}`);
            if (el) {
              (window as any).tiktok?.widgets?.load();
            }
          }
        } catch (err) {
          console.warn("[Embed Focus] Hydration failed:", err);
        }
        setIsHydrated(true);
      };

      trigger();
      const t = setTimeout(trigger, 1500);
      return () => clearTimeout(t);
    }
  }, [isVisible, thought?.id, thought?.meta?.html]);

  const renderPlayer = () => {
    const { provider, id } = embedInfo;

    // Priority 1: High-Quality Video URL (Only for designated video platforms or if no HTML)
    // We EXCLUDE Reddit/Twitter/Instagram from auto-video unless no HTML is found,
    // because their "video_url" is often just a preview or metadata link.
    const isVideoPlatform = provider === 'youtube' || provider === 'tiktok';
    const hasHtml = !!thought?.meta?.html;

    if (thought?.meta?.video_url && (isVideoPlatform || !hasHtml)) {
      const proxyUrl = `/api/proxy-video?url=${encodeURIComponent(thought.meta.video_url)}`;
      return (
        <div className="w-full h-full flex items-center justify-center bg-black">
          <video
            src={proxyUrl}
            controls
            autoPlay
            className="max-w-full max-h-full shadow-2xl"
          />
        </div>
      );
    }

    // Priority 2: Standard Video Providers (Iframe Players)
    if (provider === 'youtube' && id) {
      return (
        <iframe
          src={`https://www.youtube.com/embed/${id}?autoplay=1&theme=dark`}
          title="YouTube video player"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="absolute inset-0 w-full h-full"
        ></iframe>
      );
    }

    if (provider === 'spotify' && id) {
      return (
        <iframe
          src={`https://open.spotify.com/embed/${id}?utm_source=generator&theme=0`}
          width="100%"
          height="100%"
          frameBorder="0"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
          className="absolute inset-0 w-full h-full"
        ></iframe>
      );
    }

    const getCleanHtml = () => {
      let html = thought?.meta?.html || "";
      if (!html) return "";

      // 1. Strip scripts to prevent conflicts
      html = html.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "");

      // 2. Force Dark Mode
      if (html.includes('tiktok-embed') && !html.includes('data-theme=')) {
        html = html.replace('tiktok-embed', 'tiktok-embed" data-theme="dark');
      }
      if (html.includes('instagram-media') && !html.includes('data-instgrm-captioned')) {
        // Just standardizing
      }

      return html;
    };

    // Priority 3: Rich HTML Embeds (Twitter/Instagram/Reddit/TikTok)
    if (thought?.meta?.html) {
      const isReddit = thought.content.includes('reddit.com');
      const isTikTok = thought.content.includes('tiktok.com');
      const isInstagram = thought.content.includes('instagram.com');

      return (
        <div className="w-full h-full overflow-auto flex flex-col items-center justify-start p-4 md:p-8 custom-scroll bg-[#020408]">
          {!isHydrated && (
            <div className="flex flex-col items-center gap-4 text-slate-500 my-10 animate-pulse">
              <div className="w-8 h-8 rounded-full border-2 border-current border-t-transparent animate-spin" />
              <span className="text-[10px] font-black uppercase tracking-widest">Hydrating...</span>
            </div>
          )}
          <div
            id={`embed-${thought.id}`}
            className={cn(
              "w-full max-w-[550px] rounded-2xl overflow-hidden shadow-2xl transition-all duration-700",
              isReddit ? "bg-[#1a1a1b] p-1" : (isTikTok || isInstagram) ? "bg-black" : "bg-white",
              isHydrated ? "opacity-100 scale-100" : "opacity-60 scale-[0.98]"
            )}
            style={isReddit ? { colorScheme: 'dark' } : {}}
            dangerouslySetInnerHTML={{ __html: getCleanHtml() }}
          />
        </div>
      );
    }

    // Fallback: Full-size Image or Link Card
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black overflow-hidden">
        {thought?.image ? (
          <div className="w-full h-full flex items-center justify-center p-4">
            <img
              src={thought.image}
              alt="Content"
              className="max-w-full max-h-full object-contain rounded-xl shadow-2xl border border-white/5"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-10">
            <div className={cn("w-24 h-24 rounded-3xl flex items-center justify-center border mb-6", `${config.themeColor} border-white/10 shadow-2xl`)}>
              <Icon className={cn("w-10 h-10", config.color)} />
            </div>
            <h3 className="text-xl md:text-2xl font-bold text-white mb-2">{thought?.text || 'Untitled Link'}</h3>
            <p className="text-sm text-slate-400 max-w-sm italic opacity-60">"{thought?.description || 'No description available'}"</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <AnimatePresence>
      {isVisible && thought && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[10001] bg-[var(--bg-main)]/70 backdrop-blur-[40px] flex items-center justify-center p-4 md:p-10"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="focus-box glass rounded-[2rem] md:rounded-[3rem] overflow-hidden border border-white/10 shadow-2xl w-full max-w-[1200px] h-full max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 md:p-8 border-b border-white/5 bg-black/20 gap-4 md:gap-0">
              <div className="flex items-center gap-4 md:gap-6 w-full md:w-auto overflow-hidden">
                <div className={cn("w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center flex-shrink-0 border border-white/5 shadow-xl", config.themeColor)}>
                  <Icon className={cn("w-5 h-5 md:w-6 md:h-6", config.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <input
                    type="text"
                    value={thought.text}
                    onChange={(e) => updateThought(thought.id, { text: e.target.value })}
                    className="bg-transparent text-xl md:text-2xl font-bold text-white outline-none border-none p-0 w-full truncate"
                    placeholder="Link Title"
                  />
                  <div className="flex items-center gap-2 mt-1 overflow-hidden">
                    {thought.author && (
                      <span className={cn("text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border whitespace-nowrap", config.color, config.themeColor, "border-current/20")}>{thought.author}</span>
                    )}
                    <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest truncate opacity-60">{thought.content}</p>
                  </div>
                  {thought.description &&
                    thought.description !== 'No description available.' &&
                    thought.description !== thought.text && (
                      <p className="text-[10px] text-slate-400 mt-2 line-clamp-2 italic opacity-80 max-w-2xl leading-relaxed">
                        {thought.description}
                      </p>
                    )}
                </div>
              </div>
              <div className="flex items-center gap-3 w-full md:w-auto justify-end flex-shrink-0">
                <a
                  href={thought.content}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3 md:p-4 hover:bg-white/5 rounded-xl md:rounded-2xl text-slate-400 hover:text-white transition-all"
                >
                  <ExternalLink className="w-5 h-5 md:w-6 md:h-6" />
                </a>
                <button
                  onClick={() => setActiveFocus(null, null)}
                  className="p-3 md:p-4 hover:bg-red-500/10 rounded-xl md:rounded-2xl text-slate-400 hover:text-red-400 transition-all"
                >
                  <X className="w-5 h-5 md:w-6 md:h-6" />
                </button>
              </div>
            </div>

            {/* Player Area */}
            <div className="flex-1 bg-black relative min-h-0">
              {renderPlayer()}
            </div>

            {/* Stack Scroller */}
            <AnimatePresence>
              {stackItems.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-black/40 backdrop-blur-md border-t border-white/5 p-4 md:p-6"
                >
                  <div className="flex items-center justify-between mb-3 px-1">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Collection: {stack?.name}</span>
                    <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest">{stackItems.length + 1} items total</span>
                  </div>

                  <div className="flex gap-3 overflow-x-auto custom-scroll pb-2 w-full snap-x" ref={scrollerRef}>
                    {stackItems.map((item) => {
                      const itemInfo = getEmbedInfo(item.content);
                      const itemConfig = PROVIDER_CONFIG[itemInfo.provider] || PROVIDER_CONFIG.unknown;
                      const ItemIcon = itemConfig.icon;

                      const thumb = itemInfo.provider === 'youtube' && itemInfo.id
                        ? `https://img.youtube.com/vi/${itemInfo.id}/mqdefault.jpg`
                        : item.image;

                      return (
                        <button
                          key={item.id}
                          onClick={() => setActiveFocus(item.id, 'embed')}
                          className="flex-shrink-0 w-32 md:w-40 aspect-video rounded-xl overflow-hidden border border-white/5 hover:border-[var(--accent)]/50 transition-all group/item snap-start relative bg-white/[0.02]"
                        >
                          {thumb ? (
                            <img src={thumb} alt={item.text} className="w-full h-full object-cover opacity-50 group-hover/item:opacity-100 transition-opacity" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ItemIcon className={cn("w-5 h-5 opacity-20", itemConfig.color)} />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover/item:opacity-100 transition-opacity flex items-end p-2 text-left">
                            <p className="text-[8px] font-bold text-white truncate w-full">{item.text || "Untitled"}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Footer */}
            <div className="p-4 md:p-6 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 md:gap-0">
              <div className="flex flex-wrap justify-center md:justify-start gap-2">
                {stack && (
                  <span
                    className="tag-pill text-[8px] md:text-[9px] font-700 px-2 md:px-2.5 py-1 rounded-lg border border-white/10"
                    style={{
                      backgroundColor: stack.color.replace('1)', '0.15)'),
                      color: stack.color,
                      borderColor: stack.color.replace('1)', '0.3)')
                    }}
                  >
                    {stack.name}
                  </span>
                )}
              </div>
              <p className="text-[8px] md:text-[10px] uppercase font-black tracking-widest text-slate-600 italic">Embedded via {config.label} Player API</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default EmbedFocusEditor;
