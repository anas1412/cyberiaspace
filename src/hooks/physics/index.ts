import { spatialStrategy } from './spatialStrategy';
import { kanbanStrategy } from './kanbanStrategy';
import { calendarStrategy } from './calendarStrategy';
import type { LayoutStrategist } from './types';

export * from './types';

export const strategists: Record<string, LayoutStrategist> = {
  spatial: spatialStrategy,
  kanban: kanbanStrategy,
  calendar: calendarStrategy,
};

export const getStrategist = (mode: string): LayoutStrategist => {
  return strategists[mode] || spatialStrategy;
};
