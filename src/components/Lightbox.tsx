import React, { useMemo, useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import { useThoughtPayload } from './thought/hooks/useThoughtPayload';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { FocusEditorShell } from './editors/FocusEditorShell';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { supabaseStorage } from '../services/supabaseStorage';
import { db } from '../db';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const Lightbox: React.FC = () => {
  const isLightboxOpen = useStore((state) => state.isLightboxOpen);
  const lightboxThoughtId = useStore((state) => state.lightboxThoughtId);
  const thoughts = useStore((state) => state.thoughts);
  const stacks = useStore((state) => state.stacks);
  const openLightbox = useStore((state) => state.openLightbox);
  const closeLightbox = useStore((state) => state.closeLightbox);
  const updateThought = useStore((state) => state.updateThought);
  const isReadOnly = useStore((state) => state.isReadOnly);

  const thought = thoughts.find((t) => t.id === lightboxThoughtId);
  const { image } = useThoughtPayload(thought);
  const stack = stacks.find((s) => s.id === thought?.stackId);
  const isVisible = isLightboxOpen && !!thought;

  // Local blob and signed URL for private bucket
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  // Load local blob
  useEffect(() => {
    if (!thought) return;
    let url: string | null = null;
    const loadLocal = async () => {
      try {
        const entry = await db.blobs.where('thoughtId').equals(thought.id).first();
        if (entry) {
          url = URL.createObjectURL(entry.blob);
          setLocalUrl(url);
        }
      } catch (e) { /* ignore */ }
    };
    loadLocal();
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [thought?.id]);

  // Fetch signed URL
  useEffect(() => {
    if (localUrl || !thought?.storagePath) return;
    let cancelled = false;
    const fetchSigned = async () => {
      try {
        const url = await supabaseStorage.getSignedUrl(thought.storagePath!);
        if (!cancelled) setSignedUrl(url);
      } catch (e) { /* ignore */ }
    };
    fetchSigned();
    return () => { cancelled = true; };
  }, [thought?.storagePath, localUrl]);

  // Resolve URL for display
  const displayUrl = localUrl || signedUrl || image;

  const scrollerRef = useRef<HTMLDivElement>(null);

  const stackItems = useMemo(() => {
    if (!thought?.stackId) return [];
    return thoughts
      .filter(t => t.stackId === thought.stackId && t.type === 'file')
      .filter(t => {
        // Only include files that are actually images
        const isImg = t.meta?.file?.type?.startsWith('image/') || 
                      t.text?.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp|svg)$/);
        return !!isImg;
      })
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [thoughts, thought]);

  const currentIndex = useMemo(() => 
    stackItems.findIndex(t => t.id === thought?.id),
    [stackItems, thought]
  );

  const getItemUrl = async (item: any): Promise<string> => {
      // Try local blob first
      try {
        const entry = await db.blobs.where('thoughtId').equals(item.id).first();
        if (entry) return URL.createObjectURL(entry.blob);
      } catch (e) { /* ignore */ }
      // Try signed URL
      if (item.storagePath) {
        try {
          return await supabaseStorage.getSignedUrl(item.storagePath);
        } catch (e) { /* ignore */ }
      }
      // Fallback to data.url or image
      return item.data?.type === 'file' ? item.data.url : (item as any).image;
    };

    // Preload thumbnail URLs
    const [thumbnailUrls] = useState(() => {
      const urls: Record<string, string> = {};
      stackItems.forEach(async (item) => {
        urls[item.id] = await getItemUrl(item);
      });
      return urls;
    });

    const handleThumbnailClick = async (item: any) => {
      const url = await getItemUrl(item);
      openLightbox(url, item.id);
    };

    // Navigate function uses currentIndex from closure
    const navigate = (dir: number) => {
      if (stackItems.length <= 1) return;
      let nextIndex = currentIndex + dir;
      if (nextIndex < 0) nextIndex = stackItems.length - 1;
      if (nextIndex >= stackItems.length) nextIndex = 0;
      
      const nextThought = stackItems[nextIndex];
      if (nextThought) {
        getItemUrl(nextThought).then(url => {
          if (url) openLightbox(url, nextThought.id);
        });
      }
    };

    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (!isVisible) return;
        if (e.key === 'Escape') closeLightbox();
        if (e.key === 'ArrowLeft') navigate(-1);
        if (e.key === 'ArrowRight') navigate(1);
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isVisible, currentIndex, stackItems]);

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

  if (!thought) return null;

  const handleDownload = () => {
    if (!displayUrl) return;
    const link = document.createElement('a');
    link.href = displayUrl;
    link.download = `cyberia-image-${thought.id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <FocusEditorShell
      isVisible={isVisible}
      onClose={closeLightbox}
      title={thought.text}
      onTitleChange={(val) => { if (!isReadOnly) updateThought(thought.id, { text: val }); }}
      description={thought.description}
      isReadOnly={isReadOnly}
      stack={stack}
      maxWidth="1200px"
      headerActions={
        <button 
          onClick={handleDownload}
          className="p-3 md:p-4 hover:bg-[var(--glass-bg)] rounded-xl md:rounded-2xl text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all"
          title="Download Image"
        >
          <Download className="w-5 h-5 md:w-6 md:h-6" />
        </button>
      }
      footerStatus={
        <p className="text-[8px] md:text-[10px] uppercase font-black tracking-widest text-[var(--text-muted)] italic">
          Resolution: {image?.startsWith('data:image/') ? 'Buffered Asset' : 'External Link'}
        </p>
      }
    >
      <div className="flex-1 flex flex-col min-h-0 bg-[var(--bg-page)]">
        {/* Main Viewport */}
        <div className="flex-1 relative min-h-0 flex items-center justify-center p-4 md:p-8 overflow-hidden group/viewport">
          {/* Navigation Arrows (Floating) */}
          {stackItems.length > 1 && (
            <>
              <button 
                onClick={(e) => { e.stopPropagation(); navigate(-1); }}
                className="absolute left-4 md:left-8 w-12 h-12 md:w-16 md:h-16 glass rounded-2xl border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg)] hover:border-[var(--accent)] transition-all active:scale-90 group z-10 opacity-0 group-hover/viewport:opacity-100"
              >
                <ChevronLeft className="w-6 h-6 md:w-8 md:h-8 group-hover:-translate-x-1 transition-transform" />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); navigate(1); }}
                className="absolute right-4 md:right-8 w-12 h-12 md:w-16 md:h-16 glass rounded-2xl border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg)] hover:border-[var(--accent)] transition-all active:scale-90 group z-10 opacity-0 group-hover/viewport:opacity-100"
              >
                <ChevronRight className="w-6 h-6 md:w-8 md:h-8 group-hover:translate-x-1 transition-transform" />
              </button>
            </>
          )}

          <AnimatePresence>
            <motion.img 
              key={thought.id}
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: -10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              src={displayUrl || undefined} 
              className="max-w-full max-h-full object-contain rounded-xl shadow-2xl" 
              alt={thought.text} 
            />
          </AnimatePresence>
        </div>

        {/* Gallery Strip (Only if stacked) */}
        <AnimatePresence>
          {stackItems.length > 1 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="bg-[var(--glass-bg)] backdrop-blur-md border-t border-[var(--glass-border)] p-4 md:p-6"
            >
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="text-[9px] font-semibold tracking-[0.2em] text-[var(--text-muted)]">Stack Gallery: {stack?.name || 'Clustered'}</span>
                <span className="text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-widest">{currentIndex + 1} / {stackItems.length} Images</span>
              </div>
              <div className="flex gap-3 overflow-x-auto custom-scroll pb-2 w-full snap-x px-1" ref={scrollerRef}>
                {stackItems.map((item, idx) => {
                  // Use thumbnailUrls if available, otherwise use getItemUrl logic
                  const itemImage = thumbnailUrls[item.id] || (item.data?.type === 'file' ? item.data.url : (item as any).image);
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleThumbnailClick(item)}
                      className={cn(
                        "flex-shrink-0 w-24 md:w-32 aspect-video rounded-xl overflow-hidden border transition-all group/item snap-start relative bg-[var(--glass-bg)]",
                        idx === currentIndex ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/20 scale-95" : "border-[var(--glass-border)] hover:border-[var(--accent)]"
                      )}
                    >
                      <img src={itemImage!} alt={item.text} className="w-full h-full object-cover opacity-40 group-hover/item:opacity-100 transition-opacity" />
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </FocusEditorShell>
  );
};

export default Lightbox;
