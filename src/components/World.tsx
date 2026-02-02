import React, { useRef, useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { usePhysics } from '../hooks/usePhysics';
import ThoughtNode from './ThoughtNode';

interface WorldProps {
  transform: { x: number; y: number; scale: number };
}

const World: React.FC<WorldProps> = ({ transform }) => {
  const thoughts = useStore((state) => state.thoughts);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { registerElement, handleMouseDown, isDragging } = usePhysics(canvasRef, transform);
  
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });

  useEffect(() => {
    const handleResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
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
        className="absolute origin-top-left will-change-transform pointer-events-none w-full h-full z-10"
        style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})` }}
      >
        {thoughts.map((thought) => (
          <ThoughtNode
            key={thought.id}
            thought={thought}
            registerElement={registerElement}
            onMouseDown={handleMouseDown}
            isDragging={isDragging(thought.id)}
          />
        ))}
      </div>
    </>
  );
};

export default World;
