import React, { useRef, useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { useModalStore } from '../store/useModalStore';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import World from './World';
import { usePhysics } from '../hooks/usePhysics';

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
  const deleteThought = useStore((state) => state.deleteThought);
  const addThought = useStore((state) => state.addThought);
  const saveSpaceTransform = useStore((state) => state.saveSpaceTransform);
  const updateSpace = useStore((state) => state.updateSpace);
  
  const { openModal } = useModalStore();
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isGrabbing, setIsGrabbing] = useState(false);
  
  const lastMousePos = useRef({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const initialTouchDistance = useRef<number | null>(null);
  const initialTouchScale = useRef<number>(1);
  const initialTouchMidpoint = useRef<{ x: number, y: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const saveTimeoutRef = useRef<number | null>(null);

  const { registerElement, handleMouseDown, isDragging, kanbanHeight } = usePhysics(canvasRef, transform);

  // Load transform when space changes
  useEffect(() => {
    if (activeSpace) {
      const isMobile = window.innerWidth < 768;
      
      if (isMobile && activeSpace.mode !== 'spatial') {
        updateSpace(activeSpaceId!, { mode: 'spatial' });
        setTransform({ x: 0, y: 0, scale: 1 });
        return;
      }

      if (activeSpace.mode === 'spatial') {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTransform({
          x: activeSpace.transformX ?? 0,
          y: activeSpace.transformY ?? 0,
          scale: activeSpace.transformScale ?? 1
        });
      } else {
        // Reset for non-spatial modes to ensure consistency
        setTransform({ x: 0, y: 0, scale: 1 });
      }
    }
  }, [activeSpaceId, activeSpace?.mode]);

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

      if (
        activeSpace?.mode === 'spatial' &&
        !(e.target as HTMLElement).closest('button, input, textarea, .thought-bulb, #inspector, .ui-layer, .glass, #cal-sidebar-content, .cal-grid') &&
        (isMiddleClick || isAltLeftClick)
      ) {
        isPanningRef.current = true;
        setIsGrabbing(true);
        lastMousePos.current = { x: e.clientX, y: e.clientY };
        e.preventDefault();
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (isPanningRef.current) {
        const dx = e.clientX - lastMousePos.current.x;
        const dy = e.clientY - lastMousePos.current.y;
        
        setTransform((prev) => ({
          ...prev,
          x: prev.x + dx,
          y: prev.y + dy,
        }));
        
        lastMousePos.current = { x: e.clientX, y: e.clientY };
      }
    };

    const handleMouseUp = () => {
      isPanningRef.current = false;
      setIsGrabbing(false);
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
        
        setTransform((prev) => ({
          ...prev,
          x: prev.x + dx,
          y: prev.y + dy,
        }));
        
        lastMousePos.current = { x: touch.clientX, y: touch.clientY };
      } else if (e.touches.length === 2 && initialTouchDistance.current && initialTouchMidpoint.current && activeSpace?.mode === 'spatial') {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        
        const zoomFactor = dist / initialTouchDistance.current;
        const newScale = Math.min(Math.max(0.1, initialTouchScale.current * zoomFactor), 2);
        
        const midX = initialTouchMidpoint.current.x;
        const midY = initialTouchMidpoint.current.y;

        setTransform((prev) => {
          // Anchor zoom at the initial midpoint
          const wx = (midX - prev.x) / prev.scale;
          const wy = (midY - prev.y) / prev.scale;
          
          return {
            x: midX - wx * newScale,
            y: midY - wy * newScale,
            scale: newScale,
          };
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
        setSelectedThoughtId(null);
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
        setTransform((prev) => {
          let newY = prev.y - e.deltaY;
          if (newY > 0) newY = 0;
          
          const viewHeight = window.innerHeight;
          const contentHeight = kanbanHeight.current + 100;
          const limit = Math.min(0, viewHeight - contentHeight);
          
          if (newY < limit) newY = limit;

          return { ...prev, x: 0, y: newY, scale: 1 };
        });
      } else if (activeSpace?.mode === 'calendar') {
        setTransform({ x: 0, y: 0, scale: 1 });
      } else {
        const delta = -e.deltaY;
        setTransform((prev) => {
          const newScale = Math.min(Math.max(0.1, prev.scale + delta * 0.001), 2);
          const wx = (e.clientX - prev.x) / prev.scale;
          const wy = (e.clientY - prev.y) / prev.scale;
          return {
            x: e.clientX - wx * newScale,
            y: e.clientY - wy * newScale,
            scale: newScale,
          };
        });
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedThoughtId) {
        e.preventDefault();
        openModal({
          title: 'Delete Thought?',
          description: 'This action cannot be undone.',
          type: 'delete_thought',
          confirmText: 'Delete',
          onConfirm: () => deleteThought(selectedThoughtId)
        });
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
        addThought({}).then(id => {
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
  }, [activeSpace, setInspectorOpen, isGrabbing, selectedThoughtId, openModal, deleteThought, thoughts, addThought, setSelectedThoughtId]);

  return (
    <div 
      id="viewport" 
      className={cn(
        "fixed inset-0 z-[20] overflow-hidden",
        isGrabbing ? "pointer-events-auto cursor-grabbing" : "pointer-events-none"
      )}
    >
      {/* Moving Background Grid */}
      <div 
        className="absolute inset-0 dot-grid pointer-events-none opacity-[0.03]"
        style={{ 
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          width: '5000px',
          height: '5000px',
          left: '-2500px',
          top: '-2500px',
          transformOrigin: 'center center'
        }}
      />
      <World 
        transform={transform} 
        canvasRef={canvasRef}
        physicsResults={{ registerElement, handleMouseDown, isDragging }}
      />
    </div>
  );
};

export default Viewport;