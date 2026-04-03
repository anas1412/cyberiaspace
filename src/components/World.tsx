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
  const showArchived = useStore((state) => state.showArchived);
  const { registerElement, registerWorld, handleMouseDown, handleTouchStart, isDragging } = physicsResults;

  React.useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          // Senior Practice: Scale canvas resolution to match container exactly
          // We use a small 1.2x buffer if we detect we're in a highly scaled environment
          const buffer = 1.2;
          canvas.width = Math.ceil(width * buffer);
          canvas.height = Math.ceil(height * buffer);
        }
      }
    });

    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }

    return () => resizeObserver.disconnect();
  }, [canvasRef]);

  return (
    <>
      <canvas
        ref={canvasRef}
        id="connection-canvas"
        className="absolute pointer-events-none z-0"
        style={{
          left: '-10%',
          top: '-10%',
          width: '120%',
          height: '120%'
        }}
      />
      <div
        id="world"
        ref={registerWorld}
        className="absolute origin-top-left will-change-transform pointer-events-none w-full h-full z-10"
      >
        {thoughts.map((thought) => {
          const isArchived = !!thought.archivedAt && !showArchived;
          return (
            <ThoughtNode
              key={thought.id}
              thought={thought}
              registerElement={registerElement}
              onMouseDown={handleMouseDown}
              onTouchStart={handleTouchStart}
              isDragging={isDragging(thought.id)}
              isArchived={isArchived}
            />
          );
        })}
      </div>
    </>
  );
};

export default World;

