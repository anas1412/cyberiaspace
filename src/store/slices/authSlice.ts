import { syncOrchestrator } from '../../services/sync/syncOrchestrator';
import { type StateCreator } from 'zustand';
import { type User, type SubscriptionPlan, type AccessPeriod } from '../../constants';
import { db } from '../../db';
import { supabaseSync } from '../../services/supabaseSync';
import { type AuthState } from '../types';

const getInitialUser = (): User | null => {
  try {
    const stored = localStorage.getItem('cyberia-user');
    if (!stored) return null;
    const user = JSON.parse(stored);
    
    const today = new Date().toISOString().split('T')[0];
    return {
      ...user,
      plan: user.plan || 'free',
      subscriptionStatus: user.subscriptionStatus || 'none',
      usage: {
        ai_daily_count: user.usage?.ai_daily_count ?? 0,
        sync_thoughts: user.usage?.sync_thoughts ?? 0,
        last_ai_reset: user.usage?.last_ai_reset ?? today,
      },
      settings: {
        theme: user.settings?.theme ?? 'cyberia',
        autoSync: user.settings?.autoSync ?? true,
      }
    };
  } catch (e) {
    return null;
  }
};

export const createAuthSlice: StateCreator<AuthState, [], [], any> = (set, get, _api) => ({
  user: getInitialUser(),
  accessToken: localStorage.getItem('cyberia-token'),
  refreshSecret: localStorage.getItem('cyberia-refresh-secret'),
  grantedScopes: JSON.parse(localStorage.getItem('cyberia-scopes') || '[]'),
  status: localStorage.getItem('cyberia-user') ? 'authenticated' : 'unauthenticated' as 'idle' | 'loading' | 'authenticated' | 'unauthenticated',


  initAuth: async () => {
    window.addEventListener('online', async () => { 
      set({ isOnline: true });
      await get().processOfflineChanges();
      if (get().autoSync) {
        await get().syncData();
      }
    });
    window.addEventListener('offline', () => set({ isOnline: false, syncStatus: 'offline' }));
    get().checkExpiry();

    if (get().status === 'authenticated') {
      // Phase 1: Auto-Migration for missing updatedAt
      try {
        const now = Date.now();
        await db.transaction('rw', [db.thoughts, db.spaces, db.stacks], async () => {
          await db.thoughts.filter(t => t.updatedAt === undefined || t.updatedAt === null).modify({ updatedAt: now, syncStatus: 'local' });
          await db.spaces.filter(s => s.updatedAt === undefined || s.updatedAt === null).modify({ updatedAt: now, syncStatus: 'local' });
          await db.stacks.filter(s => s.updatedAt === undefined || s.updatedAt === null).modify({ updatedAt: now, syncStatus: 'local' });
        });
      } catch (e) {
        console.warn('[Auth] Auto-migration failed:', e);
      }

      try {
        await get().refreshProfile();
      } catch (err) {
        console.warn('[Auth] Initialization failed:', err);
      }
    }
  },

  setAuthenticatedUser: async (user: User, token: string, refreshSecret?: string, scopes?: string[]) => {
    const today = new Date().toISOString().split('T')[0];
    const userWithDefaults: User = { 
      ...user, 
      plan: user.plan || 'free',
      subscriptionStatus: user.subscriptionStatus || 'none',
      usage: {
        ai_daily_count: user.usage?.ai_daily_count ?? 0,
        sync_thoughts: user.usage?.sync_thoughts ?? 0,
        last_ai_reset: user.usage?.last_ai_reset ?? today,
      },
      settings: {
        theme: user.settings?.theme ?? 'cyberia',
        autoSync: user.settings?.autoSync ?? true,
      }
    };
    
    localStorage.setItem('cyberia-user', JSON.stringify(userWithDefaults));
    localStorage.setItem('cyberia-token', token);
    
    if (refreshSecret) {
      localStorage.setItem('cyberia-refresh-secret', refreshSecret);
    }

    if (scopes) {
      localStorage.setItem('cyberia-scopes', JSON.stringify(scopes));
    }

    const { useStore } = await import('../useStore');
    useStore.getState().isInitializing = true;

    set({
      user: userWithDefaults,
      accessToken: token,
      refreshSecret: refreshSecret || get().refreshSecret,
      grantedScopes: scopes || get().grantedScopes,
      status: 'authenticated',
      syncStatus: 'syncing'
    });

    try {
      await get().refreshProfile();
      await get().handlePostAuthSync();
    } catch (e) {
      console.error('Initial login sync failed', e);
      set({ syncStatus: 'error' });
    } finally {
      useStore.getState().isInitializing = false;
    }
  },

  handleAuthCode: async (code: string) => {
    set({ status: 'loading' });
    try {
      const res = await fetch('/api/google-auth?action=exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });

      const data = await res.json();
      if (!res.ok) {
        console.error('[Auth] Token exchange failed:', data);
        throw new Error(data.details?.error_description || data.error || 'Token exchange failed');
      }

      const scopes = ['openid', 'email', 'profile'];

      await get().setAuthenticatedUser(data.user, data.access_token, data.refresh_secret, scopes);
    } catch (err: any) {
      console.error('Auth code handling failed:', err);
      const { useModalStore } = await import('../useModalStore');
      useModalStore.getState().openModal({
        title: 'Authentication Error',
        description: err.message || 'Failed to establish a permanent session. Please check your internet and try again.',
        type: 'alert',
        confirmText: 'Acknowledged'
      });
      set({ status: 'unauthenticated' });
    }
  },

  requestServiceAccess: (scope: string, token: string) => {
    const currentScopes = get().grantedScopes;
    if (!currentScopes.includes(scope)) {
      const newScopes = [...currentScopes, scope];
      localStorage.setItem('cyberia-scopes', JSON.stringify(newScopes));
      localStorage.setItem('cyberia-token', token);
      set({ grantedScopes: newScopes, accessToken: token });
      
      get().syncData();
    }
  },

  signOut: async () => {
    const { useStore } = await import('../useStore');
    useStore.setState({ isInitializing: true });
    
    set({ status: 'loading' });
    await new Promise(resolve => setTimeout(resolve, 500));
    localStorage.removeItem('cyberia-user');
    localStorage.removeItem('cyberia-token');
    localStorage.removeItem('cyberia-last-sync');
    localStorage.removeItem('cyberia-scopes');
    localStorage.removeItem('cyberia-refresh-secret');
    set({ 
      user: null, 
      accessToken: null, 
      refreshSecret: null,
      grantedScopes: [],
      status: 'unauthenticated', 
      syncStatus: 'offline', 
      lastSync: null 
    });
    
    useStore.setState({ isInitializing: false });
  },

  upgradePlan: (plan: SubscriptionPlan, period?: AccessPeriod) => {
    const { user } = get();
    if (!user) return;
    const expiryDate = period === 'yearly' 
      ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      : period === 'monthly'
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        : null;
    
    const updatedUser: User = { ...user, plan, expiryDate };
    set({ user: updatedUser });
    localStorage.setItem('cyberia-user', JSON.stringify(updatedUser));
  },

  checkExpiry: () => {
    const { user } = get();
    if (!user || user.plan === 'free' || !user.expiryDate) return;
    if (new Date(user.expiryDate) < new Date()) {
      console.warn('[Auth] Plan expired. Reverting to free plan for user:', user.id);
      set({ user: { ...user, plan: 'free' } });
      localStorage.setItem('cyberia-user', JSON.stringify({ ...user, plan: 'free' }));
    }
  },

  refreshProfile: async () => {
    const { accessToken, user, refreshSecret } = get();
    if (!accessToken || !user) return;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      try {
        const refreshRes = await fetch('/api/google-auth?action=refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, refreshSecret }),
          signal: controller.signal
        });
        
        let currentToken = accessToken;
        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          currentToken = refreshData.access_token;
          set({ accessToken: currentToken });
          localStorage.setItem('cyberia-token', currentToken);
        } else if (refreshRes.status === 401) {
          clearTimeout(timeoutId);
          get().signOut();
          return;
        }
      } catch (err: any) {
        console.warn('[Auth] Refresh failed:', err);
      }

      const supabaseProfile = await supabaseSync.getProfile(user.id);
      clearTimeout(timeoutId);

      if (supabaseProfile?.user) {
        const supabaseUser = supabaseProfile.user;
        const updatedUser = { 
          ...user, 
          ...supabaseUser,
          settings: {
            ...user.settings,
            ...supabaseUser.settings,
            autoSync: supabaseUser.settings?.autoSync ?? user.settings?.autoSync ?? true
          }
        };
        
        set({ user: updatedUser });
        localStorage.setItem('cyberia-user', JSON.stringify(updatedUser));
      }
    } catch (e) {
      console.warn('Failed to refresh profile', e);
    }
  },

  updateSettings: async (settings: Partial<User['settings']>) => {
    const { accessToken, user } = get();
    if (!accessToken || !user) return;
    
    const updatedUser = { ...user, settings: { ...user.settings, ...settings } };
    set({ user: updatedUser });
    localStorage.setItem('cyberia-user', JSON.stringify(updatedUser));

    try {
      await supabaseSync.updateSettings(user.id, updatedUser.settings);
    } catch (e) {
      console.warn('Settings sync failed', e);
    }
  },

  cancelSubscription: () => {
    const { user } = get();
    if (!user) return;
    const updatedUser: User = { ...user, plan: 'free', expiryDate: null };
    set({ user: updatedUser });
    localStorage.setItem('cyberia-user', JSON.stringify(updatedUser));
  },


  deleteCloudData: async () => {
    const { accessToken, isOnline, user } = get();
    if (!accessToken || !isOnline || !user) return;

    set({ syncStatus: 'syncing' });
    console.log('[Auth] Starting cloud data wipe...');

    try {
      await syncOrchestrator.setSyncBlocked(true);
      await syncOrchestrator.deleteCloudContent();

      await db.transaction('rw', [db.spaces, db.stacks, db.thoughts], async () => {
        await db.spaces.toCollection().modify({ syncStatus: 'local', updatedAt: Date.now() });
        await db.stacks.toCollection().modify({ syncStatus: 'local', updatedAt: Date.now() });
        await db.thoughts.toCollection().modify({ 
          syncStatus: 'local', 
          updatedAt: Date.now(),
          storageUrl: undefined, 
          storagePath: undefined
        });
      });

      await get().setAutoSync(false);
      localStorage.removeItem('cyberia-last-sync');
      set({ syncStatus: 'offline', lastSync: null });
      
      console.log('[Auth] Wipe complete.');
    } catch (error) {
      console.error('[Auth] Wipe failed:', error);
      set({ syncStatus: 'error' });
    } finally {
      await syncOrchestrator.setSyncBlocked(false);
    }
  }

});
