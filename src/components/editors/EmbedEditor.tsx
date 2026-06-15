import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from '../../store/useStore';
import { useThoughtPayload } from '../thought/hooks/useThoughtPayload';
import { Youtube, ExternalLink, Music, MessageCircle, Share2, Link as LinkIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { getEmbedInfo } from '../../utils/embeds';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { type Thought } from '../../db';
import { StackFilmstrip } from './StackFilmstrip';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface EmbedEditorProps {
  thought: Thought;
  onClose: () => void;
}

const EmbedEditor: React.FC<EmbedEditorProps> = ({ thought, onClose }) => {
  const updateThought = useStore((state) => state.updateThought);
  const setActiveFocus = useStore((state) => state.setActiveFocus);
  const thoughts = useStore((state) => state.thoughts);
  const isReadOnly = useStore((state) => state.isReadOnly);

  const { content } = useThoughtPayload(thought);

  const PROVIDER_CONFIG: Record<string, { icon: any; color: string; label: string; themeColor: string }> = {
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

  const embedInfo = useMemo(() => getEmbedInfo(content || ''), [content]);
  const config = PROVIDER_CONFIG[embedInfo.provider] || PROVIDER_CONFIG.unknown;
  const Icon = config.icon;

  const [isHydrated, setIsHydrated] = useState(false);
  const [localTitle, setLocalTitle] = useState(thought.text);

  const stackItems = useMemo(() => {
    if (!thought.stackId) return [];
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
  }, [thoughts, thought.stackId]);

  const currentIndex = stackItems.findIndex(i => i.id === thought.id);

  /* Escape key to close */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  /* Hydrate social embeds (Twitter, Instagram, TikTok) */
  useEffect(() => {
    setIsHydrated(false);
    const trigger = () => {
      try {
        const lowerContent = (content || "").toLowerCase();
        if (lowerContent.includes('twitter.com') || lowerContent.includes('x.com')) (window as any).twttr?.widgets?.load();
        if (lowerContent.includes('instagram.com')) (window as any).instgrm?.Embeds?.process();
        if (lowerContent.includes('tiktok.com')) (window as any).tiktok?.widgets?.load();
      } catch (err) { console.warn("[Embed Editor] Hydration failed:", err); }
      setIsHydrated(true);
    };
    trigger();
    const t = setTimeout(trigger, 1500);
    return () => clearTimeout(t);
  }, [thought.id, thought.meta?.html, content]);

  const handlePrevious = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (stackItems.length <= 1) return;
    const prevIndex = (currentIndex - 1 + stackItems.length) % stackItems.length;
    const prevItem = stackItems[prevIndex];
    setActiveFocus(prevItem.id, prevItem.type as any);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (stackItems.length <= 1) return;
    const nextIndex = (currentIndex + 1) % stackItems.length;
    const nextItem = stackItems[nextIndex];
    setActiveFocus(nextItem.id, nextItem.type as any);
  };

  const renderPlayer = () => {
    const { provider, id } = embedInfo;
    const isVideoPlatform = provider === 'youtube' || provider === 'tiktok';
    const hasHtml = !!thought.meta?.html;

    if (thought.meta?.video_url && (isVideoPlatform || !hasHtml)) {
      const proxyUrl = `/api/utils?action=proxy-video&url=${encodeURIComponent(thought.meta.video_url)}`;
      return (
        <div className="w-full h-full flex items-center justify-center bg-black">
          <video src={proxyUrl} controls autoPlay className="max-w-[90%] max-h-[85%] shadow-[0_0_100px_rgba(0,0,0,0.5)] rounded-2xl border border-white/5" />
        </div>
      );
    }

    if (provider === 'youtube' && id) {
      return (
        <div className="w-full h-full flex items-center justify-center p-4 md:p-12">
          <div className="w-full max-w-5xl max-h-full aspect-video shadow-[0_0_100px_rgba(0,0,0,0.4)] rounded-3xl overflow-hidden border border-[var(--glass-border)]">
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
        <div className="w-full h-full flex items-center justify-center p-4 md:p-12">
          <div className="w-full max-w-[800px] h-[352px] shadow-[0_0_80px_rgba(29,185,84,0.1)] rounded-[2rem] overflow-hidden border border-[var(--glass-border)]">
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

    if (thought.meta?.html) {
      const isReddit = content.includes('reddit.com');
      const isTikTok = content.includes('tiktok.com');
      const isInstagram = content.includes('instagram.com');
      const html = (thought.meta.html || "").replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "");
      return (
        <div className="w-full h-full overflow-auto flex flex-col items-center justify-start p-4 md:p-12 md:pb-32 custom-scroll">
          {!isHydrated && <div className="flex flex-col items-center gap-4 text-[var(--text-muted)] my-20 animate-pulse"><div className="w-8 h-8 rounded-full border-2 border-current border-t-transparent animate-spin" /><span className="text-[10px] font-semibold tracking-widest">Hydrating...</span></div>}
          <div id={`embed-${thought.id}`} className={cn("w-full max-w-[550px] rounded-2xl overflow-hidden shadow-2xl transition-all duration-700", isReddit ? "bg-[#1a1a1b] p-1" : (isTikTok || isInstagram) ? "bg-black/80 backdrop-blur-xl" : "bg-white/90 backdrop-blur-xl", isHydrated ? "opacity-100 scale-100" : "opacity-60 scale-[0.98]")} style={isReddit ? { colorScheme: 'dark' } : {}} dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      );
    }

    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden">
        {thought.meta?.thumbnail_url ? (
          <div className="w-full h-full flex items-center justify-center p-4 md:p-12">
            <div className="relative w-full h-full flex items-center justify-center">
              <div className="absolute inset-0 blur-3xl opacity-20 bg-[var(--accent)]/10 scale-75 -z-10" />
              <img src={thought.meta.thumbnail_url} alt="Content" className="max-w-[90%] max-h-[85%] object-contain rounded-2xl shadow-2xl border border-[var(--glass-border)]" />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-10">
            <div className={cn("w-24 h-24 rounded-[2.5rem] flex items-center justify-center border mb-8 shadow-2xl bg-[var(--glass-bg)] border-[var(--glass-border)] group transition-all hover:scale-110", config.themeColor)}>
              <Icon className={cn("w-10 h-10 transition-colors", config.color)} />
            </div>
            <h3 className="text-xl md:text-2xl font-semibold tracking-[0.2em] text-[var(--text-primary)] mb-3">
              {thought.text || 'Untitled Link'}
            </h3>
            <p className="text-[10px] font-bold text-[var(--text-muted)] max-w-sm uppercase tracking-[0.2em] opacity-60 italic">
              &ldquo;{thought.description || 'No description available'}&rdquo;
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full relative">
      {/* Top bar with title edit and metadata */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--glass-border)] flex-shrink-0 z-10">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className={cn("flex items-center gap-2 px-2 py-1 rounded-lg", config.themeColor)}>
            <Icon className={cn("w-3.5 h-3.5", config.color)} />
            <span className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
              {config.label}
            </span>
          </div>

          <input
            type="text"
            value={localTitle}
            onChange={(e) => {
              const val = e.target.value;
              setLocalTitle(val);
              if (!isReadOnly) updateThought(thought.id, { text: val });
            }}
            placeholder="Untitled"
            className="flex-1 bg-transparent border-none outline-none text-[13px] font-semibold text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/30 min-w-0"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Author info */}
          {thought.author && (
            <span className="text-[9px] font-semibold tracking-widest text-[var(--text-muted)] hidden sm:block">
              {thought.author}
            </span>
          )}

          {/* Open in new tab */}
          <a 
            href={content} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all border border-[var(--glass-border)] group active:scale-95"
            title="Open in New Tab"
          >
            <ExternalLink className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
          </a>

          {/* Close */}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/10 transition-all border border-[var(--glass-border)] active:scale-95"
            title="Close (Esc)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main embed area */}
      <div className="flex-1 flex flex-col min-h-0 relative">
        <div className="flex-1 relative min-h-0 z-0 shadow-inner group/embed">
          {renderPlayer()}

          {/* Navigation buttons — shown on hover when stack has multiple items */}
          {stackItems.length > 1 && (
            <>
              <div className="absolute inset-y-0 left-0 flex items-center px-4 md:px-8 pointer-events-none">
                <button
                  onClick={handlePrevious}
                  className="w-12 h-12 rounded-full glass flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:scale-110 transition-all pointer-events-auto opacity-0 group-hover/embed:opacity-100 shadow-2xl translate-x-[-20px] group-hover/embed:translate-x-0"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
              </div>
              <div className="absolute inset-y-0 right-0 flex items-center px-4 md:px-8 pointer-events-none">
                <button
                  onClick={handleNext}
                  className="w-12 h-12 rounded-full glass flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:scale-110 transition-all pointer-events-auto opacity-0 group-hover/embed:opacity-100 shadow-2xl translate-x-[20px] group-hover/embed:translate-x-0"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Shared StackFilmstrip — consistent across all editor types */}
        <StackFilmstrip thought={thought} stackItems={stackItems} currentIndex={currentIndex} />
      </div>
    </div>
  );
};

export default EmbedEditor;
