import { sanitizeDate } from '../../utils/date';
import type { LayoutResult, LayoutStrategist } from './types';
import { cardScaleForWidth } from './autoScale';

/**
 * Positions thoughts:
 * - Month: compact grid cells with clip-path
 * - Week: kanban-style vertical stacking per day column
 * - Agenda: off-screen (React overlay handles it)
 */
export const calendarStrategy: LayoutStrategist = {
  name: 'calendar',
  
  calculateLayout: (thought, _allThoughts, context, elementHeights) => {
    const { logicalWidth, logicalHeight, calendarViewMode } = context;

    // Agenda view: React overlay handles positioning — push off-screen
    if (calendarViewMode === 'agenda') {
      return {
        targetX: logicalWidth / 2,
        targetY: logicalHeight + 1000,
        targetScale: 0,
        opacity: 0,
        visibility: 'hidden',
        pointerEvents: 'none'
      };
    }

    if (calendarViewMode === 'week') {
      return calculateWeekLayout(thought, context, elementHeights, logicalWidth, logicalHeight);
    }

    // Month view: compact grid-cell layout
    return calculateMonthLayout(thought, context, elementHeights, logicalWidth, logicalHeight);
  }
};

function calculateWeekLayout(
  thought: import('../../db').Thought,
  context: import('./types').LayoutContext,
  elementHeights: Map<string, number>,
  logicalWidth: number,
  logicalHeight: number
): LayoutResult {
  const { calendarSearchQuery, calendarStackFilter } = context;

  // Filtering logic
  const matchesSearch = !calendarSearchQuery || 
    thought.text.toLowerCase().includes(calendarSearchQuery.toLowerCase()) ||
    (thought.data?.type === 'text' ? thought.data.content : ((thought as any).content || '')).toLowerCase().includes(calendarSearchQuery.toLowerCase());
  const matchesStack = !calendarStackFilter || thought.stackId === calendarStackFilter;
  const isArchived = thought.archivedAt && !context.showArchived;
  const isFilteredOut = !matchesSearch || !matchesStack || isArchived;

  const sidebarWidth = 260;

  const dateStr = sanitizeDate(thought.startTime);

  if (dateStr) {
    // Day column — kanban-style vertical stacking
    const allDateThoughts = context.dateMap?.get(dateStr) || [];
    const visibleDateThoughts = allDateThoughts.filter(t => !t.archivedAt || context.showArchived);
    const index = visibleDateThoughts.findIndex(t => t.id === thought.id);
    const isNotInList = index === -1;

    const headerHeight = 62; // "Mon\n12" header in each column

    // Column cell rect for position reference
    const cell = context.calendarCellMap?.get(dateStr);
    if (!cell) {
      return {
        targetX: logicalWidth / 2,
        targetY: logicalHeight + 500,
        targetScale: 0,
        opacity: 0,
        visibility: 'hidden',
        pointerEvents: 'none'
      };
    }

    // Kanban-style vertical stacking — width-only auto-scale + scroll
    const colScroll = context.calendarWeekScrollTop || 0;

    // Width-only auto-scale: shrink cards to fit day cell width
    const wScale = cardScaleForWidth(280, cell.w);
    const weekScale = Math.min(wScale, 1);

    let yOffset = 0;
    for (let i = 0; i < index; i++) {
      const prevT = visibleDateThoughts[i];
      yOffset += ((elementHeights.get(prevT.id) || 120) * weekScale) + 20 * weekScale;
    }

    const targetY = cell.y + headerHeight - colScroll + yOffset + 16;
    const cardWidth = 280 * weekScale;
    const targetX = cell.x + (cell.w - cardWidth) / 2;
    const h = elementHeights.get(thought.id) || 120;

    return {
      targetX,
      targetY,
      targetScale: isFilteredOut || isNotInList ? 0 : weekScale,
      zIndex: (30 + (thought.layer || 0)).toString(),
      opacity: isFilteredOut || isNotInList ? 0 : 1,
      visibility: isFilteredOut || isNotInList ? 'hidden' : 'visible',
      pointerEvents: isFilteredOut || isNotInList ? 'none' : 'auto',
      clipPath: 'none',
      columnHeight: yOffset + (h * weekScale) + 20 + 16 // scaled card heights + gaps + padding
    };
  } else {
    // Unscheduled — Sidebar (same as month)
    return calculateSidebarLayout(thought, context, elementHeights, sidebarWidth, 40, logicalWidth, logicalHeight);
  }
}

