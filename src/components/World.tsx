import React, { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import ThoughtNode from './ThoughtNode';

interface WorldProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  physicsResults: {
    registerElement: (id: number, el: HTMLDivElement | null) => void;
    registerWorld: (el: HTMLDivElement | null) => void;
    handleMouseDown: (id: number, e: React.MouseEvent) => void;
    handleTouchStart: (id: number, e: React.TouchEvent) => void;
    isDragging: (id: number) => boolean;
  };
}

const World: React.FC<WorldProps> = ({ canvasRef, physicsResults }) => {
  const thoughts = useStore((state) => state.thoughts);
  const { registerElement, registerWorld, handleMouseDown, handleTouchStart, isDragging } = physicsResults;

  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });

  const getGlobalScale = () => {
    const body = document.querySelector('.app-body') || document.body;
    const style = window.getComputedStyle(body);
    const m = new DOMMatrix(style.transform);
    return m.a || 1;
  };

  useEffect(() => {
    const handleResize = () => {
      const s = getGlobalScale();
      setSize({ w: window.innerWidth / s, h: window.innerHeight / s });
    };
    handleResize(); // Initial call
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        id="connection-canvas"
        className="absolute inset-0 pointer-events-none z-0"
        width={size.w}
        height={size.h}
      />
      <div
        id="world"
        ref={registerWorld}
        className="absolute origin-top-left will-change-transform pointer-events-none w-full h-full z-10"
      >
        {thoughts.map((thought) => (
          <ThoughtNode
            key={thought.id}
            thought={thought}
            registerElement={registerElement}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            isDragging={isDragging(thought.id)}
          />
        ))}
      </div>
    </>
  );
};

export default World;
