import type { LayoutStrategist } from './types';

// Layout constants matching KanbanOverlay (must match CSS)
const SIDEBAR_WIDTH = 260;
const CARD_WIDTH = 280;
const CARD_SCALE = 0.78; // Same as calendar sidebar

export const kanbanStrategy: LayoutStrategist = {
  name: 'kanban',
  
  calculateLayout: (thought, _allThoughts, context, elementHeights) => {
    const { 
      logicalWidth, 
      isMobile, 
      kanbanSearchQuery, 
      kanbanStackFilter,
      sidebarScrollTop,
      sidebarTop,
      kanbanColumnScrollTop,
      kanbanColumnTop
    } = context;
    
    // Status to column mapping
    // Sidebar: 'none' (Unplanned)
    // Main columns: 'todo', 'doing', 'done'
    const statusToCol: Record<string, { colIdx: number; isSidebar: boolean }> = {
      'none': { colIdx: -1, isSidebar: true },
      'todo': { colIdx: 0, isSidebar: false },
      'doing': { colIdx: 1, isSidebar: false },
      'done': { colIdx: 2, isSidebar: false }
    };
    
    const mapping = statusToCol[thought.status] ?? { colIdx: -1, isSidebar: true };
    const { colIdx, isSidebar } = mapping;
    
    // Filtering logic
    const matchesSearch = !kanbanSearchQuery || 
      thought.text.toLowerCase().includes(kanbanSearchQuery.toLowerCase()) ||
      (thought.data?.type === 'text' ? thought.data.content : ((thought as any).content || '')).toLowerCase().includes(kanbanSearchQuery.toLowerCase());
    
    const matchesStack = !kanbanStackFilter || thought.stackId === kanbanStackFilter;
    // Hide archived thoughts unless showArchived is true
    const isArchived = thought.archivedAt && !context.showArchived;

    // Get visible list only (for position calculation)
    const allList = context.columnMap?.get(thought.status) || [];
    const visibleList = allList.filter(t => !t.archivedAt || context.showArchived);
    const indexInCol = visibleList.findIndex(t => t.id === thought.id);
    
    // indexInCol === -1 means thought was excluded by a pre-processor filter
    // (status, date, etc.) that the strategist doesn't individually check
    const isNotInList = indexInCol === -1;
    const isFilteredOut = !matchesSearch || !matchesStack || isArchived || isNotInList;
    
    // Common dimensions
    const sidebarPadding = isMobile ? 16 : 40;
    const sidebarCardX = sidebarPadding + (SIDEBAR_WIDTH - CARD_WIDTH * CARD_SCALE) / 2;
    
    if (isSidebar) {
      // === SIDEBAR: Unplanned/Unscheduled - same as Calendar unscheduled ===
      const unscheduled = visibleList;
      const currentScale = CARD_SCALE;
      const h = elementHeights.get(thought.id) || 120;
      
      // Sum previous heights in sidebar (same as calendar)
      let yOffset = 0;
      for (let i = 0; i < indexInCol; i++) {
        const prevT = unscheduled[i];
        yOffset += ((elementHeights.get(prevT.id) || 120) * currentScale) + 20;
      }
      
      const targetY = (sidebarTop || 100) + 20 - (sidebarScrollTop || 0) + yOffset;
      
      return {
        targetX: sidebarCardX,
        targetY,
        targetScale: isFilteredOut ? 0 : currentScale,
        zIndex: '50', // High z-index to be above overlay
        opacity: isFilteredOut ? 0 : 1,
        visibility: isFilteredOut ? 'hidden' : 'visible',
        pointerEvents: isFilteredOut ? 'none' : 'auto',
        clipPath: 'none',
        isSidebar: true,
        columnHeight: yOffset + (h * currentScale) + 20
      };
    } else {
      // === MAIN COLUMNS: To Do, Doing, Done - like Calendar cells ===
      const headerHeight = isMobile ? 170 : 212; // Filter bar + main header
      const colHeaderHeight = isMobile ? 50 : 60;
      const colGap = 20;
      
      // Calculate column width based on available space
      const availableWidth = logicalWidth - SIDEBAR_WIDTH - colGap * 2 - sidebarPadding * 2;
      const colWidth = availableWidth / 3;
      
      // Column content area
      const colContentStartY = headerHeight + colHeaderHeight;
      
      // Calculate Y position within column
      let yOffset = 0;
      for (let i = 0; i < indexInCol; i++) {
        const prevT = visibleList[i];
        yOffset += ((elementHeights.get(prevT.id) || 120)) + 20; // Full height + gap
      }
      
      const targetY = (kanbanColumnTop || colContentStartY) + 24 - (kanbanColumnScrollTop || 0) + yOffset;
      const targetX = SIDEBAR_WIDTH + colGap + sidebarPadding + (colWidth * colIdx) + (colWidth - CARD_WIDTH) / 2;
      
      // Track column height for spacer
      const h = elementHeights.get(thought.id) || 120;
      const columnHeight = yOffset + h + 24;
      
      return {
        targetX,
        targetY,
        targetScale: isFilteredOut ? 0 : 1,
        zIndex: (30 + (thought.layer || 0)).toString(), // Match calendar grid z-index
        opacity: isFilteredOut ? 0 : 1,
        visibility: isFilteredOut ? 'hidden' : 'visible',
        pointerEvents: isFilteredOut ? 'none' : 'auto',
        clipPath: 'none',
        isSidebar: false,
        columnHeight
      };
    }
  }
};
