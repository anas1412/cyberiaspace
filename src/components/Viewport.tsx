import React, { useRef, useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { useModalStore } from '../store/useModalStore';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import World from './World';
import { usePhysics } from '../hooks/usePhysics';
import { motion, AnimatePresence } from 'framer-motion';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const Viewport: React.FC = () => {
  const activeSpaceId = useStore((state) => state.activeSpaceId);
  const spaces = useStore((state) => state.spaces);
  const thoughts = useStore((state) => state.thoughts);
  const activeSpace = spaces.find((s) => s.id === activeSpaceId);
  const setInspectorOpen = useStore((state) => state.setInspectorOpen);
  const selectedThoughtId = useStore((state) => state.selectedThoughtId);
  const setSelectedThoughtId = useStore((state) => state.setSelectedThoughtId);
  const selectedThoughtIds = useStore((state) => state.selectedThoughtIds);
  const setSelectedThoughtIds = useStore((state) => state.setSelectedThoughtIds);
  const clearSelection = useStore((state) => state.clearSelection);
  const deleteSelectedThoughts = useStore((state) => state.deleteSelectedThoughts);
  const deleteThought = useStore((state) => state.deleteThought);
  const addThought = useStore((state) => state.addThought);
  const saveSpaceTransform = useStore((state) => state.saveSpaceTransform);
  const transform = useStore((state) => state.transform);
  const setTransform = useStore((state) => state.setTransform);
  const isSpaceLoading = useStore((state) => state.isSpaceLoading);
  
  const { openModal } = useModalStore();
  const [isGrabbing, setIsGrabbing] = useState(false);
  const [selectionRect, setSelectionRect] = useState<{ x: number, y: number, w: number, h: number } | null>(null);
  
  const lastMousePos = useRef({ x: 0, y: 0 });
  const mouseWorldPos = useRef({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const isSelectingRef = useRef(false);
  const selectionStartRef = useRef({ x: 0, y: 0 });
  const initialTouchDistance = useRef<number | null>(null);
  const initialTouchScale = useRef<number>(1);
  const initialTouchMidpoint = useRef<{ x: number, y: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const saveTimeoutRef = useRef<number | null>(null);

  const { registerElement, registerWorld, registerGrid, handleMouseDown, isDragging, kanbanHeight } = usePhysics(canvasRef, transform);

  // Save transform when it changes (Debounced)
  useEffect(() => {
    if (activeSpace?.mode === 'spatial' && activeSpaceId) {
      if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = window.setTimeout(() => {
        saveSpaceTransform(activeSpaceId, transform);
      }, 1000);
    }
    return () => { 
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
        if (activeSpace?.mode === 'spatial' && activeSpaceId) {
          saveSpaceTransform(activeSpaceId, transform);
        }
      }
    };
  }, [transform, activeSpaceId, activeSpace?.mode, saveSpaceTransform]);

  useEffect(() => {
    const handleMouseDownLocal = (e: MouseEvent) => {
      const isMiddleClick = e.button === 1;
      const isAltLeftClick = e.button === 0 && e.altKey;
      const isLeftClick = e.button === 0 && !e.altKey;

      if (
        activeSpace?.mode === 'spatial' &&
        !(e.target as HTMLElement).closest('button, input, textarea, .thought-bulb, #inspector, .ui-layer, .glass, #cal-sidebar-content, .cal-grid')
      ) {
        if (isMiddleClick || isAltLeftClick) {
          isPanningRef.current = true;
          setIsGrabbing(true);
          lastMousePos.current = { x: e.clientX, y: e.clientY };
          e.preventDefault();
        } else if (isLeftClick) {
          isSelectingRef.current = true;
          selectionStartRef.current = { x: e.clientX, y: e.clientY };
          if (!e.ctrlKey && !e.metaKey) {
            clearSelection();
          }
        }
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      // Always track world position for spawning
      mouseWorldPos.current = {
        x: (e.clientX - transform.x) / transform.scale,
        y: (e.clientY - transform.y) / transform.scale
      };

      if (isPanningRef.current) {
        const dx = e.clientX - lastMousePos.current.x;
        const dy = e.clientY - lastMousePos.current.y;
        
        setTransform({
          ...transform,
          x: transform.x + dx,
          y: transform.y + dy,
        });
      } else if (isSelectingRef.current) {
        const x = Math.min(e.clientX, selectionStartRef.current.x);
        const y = Math.min(e.clientY, selectionStartRef.current.y);
        const w = Math.abs(e.clientX - selectionStartRef.current.x);
        const h = Math.abs(e.clientY - selectionStartRef.current.y);
        
        if (w > 5 || h > 5) {
          setSelectionRect({ x, y, w, h });
          
          // Selection Logic
          const rectX = (x - transform.x) / transform.scale;
          const rectY = (y - transform.y) / transform.scale;
          const rectW = w / transform.scale;
          const rectH = h / transform.scale;

          const selectedIds = thoughts.filter(t => {
            const tx = t.x;
            const ty = t.y;
            // Rough bounding box check for thoughts (centered at x,y with approx 280x200 size)
            const tw = 280 / 2;
            const th = 200 / 2;
            return tx + tw > rectX && tx - tw < rectX + rectW &&
                   ty + th > rectY && ty - th < rectY + rectH;
          }).map(t => t.id);
          
          setSelectedThoughtIds(selectedIds);
        }
      }
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      isPanningRef.current = false;
      isSelectingRef.current = false;
      setIsGrabbing(false);
      setSelectionRect(null);
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        if (
          activeSpace?.mode === 'spatial' &&
          !(e.target as HTMLElement).closest('button, input, textarea, .thought-bulb, #inspector, .ui-layer, .glass, #cal-sidebar-content, .cal-grid')
        ) {
          isPanningRef.current = true;
          setIsGrabbing(true);
          lastMousePos.current = { x: touch.clientX, y: touch.clientY };
          initialTouchDistance.current = null;
        }
      } else if (e.touches.length === 2 && activeSpace?.mode === 'spatial') {
        // Prepare for pinch zoom
        isPanningRef.current = false;
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        initialTouchDistance.current = dist;
        initialTouchScale.current = transform.scale;
        initialTouchMidpoint.current = {
          x: (t1.clientX + t2.clientX) / 2,
          y: (t1.clientY + t2.clientY) / 2
        };
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1 && isPanningRef.current) {
        const touch = e.touches[0];
        const dx = touch.clientX - lastMousePos.current.x;
        const dy = touch.clientY - lastMousePos.current.y;
        
        setTransform({
          ...transform,
          x: transform.x + dx,
          y: transform.y + dy,
        });
        
        lastMousePos.current = { x: touch.clientX, y: touch.clientY };
      } else if (e.touches.length === 2 && initialTouchDistance.current && initialTouchMidpoint.current && activeSpace?.mode === 'spatial') {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        
        const zoomFactor = dist / initialTouchDistance.current;
        const newScale = Math.min(Math.max(0.1, initialTouchScale.current * zoomFactor), 2);
        
        const midX = initialTouchMidpoint.current.x;
        const midY = initialTouchMidpoint.current.y;

        // Anchor zoom at the initial midpoint
        const wx = (midX - transform.x) / transform.scale;
        const wy = (midY - transform.y) / transform.scale;
        
        setTransform({
          x: midX - wx * newScale,
          y: midY - wy * newScale,
          scale: newScale,
        });
      }
    };

    const handleTouchEnd = () => {
      isPanningRef.current = false;
      setIsGrabbing(false);
      initialTouchDistance.current = null;
      initialTouchMidpoint.current = null;
    };

    const handleAuxClick = (e: MouseEvent) => {
      if (e.button === 1) e.preventDefault(); // Stop auto-scroll
    };

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.thought-bulb, #inspector, .ui-layer, .glass, .expand-img, button, input, textarea, #cal-sidebar-content, .cal-grid, #chat-overlay')) {
        setInspectorOpen(false);
        if (selectedThoughtIds.length === 0) {
          setSelectedThoughtId(null);
        }
      }
    };

    const handleWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('#inspector, #text-focus-overlay, #table-focus-overlay, #chat-overlay')) return;

      const isUnscheduledNode = target.closest('[data-unscheduled="true"]');
      const isSidebar = target.closest('#cal-sidebar-content');

      if (activeSpace?.mode === 'calendar' && (isUnscheduledNode || isSidebar)) {
        const sbContent = document.getElementById('cal-sidebar-content');
        if (sbContent) {
          sbContent.scrollTop += e.deltaY;
          return; // Don't allow transform zoom/pan
        }
      }

      if (activeSpace?.mode === 'kanban') {
        let newY = transform.y - e.deltaY;
        if (newY > 0) newY = 0;
        
        const viewHeight = window.innerHeight;
        const contentHeight = kanbanHeight.current + 100;
        const limit = Math.min(0, viewHeight - contentHeight);
        
        if (newY < limit) newY = limit;

        setTransform({ ...transform, x: 0, y: newY, scale: 1 });
      } else if (activeSpace?.mode === 'calendar') {
        setTransform({ x: 0, y: 0, scale: 1 });
      } else {
        const delta = -e.deltaY;
        const newScale = Math.min(Math.max(0.1, transform.scale + delta * 0.001), 2);
        const wx = (e.clientX - transform.x) / transform.scale;
        const wy = (e.clientY - transform.y) / transform.scale;
        setTransform({
          x: e.clientX - wx * newScale,
          y: e.clientY - wy * newScale,
          scale: newScale,
        });
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedThoughtIds.length > 0) {
          e.preventDefault();
          openModal({
            title: `Delete ${selectedThoughtIds.length} Thoughts?`,
            description: 'This action cannot be undone.',
            type: 'delete_thought',
            confirmText: 'Delete All',
            onConfirm: () => deleteSelectedThoughts()
          });
        } else if (selectedThoughtId) {
          e.preventDefault();
          openModal({
            title: 'Delete Thought?',
            description: 'This action cannot be undone.',
            type: 'delete_thought',
            confirmText: 'Delete',
            onConfirm: () => deleteThought(selectedThoughtId)
          });
        }
      }

      if (e.key === ' ') {
        e.preventDefault();
        if (e.repeat) return; // Stop rapid-fire creation when holding space

        if (thoughts.length >= 40) {
          openModal({
            title: 'Limit Reached',
            description: 'You have reached the maximum of 40 thoughts per space.',
            type: 'limit_thought',
            confirmText: 'Okay'
          });
          return;
        }

        let newThoughtProps: any = {
          x: mouseWorldPos.current.x,
          y: mouseWorldPos.current.y
        };

        // Mode-specific logic
        if (activeSpace?.mode === 'kanban') {
          const x = lastMousePos.current.x; // screen x
          const width = window.innerWidth;
          if (x < width * 0.25) newThoughtProps.status = 'none';
          else if (x < width * 0.50) newThoughtProps.status = 'todo';
          else if (x < width * 0.75) newThoughtProps.status = 'doing';
          else newThoughtProps.status = 'done';
        } else if (activeSpace?.mode === 'calendar') {
          const elements = document.elementsFromPoint(lastMousePos.current.x, lastMousePos.current.y);
          const cell = elements.find(el => (el as HTMLElement).classList.contains('cal-cell'));
          if (cell) {
            newThoughtProps.date = (cell as HTMLElement).dataset.date;
          }
        }

        addThought(newThoughtProps).then(id => {
          if (id !== -1) {
            setSelectedThoughtId(id);
            setInspectorOpen(true);
          }
        });
      }
    };

    window.addEventListener('mousedown', handleMouseDownLocal);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('auxclick', handleAuxClick);
    window.addEventListener('click', handleClick);
    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('mousedown', handleMouseDownLocal);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('auxclick', handleAuxClick);
      window.removeEventListener('click', handleClick);
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeSpace, setInspectorOpen, isGrabbing, selectedThoughtId, selectedThoughtIds, openModal, deleteThought, deleteSelectedThoughts, thoughts, addThought, setSelectedThoughtId, setSelectedThoughtIds, clearSelection, transform]);

  return (
    <div 
      id="viewport" 
      className={cn(
        "fixed inset-0 z-[20] overflow-hidden",
        isGrabbing ? "pointer-events-auto cursor-grabbing" : "pointer-events-none"
      )}
    >
      {/* Selection Marquee */}
      {selectionRect && (
        <div 
          className="fixed border-2 border-indigo-500/50 bg-indigo-500/10 z-[1001] pointer-events-none"
          style={{
            left: selectionRect.x,
            top: selectionRect.y,
            width: selectionRect.w,
            height: selectionRect.h,
          }}
        />
      )}

      {/* Moving Background Grid */}
      <div 
        ref={registerGrid}
        className="absolute inset-0 dot-grid pointer-events-none opacity-[0.03]"
        style={{ 
          width: '5000px',
          height: '5000px',
          left: '-2500px',
          top: '-2500px',
          transformOrigin: 'center center'
        }}
      />
      <World 
        canvasRef={canvasRef}
        physicsResults={{ registerElement, registerWorld, handleMouseDown, isDragging }}
      />

      {/* Loading Overlay */}
      <AnimatePresence>
        {isSpaceLoading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10005] bg-[#020408]/60 backdrop-blur-2xl flex flex-col items-center justify-center pointer-events-auto"
          >
            <div className="relative">
              {/* Pulsing Glow */}
              <motion.div 
                animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-0 bg-indigo-500/20 blur-[60px] rounded-full"
              />
              
              <div className="flex flex-col items-center gap-6 relative z-10">
                {/* Spinner */}
                <div className="w-16 h-16 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                
                <div className="text-center">
                  <h2 className="text-white/80 text-[10px] font-black uppercase tracking-[0.5em] mb-2">Accessing Neural Layer</h2>
                  <div className="flex gap-1 justify-center">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        animate={{ opacity: [0.2, 1, 0.2] }}
                        transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                        className="w-1 h-1 bg-indigo-400 rounded-full"
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Viewport;