import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useStore } from '../../store/useStore';
import { useThoughtPayload } from '../thought/hooks/useThoughtPayload';
import { type Thought } from '../../db';
import { Trash2, Pencil, Eraser, Zap, X } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence } from 'framer-motion';

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

const AUTO_HIDE_DELAY = 2000;

// =============================================================================
// PROPS INTERFACE
// =============================================================================

interface PaintEditorProps {
  thought: Thought;
  onClose: () => void;
}

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
  variant = 'default',
}) => (
  <div className="relative group">
    <button
      onClick={onClick}
      className={cn(
        "w-11 h-11 flex items-center justify-center rounded-xl transition-all duration-200",
        active
          ? variant === 'danger'
            ? "bg-red-500/20 text-red-400 shadow-inner"
            : "bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/30"
          : variant === 'danger'
            ? "text-red-400 hover:bg-red-500/10 border border-red-500/20"
            : "text-[var(--text-muted)] hover:bg-[var(--bg-main)] hover:text-[var(--text-primary)] border border-transparent hover:border-[var(--glass-border)]"
      )}
    >
      {children}
    </button>
    {label && (
      <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-[var(--bg-main)] border border-[var(--glass-border)] rounded-md text-[10px] font-medium text-[var(--text-primary)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 shadow-lg pointer-events-none">
        {label}
      </div>
    )}
  </div>
);

// =============================================================================
// FLOATING TOOLBAR COMPONENT
// =============================================================================

interface ToolbarInnerProps {
  tool: 'brush' | 'eraser';
  setTool: (t: 'brush' | 'eraser') => void;
  brushSize: number;
  setBrushSize: (s: number) => void;
  color: string;
  setColor: (c: string) => void;
  isNeon: boolean;
  setIsNeon: (v: boolean) => void;
  onClear: () => void;
}

const ToolbarInner: React.FC<ToolbarInnerProps> = ({
  tool,
  setTool,
  brushSize,
  setBrushSize,
  color,
  setColor,
  isNeon,
  setIsNeon,
  onClear,
}) => {
  const percentage = ((brushSize - MIN_BRUSH_SIZE) / (MAX_BRUSH_SIZE - MIN_BRUSH_SIZE)) * 100;

  return (
    <div className="flex flex-col items-center">
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
      <div className="w-8 h-px bg-[var(--glass-border)] my-3 self-center" />

      {/* Brush Size Section */}
      <div className="flex flex-col items-center gap-2">
        <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
          Size
        </span>
        <div
          className="rounded-full transition-all duration-200 shadow-sm"
          style={{
            width: Math.max(4, brushSize / 2.5),
            height: Math.max(4, brushSize / 2.5),
            backgroundColor: tool === 'eraser' ? '#94a3b8' : color,
            boxShadow: isNeon && tool !== 'eraser' ? `0 0 ${brushSize / 3}px ${color}60` : 'none',
          }}
        />
        <div className="relative w-3 h-20 bg-[var(--bg-main)] rounded-full border border-[var(--glass-border)] overflow-hidden">
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
            style={{ WebkitAppearance: 'slider-vertical' as any }}
          />
        </div>
        <span className="text-[10px] font-bold text-[var(--text-primary)] tabular-nums w-8 text-center">
          {brushSize}
        </span>
      </div>

      {/* Divider */}
      <div className="w-8 h-px bg-[var(--glass-border)] my-3 self-center" />

      {/* Neon Toggle */}
      <ToolButton
        active={isNeon}
        onClick={() => setIsNeon(!isNeon)}
        label="Neon"
      >
        <Zap className="w-4 h-4" />
      </ToolButton>

      {/* Color Palette */}
      <div className="w-8 h-px bg-[var(--glass-border)] my-3 self-center" />
      <div className="flex flex-col items-center gap-1.5">
        <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-0.5">
          Color
        </span>
        {COLORS.map((c) => (
          <button
            key={c.value}
            onClick={() => { setColor(c.value); setTool('brush'); }}
            className={cn(
              "w-6 h-6 rounded-full transition-all duration-200 relative flex items-center justify-center flex-shrink-0",
              color === c.value
                ? "ring-2 ring-[var(--accent)] ring-offset-1 ring-offset-[var(--bg-main)] scale-110 shadow-lg"
                : "hover:scale-105 hover:shadow-md"
            )}
            style={{ backgroundColor: c.value }}
            title={c.name}
          >
            {c.value === '#ffffff' && (
              <span className="absolute inset-0 rounded-full border border-[var(--glass-border)]" />
            )}
            {color === c.value && (
              <motion.div
                layoutId="activeColor"
                className="absolute inset-0 rounded-full ring-2 ring-[var(--accent)]"
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Spacer */}
      <div className="flex-1 min-h-2" />

      {/* Clear Button */}
      <ToolButton
        onClick={onClear}
        variant="danger"
        label="Clear"
      >
        <Trash2 className="w-5 h-5" />
      </ToolButton>
    </div>
  );
};

// =============================================================================
// FLOATING TOOLBAR WRAPPER (with animation)
// =============================================================================

interface FloatingToolbarProps extends ToolbarInnerProps {
  isVisible: boolean;
}

const FloatingToolbar: React.FC<FloatingToolbarProps> = ({ isVisible, ...innerProps }) => (
  <AnimatePresence>
    {isVisible && (
      <motion.div
        initial={{ opacity: 0, x: 60, scale: 0.95 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: 60, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 350, damping: 30, mass: 0.8 }}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-[64px] max-h-[calc(100vh-80px)] overflow-y-auto
          bg-[var(--glass-bg)] backdrop-blur-xl rounded-2xl border border-[var(--glass-border)]
          p-2.5 shadow-2xl shadow-black/20
          [&::-webkit-scrollbar]:w-0 [&::-webkit-scrollbar]:h-0"
      >
        <ToolbarInner {...innerProps} />
      </motion.div>
    )}
  </AnimatePresence>
);

// =============================================================================
// MAIN PAINT EDITOR COMPONENT
// =============================================================================

const PaintEditor: React.FC<PaintEditorProps> = ({ thought, onClose }) => {
  const updateThought = useStore((state) => state.updateThought);
  const isReadOnly = useStore((state) => state.isReadOnly);
  const { drawing } = useThoughtPayload(thought);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hasInitializedCanvas = useRef(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isPainting, setIsPainting] = useState(false);
  const [color, setColor] = useState('#1e293b');
  const [brushSize, setBrushSize] = useState(4);
  const [tool, setTool] = useState<'brush' | 'eraser'>('brush');
  const [isNeon, setIsNeon] = useState(true);
  const [isToolbarVisible, setIsToolbarVisible] = useState(true);

  // ── Auto-hide toolbar ─────────────────────────────────────────────────

  const resetHideTimer = useCallback(() => {
    setIsToolbarVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setIsToolbarVisible(false);
    }, AUTO_HIDE_DELAY);
  }, []);

  useEffect(() => {
    resetHideTimer();
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [resetHideTimer]);

  // ── Initialize canvas ─────────────────────────────────────────────────

  useEffect(() => {
    if (!canvasRef.current) return;
    if (hasInitializedCanvas.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (drawing) {
      const img = new Image();
      img.onload = () => {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      };
      img.src = drawing;
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    hasInitializedCanvas.current = true;
  }, [drawing]);

  // Reset initialization when thought changes
  useEffect(() => {
    hasInitializedCanvas.current = false;
  }, [thought.id]);

  // ── Drawing handlers ──────────────────────────────────────────────────

  const startPainting = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    setIsPainting(true);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let clientX: number, clientY: number;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = (clientX - rect.left) * (CANVAS_WIDTH / rect.width);
    const y = (clientY - rect.top) * (CANVAS_HEIGHT / rect.height);

    ctx.beginPath();
    ctx.moveTo(x, y);
  }, []);

  const stopPainting = useCallback(() => {
    if (!isPainting) return;
    setIsPainting(false);
    if (canvasRef.current) {
      const dataUrl = canvasRef.current.toDataURL();
      updateThought(thought.id, { data: { type: 'paint', drawing: dataUrl } });
    }
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) ctx.beginPath();
  }, [isPainting, thought.id, updateThought]);

  const paint = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas || !isPainting) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let clientX: number, clientY: number;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

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
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      const dataUrl = canvasRef.current.toDataURL();
      updateThought(thought.id, { data: { type: 'paint', drawing: dataUrl } });
    }
  }, [thought.id, updateThought]);

  // ── Keyboard shortcut: Escape to close ────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* Header: Title + Close */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--glass-border)] shrink-0">
        <input
          type="text"
          value={thought.text}
          onChange={(e) => updateThought(thought.id, { text: e.target.value })}
          placeholder="Untitled"
          readOnly={isReadOnly}
          className="flex-1 bg-transparent border-none outline-none text-[13px] font-semibold text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/30 min-w-0"
        />
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg)] transition-all"
          title="Close (Esc)"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div
        className="flex-1 relative overflow-hidden"
        onMouseMove={resetHideTimer}
        onTouchMove={resetHideTimer}
      >
        {/* Canvas */}
        <canvas
          ref={canvasRef}
          className="w-full h-full touch-none cursor-crosshair"
          onMouseDown={startPainting}
          onMouseMove={paint}
          onMouseUp={stopPainting}
          onMouseLeave={stopPainting}
          onTouchStart={startPainting}
          onTouchMove={paint}
          onTouchEnd={stopPainting}
        />

        {/* Floating Toolbar */}
        <FloatingToolbar
          isVisible={isToolbarVisible}
          tool={tool}
          setTool={setTool}
          brushSize={brushSize}
          setBrushSize={setBrushSize}
          color={color}
          setColor={setColor}
          isNeon={isNeon}
          setIsNeon={setIsNeon}
          onClear={clearCanvas}
        />
      </div>
    </div>
  );
};

export default PaintEditor;
