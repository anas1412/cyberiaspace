import type { LayoutStrategist } from './types';

export const calendarStrategy: LayoutStrategist = {
  name: 'calendar',
  
  calculateLayout: (thought, allThoughts, context, elementHeights) => {
    const { logicalWidth, logicalHeight, hoveredCalDate, sidebarScrollTop, sidebarTop, calendarSearchQuery, calendarStackFilter, isMobile } = context;
    
    const compactClip = 'inset(0px 0px calc(100% - 70px) 0px round 32px)';
    
    // Filtering logic
    const matchesSearch = !calendarSearchQuery || 
      thought.text.toLowerCase().includes(calendarSearchQuery.toLowerCase()) ||
      thought.content.toLowerCase().includes(calendarSearchQuery.toLowerCase());
    
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
        const dateThoughts = allThoughts
          .filter(t => t.date === thought.date)
          .filter(t => {
            const mS = !calendarSearchQuery || t.text.toLowerCase().includes(calendarSearchQuery.toLowerCase()) || t.content.toLowerCase().includes(calendarSearchQuery.toLowerCase());
            const mStack = !calendarStackFilter || t.stackId === calendarStackFilter;
            return mS && mStack;
          })
          .sort((a, b) => (a.layer || 0) - (b.layer || 0));
        
        const count = dateThoughts.length;
        const index = dateThoughts.findIndex(t => t.id === thought.id);
        const isTopCard = index === count - 1;

        const uniformScale = Math.min((cellWidth - 12) / 280, (cellHeight - 32) / 70, 0.85);
        const targetScale = isFilteredOut ? 0 : (isHovered ? uniformScale * 1.05 : uniformScale);
        
        const targetX = cellX + 12 + (index * 12);
        const targetY = cellY + 32 + (index * 35);

        return {
          targetX,
          targetY,
          targetScale,
          zIndex: (30 + (thought.layer || 0)).toString(),
          clipPath: (isHovered || isTopCard) ? 'none' : compactClip,
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
      const unscheduled = allThoughts
        .filter(t => !t.date)
        .filter(t => {
          const mS = !calendarSearchQuery || t.text.toLowerCase().includes(calendarSearchQuery.toLowerCase()) || t.content.toLowerCase().includes(calendarSearchQuery.toLowerCase());
          const mStack = !calendarStackFilter || t.stackId === calendarStackFilter;
          return mS && mStack;
        })
        .sort((a, b) => a.order - b.order);
      
      const index = unscheduled.findIndex(t => t.id === thought.id);
      const isSidebarHovered = hoveredCalDate === "";
      
      const currentScale = 0.78;
      const h = elementHeights.get(thought.id) || 120;
      
      // Sum previous heights in sidebar
      let yOffset = 0;
      for (let i = 0; i < index; i++) {
        const prevH = elementHeights.get(unscheduled[i].id) || 120;
        const prevIsExpanded = isSidebarHovered; // Simplified for now
        const visibleH = prevIsExpanded ? prevH : 70;
        yOffset += (visibleH * currentScale) + 20;
      }

      const targetY = sidebarTop + 20 - sidebarScrollTop + yOffset;

      const currentVisibleH = isSidebarHovered ? h : 70;

      return {
        targetX: padding + (sidebarWidth - 280 * 0.78) / 2,
        targetY,
        targetScale: isFilteredOut ? 0 : currentScale,
        zIndex: '50',
        opacity: isFilteredOut ? 0 : 1,
        visibility: isFilteredOut ? 'hidden' : 'visible',
        pointerEvents: isFilteredOut ? 'none' : 'auto',
        clipPath: isSidebarHovered ? 'none' : compactClip,
        isSidebar: true,
        columnHeight: yOffset + (currentVisibleH * currentScale) + 20
      };
    }
  }
};
