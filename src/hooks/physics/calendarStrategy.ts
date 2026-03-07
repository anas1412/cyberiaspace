import type { LayoutStrategist } from './types';

export const calendarStrategy: LayoutStrategist = {
  name: 'calendar',
  
  calculateLayout: (thought, _allThoughts, context, elementHeights) => {
    const H_STACK = 62;
    const H_PLAIN = 46;
    const COMPACT_GAP = 8;
    const { logicalWidth, logicalHeight, hoveredCalDate, sidebarScrollTop, sidebarTop, calendarSearchQuery, calendarStackFilter, isMobile } = context;
    
    // Filtering logic
    const matchesSearch = !calendarSearchQuery || 
      thought.text.toLowerCase().includes(calendarSearchQuery.toLowerCase()) ||
      (thought.data?.type === 'text' ? thought.data.content : ((thought as any).content || '')).toLowerCase().includes(calendarSearchQuery.toLowerCase());
    
    const matchesStack = !calendarStackFilter || thought.stackId === calendarStackFilter;
    const isFilteredOut = !matchesSearch || !matchesStack;
 
    const sidebarWidth = 260;
    const padding = isMobile ? 16 : 40;

    if (thought.date) {
      const cell = context.calendarCellMap?.get(thought.date);
      if (cell) {
        const cellX = cell.x;
        const cellY = cell.y;
        const cellWidth = cell.w;
        const cellHeight = cell.h;

        const isHovered = hoveredCalDate === thought.date;
        const dateThoughts = context.dateMap?.get(thought.date) || [];
        
        const count = dateThoughts.length;
        const index = dateThoughts.findIndex(t => t.id === thought.id);
        const isTopCard = index === count - 1;

        const currentCompactH = thought.stackId ? H_STACK : H_PLAIN;
        const dynamicClip = 'inset(0px 0px calc(100% - ' + currentCompactH + 'px) 0px round 32px)';

        const uniformScale = Math.min((cellWidth - 12) / 280, (cellHeight - 12) / currentCompactH, 0.85);
        const targetScale = isFilteredOut ? 0 : (isHovered ? uniformScale * 1.05 : uniformScale);
        
        const verticalStep = isHovered ? 45 : 10;
        const horizontalStep = isHovered ? 12 : 0; // ZERO horizontal shift in compact mode to stop leakage
        const cardWidth = 280 * targetScale;
        const targetX = cellX + (cellWidth - cardWidth) / 2 + (index * horizontalStep);
        const targetY = cellY + 20 + (index * verticalStep);

        return {
          targetX,
          targetY,
          targetScale,
          zIndex: (30 + (thought.layer || 0)).toString(),
          clipPath: (isHovered || isTopCard) ? 'none' : dynamicClip,
          rotation: (thought.layer || 0) % 2 === 0 ? 0.8 : -0.8,
          opacity: isFilteredOut ? 0 : 1,
          visibility: isFilteredOut ? 'hidden' : 'visible',
          pointerEvents: isFilteredOut ? 'none' : 'auto'
        };
      } else {
        // Hide thoughts from other months
        return {
          targetX: logicalWidth / 2,
          targetY: logicalHeight + 500,
          targetScale: 0,
          opacity: 0,
          visibility: 'hidden',
          pointerEvents: 'none'
        };
      }
    } else {
      // Unscheduled - Sidebar Logic
      const unscheduled = context.dateMap?.get("") || [];
      const index = unscheduled.findIndex(t => t.id === thought.id);
      const isSidebarHovered = hoveredCalDate === "";
      
      const currentScale = 0.78;
      const h = elementHeights.get(thought.id) || 120;
      
      const currentCompactH = thought.stackId ? H_STACK : H_PLAIN;
      const dynamicClip = 'inset(0px 0px calc(100% - ' + currentCompactH + 'px) 0px round 32px)';
      
      // Sum previous heights in sidebar
      let yOffset = 0;
      for (let i = 0; i < index; i++) {
        const prevT = unscheduled[i];
        const hForCalc = isSidebarHovered ? (elementHeights.get(prevT.id) || 120) : (prevT.stackId ? H_STACK : H_PLAIN);
        const gapForCalc = isSidebarHovered ? 20 : COMPACT_GAP;
        yOffset += (hForCalc * currentScale) + gapForCalc;
      }

      const currentVisibleH = isSidebarHovered ? h : (thought.stackId ? H_STACK : H_PLAIN);
      const finalGap = isSidebarHovered ? 20 : COMPACT_GAP;
      const targetY = sidebarTop + 20 - sidebarScrollTop + yOffset;

      return {
        targetX: padding + (sidebarWidth - 280 * 0.78) / 2,
        targetY,
        targetScale: isFilteredOut ? 0 : currentScale,
        zIndex: '50',
        opacity: isFilteredOut ? 0 : 1,
        visibility: isFilteredOut ? 'hidden' : 'visible',
        pointerEvents: isFilteredOut ? 'none' : 'auto',
        clipPath: isSidebarHovered ? 'none' : dynamicClip,
        isSidebar: true,
        columnHeight: yOffset + (currentVisibleH * currentScale) + finalGap
      };
    }

  }
};
