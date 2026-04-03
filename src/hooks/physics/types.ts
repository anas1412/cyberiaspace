import type { Thought } from '../../db';

export interface PhysicsPoint {
  x: number;
  y: number;
  vx: number;
  vy: number;
  scale: number;
}

export interface LayoutContext {
  logicalWidth: number;
  logicalHeight: number;
  globalScale: number;
  calendarViewDate: Date;
  hoveredCalDate: string | null;
  calendarSearchQuery: string;
  calendarStackFilter: string | null;
  kanbanSearchQuery: string;
  kanbanStackFilter: string | null;
  kanbanY: number;
  sidebarScrollTop: number;
  sidebarTop: number;
  isMobile: boolean;
  isReadOnly: boolean;
  isDemo?: boolean;
  timeScale: number;
  transform: { x: number; y: number; scale: number };
  calendarCellMap?: Map<string, { x: number; y: number; w: number; h: number }>;
  thoughtMap: Map<string, Thought>;
  columnMap?: Map<string, Thought[]>;
  dateMap?: Map<string, Thought[]>;
  // Kanban-specific
  kanbanSidebarWidth?: number;
  kanbanGap?: number;
  kanbanPadding?: number;
  kanbanColumnScrollTop?: number;
  kanbanColumnTop?: number;
}


export interface LayoutResult {
  targetX: number;
  targetY: number;
  targetScale: number;
  zIndex?: string;
  clipPath?: string;
  opacity?: number;
  visibility?: 'visible' | 'hidden';
  pointerEvents?: 'auto' | 'none';
  rotation?: number;
  // Metadata for the orchestrator
  isSidebar?: boolean;
  columnHeight?: number; 
}

export interface LayoutStrategist {
  name: string;
  calculateLayout: (
    thought: Thought,
    allThoughts: Thought[],
    context: LayoutContext,
    elementHeights: Map<string, number>
  ) => LayoutResult;
  
  applyForces?: (
    id: string,
    p: PhysicsPoint,
    allStates: Map<string, PhysicsPoint>,
    thought: Thought,
    allThoughts: Thought[],
    context: LayoutContext,
    elementHeights: Map<string, number>
  ) => { vx: number; vy: number };
}
