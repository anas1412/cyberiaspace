import React, { useRef, useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { useThoughtPayload } from '../thought/hooks/useThoughtPayload';
import { Trash2, Palette, MousePointer2, Eraser } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion } from 'framer-motion';
import { FocusEditorShell } from './FocusEditorShell';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const COLORS = [
  '#ffffff', '#6366f1', '#3b82f6', '#22c55e', '#eab308', '#f97316', '#ef4444', '#ec4899', '#a855f7'
];

const BRUSH_SIZES = [2, 4, 8, 12, 24, 48];

const EditorContent: React.FC<{
  isEditMode: boolean;
  drawing: string | null;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  startPainting: (e: React.MouseEvent | React.TouchEvent) => void;
  paint: (e: React.MouseEvent | React.TouchEvent) => void;
  stopPainting: () => void;
  tool: 'brush' | 'eraser';
  setTool: (t: 'brush' | 'eraser') => void;
  isNeon: boolean;
  setIsNeon: (v: boolean) => void;
  brushSize: number;
  setBrushSize: (s: number) => void;
  color: string;
  setColor: (c: string) => void;
  clearCanvas: () => void;
}> = ({ 
  isEditMode, drawing, canvasRef, containerRef, startPainting, paint, stopPainting,
  tool, setTool, isNeon, setIsNeon, brushSize, setBrushSize, color, setColor, clearCanvas
}) => (
  <div className="flex-1 flex flex-col md:flex-row overflow-hidden p-3 md:p-6 gap-3 md:gap-6">
    {isEditMode ? (
      <>
        {/* Tools */}
        <div className="w-full md:w-20 bg-[var(--bg-main)]/20 rounded-xl md:rounded-[2.5rem] border border-[var(--glass-border)] p-2 md:p-4 flex flex-row md:flex-col gap-2 md:gap-4 items-center overflow-x-auto md:overflow-y-auto no-scrollbar custom-scroll h-14 md:h-auto flex-shrink-0">
          <button
            onClick={() => setTool('brush')}
            className={cn(
              "w-10 h-10 md:w-12 md:h-12 rounded-lg md:rounded-2xl flex items-center justify-center transition-all flex-shrink-0",
              tool === 'brush' ? "bg-[var(--accent)] text-[var(--accent-contrast)] shadow-lg shadow-[var(--accent-glow)]/20" : "text-[var(--text-muted)] hover:bg-white/5 hover:text-[var(--text-primary)]"
            )}
          >
            <MousePointer2 className="w-4 h-4 md:w-5 md:h-5" />
          </button>
          <button
            onClick={() => setTool('eraser')}
            className={cn(
              "w-10 h-10 md:w-12 md:h-12 rounded-lg md:rounded-2xl flex items-center justify-center transition-all flex-shrink-0",
              tool === 'eraser' ? "bg-[var(--accent)] text-[var(--accent-contrast)] shadow-lg shadow-[var(--accent-glow)]/20" : "text-[var(--text-muted)] hover:bg-white/5 hover:text-[var(--text-primary)]"
            )}
          >
            <Eraser className="w-4 h-4 md:w-5 md:h-5" />
          </button>
          <div className="hidden md:block w-8 h-px bg-[var(--glass-border)] my-2" />
          <button onClick={() => setIsNeon(!isNeon)} className={cn("text-[7px] md:text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border flex-shrink-0 transition-all", isNeon ? "bg-[var(--accent)]/20 border-[var(--accent)] text-[var(--accent-secondary)]" : "bg-white/5 border-[var(--glass-border)] text-[var(--text-muted)] hover:text-[var(--text-primary)]")}>Neon</button>
          <div className="hidden md:block w-8 h-px bg-[var(--glass-border)] my-2" />
          {BRUSH_SIZES.map(size => (
            <button key={size} onClick={() => setBrushSize(size)} className={cn("w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-lg md:rounded-xl transition-all flex-shrink-0", brushSize === size ? "bg-white/10 text-[var(--text-primary)] border border-white/20" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]")}>
              <div className="rounded-full bg-current" style={{ width: Math.max(2, size / 5), height: Math.max(2, size / 5) }} />
            </button>
          ))}
          <div className="hidden md:flex flex-1" />
          <button onClick={clearCanvas} className="p-2 md:p-3 hover:bg-red-500/20 text-red-400 rounded-lg md:rounded-xl transition-all flex-shrink-0 ml-auto md:ml-0 border border-transparent hover:border-red-500/20"><Trash2 className="w-4 h-4 md:w-5 md:h-5" /></button>
        </div>

        {/* Canvas Area */}
        <div ref={containerRef} className="flex-1 bg-black rounded-2xl md:rounded-[2.5rem] border border-[var(--glass-border)] overflow-hidden relative shadow-inner min-h-[200px] md:min-h-[300px]">
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
        <div className="w-full md:w-20 bg-[var(--bg-main)]/20 rounded-xl md:rounded-[2.5rem] border border-[var(--glass-border)] p-2 md:p-4 flex flex-row md:flex-col gap-2 md:gap-4 items-center overflow-x-auto md:overflow-y-auto no-scrollbar custom-scroll h-14 md:h-auto flex-shrink-0">
          {COLORS.map(c => (
            <button key={c} onClick={() => { setColor(c); setTool('brush'); }} className={cn("w-8 h-8 md:w-10 md:h-10 rounded-full border transition-all transform hover:scale-110 flex-shrink-0", color === c && tool === 'brush' ? "border-[var(--text-primary)] ring-2 ring-[var(--accent)]/50" : "border-[var(--glass-border)]")} style={{ backgroundColor: c }} />
          ))}
        </div>
      </>
    ) : (
      <div className="flex-1 bg-black/20 rounded-2xl md:rounded-[2.5rem] border border-[var(--glass-border)] flex items-center justify-center overflow-hidden">
        {drawing ? (
          <img src={drawing} className="max-w-full max-h-full object-contain shadow-2xl" alt="Sketch" />
        ) : (
          <div className="text-center">
            <Palette className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-4 text-[var(--text-muted)] opacity-20" />
            <p className="text-xs md:text-sm font-medium text-[var(--text-muted)] italic">No drawing yet. Click Edit to start.</p>
          </div>
        )}
      </div>
    )}
  </div>
);

const PaintFocusEditor: React.FC = () => {
  const activeFocusId = useStore((state) => state.activeFocusId);
  const focusType = useStore((state) => state.focusType);
  const thoughts = useStore((state) => state.thoughts);
  const updateThought = useStore((state) => state.updateThought);
  const setActiveFocus = useStore((state) => state.setActiveFocus);
  const isReadOnly = useStore((state) => state.isReadOnly);

  const [isEditMode, setIsEditMode] = useState(false);
  const thought = thoughts.find((t) => t.id === activeFocusId);
  const { drawing } = useThoughtPayload(thought as any);
  const isVisible = focusType === 'paint' && !!thought;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPainting, setIsPainting] = useState(false);
  const [color, setColor] = useState('#ffffff');
  const [brushSize, setBrushSize] = useState(4);
  const [tool, setTool] = useState<'brush' | 'eraser'>('brush');
  const [isNeon, setIsNeon] = useState(true);

  useEffect(() => {
    if (isVisible && isEditMode && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width = 1920;
        canvas.height = 1080;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (drawing) {
          const img = new Image();
          img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
          };
          img.src = drawing;
        }
      }
    }
  }, [isVisible, isEditMode, activeFocusId, drawing]);

  const startPainting = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isEditMode || isReadOnly) return;
    setIsPainting(true);
    paint(e);
  };

  const stopPainting = () => {
    if (!isPainting || isReadOnly) return;
    setIsPainting(false);
    if (canvasRef.current && activeFocusId) {
      const dataUrl = canvasRef.current.toDataURL();
      updateThought(activeFocusId, { 
        data: { type: 'paint', drawing: dataUrl } 
      });
    }
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) ctx.beginPath();
  };

  const paint = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas || !isPainting) return;

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
      x = (e.nativeEvent.offsetX) * scaleX;
      y = (e.nativeEvent.offsetY) * scaleY;
    }

    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
      if (isNeon) {
        ctx.shadowBlur = brushSize * 2;
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
    if (!canvasRef.current || isReadOnly) return;
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      const dataUrl = canvasRef.current.toDataURL();
      updateThought(activeFocusId!, { 
        data: { type: 'paint', drawing: dataUrl } 
      });
    }
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
      headerActions={
        <div className="flex bg-[var(--bg-main)]/40 p-1 rounded-xl md:rounded-2xl border border-[var(--glass-border)] relative">
          {[
            { id: false, label: 'View' },
            { id: true, label: 'Edit' }
          ].map((mode) => (
            <button
              key={mode.label}
              onClick={() => setIsEditMode(mode.id)}
              disabled={mode.id === true && isReadOnly}
                className={cn(
                  "relative px-4 md:px-6 py-2 md:py-2.5 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all duration-300 z-10",
                  isEditMode === mode.id 
                    ? (mode.id === true ? "text-[var(--accent-contrast)]" : "text-[var(--text-primary)]")
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]",
                  mode.id === true && isReadOnly && "opacity-30 cursor-not-allowed"
                )}
            >
              {isEditMode === mode.id && (
                <motion.div
                  layoutId="activeTab"
                  className={cn(
                    "absolute inset-0 rounded-lg md:rounded-xl shadow-lg z-[-1]",
                    mode.id === true 
                      ? "bg-[var(--accent)] shadow-[var(--accent-glow)]" 
                      : "bg-white/10 border border-white/10"
                  )}
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              {mode.label}
            </button>
          ))}
        </div>
      }
    >
      <EditorContent 
        isEditMode={isEditMode}
        drawing={drawing}
        canvasRef={canvasRef}
        containerRef={containerRef}
        startPainting={startPainting}
        paint={paint}
        stopPainting={stopPainting}
        tool={tool}
        setTool={setTool}
        isNeon={isNeon}
        setIsNeon={setIsNeon}
        brushSize={brushSize}
        setBrushSize={setBrushSize}
        color={color}
        setColor={setColor}
        clearCanvas={clearCanvas}
      />
    </FocusEditorShell>
  );
};

export default PaintFocusEditor;
