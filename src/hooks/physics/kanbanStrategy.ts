import type { LayoutStrategist } from './types';
import { cardScaleForWidth } from './autoScale';

// Layout constants matching KanbanOverlay (must match CSS)
const SIDEBAR_WIDTH = 260;
const CARD_WIDTH = 280;
const CARD_SCALE = 0.78;
const CARD_GAP = 20;
const COL_PADDING = 24;

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
      kanbanColumnTop,
      kanbanColumnsCount
    } = context;
    
    // ─── Determine positioning group ─────────────────
    // kanbanCol >= 4 → extra columns; otherwise fall back to status
    const useKanbanCol = thought.kanbanCol !== undefined && thought.kanbanCol >= 4;
    let isSidebar: boolean;
    let colIdx: number; // 0-based index within the main grid (excluding sidebar)

    if (useKanbanCol) {
      // kanbanCol 0 = sidebar, 1 = todo, 2 = doing, 3 = done, 4+ = extra
      const kc = thought.kanbanCol!;
      isSidebar = kc === 0;
      colIdx = kc - 1; // Grid column index (0 = first main column)
    } else {
      const statusToCol: Record<string, { colIdx: number; isSidebar: boolean }> = {
        'none': { colIdx: -1, isSidebar: true },
        'todo': { colIdx: 0, isSidebar: false },
        'doing': { colIdx: 1, isSidebar: false },
        'done': { colIdx: 2, isSidebar: false }
      };
      const mapping = statusToCol[thought.status] ?? { colIdx: -1, isSidebar: true };
      isSidebar = mapping.isSidebar;
      colIdx = mapping.colIdx;
    }

    // ─── Filtering logic ─────────────────────────────
    const matchesSearch = !kanbanSearchQuery || 
      thought.text.toLowerCase().includes(kanbanSearchQuery.toLowerCase()) ||
      (thought.data?.type === 'text' ? thought.data.content : ((thought as any).content || '')).toLowerCase().includes(kanbanSearchQuery.toLowerCase());
    
    const matchesStack = !kanbanStackFilter || thought.stackId === kanbanStackFilter;
    const isArchived = thought.archivedAt && !context.showArchived;

    // ─── Get visible list for position calculation ───
    let allList: import('../../db').Thought[];
    if (useKanbanCol) {
      allList = context.columnMap?.get(`kanban-${thought.kanbanCol}`) || [];
    } else {
      allList = context.columnMap?.get(thought.status) || [];
    }
    const visibleList = allList.filter(t => !t.archivedAt || context.showArchived);
    const indexInCol = visibleList.findIndex(t => t.id === thought.id);
    
    const isNotInList = indexInCol === -1;
    const isFilteredOut = !matchesSearch || !matchesStack || isArchived || isNotInList;
    
    // ─── Common dimensions ───────────────────────────
    const sidebarPadding = isMobile ? 16 : 40;
    const sidebarCardX = sidebarPadding + (SIDEBAR_WIDTH - CARD_WIDTH * CARD_SCALE) / 2;
    
    if (isSidebar) {
      // ─── SIDEBAR: Unplanned ────────────────────────
      const currentScale = CARD_SCALE;
      const h = elementHeights.get(thought.id) || 120;
      
      let yOffset = 0;
      for (let i = 0; i < indexInCol; i++) {
        const prevT = visibleList[i];
        yOffset += ((elementHeights.get(prevT.id) || 120) * currentScale) + 20;
      }
      
      const targetY = (sidebarTop || 100) + 20 - (sidebarScrollTop || 0) + yOffset;
      
      return {
        targetX: sidebarCardX,
        targetY,
        targetScale: isFilteredOut ? 0 : currentScale,
        zIndex: '50',
        opacity: isFilteredOut ? 0 : 1,
        visibility: isFilteredOut ? 'hidden' : 'visible',
        pointerEvents: isFilteredOut ? 'none' : 'auto',
        clipPath: 'none',
        isSidebar: true,
        columnHeight: yOffset + (h * currentScale) + 20
      };
    } else {
      // ─── MAIN COLUMNS ──────────────────────────────
      const colGap = isMobile ? 16 : 20; // matches gap-4 / gap-5 on the flex overlay
      const colCount = kanbanColumnsCount ?? 3;
      
      // Actual width of the kanban-main flex child (sidebarPadding both sides, sidebar, 1 gap)
      const mainAreaWidth = logicalWidth - sidebarPadding * 2 - SIDEBAR_WIDTH - colGap;
      // The CSS grid inside kanban-main has an extra 44px track for the "+" button (non-readonly)
      const addColWidth = context.isReadOnly ? 0 : 44;
      const availableWidth = mainAreaWidth - addColWidth;
      const colWidth = availableWidth / (colCount || 1);
      
      // ─── Width-only auto-scale: shrink cards to fit column width ──
      // Cards overflow vertically → scrolling handles the rest (like calendar week view)
      const autoScale = cardScaleForWidth(CARD_WIDTH, colWidth);

      // ─── Y position within column ──────────────────
      let yOffset = 0;
      for (let i = 0; i < indexInCol; i++) {
        const prevT = visibleList[i];
        yOffset += ((elementHeights.get(prevT.id) || 120) * autoScale) + CARD_GAP * autoScale;
      }
      
      const targetY = (kanbanColumnTop || 272) + COL_PADDING - (kanbanColumnScrollTop || 0) + yOffset;
      // Center accounting for scaled card width (autoScale < 1 with origin-top-left)
      const scaledCardWidth = CARD_WIDTH * autoScale;
      const targetX = SIDEBAR_WIDTH + colGap + sidebarPadding + (colWidth * colIdx) + (colWidth - scaledCardWidth) / 2;
      
      const h = elementHeights.get(thought.id) || 120;
      const columnHeight = yOffset + (h * autoScale) + COL_PADDING;
      
      return {
        targetX,
        targetY,
        targetScale: isFilteredOut ? 0 : autoScale,
        zIndex: (30 + (thought.layer || 0)).toString(),
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
