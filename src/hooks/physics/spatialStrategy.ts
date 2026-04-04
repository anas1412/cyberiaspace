import type { Thought } from '../../db';
import type { LayoutStrategist, LayoutResult, LayoutContext } from './types';

// Default physics constants (used when intensity = 0.5)
const DEFAULTS = {
  REPULSION: 80000,
  ATTRACTION: 0.01,
  GRAVITY_X: 0.002,
  GRAVITY_Y: 0.004,
  COMFORT_ZONE: 200,
  DAMPING: 0.8,
  MAX_VELOCITY: 10,
};

/**
 * Scale physics constants based on intensity (0–1).
 * At 0: all forces zero (frozen). At 0.5: defaults. At 1.0: amplified.
 */
function getPhysicsConfig(intensity: number) {
  // intensity 0 → multiplier 0, intensity 0.5 → multiplier 1, intensity 1.0 → multiplier 2
  const forceMultiplier = intensity * 2;
  // Damping: 0.95 at intensity 0 (very sticky) → 0.8 at 0.5 → 0.6 at 1.0 (bouncy)
  const damping = 0.95 - (intensity * 0.35);
  // Max velocity: 5 at intensity 0 → 10 at 0.5 → 20 at 1.0
  const maxVelocity = 5 + (intensity * 15);
  // Comfort zone shrinks at higher intensity (tighter orbits)
  const comfortZone = DEFAULTS.COMFORT_ZONE * (1 - intensity * 0.3);

  return {
    intensity,
    repulsion: DEFAULTS.REPULSION * forceMultiplier,
    attraction: DEFAULTS.ATTRACTION * forceMultiplier,
    gravityX: DEFAULTS.GRAVITY_X * forceMultiplier,
    gravityY: DEFAULTS.GRAVITY_Y * forceMultiplier,
    comfortZone,
    damping,
    maxVelocity,
  };
}

const PRIORITY_WEIGHT = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
  none: 0
};

export const spatialStrategy: LayoutStrategist = {
  name: 'spatial',
  
  calculateLayout: (thought: Thought, _allThoughts: Thought[], context: LayoutContext, elementHeights: Map<string, number>): LayoutResult => {
    const prioLevel = PRIORITY_WEIGHT[thought.priority] || 0;
    const targetScale = (1 + prioLevel * 0.05) * (thought.size || 1);
    
    const isArchived = thought.archivedAt && !context.showArchived;
    const isFilteredOut = context.visibleIds ? !context.visibleIds.has(thought.id) : false;
    const isHidden = isArchived || isFilteredOut;
    
    return {
      targetX: thought.x - 140,
      targetY: thought.y - (elementHeights.get(thought.id) || 120) / 2,
      targetScale,
      zIndex: (20 + (thought.layer || 0)).toString(),
      opacity: isHidden ? 0 : 1,
      visibility: isHidden ? 'hidden' : 'visible',
      pointerEvents: isHidden ? 'none' : 'auto',
      clipPath: 'none'
    };
  },

  applyForces: (id, p, allStates, thought, _allThoughts, context, elementHeights) => {
    const config = context.physicsConfig || getPhysicsConfig(0.5);
    
    // At intensity 0, skip all force calculations (frozen)
    if (config.repulsion === 0 && config.gravityX === 0 && config.gravityY === 0) {
      return { vx: 0, vy: 0 };
    }

    let dvx = 0;
    let dvy = 0;

    const prioLevel = PRIORITY_WEIGHT[thought.priority] || 0;
    const gravityMultiplier = 1 + prioLevel * 0.5;
    
    const centerX = p.x + 140;
    const centerY = p.y + (elementHeights.get(id) || 120) / 2;
    
    const targetX = context.logicalWidth / 2;
    const targetY = context.logicalHeight / 2;
    
    dvx += (targetX - centerX) * (config.gravityX * gravityMultiplier);
    dvy += (targetY - centerY) * (config.gravityY * gravityMultiplier);

    allStates.forEach((otherP, otherId) => {
      if (id === otherId) return;
      
      const otherT = context.thoughtMap.get(otherId);
      if (!otherT) return;

      if (context.visibleIds && !context.visibleIds.has(otherId)) return;
      if (otherT.archivedAt && !context.showArchived) return;

      const centerA = { x: p.x + 140, y: p.y + (elementHeights.get(id) || 120) / 2 };
      const centerB = { x: otherP.x + 140, y: otherP.y + (elementHeights.get(otherId) || 120) / 2 };
      const dx = centerA.x - centerB.x;
      const dy = centerA.y - centerB.y;
      const distSq = dx * dx + dy * dy || 1;
      const d = Math.sqrt(distSq);

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
        const force = Math.min((config.repulsion * repulsionMultiplier) / distSq, 8);
        dvx += (dx / d) * force;
        dvy += (dy / d) * force;
      }

      // Stack Attraction
      if (thought.stackId && thought.stackId === otherT.stackId) {
        if (d > config.comfortZone) {
          const pull = (d - config.comfortZone) * config.attraction;
          dvx -= (dx / d) * pull;
          dvy -= (dy / d) * pull;
        }
      }
    });

    return { vx: dvx, vy: dvy };
  }
};

// Export the config builder for use in usePhysics.ts
export { getPhysicsConfig };
