import React, { useRef, useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import World from './World';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const Viewport: React.FC = () => {
  const activeSpaceId = useStore((state) => state.activeSpaceId);
  const spaces = useStore((state) => state.spaces);
  const activeSpace = spaces.find((s) => s.id === activeSpaceId);
  const setInspectorOpen = useStore((state) => state.setInspectorOpen);
  
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isGrabbing, setIsGrabbing] = useState(false);
  
  const lastMousePos = useRef({ x: 0, y: 0 });
  const isPanningRef = useRef(false);

  useEffect(() => {
    // Reset transform when switching views or spaces
    setTransform({ x: 0, y: 0, scale: 1 });
  }, [activeSpace?.mode, activeSpaceId]);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
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

    const handleAuxClick = (e: MouseEvent) => {
      if (e.button === 1) e.preventDefault(); // Stop auto-scroll
    };

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.thought-bulb, #inspector, .ui-layer, .glass, .expand-img, button, input, textarea, #cal-sidebar-content, .cal-grid')) {
        setInspectorOpen(false);
      }
    };

    const handleWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('#inspector, #text-focus-overlay, #table-focus-overlay')) return;

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

    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('auxclick', handleAuxClick);
    window.addEventListener('click', handleClick);
    window.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('auxclick', handleAuxClick);
      window.removeEventListener('click', handleClick);
      window.removeEventListener('wheel', handleWheel);
    };
  }, [activeSpace, setInspectorOpen]);

  return (
    <div 
      id="viewport" 
      className={cn(
        "fixed inset-0 z-[20] overflow-hidden",
        isGrabbing ? "pointer-events-auto cursor-grabbing" : "pointer-events-none"
      )}
    >
      <World transform={transform} />
    </div>
  );
};

export default Viewport;
