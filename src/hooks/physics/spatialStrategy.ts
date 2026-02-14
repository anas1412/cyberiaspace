import type { Thought } from '../../db';
import type { LayoutStrategist, LayoutResult, PhysicsPoint, LayoutContext } from './types';

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
  
  calculateLayout: (thought: Thought): LayoutResult => {
    const prioLevel = PRIORITY_WEIGHT[thought.priority] || 0;
    const targetScale = (1 + prioLevel * 0.05) * (thought.size || 1);
    
    return {
      targetX: thought.x,
      targetY: thought.y,
      targetScale,
      zIndex: (20 + (thought.layer || 0)).toString(),
      opacity: 1,
      visibility: 'visible',
      pointerEvents: 'auto',
      clipPath: 'none'
    };
  },

  applyForces: (id, p, allStates, thought, allThoughts, context) => {
    let dvx = 0;
    let dvy = 0;

    const prioLevel = PRIORITY_WEIGHT[thought.priority] || 0;
    const gravityMultiplier = 1 + prioLevel * 0.5;
    
    // Gravity toward center
    dvx += (context.logicalWidth / 2 - p.x) * (GRAVITY * gravityMultiplier);
    dvy += (context.logicalHeight / 2 - p.y) * (GRAVITY * gravityMultiplier);

    allStates.forEach((otherP, otherId) => {
      if (id === otherId) return;
      
      const otherT = allThoughts.find(t => t.id === otherId);
      if (!otherT) return;

      const dx = p.x - otherP.x;
      const dy = p.y - otherP.y;
      const distSq = dx * dx + dy * dy || 1;
      const d = Math.sqrt(distSq);

      // Repulsion
      const nHeight = 120; // Baseline
      const nRadius = Math.max(120, (nHeight / 2) * p.scale);
      const otherRadius = Math.max(120, (nHeight / 2) * otherP.scale);
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
