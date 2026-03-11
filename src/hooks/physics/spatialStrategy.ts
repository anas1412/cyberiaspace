import type { Thought } from '../../db';
import type { LayoutStrategist, LayoutResult, LayoutContext } from './types';

const REPULSION = 80000;
const ATTRACTION = 0.01;
const GRAVITY = 0.003;
const COMFORT_ZONE = 200;

const PRIORITY_WEIGHT = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
  none: 0
};

export const spatialStrategy: LayoutStrategist = {
  name: 'spatial',
  
  calculateLayout: (thought: Thought, _allThoughts: Thought[], _context: LayoutContext, elementHeights: Map<string, number>): LayoutResult => {
    const prioLevel = PRIORITY_WEIGHT[thought.priority] || 0;
    const targetScale = (1 + prioLevel * 0.05) * (thought.size || 1);
    
    return {
      targetX: thought.x - 140,
      targetY: thought.y - (elementHeights.get(thought.id) || 120) / 2,
      targetScale,
      zIndex: (20 + (thought.layer || 0)).toString(),
      opacity: 1,
      visibility: 'visible',
      pointerEvents: 'auto',
      clipPath: 'none'
    };
  },

  applyForces: (id, p, allStates, thought, _allThoughts, context, elementHeights) => {
    let dvx = 0;
    let dvy = 0;

    const prioLevel = PRIORITY_WEIGHT[thought.priority] || 0;
    const gravityMultiplier = 1 + prioLevel * 0.5;
    
    // Gravity toward a fixed stable center in world coordinates
    const centerX = p.x + 140;
    const centerY = p.y + (elementHeights.get(id) || 120) / 2;
    
    // Lock gravity to the center of the coordinate system, independent of pan/zoom
    const targetX = context.logicalWidth / 2;
    const targetY = context.logicalHeight / 2;
    
    dvx += (targetX - centerX) * (GRAVITY * gravityMultiplier);
    dvy += (targetY - centerY) * (GRAVITY * gravityMultiplier);

    allStates.forEach((otherP, otherId) => {
      if (id === otherId) return;
      
      const otherT = context.thoughtMap.get(otherId);
      if (!otherT) return;

      const centerA = { x: p.x + 140, y: p.y + (elementHeights.get(id) || 120) / 2 };
      const centerB = { x: otherP.x + 140, y: otherP.y + (elementHeights.get(otherId) || 120) / 2 };
      const dx = centerA.x - centerB.x;
      const dy = centerA.y - centerB.y;
      const distSq = dx * dx + dy * dy || 1;
      const d = Math.sqrt(distSq);

      // Repulsion using actual element heights
      const nHeight = elementHeights.get(id) || 120;
      const nRadius = Math.max(120, (nHeight / 2) * p.scale);
      const otherHeight = elementHeights.get(otherId) || 120;
      const otherRadius = Math.max(120, (otherHeight / 2) * otherP.scale);
      const minDistance = nRadius + otherRadius;

      const otherPrio = PRIORITY_WEIGHT[otherT.priority] || 0;
      const combinedPrio = prioLevel + otherPrio;
      const repulsionMultiplier = 1 + combinedPrio * 0.1;

      if (d < minDistance) {
        const force = ((minDistance - d) / minDistance) * 12;
        dvx += (dx / d) * force;
        dvy += (dy / d) * force;
      } else {
        const force = Math.min((REPULSION * repulsionMultiplier) / distSq, 8);
        dvx += (dx / d) * force;
        dvy += (dy / d) * force;
      }

      // Stack Attraction
      if (thought.stackId && thought.stackId === otherT.stackId) {
        if (d > COMFORT_ZONE) {
          const pull = (d - COMFORT_ZONE) * ATTRACTION;
          dvx -= (dx / d) * pull;
          dvy -= (dy / d) * pull;
        }
      }
    });

    return { vx: dvx, vy: dvy };
  }
};
