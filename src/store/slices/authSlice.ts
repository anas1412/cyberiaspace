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
  grantedScopes: JSON.parse(localStorage.getItem('cyberia-scopes') || '[]'),
  status: localStorage.getItem('cyberia-user') ? 'authenticated' : 'unauthenticated' as 'idle' | 'loading' | 'authenticated' | 'unauthenticated',

  initAuth: async () => {
    window.addEventListener('online', async () => { 
      set({ isOnline: true });
      // Process offline changes when back online
      await get().processOfflineChanges();
      // Process pending blob uploads
      await get().processPendingBlobs();
      // Also trigger a regular sync
      if (get().autoSync) {
        await get().syncData();
      }
    });
    window.addEventListener('offline', () => set({ isOnline: false, syncStatus: 'offline' }));
    get().checkExpiry();

    // Safety cleanup: Reset any stuck 'syncing' states back to 'local' on app boot
    try {
      await db.thoughts.where('syncStatus').equals('syncing').modify({ syncStatus: 'local' });
    } catch (e) {
      console.warn('[Auth] Syncing state cleanup failed:', e);
    }

    if (get().status === 'authenticated') {
      console.log('[Auth] Initializing authenticated session...');
      try {
        await get().refreshProfile();
        // After profile is refreshed, check for initial sync
        if (!get().lastSync) {
          console.log('[Auth] No lastSync found, triggering post-auth sync...');
          await get().handlePostAuthSync();
        }
      } catch (err) {
        console.warn('[Auth] Initialization failed:', err);
      }
    }
  },

  setAuthenticatedUser: async (user: User, token: string, scopes?: string[]) => {
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
    
    if (scopes) {
      localStorage.setItem('cyberia-scopes', JSON.stringify(scopes));
    }

    // Backend /api/google-auth?action=exchange already handles the initial sync and merging.
    // Calling it again from the frontend with only 4 fields is potentially risky and unnecessary.
    console.log('[Supabase] Authenticated via Google, backend sync already handled by exchange action.')


    const { useStore } = await import('../useStore');
    useStore.getState().isInitializing = true;

    set({
      user: userWithDefaults,
      accessToken: token,
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

      await get().setAuthenticatedUser(data.user, data.access_token, scopes);
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
    set({ 
      user: null, 
      accessToken: null, 
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
    const { accessToken, user } = get();
    if (!accessToken || !user) return;
    try {
      // 1. First try a silent refresh if token might be expired
      const refreshRes = await fetch('/api/google-auth?action=refresh', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      
      let currentToken = accessToken;
      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        currentToken = refreshData.access_token;
        set({ accessToken: currentToken });
        localStorage.setItem('cyberia-token', currentToken);
      } else if (refreshRes.status === 401) {
        get().signOut();
        return;
      }

      // 2. Fetch profile from Supabase
      console.log('[Auth] Refreshing profile for:', user.id);
      const supabaseProfile = await supabaseSync.getProfile(user.id);
      console.log('[Auth] Supabase profile result:', JSON.stringify(supabaseProfile));

      if (supabaseProfile?.user) {
        const supabaseUser = supabaseProfile.user;
        
        // Extract auto_sync from Supabase (column) vs settings.autoSync (JSON)
        const cloudAutoSync = supabaseUser.auto_sync ?? supabaseUser.settings?.autoSync;
        
        const updatedUser = { 
          ...user, 
          ...supabaseUser,
          settings: {
            ...user.settings,
            ...supabaseUser.settings,
            // Prefer cloud auto_sync value, fallback to local
            autoSync: cloudAutoSync !== undefined ? cloudAutoSync : user.settings?.autoSync
          }
        };
        
        // Update autoSync state from cloud
        if (cloudAutoSync !== undefined && cloudAutoSync !== get().autoSync) {
          set({ autoSync: cloudAutoSync });
          localStorage.setItem('cyberia-auto-sync', String(cloudAutoSync));
        }
        
        set({ user: updatedUser });
        localStorage.setItem('cyberia-user', JSON.stringify(updatedUser));
      } else {
        console.warn('[Auth] No profile found in Supabase for user:', user.id);
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

    try {
      // Delete all data from Supabase
      const spaces = await supabaseSync.getSpaces(user.id);
      for (const space of spaces?.spaces || []) {
        await supabaseSync.deleteSpace(space.id, user.id);
      }

      const thoughts = await supabaseSync.getThoughts(user.id);
      for (const thought of thoughts?.thoughts || []) {
        await supabaseSync.deleteThought(thought.id, user.id);
      }

      const stacks = await supabaseSync.getStacks(user.id);
      for (const stack of stacks?.stacks || []) {
        await supabaseSync.deleteStack(stack.id, user.id);
      }

      localStorage.removeItem('cyberia-last-sync');
      set({ syncStatus: 'offline', lastSync: null });
    } catch (error) {
      console.error('Delete error:', error);
      set({ syncStatus: 'error' });
    }
  }
});
