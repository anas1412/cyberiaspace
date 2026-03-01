import { create } from 'zustand';
import { type AuthState } from './types';
import { createAuthSlice } from './slices/authSlice';
import { createSyncSlice } from './slices/syncSlice';
import { createStorageSlice } from './slices/storageSlice';

export const useAuthStore = create<AuthState>((...a) => ({
  ...createAuthSlice(...a),
  ...createSyncSlice(...a),
  ...createStorageSlice(...a),
}));

export type { AuthState };
