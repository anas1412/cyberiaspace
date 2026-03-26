import React, { useRef, useState, useEffect } from 'react';
import { Plus, ArrowLeft, File as FileIcon, Clipboard } from 'lucide-react';
import { detectImageType } from '../../utils/image';

interface ActionFABProps {
  isReadOnly: boolean;
  handleAddThought: () => void;
}

export const ActionFAB: React.FC<ActionFABProps> = ({ isReadOnly, handleAddThought }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPress = useRef(false);

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
    };
  }, []);

  const handleMouseEnter = () => {
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
      // 1. Read all clipboard items
      const items = await navigator.clipboard.read();
      let bestItem: { blob: Blob, type: string } | null = null;
      let htmlContent: string | null = null;

      // Priority list for image types
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

      // GIF RECOVERY LOGIC:
      // If we found an image but it's NOT a GIF, check if the HTML has a GIF URL
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
            // Fallback: we still have the static 'bestItem' if it was found
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

      // 2. Fallback to text if no image found
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
      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[10000] pointer-events-none flex flex-col items-center transition-all duration-300">
        <button onClick={() => window.location.href = '/'} className="group relative flex items-center gap-3 px-6 py-3 bg-[var(--bg-main)]/60 backdrop-blur-2xl text-white rounded-2xl border border-[var(--glass-border)] shadow-[0_0_50px_var(--accent-glow)] transition-all hover:scale-105 active:scale-95 hover:border-[var(--accent)]/40 pointer-events-auto">
          <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 pointer-events-none whitespace-nowrap"><div className="glass px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2 shadow-2xl bg-[var(--bg-main)]/90 backdrop-blur-xl"><span className="text-[10px] font-black uppercase tracking-widest text-white/80">Return to Your Workspace</span></div></div>
          <div className="absolute inset-0 rounded-2xl bg-[var(--accent)]/5 opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />
          <ArrowLeft className="w-5 h-5 text-slate-400 group-hover:text-white transition-all relative z-10" /><span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-white transition-all relative z-10">Exit</span>
        </button>
      </div>
    );
  }

  return (
    <div 
      className="fixed bottom-10 z-[10000] left-1/2 -translate-x-1/2 flex items-center justify-center transition-all duration-300 mobile-fab-adjust"
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
        className={`relative flex items-center justify-center pointer-events-auto transition-all duration-500 ${isExpanded ? 'w-[200px]' : 'w-[64px]'} h-[64px]`}
      >
        <button 
          onClick={() => fileInputRef.current?.click()}
          className={`absolute group flex items-center justify-center w-12 h-12 bg-white/5 backdrop-blur-2xl text-white rounded-xl border border-white/5 shadow-2xl transition-all duration-500 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)] hover:scale-110 active:scale-95 hover:bg-white/10 pointer-events-auto ${
            isExpanded ? "opacity-100 scale-100 -translate-x-[70px]" : "opacity-0 scale-50 translate-x-0 pointer-events-none"
          }`}
        >
          <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 pointer-events-none whitespace-nowrap"><div className="glass px-3 py-1.5 rounded-xl border border-white/10 flex flex-col items-center gap-1 shadow-2xl bg-[var(--bg-main)]/90 backdrop-blur-xl"><span className="text-[10px] font-black uppercase tracking-widest text-white/80">Upload File</span></div></div>
          <FileIcon className="w-5 h-5 text-[var(--text-muted)] group-hover:text-white transition-all" />
        </button>

          <button 
            onContextMenu={(e) => e.preventDefault()}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onClick={handleClick}
            className="group relative z-10 flex items-center justify-center w-16 h-16 bg-[var(--bg-main)]/60 backdrop-blur-2xl text-white rounded-2xl border border-[var(--glass-border)] shadow-[0_0_50px_var(--accent-glow)] transition-all hover:scale-110 active:scale-95 hover:border-[var(--accent)]/40 pointer-events-auto"
          >
            <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 pointer-events-none whitespace-nowrap"><div className="glass px-3 py-1.5 rounded-xl border border-white/10 flex flex-col items-center gap-1 shadow-2xl bg-[var(--bg-main)]/90 backdrop-blur-xl"><div className="flex items-center gap-2"><span className="text-[10px] font-black uppercase tracking-widest text-white/80">New Thought</span><div className="w-[1px] h-2 bg-white/10 mx-0.5" /><kbd className="bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-[8px] font-black text-[var(--accent-secondary)]">SPACE</kbd></div><span className="text-[7px] font-black uppercase tracking-[0.2em] text-white/30 italic">or drag files to import</span></div></div>
            <div className="absolute inset-0 rounded-2xl bg-[var(--accent)]/5 opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />
            <Plus className={`w-8 h-8 text-slate-400 group-hover:text-white transition-all duration-500 relative z-10 ${isExpanded ? 'rotate-90 text-white' : ''}`} />
          </button>

        <button 
          onClick={handlePasteAction}
          className={`absolute group flex items-center justify-center w-12 h-12 bg-white/5 backdrop-blur-2xl text-white rounded-xl border border-white/5 shadow-2xl transition-all duration-500 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)] hover:scale-110 active:scale-95 hover:bg-white/10 pointer-events-auto ${
            isExpanded ? "opacity-100 scale-100 translate-x-[70px]" : "opacity-0 scale-50 translate-x-0 pointer-events-none"
          }`}
        >
          <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 pointer-events-none whitespace-nowrap"><div className="glass px-3 py-1.5 rounded-xl border border-white/10 flex flex-col items-center gap-1 shadow-2xl bg-[var(--bg-main)]/90 backdrop-blur-xl"><div className="flex items-center gap-2"><span className="text-[10px] font-black uppercase tracking-widest text-white/80">Paste</span><div className="w-[1px] h-2 bg-white/10 mx-0.5" /><kbd className="bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-[8px] font-black text-[var(--accent-secondary)]">CTRL+V</kbd></div></div></div>
          <Clipboard className="w-5 h-5 text-[var(--text-muted)] group-hover:text-white transition-all" />
        </button>
      </div>
    </div>
  );
};
