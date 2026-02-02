import React, { useRef, useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import World from './World';

const Viewport: React.FC = () => {
  const activeSpaceId = useStore((state) => state.activeSpaceId);
  const spaces = useStore((state) => state.spaces);
  const activeSpace = spaces.find((s) => s.id === activeSpaceId);
  const setInspectorOpen = useStore((state) => state.setInspectorOpen);
  
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const isPanning = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    // Reset transform when switching views or spaces
    setTransform({ x: 0, y: 0, scale: 1 });
  }, [activeSpace?.mode, activeSpaceId]);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (
        activeSpace?.mode === 'spatial' &&
        !(e.target as HTMLElement).closest('button, input, textarea, .thought-bulb, #inspector') &&
        (e.button === 1 || (e.button === 0 && e.altKey))
      ) {
        isPanning.current = true;
        lastMousePos.current = { x: e.clientX, y: e.clientY };
        e.preventDefault();
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (isPanning.current) {
        setTransform((prev) => ({
          ...prev,
          x: prev.x + (e.clientX - lastMousePos.current.x),
          y: prev.y + (e.clientY - lastMousePos.current.y),
        }));
        lastMousePos.current = { x: e.clientX, y: e.clientY };
      }
    };

    const handleMouseUp = () => {
      isPanning.current = false;
    };

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.thought-bulb, #inspector, .ui-layer, .glass, .expand-img, button, input, textarea')) {
        setInspectorOpen(false);
      }
    };

    const handleWheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest('#inspector, #text-focus-overlay, #table-focus-overlay')) return;

      if (activeSpace?.mode === 'kanban') {
        setTransform((prev) => {
          let newY = prev.y - e.deltaY;
          if (newY > 0) newY = 0;
          return { ...prev, x: 0, y: newY, scale: 1 };
        });
      } else if (activeSpace?.mode === 'calendar') {
        // Calendar sidebar scrolling is handled in its own component
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
    window.addEventListener('click', handleClick);
    window.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('click', handleClick);
      window.removeEventListener('wheel', handleWheel);
    };
  }, [activeSpace, setInspectorOpen]);

  return (
    <div id="viewport" className="fixed inset-0 z-10 overflow-hidden pointer-events-none">
      <World transform={transform} />
    </div>
  );
};

export default Viewport;
