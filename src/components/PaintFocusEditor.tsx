import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { X, Trash2, Palette, MousePointer2, Eraser, Maximize2 } from 'lucide-react';
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
    if (isVisible && isEditMode && canvasRef.current && containerRef.current) {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        // Set internal resolution to match displayed size
        const { width, height } = container.getBoundingClientRect();
        canvas.width = width;
        canvas.height = height;
        
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        // Load existing drawing
        if (thought?.drawing) {
          const img = new Image();
          img.onload = () => ctx.drawImage(img, 0, 0);
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
    let x, y;
    if ('touches' in e) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    ctx.lineWidth = brushSize;
    
    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.shadowBlur = 0;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
      if (isNeon) {
        ctx.shadowBlur = 2;
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
          className="fixed inset-0 z-[10001] bg-[#020408]/70 backdrop-blur-[40px] flex items-center justify-center p-10"
          onClick={() => setActiveFocus(null, null)}
        >
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="focus-box glass rounded-[3rem] overflow-hidden border border-white/10 shadow-2xl w-full max-w-[1200px] h-full max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex justify-between items-center p-8 border-b border-white/5 bg-black/20">
              <div className="flex items-center gap-6">
                <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-400">
                  <Palette className="w-6 h-6" />
                </div>
                <input 
                  type="text" 
                  value={thought.text}
                  onChange={(e) => updateThought(thought.id, { text: e.target.value })}
                  className="bg-transparent text-2xl font-bold text-white outline-none border-none p-0 w-[400px]" 
                  placeholder="Untitled Sketch"
                />
              </div>

              <div className="flex items-center gap-3">
                <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5">
                  <button 
                    onClick={() => setIsEditMode(false)}
                    className={cn(
                      "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                      !isEditMode ? "bg-slate-700 text-white" : "text-slate-500 hover:text-white"
                    )}
                  >
                    View
                  </button>
                  <button 
                    onClick={() => setIsEditMode(true)}
                    className={cn(
                      "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                      isEditMode ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20" : "text-slate-500 hover:text-white"
                    )}
                  >
                    Edit
                  </button>
                </div>
                <button 
                  onClick={() => setActiveFocus(null, null)}
                  className="p-4 hover:bg-red-500/10 rounded-2xl text-slate-400 hover:text-red-400 transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Editor Body */}
            <div className="flex-1 flex overflow-hidden p-6 gap-6">
              {isEditMode ? (
                <>
                  {/* Tools */}
                  <div className="w-20 bg-white/5 rounded-[2.5rem] border border-white/10 p-4 flex flex-col gap-4 items-center overflow-y-auto custom-scroll">
                    <button 
                      onClick={() => setTool('brush')}
                      className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center transition-all",
                        tool === 'brush' ? "bg-indigo-500 text-white" : "text-white/40 hover:bg-white/5"
                      )}
                    >
                      <MousePointer2 className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => setTool('eraser')}
                      className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center transition-all",
                        tool === 'eraser' ? "bg-indigo-500 text-white" : "text-white/40 hover:bg-white/5"
                      )}
                    >
                      <Eraser className="w-5 h-5" />
                    </button>
                    <div className="w-8 h-px bg-white/10 my-2" />
                    <button onClick={() => setIsNeon(!isNeon)} className={cn("text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border", isNeon ? "bg-indigo-500/20 border-indigo-500 text-indigo-400" : "bg-white/5 border-white/10 text-white/40")}>Neon</button>
                    <div className="w-8 h-px bg-white/10 my-2" />
                    {BRUSH_SIZES.map(size => (
                      <button key={size} onClick={() => setBrushSize(size)} className={cn("w-10 h-10 flex items-center justify-center rounded-xl transition-all", brushSize === size ? "bg-white/10 text-white" : "text-white/20")}>
                        <div className="rounded-full bg-current" style={{ width: Math.max(2, size/3), height: Math.max(2, size/3) }} />
                      </button>
                    ))}
                    <div className="flex-1" />
                    <button onClick={clearCanvas} className="p-3 hover:bg-red-500/20 text-red-400 rounded-xl transition-all"><Trash2 className="w-5 h-5" /></button>
                  </div>

                  {/* Canvas Area */}
                  <div ref={containerRef} className="flex-1 bg-black rounded-[2.5rem] border border-white/10 overflow-hidden relative shadow-inner">
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
                  <div className="w-20 bg-white/5 rounded-[2.5rem] border border-white/10 p-4 flex flex-col gap-4 items-center overflow-y-auto custom-scroll">
                    {COLORS.map(c => (
                      <button key={c} onClick={() => { setColor(c); setTool('brush'); }} className={cn("w-10 h-10 rounded-full border-2 transition-all transform hover:scale-110", color === c && tool === 'brush' ? "border-white" : "border-transparent")} style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex-1 bg-black/20 rounded-[2.5rem] border border-white/5 flex items-center justify-center overflow-hidden">
                  {thought.drawing ? (
                    <img src={thought.drawing} className="max-w-full max-h-full object-contain shadow-2xl" alt="Sketch" />
                  ) : (
                    <div className="text-center text-slate-600">
                      <Palette className="w-16 h-16 mx-auto mb-4 opacity-10" />
                      <p className="text-sm font-medium">No drawing yet. Click Edit to start.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-6 bg-black/40 border-t border-white/5 flex justify-between items-center px-10">
              <p className="text-[10px] uppercase font-black tracking-widest text-slate-600">Drawing automatically saved to space</p>
              <div className="flex items-center gap-10 text-white/20 text-[8px] font-black uppercase tracking-[0.2em]">
                <span>Click & Drag to Paint</span>
                <span className="w-1.5 h-1.5 rounded-full bg-white/10" />
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