function calculateMonthLayout(
  thought: import('../../db').Thought,
  context: import('./types').LayoutContext,
  elementHeights: Map<string, number>,
  logicalWidth: number,
  logicalHeight: number
): LayoutResult {
  const H_STACK = 62;
  const H_PLAIN = 46;
  const { hoveredCalDate, calendarSearchQuery, calendarStackFilter, isMobile } = context;
  
  const matchesSearch = !calendarSearchQuery || 
    thought.text.toLowerCase().includes(calendarSearchQuery.toLowerCase()) ||
    (thought.data?.type === 'text' ? thought.data.content : ((thought as any).content || '')).toLowerCase().includes(calendarSearchQuery.toLowerCase());
  const matchesStack = !calendarStackFilter || thought.stackId === calendarStackFilter;
  const isArchived = thought.archivedAt && !context.showArchived;
  const isFilteredOut = !matchesSearch || !matchesStack || isArchived;

  const sidebarWidth = 260;
  const padding = isMobile ? 16 : 40;
  const dateStr = sanitizeDate(thought.startTime);

  if (dateStr) {
    const cell = context.calendarCellMap?.get(dateStr);
    if (cell) {
      const cellX = cell.x;
      const cellY = cell.y;
      const cellWidth = cell.w;
      const cellHeight = cell.h;

      const isHovered = hoveredCalDate === dateStr;
      const allDateThoughts = context.dateMap?.get(dateStr) || [];
      const visibleDateThoughts = allDateThoughts.filter(t => !t.archivedAt || context.showArchived);
      
      const count = visibleDateThoughts.length;
      const index = visibleDateThoughts.findIndex(t => t.id === thought.id);
      const isTopCard = index === count - 1;

      const currentCompactH = thought.stackId ? H_STACK : H_PLAIN;
      const dynamicClip = 'inset(0px 0px calc(100% - ' + currentCompactH + 'px) 0px round 16px)';

      const uniformScale = Math.min((cellWidth - 12) / 280, (cellHeight - 12) / currentCompactH, 0.85);
      const targetScale = isFilteredOut ? 0 : (isHovered ? uniformScale * 1.05 : uniformScale);
      
      const verticalStep = isHovered ? 45 : 10;
      const horizontalStep = isHovered ? 12 : 0;
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
    return calculateSidebarLayout(thought, context, elementHeights, sidebarWidth, padding, logicalWidth, logicalHeight);
  }
}

function calculateSidebarLayout(
  thought: import('../../db').Thought,
  context: import('./types').LayoutContext,
  elementHeights: Map<string, number>,
  sidebarWidth: number,
  padding: number,
  _logicalWidth: number,
  _logicalHeight: number
): LayoutResult {
  const { sidebarScrollTop, sidebarTop, calendarSearchQuery, calendarStackFilter } = context;

  const matchesSearch = !calendarSearchQuery || 
    thought.text.toLowerCase().includes(calendarSearchQuery.toLowerCase()) ||
    (thought.data?.type === 'text' ? thought.data.content : ((thought as any).content || '')).toLowerCase().includes(calendarSearchQuery.toLowerCase());
  const matchesStack = !calendarStackFilter || thought.stackId === calendarStackFilter;
  const isArchived = thought.archivedAt && !context.showArchived;
  const isFilteredOut = !matchesSearch || !matchesStack || isArchived;

  const allUnscheduled = context.dateMap?.get("") || [];
  const visibleUnscheduled = allUnscheduled.filter(t => !t.archivedAt || context.showArchived);
  const index = visibleUnscheduled.findIndex(t => t.id === thought.id);
  const isNotInList = index === -1;
  
  const currentScale = 0.78;
  const h = elementHeights.get(thought.id) || 120;
  
  let yOffset = 0;
  for (let i = 0; i < index; i++) {
    const prevT = visibleUnscheduled[i];
    const hForCalc = elementHeights.get(prevT.id) || 120;
    yOffset += (hForCalc * currentScale) + 20;
  }

  return {
    targetX: padding + (sidebarWidth - 280 * 0.78) / 2,
    targetY: sidebarTop + 20 - sidebarScrollTop + yOffset,
    targetScale: isFilteredOut || isNotInList ? 0 : currentScale,
    zIndex: '50',
    opacity: isFilteredOut || isNotInList ? 0 : 1,
    visibility: isFilteredOut || isNotInList ? 'hidden' : 'visible',
    pointerEvents: isFilteredOut || isNotInList ? 'none' : 'auto',
    clipPath: 'none',
    isSidebar: true,
    columnHeight: yOffset + (h * currentScale) + 20
  };
}


