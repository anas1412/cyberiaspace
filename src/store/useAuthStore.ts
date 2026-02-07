import { create } from 'zustand';
import { LIMITS } from '../constants';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  status: 'idle' | 'loading' | 'authenticated' | 'unauthenticated';
  syncStatus: 'synced' | 'syncing' | 'error' | 'offline';
  lastSync: Date | null;
  autoSync: boolean;
  cloudUsage: number;
  isOnline: boolean;
  
  setAuthenticatedUser: (user: User, token: string) => Promise<void>;
  signOut: () => Promise<void>;
  syncData: () => Promise<void>;
  importCloudData: () => Promise<unknown | null>;
  setAutoSync: (enabled: boolean) => void;
  deleteCloudData: () => Promise<void>;
  calculateUsage: (thoughtCount: number) => void;
  initAuth: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: JSON.parse(localStorage.getItem('cyberia-user') || 'null'),
  accessToken: localStorage.getItem('cyberia-token'),
  status: localStorage.getItem('cyberia-user') ? 'authenticated' : 'unauthenticated',
  syncStatus: navigator.onLine ? (localStorage.getItem('cyberia-user') ? 'synced' : 'offline') : 'offline',
  lastSync: localStorage.getItem('cyberia-last-sync') ? new Date(localStorage.getItem('cyberia-last-sync')!) : null,
  autoSync: localStorage.getItem('cyberia-auto-sync') !== 'false',
  cloudUsage: 0,
  isOnline: navigator.onLine,

  initAuth: () => {
    const handleOnline = () => {
      set({ isOnline: true });
      if (get().status === 'authenticated' && get().autoSync) {
        get().syncData();
      }
    };
    const handleOffline = () => {
      set({ isOnline: false, syncStatus: 'offline' });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
  },

  calculateUsage: (thoughtCount: number) => {
    const percentage = Math.min(Math.round((thoughtCount / LIMITS.MAX_CLOUD_THOUGHTS) * 100), 100);
    set({ cloudUsage: percentage });
  },

  setAuthenticatedUser: async (user: User, token: string) => {
    localStorage.setItem('cyberia-user', JSON.stringify(user));
    localStorage.setItem('cyberia-token', token);
    
    set({ 
      user, 
      accessToken: token,
      status: 'authenticated', 
      syncStatus: 'syncing'
    });

    // Check if cloud data exists
    try {
      const response = await fetch('/api/sync', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      
      if (result.data) {
        set({ syncStatus: 'synced', lastSync: new Date() });
      } else {
        set({ syncStatus: 'offline', lastSync: null });
      }
    } catch {
      set({ syncStatus: 'error' });
    }
  },

  signOut: async () => {
    set({ status: 'loading' });
    await new Promise(resolve => setTimeout(resolve, 300));
    localStorage.removeItem('cyberia-user');
    localStorage.removeItem('cyberia-token');
    localStorage.removeItem('cyberia-last-sync');
    set({ user: null, accessToken: null, status: 'unauthenticated', syncStatus: 'offline', lastSync: null });
  },

  importCloudData: async () => {
    const { accessToken, isOnline } = get();
    if (!accessToken || !isOnline) return null;

    set({ syncStatus: 'syncing' });
    try {
      const response = await fetch('/api/sync', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const result = await response.json();
      set({ syncStatus: 'synced' });
      return result.data;
    } catch {
      set({ syncStatus: 'error' });
      return null;
    }
  },

  syncData: async () => {
    const { status, accessToken, isOnline } = get();
    if (status !== 'authenticated' || !accessToken) return;
    if (!isOnline) {
      set({ syncStatus: 'offline' });
      return;
    }
    
    set({ syncStatus: 'syncing' });
    
    try {
      const { db } = await import('../db');
      const allSpaces = await db.spaces.toArray();
      const allThoughts = await db.thoughts.toArray();
      const allStacks = await db.stacks.toArray();
      
      const payload = {
        spaces: allSpaces,
        thoughts: allThoughts,
        stacks: allStacks,
        activeSpaceId: localStorage.getItem('cyberia-active-space-id'),
        settings: {
          theme: localStorage.getItem('cyberia-theme')
        },
        version: 2,
        timestamp: Date.now()
      };

      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error('Sync failed');

      const now = new Date();
      localStorage.setItem('cyberia-last-sync', now.toISOString());
      
      set({ 
        syncStatus: 'synced',
        lastSync: now
      });
    } catch {
      set({ syncStatus: 'error' });
    }
  },

  setAutoSync: (enabled: boolean) => {
    localStorage.setItem('cyberia-auto-sync', String(enabled));
    set({ autoSync: enabled });
  },

  deleteCloudData: async () => {
    const { accessToken, isOnline } = get();
    if (!accessToken || !isOnline) return;

    set({ syncStatus: 'syncing' });
    
    try {
      const response = await fetch('/api/sync', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) throw new Error('Delete failed');

      localStorage.removeItem('cyberia-last-sync');
      set({ 
        syncStatus: 'offline',
        lastSync: null
      });
    } catch (error) {
      console.error('Delete error:', error);
      set({ syncStatus: 'error' });
    }
  }
}));