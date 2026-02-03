import React, { useRef, useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { X, Trash2, Palette, MousePointer2, Eraser } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence } from 'framer-motion';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const COLORS = [
  '#ffffff', '#6366f1', '#3b82f6', '#22c55e', '#eab308', '#f97316', '#ef4444', '#ec4899', '#a855f7'
];

const BRUSH_SIZES = [2, 4, 8, 12, 24, 48];

const PaintFocusEditor: React.FC = () => {
  const activeFocusId = useStore((state) => state.activeFocusId);
  const focusType = useStore((state) => state.focusType);
  const thoughts = useStore((state) => state.thoughts);
  const updateThought = useStore((state) => state.updateThought);
  const setActiveFocus = useStore((state) => state.setActiveFocus);

  const [isEditMode, setIsEditMode] = useState(false);
  const thought = thoughts.find((t) => t.id === activeFocusId);
  const isVisible = focusType === 'paint' && !!thought;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPainting, setIsPainting] = useState(false);
  const [color, setColor] = useState('#ffffff');
  const [brushSize, setBrushSize] = useState(4);
  const [tool, setTool] = useState<'brush' | 'eraser'>('brush');
  const [isNeon, setIsNeon] = useState(true);

  // Initialize and resize canvas
  useEffect(() => {
    if (isVisible && isEditMode && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        // Use fixed internal resolution for consistency across devices
        canvas.width = 1920;
        canvas.height = 1080;
        
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        // Load existing drawing
        if (thought?.drawing) {
          const img = new Image();
          img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
          };
          img.src = thought.drawing;
        }
      }
    }
  }, [isVisible, isEditMode, activeFocusId]);

  const startPainting = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isEditMode) return;
    setIsPainting(true);
    paint(e);
  };

  const stopPainting = () => {
    if (!isPainting) return;
    setIsPainting(false);
    if (canvasRef.current && activeFocusId) {
      const dataUrl = canvasRef.current.toDataURL();
      updateThought(activeFocusId, { drawing: dataUrl });
    }
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) ctx.beginPath();
  };

  const paint = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isPainting || !canvasRef.current || !isEditMode) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let x, y;
    if ('touches' in e) {
      x = (e.touches[0].clientX - rect.left) * scaleX;
      y = (e.touches[0].clientY - rect.top) * scaleY;
    } else {
      x = (e.clientX - rect.left) * scaleX;
      y = (e.clientY - rect.top) * scaleY;
    }

    ctx.lineWidth = brushSize * 2; // Compensate for higher internal resolution
    
    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.shadowBlur = 0;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
      if (isNeon) {
        ctx.shadowBlur = 4;
        ctx.shadowColor = color;
      } else {
        ctx.shadowBlur = 0;
      }
    }

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const clearCanvas = () => {
    if (canvasRef.current && activeFocusId) {
      const ctx = canvasRef.current.getContext('2d');
      ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      updateThought(activeFocusId, { drawing: null });
    }
  };

  return (
    <AnimatePresence>
      {isVisible && thought && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[10001] bg-[var(--bg-main)]/70 backdrop-blur-[40px] flex items-center justify-center p-4 md:p-10"
          onClick={() => setActiveFocus(null, null)}
        >
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="focus-box glass rounded-[2rem] md:rounded-[3rem] overflow-hidden border border-white/10 shadow-2xl w-full max-w-[1200px] h-full max-h-[95vh] md:max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 md:p-8 border-b border-white/5 bg-black/20 gap-4 md:gap-0">
              <div className="flex items-center gap-4 md:gap-6 w-full md:w-auto">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-[var(--accent)]/10 rounded-xl md:rounded-2xl flex items-center justify-center text-[var(--accent-secondary)] flex-shrink-0">
                  <Palette className="w-5 h-5 md:w-6 md:h-6" />
                </div>
                <input 
                  type="text" 
                  value={thought.text}
                  onChange={(e) => updateThought(thought.id, { text: e.target.value })}
                  className="bg-transparent text-xl md:text-2xl font-bold text-white outline-none border-none p-0 flex-1 md:w-[400px]" 
                  placeholder="Untitled Sketch"
                />
              </div>

              <div className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto">
                <div className="flex bg-white/5 p-1 rounded-xl md:rounded-2xl border border-white/5">
                  <button 
                    onClick={() => setIsEditMode(false)}
                    className={cn(
                      "px-4 md:px-6 py-2 md:py-2.5 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all",
                      !isEditMode ? "bg-slate-700 text-white" : "text-slate-500 hover:text-white"
                    )}
                  >
                    View
                  </button>
                  <button 
                    onClick={() => setIsEditMode(true)}
                    className={cn(
                      "px-4 md:px-6 py-2 md:py-2.5 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all",
                      isEditMode ? "bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent-glow)]" : "text-slate-500 hover:text-white"
                    )}
                  >
                    Edit
                  </button>
                </div>
                <button 
                  onClick={() => setActiveFocus(null, null)}
                  className="p-3 md:p-4 hover:bg-red-500/10 rounded-xl md:rounded-2xl text-slate-400 hover:text-red-400 transition-all"
                >
                  <X className="w-5 h-5 md:w-6 md:h-6" />
                </button>
              </div>
            </div>

            {/* Editor Body */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden p-3 md:p-6 gap-3 md:gap-6">
              {isEditMode ? (
                <>
                  {/* Tools */}
                  <div className="w-full md:w-20 bg-white/5 rounded-xl md:rounded-[2.5rem] border border-white/10 p-2 md:p-4 flex flex-row md:flex-col gap-2 md:gap-4 items-center overflow-x-auto md:overflow-y-auto no-scrollbar custom-scroll h-14 md:h-auto flex-shrink-0">
                    <button 
                      onClick={() => setTool('brush')}
                      className={cn(
                        "w-10 h-10 md:w-12 md:h-12 rounded-lg md:rounded-2xl flex items-center justify-center transition-all flex-shrink-0",
                        tool === 'brush' ? "bg-[var(--accent)] text-white" : "text-white/40 hover:bg-white/5"
                      )}
                    >
                      <MousePointer2 className="w-4 h-4 md:w-5 md:h-5" />
                    </button>
                    <button 
                      onClick={() => setTool('eraser')}
                      className={cn(
                        "w-10 h-10 md:w-12 md:h-12 rounded-lg md:rounded-2xl flex items-center justify-center transition-all flex-shrink-0",
                        tool === 'eraser' ? "bg-[var(--accent)] text-white" : "text-white/40 hover:bg-white/5"
                      )}
                    >
                      <Eraser className="w-4 h-4 md:w-5 md:h-5" />
                    </button>
                    <div className="hidden md:block w-8 h-px bg-white/10 my-2" />
                    <button onClick={() => setIsNeon(!isNeon)} className={cn("text-[7px] md:text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border flex-shrink-0", isNeon ? "bg-[var(--accent)]/20 border-[var(--accent)] text-[var(--accent-secondary)]" : "bg-white/5 border-white/10 text-white/40")}>Neon</button>
                    <div className="hidden md:block w-8 h-px bg-white/10 my-2" />
                    {BRUSH_SIZES.map(size => (
                      <button key={size} onClick={() => setBrushSize(size)} className={cn("w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-lg md:rounded-xl transition-all flex-shrink-0", brushSize === size ? "bg-white/10 text-white" : "text-white/20")}>
                        <div className="rounded-full bg-current" style={{ width: Math.max(2, size/5), height: Math.max(2, size/5) }} />
                      </button>
                    ))}
                    <div className="hidden md:flex flex-1" />
                    <button onClick={clearCanvas} className="p-2 md:p-3 hover:bg-red-500/20 text-red-400 rounded-lg md:rounded-xl transition-all flex-shrink-0 ml-auto md:ml-0"><Trash2 className="w-4 h-4 md:w-5 md:h-5" /></button>
                  </div>

                  {/* Canvas Area */}
                  <div ref={containerRef} className="flex-1 bg-black rounded-2xl md:rounded-[2.5rem] border border-white/10 overflow-hidden relative shadow-inner min-h-[200px] md:min-h-[300px]">
                    <canvas
                      ref={canvasRef}
                      className="w-full h-full cursor-crosshair touch-none"
                      onMouseDown={startPainting}
                      onMouseMove={paint}
                      onMouseUp={stopPainting}
                      onMouseLeave={stopPainting}
                      onTouchStart={startPainting}
                      onTouchMove={paint}
                      onTouchEnd={stopPainting}
                    />
                  </div>

                  {/* Colors */}
                  <div className="w-full md:w-20 bg-white/5 rounded-xl md:rounded-[2.5rem] border border-white/10 p-2 md:p-4 flex flex-row md:flex-col gap-2 md:gap-4 items-center overflow-x-auto md:overflow-y-auto no-scrollbar custom-scroll h-14 md:h-auto flex-shrink-0">
                    {COLORS.map(c => (
                      <button key={c} onClick={() => { setColor(c); setTool('brush'); }} className={cn("w-8 h-8 md:w-10 md:h-10 rounded-full border transition-all transform hover:scale-110 flex-shrink-0", color === c && tool === 'brush' ? "border-white" : "border-transparent")} style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex-1 bg-black/20 rounded-2xl md:rounded-[2.5rem] border border-white/5 flex items-center justify-center overflow-hidden">
                  {thought.drawing ? (
                    <img src={thought.drawing} className="max-w-full max-h-full object-contain shadow-2xl" alt="Sketch" />
                  ) : (
                    <div className="text-center text-slate-600">
                      <Palette className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-4 opacity-10" />
                      <p className="text-xs md:text-sm font-medium text-slate-700 italic">No drawing yet. Click Edit to start.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 md:p-6 bg-black/40 border-t border-white/5 flex flex-col md:flex-row justify-between items-center px-6 md:px-10 gap-4 md:gap-0">
              <p className="text-[8px] md:text-[10px] uppercase font-black tracking-widest text-slate-600">Drawing automatically saved to space</p>
              <div className="flex items-center gap-6 md:gap-10 text-white/20 text-[7px] md:text-[8px] font-black uppercase tracking-[0.2em]">
                <span>Click & Drag to Paint</span>
                <span className="w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-white/10" />
                <span>Neon Chalk Enabled</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PaintFocusEditor;
