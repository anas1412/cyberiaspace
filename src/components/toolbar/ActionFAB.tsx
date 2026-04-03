import React, { useRef, useState, useEffect } from 'react';
import { Plus, ArrowLeft, File as FileIcon, Clipboard, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { detectImageType } from '../../utils/image';

interface ActionFABProps {
  isReadOnly: boolean;
  handleAddThought: () => void;
  isDraggingThought?: boolean;
  isOverDeleteZone?: boolean;
}

export const ActionFAB: React.FC<ActionFABProps> = ({ isReadOnly, handleAddThought, isDraggingThought = false, isOverDeleteZone = false }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPress = useRef(false);

  // Collapse side buttons when drag starts
  useEffect(() => {
    if (isDraggingThought) {
      setIsExpanded(false);
    }
  }, [isDraggingThought]);

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
    };
  }, []);

  const handleMouseEnter = () => {
    if (isDraggingThought) return;
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setIsExpanded(true);
  };

  const handleMouseLeave = () => {
    closeTimer.current = setTimeout(() => {
      setIsExpanded(false);
      closeTimer.current = null;
    }, 300);
  };

  const handleTouchStart = () => {
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      setIsExpanded(prev => !prev);
    }, 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  const handleClick = () => {
    if (isLongPress.current) {
      isLongPress.current = false;
      return;
    }
    handleAddThought();
  };

  const handlePasteAction = async () => {
    try {
      const items = await navigator.clipboard.read();
      let bestItem: { blob: Blob, type: string } | null = null;
      let htmlContent: string | null = null;

      const priority = ['image/gif', 'image/webp', 'image/png', 'image/jpeg'];

      for (const item of items) {
        if (item.types.includes('text/html')) {
          const blob = await item.getType('text/html');
          htmlContent = await blob.text();
        }

        for (const type of item.types) {
          if (type.startsWith('image/')) {
            const blob = await item.getType(type);
            const actualType = await detectImageType(blob);
            
            if (!bestItem || priority.indexOf(actualType) < priority.indexOf(bestItem.type)) {
              bestItem = { blob, type: actualType };
            }
          }
        }
      }

      if (htmlContent && (!bestItem || bestItem.type !== 'image/gif')) {
        const doc = new DOMParser().parseFromString(htmlContent, 'text/html');
        const img = doc.querySelector('img');
        const src = img?.getAttribute('src');
        
        if (src && (src.toLowerCase().includes('.gif') || src.startsWith('data:image/gif'))) {
          console.log('[Paste] Recovered GIF source from HTML:', src);
          try {
            const response = await fetch(src);
            if (response.ok) {
              const blob = await response.blob();
              bestItem = { blob, type: 'image/gif' };
            }
          } catch (e) {
            console.warn('[Paste] Failed to fetch recovered GIF (CORS?)', e);
          }
        }
      }

      if (bestItem) {
        console.log(`[Paste] Best image detected: ${bestItem.type}`);
        const dataTransfer = new DataTransfer();
        const extension = bestItem.type.split('/')[1] || 'png';
        const file = new File([bestItem.blob], `pasted_asset.${extension}`, { type: bestItem.type });
        dataTransfer.items.add(file);
        window.dispatchEvent(new CustomEvent('cyberia-paste-triggered', { detail: { dataTransfer } }));
        return;
      }

      const text = await navigator.clipboard.readText();
      if (text) {
        console.log('[Paste] Text detected');
        window.dispatchEvent(new CustomEvent('cyberia-paste-triggered', { detail: { text } }));
        return;
      }
    } catch (err) {
      console.error('[Paste] Clipboard access failed:', err);
    }
  };

  if (isReadOnly) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', damping: 40, stiffness: 200 }}
        className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[10000] pointer-events-none flex flex-col items-center"
      >
        <button onClick={() => window.location.href = '/'} className="group relative flex items-center gap-3 px-6 py-3 bg-[var(--text-primary)]/10 backdrop-blur-2xl text-[var(--text-primary)] rounded-2xl border border-[var(--glass-border)] shadow-2xl hover:brightness-110 active:brightness-90">
          <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 pointer-events-none whitespace-nowrap"><div className="glass px-3 py-1.5 rounded-xl border border-[var(--glass-border)] flex items-center gap-2 shadow-2xl bg-[var(--bg-main)]/90 backdrop-blur-xl"><span className="text-[12px] font-semibold tracking-wide text-[var(--text-primary)]/80">Return to Your Workspace</span></div></div>
          <div className="absolute inset-0 rounded-2xl bg-[var(--accent)]/10 opacity-0 group-hover:opacity-100" />
          <ArrowLeft className="w-5 h-5 text-[var(--text-muted)] group-hover:text-[var(--text-primary)] relative z-10" /><span className="text-[12px] font-semibold tracking-wide text-[var(--text-muted)] group-hover:text-[var(--text-primary)] relative z-10">Exit</span>
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', damping: 40, stiffness: 200 }}
      className="fixed bottom-10 z-[10000] left-1/2 -translate-x-1/2 flex items-center justify-center mobile-fab-adjust"
    >
      <input 
        type="file" 
        className="hidden" 
        ref={fileInputRef} 
        onChange={(e) => {
          const files = e.target.files;
          if (files && files.length > 0) {
            const dropEvent = new DragEvent('drop', {
              dataTransfer: new DataTransfer()
            });
            for (let i = 0; i < files.length; i++) {
              dropEvent.dataTransfer?.items.add(files[i]);
            }
            window.dispatchEvent(dropEvent);
          }
        }} 
      />
      
      <div 
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="relative flex items-center justify-center pointer-events-auto h-[64px]"
      >
        <AnimatePresence>
          {isExpanded && (
            <>
              <motion.button 
                initial={{ opacity: 0, x: 0, scale: 0.5 }}
                animate={{ opacity: 1, x: -70, scale: 1 }}
                exit={{ opacity: 0, x: 0, scale: 0.5 }}
                transition={{ type: 'spring', damping: 40, stiffness: 200 }}
                onClick={() => fileInputRef.current?.click()}
className="absolute group flex items-center justify-center w-12 h-12 bg-[var(--text-primary)]/10 backdrop-blur-2xl text-[var(--text-primary)] rounded-xl border border-[var(--glass-border)] shadow-2xl active:brightness-90 pointer-events-auto focus-visible:outline-none"
               >
                <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap"><div className="glass px-3 py-1.5 rounded-xl border border-[var(--glass-border)] flex flex-col items-center gap-1 shadow-2xl bg-[var(--bg-main)]/90 backdrop-blur-xl"><span className="text-[12px] font-semibold tracking-wide text-[var(--text-primary)]/80">Upload File</span></div></div>
                <FileIcon className="w-5 h-5 text-[var(--text-muted)] group-hover:text-[var(--text-primary)]" />
              </motion.button>

              <motion.button
                initial={{ opacity: 0, x: 0, scale: 0.5 }}
                animate={{ opacity: 1, x: 70, scale: 1 }}
                exit={{ opacity: 0, x: 0, scale: 0.5 }}
                transition={{ type: 'spring', damping: 40, stiffness: 200 }}
                onClick={handlePasteAction}
className="absolute group flex items-center justify-center w-12 h-12 bg-[var(--text-primary)]/10 backdrop-blur-2xl text-[var(--text-primary)] rounded-xl border border-[var(--glass-border)] shadow-2xl active:brightness-90 pointer-events-auto focus-visible:outline-none"
              >
                <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap"><div className="glass px-3 py-1.5 rounded-xl border border-[var(--glass-border)] flex flex-col items-center gap-1 shadow-2xl bg-[var(--bg-main)]/90 backdrop-blur-xl"><div className="flex items-center gap-2"><span className="text-[12px] font-semibold tracking-wide text-[var(--text-primary)]/80">Paste</span><div className="w-[1px] h-2 bg-[var(--glass-border)] mx-0.5" /><kbd className="bg-[var(--glass-bg)] border border-[var(--glass-border)] px-1.5 py-0.5 rounded text-[10px] font-black text-[var(--accent-secondary)]">CTRL+V</kbd></div></div></div>
                <Clipboard className="w-5 h-5 text-[var(--text-muted)] group-hover:text-[var(--text-primary)]" />
              </motion.button>
            </>
          )}
        </AnimatePresence>

        <motion.button 
          onContextMenu={(e) => e.preventDefault()}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onClick={handleClick}
          animate={isOverDeleteZone ? { scale: 1.15 } : { scale: 1 }}
          transition={{ duration: 0.12, ease: 'easeOut' }}
          className={`group relative z-10 flex items-center justify-center w-16 h-16 bg-[var(--text-primary)]/10 backdrop-blur-2xl text-[var(--text-primary)] rounded-2xl border shadow-2xl hover:brightness-110 active:brightness-90 pointer-events-auto focus-visible:outline-none transition-all duration-200 ${isDraggingThought ? 'border-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.2)]' : 'border-[var(--glass-border)]'} ${isOverDeleteZone ? 'border-red-500 shadow-[0_0_40px_rgba(239,68,68,0.4)]' : ''}`}
          >
          {/* Red ring indicator when over delete zone */}
          {isOverDeleteZone && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.12, ease: 'easeOut' }}
              className="absolute -inset-1 rounded-2xl border-2 border-red-500/60"
            />
          )}
          {!isDraggingThought && (
            <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 pointer-events-none whitespace-nowrap"><div className="glass px-3 py-1.5 rounded-xl border border-[var(--glass-border)] flex flex-col items-center gap-1 shadow-2xl bg-[var(--bg-main)]/90 backdrop-blur-xl"><div className="flex items-center gap-2"><span className="text-[12px] font-semibold tracking-wide text-[var(--text-primary)]/80">New Thought</span><div className="w-[1px] h-2 bg-[var(--glass-border)] mx-0.5" /><kbd className="bg-[var(--glass-bg)] border border-[var(--glass-border)] px-1.5 py-0.5 rounded text-[10px] font-black text-[var(--accent-secondary)]">SPACE</kbd></div><span className="text-[10px] font-semibold tracking-wide text-[var(--text-primary)]/30 italic">or drag files to import</span></div></div>
          )}
          <div className={`absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity ${isDraggingThought ? 'bg-red-500/10' : 'bg-[var(--accent)]/10'}`} />
          <AnimatePresence mode="wait">
            {isDraggingThought ? (
              <motion.div
                key="trash"
                initial={{ scale: 0.5, opacity: 0, rotate: -90 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                exit={{ scale: 0.5, opacity: 0, rotate: 90 }}
                transition={{ duration: 0.15, ease: 'easeInOut' }}
                className="relative z-10"
              >
                <Trash2 className="w-8 h-8 text-red-400" />
              </motion.div>
            ) : (
              <motion.div
                key="plus"
                initial={{ scale: 0.5, opacity: 0, rotate: 90 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                exit={{ scale: 0.5, opacity: 0, rotate: -90 }}
                transition={{ duration: 0.15, ease: 'easeInOut' }}
                className="relative z-10"
              >
                <Plus className="w-8 h-8 text-[var(--text-muted)] group-hover:text-[var(--text-primary)]" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>
      </div>
    </motion.div>
  );
};
