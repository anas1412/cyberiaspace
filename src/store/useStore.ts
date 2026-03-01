import { create } from 'zustand';
import { type CyberiaState } from './types';
import { createCanvasSlice } from './slices/canvasSlice';
import { createSpaceSlice } from './slices/spaceSlice';
import { createThoughtSlice } from './slices/thoughtSlice';
import { createStackSlice } from './slices/stackSlice';
import { createHistorySlice } from './slices/historySlice';
import { createDataSlice } from './slices/dataSlice';
import { createUiSlice } from './slices/uiSlice';

export const useStore = create<CyberiaState>((...a) => ({
  ...createCanvasSlice(...a),
  ...createSpaceSlice(...a),
  ...createThoughtSlice(...a),
  ...createStackSlice(...a),
  ...createHistorySlice(...a),
  ...createDataSlice(...a),
  ...createUiSlice(...a),
}));

export type { CyberiaState };
