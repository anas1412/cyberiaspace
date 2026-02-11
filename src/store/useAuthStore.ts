import { create } from 'zustand';
import { PLAN_CONFIG, type SubscriptionPlan, type AccessPeriod } from '../constants';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  plan: SubscriptionPlan;
  accessPeriod?: AccessPeriod;
  subscriptionStatus?: 'active' | 'expired';
  expiryDate?: string;
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
  upgradePlan: (plan: SubscriptionPlan, period?: AccessPeriod) => void;
  checkExpiry: () => void;
  refreshProStatus: () => Promise<void>;
  cancelSubscription: () => void;
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

    // Initial expiry check
    get().checkExpiry();
    // Reconcile with server status
    get().refreshProStatus();
  },

  calculateUsage: (thoughtCount: number) => {
    const { user } = get();
    const plan = (user?.plan as SubscriptionPlan) || 'free';
    const limits = PLAN_CONFIG[plan] || PLAN_CONFIG.free;
    const percentage = Math.round((thoughtCount / limits.MAX_CLOUD_THOUGHTS) * 100);
    set({ cloudUsage: percentage });
  },

  upgradePlan: (plan: SubscriptionPlan, period: AccessPeriod = 'monthly') => {
    const { user } = get();
    if (!user) return;

    const now = new Date();
    const expiry = new Date();
    if (period === 'monthly') {
      expiry.setMonth(now.getMonth() + 1);
    } else {
      expiry.setFullYear(now.getFullYear() + 1);
    }

    const updatedUser: User = {
      ...user,
      plan,
      accessPeriod: period,
      subscriptionStatus: 'active',
      expiryDate: expiry.toISOString()
    };

    localStorage.setItem('cyberia-user', JSON.stringify(updatedUser));
    set({ user: updatedUser });
  },

  checkExpiry: () => {
    const { user } = get();
    if (!user || user.plan === 'free' || !user.expiryDate) return;

    if (new Date() > new Date(user.expiryDate)) {
      const updatedUser: User = { ...user, plan: 'free', subscriptionStatus: 'expired' };
      localStorage.setItem('cyberia-user', JSON.stringify(updatedUser));
      set({ user: updatedUser });
    }
  },

  refreshProStatus: async () => {
    const { accessToken, status, user } = get();
    if (status !== 'authenticated' || !accessToken) return;

    try {
      const response = await fetch('/api/user?action=status', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      if (response.ok) {
        const serverStatus = await response.json();
        // If server says pro but local says free, OR expiry changed, update local
        if (serverStatus.plan !== user?.plan || serverStatus.expiryDate !== user?.expiryDate) {
          const updatedUser: User = {
            ...(user as User),
            plan: serverStatus.plan,
            expiryDate: serverStatus.expiryDate,
            subscriptionStatus: serverStatus.plan === 'pro' ? 'active' : 'expired'
          };
          localStorage.setItem('cyberia-user', JSON.stringify(updatedUser));
          set({ user: updatedUser });
        }
      }
    } catch (err) {
      console.error('Failed to refresh pro status:', err);
    }
  },

  cancelSubscription: () => {
    const { user } = get();
    if (!user || user.plan === 'free') return;

    const updatedUser: User = {
      ...user,
      subscriptionStatus: 'expired' // Or just clear it, let's use 'expired' for simplicity in mock
    };

    localStorage.setItem('cyberia-user', JSON.stringify(updatedUser));
    set({ user: updatedUser });
  },

  setAuthenticatedUser: async (user: User, token: string) => {
    const userWithPlan = { ...user, plan: user.plan || 'free' };
    localStorage.setItem('cyberia-user', JSON.stringify(userWithPlan));
    localStorage.setItem('cyberia-token', token);

    set({
      user: userWithPlan,
      accessToken: token,
      status: 'authenticated',
      syncStatus: 'syncing'
    });

    // Check if cloud data exists
    try {
      const response = await fetch('/api/user?action=sync', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.status === 401) {
        get().signOut();
        return;
      }

      const result = await response.json();

      if (result.data) {
        set({ syncStatus: 'synced', lastSync: new Date() });
      } else {
        set({ syncStatus: 'offline', lastSync: null });
      }

      // Reconcile pro status after login
      get().refreshProStatus();
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
      const response = await fetch('/api/user?action=sync', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      if (response.status === 401) {
        get().signOut();
        return null;
      }

      const result = await response.json();
      set({ syncStatus: 'synced' });
      return result.data;
    } catch {
      set({ syncStatus: 'error' });
      return null;
    }
  },

  syncData: async () => {
    const { status, accessToken, isOnline, syncStatus, user } = get();
    if (status !== 'authenticated' || !accessToken) return;
    if (!isOnline || syncStatus === 'syncing') return;

    set({ syncStatus: 'syncing' });

    try {
      const { db } = await import('../db');
      const allSpaces = await db.spaces.toArray();
      const allThoughts = await db.thoughts.toArray();
      const allStacks = await db.stacks.toArray();

      const plan = (user?.plan as SubscriptionPlan) || 'free';
      const limits = PLAN_CONFIG[plan] || PLAN_CONFIG.free;

      if (allThoughts.length > limits.MAX_CLOUD_THOUGHTS) {
        const { useModalStore } = await import('./useModalStore');
        useModalStore.getState().openModal({
          title: 'Sync Blocked',
          description: `You have too many thoughts for the Free plan (${allThoughts.length}/${limits.MAX_CLOUD_THOUGHTS}). Upgrade to Pro to sync everything.`,
          type: 'alert',
          confirmText: 'View Plans',
          onConfirm: () => useModalStore.getState().openPricing()
        });
        set({ syncStatus: 'error' });
        return;
      }

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

      const response = await fetch('/api/user?action=sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(payload)
      });

      if (response.status === 401) {
        // Token expired
        get().signOut();
        return;
      }

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
      const response = await fetch('/api/user?action=sync', {
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