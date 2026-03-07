import type { LayoutStrategist } from './types';

export const kanbanStrategy: LayoutStrategist = {
  name: 'kanban',
  
  calculateLayout: (thought, _allThoughts, context, elementHeights) => {
    const { logicalWidth, isMobile, kanbanSearchQuery, kanbanStackFilter } = context;
    const colWidth = logicalWidth / 4;
    const statuses: ('none' | 'todo' | 'doing' | 'done')[] = ['none', 'todo', 'doing', 'done'];
    const colIdx = statuses.indexOf(thought.status);
    
    // Filtering logic
    const matchesSearch = !kanbanSearchQuery || 
      thought.text.toLowerCase().includes(kanbanSearchQuery.toLowerCase()) ||
      (thought.data?.type === 'text' ? thought.data.content : ((thought as any).content || '')).toLowerCase().includes(kanbanSearchQuery.toLowerCase());
    
    const matchesStack = !kanbanStackFilter || thought.stackId === kanbanStackFilter;
    const isFilteredOut = !matchesSearch || !matchesStack;

    const list = context.columnMap?.get(thought.status) || [];
    
    const indexInCol = list.findIndex(t => t.id === thought.id);
    
    // Calculate cumulative Y precisely like the reference, but only for visible items
    let currentY = 320;
    if (!isFilteredOut) {
      for (let i = 0; i < indexInCol; i++) {
        const h = elementHeights.get(list[i].id) || 120;
        currentY += h + 24;
      }
    }
    
    const height = elementHeights.get(thought.id) || 120;
    const targetY = isFilteredOut ? 320 : currentY;
    const targetX = (colWidth * colIdx) + (colWidth - 280) / 2;

    // Fading Logic from reference
    const headerBottom = isMobile ? 210 : 240;
    const nodeScreenY = targetY; // Since world transform is {x:0, y:vT.y, scale:1}
    const cardBottom = nodeScreenY + height;
    
    let opacity = Math.max(0, Math.min(1, (cardBottom - headerBottom) / 60));
    if (isFilteredOut) opacity = 0;

    return {
      targetX,
      targetY,
      targetScale: isFilteredOut ? 0 : 1,
      zIndex: (20 + (thought.layer || 0)).toString(),
      opacity,
      visibility: opacity === 0 ? 'hidden' : 'visible',
      pointerEvents: (opacity < 0.1 || isFilteredOut) ? 'none' : 'auto',
      clipPath: 'none',
      columnHeight: isFilteredOut ? 0 : currentY + height + 24
    };
  }
};
