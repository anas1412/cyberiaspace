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
  sidebarScrollTop: number;
  sidebarTop: number;
  isMobile: boolean;
  isReadOnly: boolean;
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
    elementHeights: Map<number, number>
  ) => LayoutResult;
  
  applyForces?: (
    id: number,
    p: PhysicsPoint,
    allStates: Map<number, PhysicsPoint>,
    thought: Thought,
    allThoughts: Thought[],
    context: LayoutContext,
    elementHeights: Map<number, number>
  ) => { vx: number; vy: number };
}
