import React from 'react';
import { useStore } from '../store/useStore';
import ThoughtNode from './ThoughtNode';

interface WorldProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  physicsResults: {
    registerElement: (id: string, el: HTMLDivElement | null) => void;
    registerWorld: (el: HTMLDivElement | null) => void;
    handleMouseDown: (id: string, e: React.MouseEvent) => void;
    handleTouchStart: (id: string, e: React.TouchEvent) => void;
    isDragging: (id: string) => boolean;
  };
}

const World: React.FC<WorldProps> = ({ canvasRef, physicsResults }) => {
  const thoughts = useStore((state) => state.thoughts);
  const { registerElement, registerWorld, handleMouseDown, handleTouchStart, isDragging } = physicsResults;

  React.useLayoutEffect(() => {
    const updateSize = () => {
      if (!canvasRef.current) return;
      canvasRef.current.width = window.innerWidth;
      canvasRef.current.height = window.innerHeight;
    };
    window.addEventListener('resize', updateSize);
    updateSize();
    return () => window.removeEventListener('resize', updateSize);
  }, [canvasRef]);

  return (
    <>
      <canvas
        ref={canvasRef}
        id="connection-canvas"
        className="absolute inset-0 pointer-events-none z-0"
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

