import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useStore } from '../../store/useStore';
import { useThoughtPayload } from '../thought/hooks/useThoughtPayload';
import { syncOrchestrator } from '../../services/sync/syncOrchestrator';
import { Trash2, Pencil, Eraser, Zap } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion } from 'framer-motion';
import { FocusEditorShell } from './FocusEditorShell';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// =============================================================================
// CONSTANTS
// =============================================================================

const COLORS = [
  { value: '#1e293b', name: 'Dark' },
  { value: '#6366f1', name: 'Indigo' },
  { value: '#3b82f6', name: 'Blue' },
  { value: '#22c55e', name: 'Green' },
  { value: '#eab308', name: 'Yellow' },
  { value: '#f97316', name: 'Orange' },
  { value: '#ef4444', name: 'Red' },
  { value: '#ec4899', name: 'Pink' },
  { value: '#a855f7', name: 'Purple' },
  { value: '#ffffff', name: 'White' },
];

const MIN_BRUSH_SIZE = 1;
const MAX_BRUSH_SIZE = 50;
const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;

// =============================================================================
// TOOLBAR COMPONENT
// =============================================================================

interface ToolbarProps {
  tool: 'brush' | 'eraser';
  setTool: (t: 'brush' | 'eraser') => void;
  brushSize: number;
  setBrushSize: (s: number) => void;
  color: string;
  isNeon: boolean;
  setIsNeon: (v: boolean) => void;
  onClear: () => void;
  isReadOnly: boolean;
}

const Toolbar: React.FC<ToolbarProps> = ({
  tool,
  setTool,
  brushSize,
  setBrushSize,
  color,
  isNeon,
  setIsNeon,
  onClear,
  isReadOnly
}) => {
  const percentage = ((brushSize - MIN_BRUSH_SIZE) / (MAX_BRUSH_SIZE - MIN_BRUSH_SIZE)) * 100;
  
  return (
    <div className="flex flex-col h-full items-center">
      {/* Main Tools */}
      <div className="flex flex-col gap-2 items-center">
        <ToolButton
          active={tool === 'brush'}
          onClick={() => setTool('brush')}
          label="Brush"
        >
          <Pencil className="w-5 h-5" />
        </ToolButton>
        
        <ToolButton
          active={tool === 'eraser'}
          onClick={() => setTool('eraser')}
          label="Eraser"
        >
          <Eraser className="w-5 h-5" />
        </ToolButton>
      </div>
      
      {/* Divider */}
      <div className="w-8 h-px bg-[var(--glass-border)] my-4 self-center" />
      
      {/* Brush Size Section */}
      <div className="flex flex-col items-center gap-3">
        <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
          Size
        </span>
        
        {/* Size Preview */}
        <div 
          className="rounded-full transition-all duration-200 shadow-sm"
          style={{ 
            width: Math.max(4, brushSize / 2.5), 
            height: Math.max(4, brushSize / 2.5),
            backgroundColor: tool === 'eraser' ? '#94a3b8' : color,
            boxShadow: isNeon && tool !== 'eraser' ? `0 0 ${brushSize / 3}px ${color}60` : 'none'
          }} 
        />
        
        {/* Vertical Slider */}
        <div className="relative w-3 h-28 bg-[var(--bg-main)] rounded-full border border-[var(--glass-border)] overflow-hidden">
          <div 
            className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[var(--accent)] to-[var(--accent-secondary)] rounded-full transition-all duration-150"
            style={{ height: `${percentage}%` }}
          />
          <input
            type="range"
            min={MIN_BRUSH_SIZE}
            max={MAX_BRUSH_SIZE}
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            style={{ 
              WebkitAppearance: 'slider-vertical' as any
            }}
          />
        </div>
        
        {/* Size Value */}
        <span className="text-[10px] font-bold text-[var(--text-primary)] tabular-nums w-8 text-center">
          {brushSize}
        </span>
      </div>
      
      {/* Divider */}
      <div className="w-8 h-px bg-[var(--glass-border)] my-4 self-center" />
      
      {/* Neon Toggle */}
      <ToolButton
        active={isNeon}
        onClick={() => setIsNeon(!isNeon)}
        label="Neon"
      >
        <Zap className="w-4 h-4" />
      </ToolButton>
      
      {/* Spacer */}
      <div className="flex-1" />
      
      {/* Clear Button */}
      {!isReadOnly && (
        <ToolButton
          onClick={onClear}
          variant="danger"
          label="Clear"
        >
          <Trash2 className="w-5 h-5" />
        </ToolButton>
      )}
    </div>
  );
};

