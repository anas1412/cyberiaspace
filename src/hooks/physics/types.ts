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
  calendarStatusFilter: 'none' | 'todo' | 'doing' | 'done' | null;
  kanbanSearchQuery: string;
  kanbanStackFilter: string | null;
  kanbanStatusFilter: 'none' | 'todo' | 'doing' | 'done' | null;
  kanbanDateFilter: string | null;
  spatialSearchQuery: string;
  spatialStackFilter: string | null;
  spatialStatusFilter: 'none' | 'todo' | 'doing' | 'done' | null;
  spatialDateFilter: string | null;
  showArchived?: boolean;
  visibleIds?: Set<string>;
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
  // Physics configuration (dynamic, from store)
  physicsConfig?: {
    intensity: number;       // 0 = frozen, 0.5 = default, 1.0 = high energy
    repulsion: number;       // base repulsion force
    attraction: number;      // stack attraction strength
    gravityX: number;        // horizontal gravity
    gravityY: number;        // vertical gravity
    comfortZone: number;     // distance before attraction kicks in
    damping: number;         // velocity decay per frame
    maxVelocity: number;     // velocity cap
  };
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
