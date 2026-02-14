import type { LayoutStrategist } from './types';

export const kanbanStrategy: LayoutStrategist = {
  name: 'kanban',
  
  calculateLayout: (thought, allThoughts, context, elementHeights) => {
    const { logicalWidth, isMobile } = context;
    const colWidth = logicalWidth / 4;
    const statuses: ('none' | 'todo' | 'doing' | 'done')[] = ['none', 'todo', 'doing', 'done'];
    const colIdx = statuses.indexOf(thought.status);
    
    const list = allThoughts
      .filter(t => t.status === thought.status)
      .sort((a, b) => a.order - b.order);
    
    const indexInCol = list.findIndex(t => t.id === thought.id);
    
    // Calculate cumulative Y precisely like the reference
    let currentY = 280;
    for (let i = 0; i < indexInCol; i++) {
      const h = elementHeights.get(list[i].id) || 120;
      currentY += h + 24;
    }
    
    const height = elementHeights.get(thought.id) || 120;
    const targetY = currentY + height / 2;
    const targetX = (colWidth * colIdx) + (colWidth / 2);

    // Fading Logic from reference
    const headerBottom = isMobile ? 170 : 200;
    const nodeScreenY = targetY; // Since camera is 0,0 in modular structured modes
    const cardBottom = nodeScreenY + (height / 2);
    const opacity = Math.max(0, Math.min(1, (cardBottom - headerBottom) / 60));

    return {
      targetX,
      targetY,
      targetScale: 1,
      zIndex: (20 + (thought.layer || 0)).toString(),
      opacity,
      visibility: opacity === 0 ? 'hidden' : 'visible',
      pointerEvents: opacity < 0.1 ? 'none' : 'auto',
      clipPath: 'none',
      columnHeight: currentY + height + 24
    };
  }
};
