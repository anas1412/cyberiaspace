import { syncOrchestrator } from '../../services/sync/syncOrchestrator';
import { type StateCreator } from 'zustand';
import { type User, type SubscriptionPlan, type AccessPeriod, PLAN_CONFIG } from '../../constants';
import { db } from '../../db';
import { supabaseSync } from '../../services/supabaseSync';
import { type AuthState } from '../types';
import { supabaseStorage, isStorageUrl } from '../../services/supabaseStorage';

let refreshProfilePromise: Promise<void> | null = null;
let refreshInterval: ReturnType<typeof setInterval> | null = null;

const getHasRegressedToFree = (): boolean => {
  try {
    return localStorage.getItem('cyberia-regressed-to-free') === 'true';
  } catch { return false; }
};

const setHasRegressedToFree = (value: boolean) => {
  if (value) {
    localStorage.setItem('cyberia-regressed-to-free', 'true');
  } else {
    localStorage.removeItem('cyberia-regressed-to-free');
  }
};

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
  accessTokenExpiresAt: localStorage.getItem('cyberia-token-expiry') ? Number(localStorage.getItem('cyberia-token-expiry')) : null,
  refreshSecret: localStorage.getItem('cyberia-refresh-secret'),
  grantedScopes: JSON.parse(localStorage.getItem('cyberia-scopes') || '[]'),
  status: localStorage.getItem('cyberia-user') ? 'authenticated' : 'unauthenticated' as 'idle' | 'loading' | 'authenticated' | 'unauthenticated',


  initAuth: async () => {
    window.addEventListener('online', async () => { 
      set({ isOnline: true });
      await get().processOfflineChanges();
    });
    window.addEventListener('offline', () => set({ isOnline: false, syncStatus: 'offline' }));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && get().status === 'authenticated') {
        console.log('[Auth] App visible, checking for profile refresh...');
        get().refreshProfile();
      }
    });
    get().checkExpiry();
    get().setupRefreshInterval();

    const currentUser = get().user;
    if (get().status === 'authenticated' && currentUser?.id) {
      // Phase 0: Start Realtime Listener for instant sync
      syncOrchestrator.setupRealtimeListener(currentUser.id);

      // Phase 1: Auto-Migration for missing updatedAt
      try {
        const now = Date.now();
        const currentUserId = currentUser?.id;
        if (currentUserId) {
          await db.transaction('rw', [db.thoughts, db.spaces, db.stacks], async () => {
            await db.thoughts.filter(t => (t.updatedAt === undefined || t.updatedAt === null) && t.userId === currentUserId).modify({ updatedAt: now, syncStatus: 'local' });
            await db.spaces.filter(s => (s.updatedAt === undefined || s.updatedAt === null) && s.userId === currentUserId).modify({ updatedAt: now, syncStatus: 'local' });
            await db.stacks.filter(s => (s.updatedAt === undefined || s.updatedAt === null) && s.userId === currentUserId).modify({ updatedAt: now, syncStatus: 'local' });
          });
        }
      } catch (e) {
        console.warn('[Auth] Auto-migration failed:', e);
      }

      try {
        await get().refreshProfile();
      } catch (err) {
        console.warn('[Auth] Initialization failed:', err);
      }

      // Phase 2: Trigger initial delta sync to catch any remote changes
      // made on other devices while this client was offline/closed.
      if (get().autoSync && get().isOnline) {
        const hasSyncedBefore = !!localStorage.getItem('cyberia-last-sync');
        if (hasSyncedBefore) {
          // Fire non-blocking to prevent locking UI
          setTimeout(() => syncOrchestrator.triggerSync(true), 500);
        }
      }
    }
  },

  setAuthenticatedUser: async (user: User, token: string, refreshSecret?: string, scopes?: string[], expiresIn?: number) => {
    const today = new Date().toISOString().split('T')[0];
    const expiryTime = expiresIn ? Date.now() + (expiresIn * 1000) : Date.now() + (3600 * 1000);
    
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
        space: user.settings?.space ?? 'cyberia',
        autoSync: user.settings?.autoSync ?? true,
      }
    };
    // If switching accounts in the same session, clear in-memory caches for old user data
    try {
      const prevUserId = get().user?.id;
      if (prevUserId && prevUserId !== userWithDefaults.id) {
        const { useStore } = await import('../useStore');
        useStore.setState({ thoughts: [], spaces: [], stacks: [] });
      }
    } catch {
      // ignore cleanup if store isn't ready yet
    }
    
    localStorage.setItem('cyberia-user', JSON.stringify(userWithDefaults));
    // Theme is now per-space only, handled by space settings
    localStorage.setItem('cyberia-token', token);
    localStorage.setItem('cyberia-token-expiry', expiryTime.toString());
    
    if (refreshSecret) {
      localStorage.setItem('cyberia-refresh-secret', refreshSecret);
    }

    if (scopes) {
      localStorage.setItem('cyberia-scopes', JSON.stringify(scopes));
    }

    const { useStore } = await import('../useStore');
    useStore.setState({ isInitializing: true });

    set({
      user: userWithDefaults,
      accessToken: token,
      accessTokenExpiresAt: expiryTime,
      refreshSecret: refreshSecret || get().refreshSecret,
      grantedScopes: scopes || get().grantedScopes,
      status: 'authenticated',
      syncStatus: 'syncing'
    });

    get().setupRefreshInterval();

    // Start instant realtime listener
    syncOrchestrator.setupRealtimeListener(userWithDefaults.id);

    try {
      await get().refreshProfile();
      await get().handlePostAuthSync();
      
      // Migration: Add userId to all existing local data if not present
      const { useStore } = await import('../useStore');
      const store = useStore.getState();
      if (typeof store.migrateLegacyData === 'function') {
        await store.migrateLegacyData(userWithDefaults.id);
      }
      
      // Ensure user has at least one workspace
      if (typeof store.ensureWorkspaceForCurrentUser === 'function') {
        await store.ensureWorkspaceForCurrentUser();
      }
    } catch (e) {
      console.error('Initial login sync failed', e);
      set({ syncStatus: 'error' });
    } finally {
      useStore.setState({ isInitializing: false });
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

      await get().setAuthenticatedUser(data.user, data.access_token, data.refresh_secret, scopes, data.expires_in);
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
    syncOrchestrator.cleanupRealtimeListener();
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
    localStorage.removeItem('cyberia-user');
    localStorage.removeItem('cyberia-token');
    localStorage.removeItem('cyberia-token-expiry');
    localStorage.removeItem('cyberia-last-sync');
    localStorage.removeItem('cyberia-scopes');
    localStorage.removeItem('cyberia-refresh-secret');
    localStorage.removeItem('cyberia-active-space-id');
    localStorage.removeItem('cyberia-theme');
    set({ 
      user: null, 
      accessToken: null, 
      refreshSecret: null,
      grantedScopes: [],
      status: 'unauthenticated', 
      syncStatus: 'offline', 
      lastSync: null 
    });
    
    // Clear in-memory store data to prevent stale data from leaking to next user
    useStore.setState({ 
      thoughts: [], 
      spaces: [], 
      stacks: [], 
      activeSpaceId: null,
      transform: { x: 0, y: 0, scale: 1 },
      selectedThoughtIds: [],
      creatorName: null,
      customBg: null,
      theme: 'cyberia'
    });
    document.body.setAttribute('data-theme', 'cyberia');
    
    // Create fresh guest workspace so the app isn't blank after logout
    await useStore.getState().createInitialWorkspace();
    
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
    
    if (plan === 'pro') {
      setHasRegressedToFree(false);
    }
  },

  checkExpiry: () => {
    const { user } = get();
    if (!user) return;
    
    const now = new Date();
    const isPro = user.plan === 'pro' && user.expiryDate && new Date(user.expiryDate) > now;
    
    if (user.plan === 'pro' && !isPro) {
      console.warn('[Auth] Plan expired. Reverting to free plan for user:', user.id);
      setHasRegressedToFree(true);
      const updatedUser: User = { 
        ...user, 
        plan: 'free',
        settings: {
          ...user.settings,
          personality: '',
        }
      };
      set({ user: updatedUser });
      localStorage.setItem('cyberia-user', JSON.stringify(updatedUser));
      get().handlePlanRegression();
    } else if (isPro && getHasRegressedToFree()) {
      setHasRegressedToFree(false);
    }
  },

  refreshProfile: async () => {
    const { accessToken, user, refreshSecret } = get();
    if (!accessToken || !user) return;

    // Deduplication: If a refresh is already in progress, join it
    if (refreshProfilePromise) return refreshProfilePromise;

    refreshProfilePromise = (async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000); // Increased to 20s

        // 1. Background Token Refresh
        try {
          const refreshRes = await fetch('/api/google-auth?action=refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id, refreshSecret }),
            signal: controller.signal
          });
          
          if (refreshRes.ok) {
            const refreshData = await refreshRes.json();
            const currentToken = refreshData.access_token;
            const expiresIn = refreshData.expires_in || 3600;
            const expiryTime = Date.now() + (expiresIn * 1000);
            
            set({ 
              accessToken: currentToken,
              accessTokenExpiresAt: expiryTime
            });
            localStorage.setItem('cyberia-token', currentToken);
            localStorage.setItem('cyberia-token-expiry', expiryTime.toString());
          } else if (refreshRes.status === 401) {
            console.warn('[Auth] Session expired (401), signing out');
            clearTimeout(timeoutId);
            get().signOut();
            return;
          }
        } catch (err: any) {
          // Silent failure for background refresh unless it's a critical error
          if (err.name === 'AbortError') {
            console.log('[Auth] Token refresh timed out (Silent)');
          } else {
            console.warn('[Auth] Token refresh error:', err.message);
          }
        }

        // 2. Profile Sync
        try {
          const supabaseProfile = await supabaseSync.getProfile(user.id);
          if (supabaseProfile?.user) {
            const supabaseUser = supabaseProfile.user;
            const now = new Date();
            const isPro = supabaseUser.plan === 'pro' && supabaseUser.expiryDate && new Date(supabaseUser.expiryDate) > now;
            
            const updatedUser = { 
              ...user, 
              ...supabaseUser,
              settings: {
                ...user.settings,
                ...supabaseUser.settings,
                autoSync: supabaseUser.settings?.autoSync ?? user.settings?.autoSync ?? true
              }
            };
            
            if (!isPro) {
              updatedUser.plan = 'free';
              updatedUser.settings.personality = '';
              
              if (user.plan === 'pro') {
                console.log('[Auth] Plan regression detected: pro -> free');
                get().handlePlanRegression();
              }
              setHasRegressedToFree(true);
            } else {
              if (getHasRegressedToFree()) {
                console.log('[Auth] Plan renewed! Lifting regression restrictions.');
              }
              setHasRegressedToFree(false);
            }

            set({ user: updatedUser });
            localStorage.setItem('cyberia-user', JSON.stringify(updatedUser));
          }
        } catch (err: any) {
          console.warn('[Auth] Profile sync failed:', err.message);
        } finally {
          clearTimeout(timeoutId);
        }
      } catch (e) {
        console.warn('[Auth] Refresh profile critical failure:', e);
      } finally {
        refreshProfilePromise = null;
      }
    })();

    return refreshProfilePromise;
  },

  getOrRefreshToken: async () => {
    const { accessToken, accessTokenExpiresAt, status, isOnline } = get();
    if (status !== 'authenticated' || !isOnline) return accessToken;

    const BUFFER_MS = 5 * 60 * 1000; // 5 minutes
    const now = Date.now();
    
    if (!accessToken || !accessTokenExpiresAt || (accessTokenExpiresAt - now) < BUFFER_MS) {
      console.log('[Auth] Token missing or near expiry, refreshing...');
      await get().refreshProfile();
      return get().accessToken;
    }

    return accessToken;
  },

  setupRefreshInterval: () => {
    if (refreshInterval) clearInterval(refreshInterval);
    
    // Heartbeat: Refresh profile and token every 30 minutes
    // Google tokens usually last 60 minutes.
    refreshInterval = setInterval(() => {
      const { status, isOnline } = get();
      if (status === 'authenticated' && isOnline) {
        console.log('[Auth] Heartbeat: Refreshing token and profile...');
        get().refreshProfile();
      }
    }, 30 * 60 * 1000);
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

  handlePlanRegression: async () => {
    console.log('[Auth] Handling plan regression...');
    const { user, accessToken } = get();
    if (!user || !accessToken) return;

    // Reset all spaces to cyberia theme for free users
    const freeThemes = PLAN_CONFIG.free.THEMES_ENABLED;
    // CRITICAL: Only process spaces belonging to the current regressed user
    const spaces = await db.spaces.where('userId').equals(user.id).toArray();
    const now = Date.now();
    for (const space of spaces) {
      let needsUpdate = false;
      const updates: any = { updatedAt: now, syncStatus: 'local' };
      
      // Reset theme to cyberia if not allowed for free users
      if (space.theme && !freeThemes.includes(space.theme)) {
        updates.theme = 'cyberia';
        needsUpdate = true;
      }
      
      // Clear custom backgrounds
      if (space.customBg && isStorageUrl(space.customBg)) {
        try {
          await supabaseStorage.deleteSpaceBackground(user.id, space.id);
        } catch (e) {
          console.warn('[Auth] Failed to delete background file from storage:', e);
        }
        updates.customBg = null;
        needsUpdate = true;
      }
      
      if (needsUpdate) {
        await db.spaces.update(space.id, updates);
        try {
          await supabaseSync.updateSpace(space.id, updates, user.id);
        } catch (e) {
          console.warn('[Auth] Failed to sync space after regression cleanup:', e);
        }
      }
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
        // Clear stale storage-backed customBg references on spaces belonging to CURRENT user
        const now = Date.now();
        await db.spaces.where('userId').equals(user.id).modify((s: any) => {
          s.syncStatus = 'local';
          s.updatedAt = now;
          if (s.customBg && isStorageUrl(s.customBg)) {
            s.customBg = null;
          }
        });
        await db.stacks.where('userId').equals(user.id).modify({ syncStatus: 'local', updatedAt: now });
        await db.thoughts.where('userId').equals(user.id).modify({ 
          syncStatus: 'local', 
          updatedAt: now,
          storageUrl: undefined, 
          storagePath: undefined
        });
      });

      // After wipe, we keep autoSync on as it is now mandatory
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
