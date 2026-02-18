import React, { useMemo, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { Image as ImageIcon, ChevronLeft, ChevronRight, Maximize2, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { FocusEditorShell } from './editors/FocusEditorShell';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

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
  const stack = stacks.find((s) => s.id === thought?.stackId);
  const isVisible = isLightboxOpen && !!thought;

  const scrollerRef = useRef<HTMLDivElement>(null);

  const stackItems = useMemo(() => {
    if (!thought?.stackId) return [];
    return thoughts
      .filter(t => t.stackId === thought.stackId && t.type === 'image' && t.image)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [thoughts, thought]);

  const currentIndex = useMemo(() => 
    stackItems.findIndex(t => t.id === thought?.id),
    [stackItems, thought]
  );

  const navigate = (dir: number) => {
    if (stackItems.length <= 1) return;
    let nextIndex = currentIndex + dir;
    if (nextIndex < 0) nextIndex = stackItems.length - 1;
    if (nextIndex >= stackItems.length) nextIndex = 0;
    
    const nextThought = stackItems[nextIndex];
    if (nextThought && nextThought.image) {
      openLightbox(nextThought.image, nextThought.id);
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
    if (!thought.image) return;
    const link = document.createElement('a');
    link.href = thought.image;
    link.download = `cyberia-image-${thought.id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <FocusEditorShell
      isVisible={isVisible}
      onClose={closeLightbox}
      icon={ImageIcon}
      title={thought.text}
      onTitleChange={(val) => { if (!isReadOnly) updateThought(thought.id, { text: val }); }}
      description={thought.description}
      isReadOnly={isReadOnly}
      stack={stack}
      maxWidth="1200px"
      headerActions={
        <button 
          onClick={handleDownload}
          className="p-3 md:p-4 hover:bg-white/5 rounded-xl md:rounded-2xl text-slate-400 hover:text-white transition-all"
          title="Download Image"
        >
          <Download className="w-5 h-5 md:w-6 md:h-6" />
        </button>
      }
      footerStatus={
        <p className="text-[8px] md:text-[10px] uppercase font-black tracking-widest text-slate-600 italic">
          Resolution: {thought.image?.startsWith('data:image/') ? 'Buffered Asset' : 'External Link'}
        </p>
      }
    >
      <div className="flex-1 flex flex-col min-h-0 bg-[#020408]">
        {/* Main Viewport */}
        <div className="flex-1 relative min-h-0 flex items-center justify-center p-4 md:p-8 overflow-hidden group/viewport">
          {/* Navigation Arrows (Floating) */}
          {stackItems.length > 1 && (
            <>
              <button 
                onClick={(e) => { e.stopPropagation(); navigate(-1); }}
                className="absolute left-4 md:left-8 w-12 h-12 md:w-16 md:h-16 glass rounded-2xl border border-white/10 flex items-center justify-center text-white/20 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all active:scale-90 group z-10 opacity-0 group-hover/viewport:opacity-100"
              >
                <ChevronLeft className="w-6 h-6 md:w-8 md:h-8 group-hover:-translate-x-1 transition-transform" />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); navigate(1); }}
                className="absolute right-4 md:right-8 w-12 h-12 md:w-16 md:h-16 glass rounded-2xl border border-white/10 flex items-center justify-center text-white/20 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all active:scale-90 group z-10 opacity-0 group-hover/viewport:opacity-100"
              >
                <ChevronRight className="w-6 h-6 md:w-8 md:h-8 group-hover:translate-x-1 transition-transform" />
              </button>
            </>
          )}

          <AnimatePresence mode="wait">
            <motion.img 
              key={thought.id}
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 1.02, y: -10 }}
              transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
              src={thought.image || undefined} 
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
              className="bg-black/40 backdrop-blur-md border-t border-white/5 p-4 md:p-6"
            >
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Stack Gallery: {stack?.name || 'Clustered'}</span>
                <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest">{currentIndex + 1} / {stackItems.length} Images</span>
              </div>
              <div className="flex gap-3 overflow-x-auto custom-scroll pb-2 w-full snap-x" ref={scrollerRef}>
                {stackItems.map((item, idx) => (
                  <button
                    key={item.id}
                    onClick={() => openLightbox(item.image!, item.id)}
                    className={cn(
                      "flex-shrink-0 w-24 md:w-32 aspect-video rounded-xl overflow-hidden border transition-all group/item snap-start relative bg-white/[0.02]",
                      idx === currentIndex ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/20 scale-95" : "border-white/5 hover:border-white/20"
                    )}
                  >
                    <img 
                      src={item.image!} 
                      alt={item.text} 
                      className={cn(
                        "w-full h-full object-cover transition-opacity duration-500",
                        idx === currentIndex ? "opacity-100" : "opacity-40 group-hover/item:opacity-80"
                      )} 
                    />
                    <div className={cn(
                      "absolute inset-0 bg-[var(--accent)]/10 transition-opacity",
                      idx === currentIndex ? "opacity-100" : "opacity-0 group-hover/item:opacity-100"
                    )} />
                    {idx === currentIndex && (
                      <div className="absolute top-2 right-2">
                        <Maximize2 className="w-3 h-3 text-[var(--accent-secondary)]" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </FocusEditorShell>
  );
};

export default Lightbox;
