import { create } from 'zustand';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
}

export interface AuthState {
  user: User | null;
  status: 'idle' | 'loading' | 'authenticated' | 'unauthenticated';
  syncStatus: 'synced' | 'syncing' | 'error' | 'offline';
  lastSync: Date | null;
  autoSync: boolean;
  cloudUsage: number;
  isOnline: boolean;
  
  setAuthenticatedUser: (user: User) => void;
  signOut: () => Promise<void>;
  syncData: () => Promise<void>;
  setAutoSync: (enabled: boolean) => void;
  deleteCloudData: () => Promise<void>;
  calculateUsage: (thoughtCount: number) => void;
  initAuth: () => void;
}

export const MAX_CLOUD_THOUGHTS = 240;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: JSON.parse(localStorage.getItem('cyberia-user') || 'null'),
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
    const percentage = Math.min(Math.round((thoughtCount / MAX_CLOUD_THOUGHTS) * 100), 100);
    set({ cloudUsage: percentage });
  },

  setAuthenticatedUser: (user: User) => {
    localStorage.setItem('cyberia-user', JSON.stringify(user));
    const now = new Date();
    localStorage.setItem('cyberia-last-sync', now.toISOString());

    set({ 
      user, 
      status: 'authenticated', 
      syncStatus: 'synced',
      lastSync: now
    });
  },

  signOut: async () => {
    set({ status: 'loading' });
    await new Promise(resolve => setTimeout(resolve, 300));
    localStorage.removeItem('cyberia-user');
    localStorage.removeItem('cyberia-last-sync');
    set({ user: null, status: 'unauthenticated', syncStatus: 'offline', lastSync: null });
  },

  syncData: async () => {
    if (get().status !== 'authenticated') return;
    if (!navigator.onLine) {
      set({ syncStatus: 'offline' });
      return;
    }
    
    set({ syncStatus: 'syncing' });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const now = new Date();
    localStorage.setItem('cyberia-last-sync', now.toISOString());
    
    set({ 
      syncStatus: 'synced',
      lastSync: now
    });
  },

  setAutoSync: (enabled: boolean) => {
    localStorage.setItem('cyberia-auto-sync', String(enabled));
    set({ autoSync: enabled });
  },

  deleteCloudData: async () => {
    set({ syncStatus: 'syncing' });
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    localStorage.removeItem('cyberia-last-sync');
    set({ 
      syncStatus: 'offline',
      lastSync: null
    });
  }
}));