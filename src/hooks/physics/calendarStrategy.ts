import type { LayoutStrategist } from './types';

export const calendarStrategy: LayoutStrategist = {
  name: 'calendar',
  
  calculateLayout: (thought, allThoughts, context, elementHeights) => {
    const { logicalWidth, logicalHeight, calendarViewDate, hoveredCalDate, sidebarScrollTop } = context;
    
    const sidebarWidth = 260;
    const gap = 20;
    const padding = 40;
    const topPadding = 190;
    const mainLeft = padding + sidebarWidth + gap;
    const mainWidth = logicalWidth - mainLeft - padding;
    const cellWidth = mainWidth / 7;
    const cellHeight = (logicalHeight - topPadding - 120) / 5;

    if (thought.date) {
      const year = calendarViewDate.getFullYear();
      const month = calendarViewDate.getMonth();
      const firstDay = new Date(year, month, 1).getDay() || 7;
      
      const tDate = new Date(thought.date + 'T00:00:00');
      if (tDate.getFullYear() === year && tDate.getMonth() === month) {
        const day = tDate.getDate();
        const startOffset = firstDay - 1;
        const cellIndex = startOffset + (day - 1);
        const col = cellIndex % 7;
        const row = Math.floor(cellIndex / 7);

        const cellX = mainLeft + col * cellWidth;
        const cellY = topPadding + row * cellHeight;

        const isHovered = hoveredCalDate === thought.date;
        
        const dateThoughts = allThoughts
          .filter(t => t.date === thought.date)
          .sort((a, b) => (a.layer || 0) - (b.layer || 0));
        
        const count = dateThoughts.length;
        const index = dateThoughts.findIndex(t => t.id === thought.id);
        const isTopCard = index === count - 1;

        // Scaling & Spacing Math: Use more of the cell area
        const widthScale = (cellWidth - 12) / 280;
        const heightScale = (cellHeight - 20) / 150; 
        const uniformScale = Math.min(widthScale, heightScale, 0.85);

        let hSpread = isHovered ? 25 : 12;
        let vSpread = isHovered ? 70 : 35;

        if (count > 1) {
          hSpread = Math.min(hSpread, (cellWidth * 0.5) / (count - 1));
          vSpread = Math.min(vSpread, (cellHeight * 0.5) / (count - 1));
        }

        const targetScale = isHovered ? uniformScale * 1.05 : uniformScale;
        const h = elementHeights.get(thought.id) || 120;
        
        const targetX = cellX + 6 + (index * hSpread) + (280 * targetScale) / 2;
        const targetY = cellY + 4 + (index * vSpread) + (h * targetScale) / 2;

        return {
          targetX,
          targetY,
          targetScale,
          zIndex: (30 + (thought.layer || 0)).toString(),
          clipPath: (isHovered || isTopCard) ? 'none' : 'inset(0px 0px calc(100% - 70px) 0px)',
          rotation: (thought.layer || 0) % 2 === 0 ? 0.8 : -0.8,
          opacity: 1,
          visibility: 'visible',
          pointerEvents: 'auto'
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
        .sort((a, b) => a.order - b.order);
      
      const index = unscheduled.findIndex(t => t.id === thought.id);
      
      const h = elementHeights.get(thought.id) || 120;
      const heightAtScale = h * 0.8;
      
      // Sum previous heights in sidebar
      let yOffset = 0;
      for (let i = 0; i < index; i++) {
        const prevH = elementHeights.get(unscheduled[i].id) || 120;
        yOffset += (prevH * 0.8) + 20;
      }

      const targetY = 200 - sidebarScrollTop + yOffset + heightAtScale / 2;

      return {
        targetX: padding + sidebarWidth / 2,
        targetY,
        targetScale: 0.8,
        zIndex: '35',
        opacity: 1,
        visibility: 'visible',
        pointerEvents: 'auto',
        isSidebar: true,
        columnHeight: yOffset + heightAtScale + 20
      };
    }
  }
};