// =============================================================================
// TOOL BUTTON COMPONENT
// =============================================================================

interface ToolButtonProps {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  label?: string;
  variant?: 'default' | 'danger';
}

const ToolButton: React.FC<ToolButtonProps> = ({ 
  active = false, 
  onClick, 
  children, 
  label,
  variant = 'default' 
}) => (
  <div className="relative group">
    <button
      onClick={onClick}
      className={cn(
        "w-11 h-11 flex items-center justify-center rounded-xl transition-all duration-200",
        active 
          ? variant === 'danger'
            ? "bg-red-500/20 text-red-400 shadow-inner"
            : "bg-[var(--accent)] text-[var(--accent-contrast)] shadow-lg shadow-[var(--accent)]/30"
          : variant === 'danger'
            ? "text-red-400 hover:bg-red-500/10 border border-red-500/20"
            : "text-[var(--text-muted)] hover:bg-[var(--bg-main)] hover:text-[var(--text-primary)] border border-transparent hover:border-[var(--glass-border)]"
      )}
    >
      {children}
    </button>
    
    {/* Tooltip */}
    {label && (
      <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-[var(--bg-main)] border border-[var(--glass-border)] rounded-md text-[10px] font-medium text-[var(--text-primary)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 shadow-lg">
        {label}
      </div>
    )}
  </div>
);

// =============================================================================
// COLOR PALETTE COMPONENT
// =============================================================================

interface ColorPaletteProps {
  selectedColor: string;
  onSelect: (color: string) => void;
}

const ColorPalette: React.FC<ColorPaletteProps> = ({ selectedColor, onSelect }) => (
  <div className="flex flex-col items-center gap-2 py-1">
    <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
      Color
    </span>
    
    {COLORS.map((c) => (
      <button
        key={c.value}
        onClick={() => onSelect(c.value)}
        className={cn(
          "w-7 h-7 rounded-full transition-all duration-200 relative flex items-center justify-center",
          selectedColor === c.value
            ? "ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--bg-main)] scale-110 shadow-lg"
            : "hover:scale-105 hover:shadow-md"
        )}
        style={{ backgroundColor: c.value }}
        title={c.name}
      >
        {/* White color needs subtle border */}
        {c.value === '#ffffff' && (
          <span className="absolute inset-0 rounded-full border-2 border-[var(--glass-border)]" />
        )}
        
        {/* Active indicator */}
        {selectedColor === c.value && (
          <motion.div
            layoutId="activeColor"
            className="absolute inset-0 rounded-full ring-2 ring-[var(--accent)]"
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          />
        )}
      </button>
    ))}
  </div>
);

// =============================================================================
// EDITOR CONTENT COMPONENT
// =============================================================================

interface EditorContentProps {
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
  isReadOnly: boolean;
}

const EditorContent: React.FC<EditorContentProps> = ({ 
  canvasRef, containerRef, startPainting, paint, stopPainting,
  tool, setTool, isNeon, setIsNeon, brushSize, setBrushSize, color, setColor, clearCanvas, isReadOnly
}) => (
  <div className="flex-1 flex overflow-hidden p-4 gap-4">
    {/* Left Toolbar */}
    <div className="w-14 bg-[var(--bg-main)]/40 backdrop-blur-sm rounded-2xl border border-[var(--glass-border)] p-2 flex-shrink-0">
      <Toolbar
        tool={tool}
        setTool={setTool}
        brushSize={brushSize}
        setBrushSize={setBrushSize}
        color={color}
        isNeon={isNeon}
        setIsNeon={setIsNeon}
        onClear={clearCanvas}
        isReadOnly={isReadOnly}
      />
    </div>

    {/* Canvas Area - fills available space */}
    <div 
      ref={containerRef} 
      className="flex-1 bg-white rounded-2xl border border-[var(--glass-border)] overflow-hidden shadow-lg p-4 md:p-8"
    >
      <canvas
        ref={canvasRef}
        className={cn(
          "w-full h-full touch-none shadow-xl rounded-lg",
          isReadOnly ? "cursor-default" : "cursor-crosshair"
        )}
        onMouseDown={startPainting}
        onMouseMove={paint}
        onMouseUp={stopPainting}
        onMouseLeave={stopPainting}
        onTouchStart={startPainting}
        onTouchMove={paint}
        onTouchEnd={stopPainting}
      />
    </div>

    {/* Right Color Palette */}
    <div className="w-12 bg-[var(--bg-main)]/40 backdrop-blur-sm rounded-2xl border border-[var(--glass-border)] p-2 flex-shrink-0 flex flex-col items-center">
      <ColorPalette
        selectedColor={color}
        onSelect={(c) => { setColor(c); setTool('brush'); }}
      />
    </div>
  </div>
);

// =============================================================================
// MAIN COMPONENT
// =============================================================================

const PaintFocusEditor: React.FC = () => {
  const activeFocusId = useStore((state) => state.activeFocusId);
  const focusType = useStore((state) => state.focusType);
  const thoughts = useStore((state) => state.thoughts);
  const updateThought = useStore((state) => state.updateThought);
  const setActiveFocus = useStore((state) => state.setActiveFocus);
  const isReadOnly = useStore((state) => state.isReadOnly);

  const thought = thoughts.find((t) => t.id === activeFocusId);
  const { drawing } = useThoughtPayload(thought as any);
  const isVisible = focusType === 'paint' && !!thought;

  React.useEffect(() => {
    if (thought?.id) {
      syncOrchestrator.setFocusEditing(true, thought.id);
    }
    return () => {
      syncOrchestrator.setFocusEditing(false, null);
    };
  }, [thought?.id]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hasInitializedCanvas = useRef(false);
  const [isPainting, setIsPainting] = useState(false);
  const [color, setColor] = useState('#1e293b');
  const [brushSize, setBrushSize] = useState(4);
  const [tool, setTool] = useState<'brush' | 'eraser'>('brush');
  const [isNeon, setIsNeon] = useState(true);

  // Initialize canvas ONCE when thought loads
  useEffect(() => {
    if (!isVisible || !canvasRef.current || !activeFocusId) return;
    if (hasInitializedCanvas.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas dimensions FIRST
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    if (drawing) {
      // Load existing drawing
      const img = new Image();
      img.onload = () => {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      };
      img.src = drawing;
    } else {
      // Empty white canvas
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    hasInitializedCanvas.current = true;
  }, [isVisible, activeFocusId, drawing]);

  // Reset initialization when thought changes (for when user closes and reopens)
  useEffect(() => {
    hasInitializedCanvas.current = false;
  }, [activeFocusId]);

  const startPainting = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (isReadOnly) return;
    setIsPainting(true);
    paint(e);
  }, [isReadOnly]);

  const stopPainting = useCallback(() => {
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
  }, [isPainting, isReadOnly, activeFocusId, updateThought]);

  const paint = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas || !isPainting) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    // Calculate position relative to canvas bounding rect
    // Then scale to internal canvas resolution
    const x = (clientX - rect.left) * (CANVAS_WIDTH / rect.width);
    const y = (clientY - rect.top) * (CANVAS_HEIGHT / rect.height);

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
  }, [isPainting, brushSize, tool, color, isNeon]);

  const clearCanvas = useCallback(() => {
    if (!canvasRef.current || isReadOnly) return;
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      const dataUrl = canvasRef.current.toDataURL();
      updateThought(activeFocusId!, { 
        data: { type: 'paint', drawing: dataUrl } 
      });
    }
  }, [isReadOnly, activeFocusId, updateThought]);

  if (!thought) return null;

  return (
    <FocusEditorShell
      isVisible={isVisible}
      onClose={() => setActiveFocus(null, null)}
      title={thought.text}
      onTitleChange={(val) => { if (!isReadOnly) updateThought(thought.id, { text: val }); }}
      description={thought.description}
      isReadOnly={isReadOnly}
      headerActions={undefined}
    >
      <EditorContent 
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
        isReadOnly={isReadOnly}
      />
    </FocusEditorShell>
  );
};

export default PaintFocusEditor;
