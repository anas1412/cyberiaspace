// text/plain

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

/**
 * Core Local-to-Account Data Flow Engine
 * Eliminates race conditions by strictly following Phase 1 -> Phase 2 -> Phase 3
 */
async function runAuthenticationFlow(user: User, get: any, isFreshLogin: boolean) {
  const { useStore } = await import('../useStore');
  const { useModalStore } = await import('../useModalStore');
  const store = useStore.getState();

  useStore.setState({ isInitializing: true });

  try {
    // PHASE 1: Import Cloud Data (Always First)
    // We only fetch and destructively import on a fresh login. Returning users already have this synced in IDB.
    if (isFreshLogin) {
      console.log('[AUTH] Phase 1: Importing Cloud Data...');
      try {
        const cloudData = await syncOrchestrator.fetchCloudData();
        if (cloudData && cloudData.spaces.length > 0) {
          await store.importFullState(cloudData, false); // false = don't trigger reverse sync
        }
      } catch (err) {
        console.warn('[AUTH] Phase 1 Cloud fetch failed (might be offline):', err);
      }
    }

    // Rely on IDB for accurate cloud counts post-import
    const userSpaces = await db.spaces.where('userId').equals(user.id).filter(s => !s.deletedAt).toArray();
    const cloudCount = userSpaces.length;

    // PHASE 2: Assess Local Data
    console.log('[AUTH] Phase 2: Assessing Local Data...');
    const localGuestSpaces = await db.spaces.where('userId').equals('guest').filter(s => !s.deletedAt).toArray();
    let localCount = 0;
    for (const space of localGuestSpaces) {
      const thoughtCount = await db.thoughts.where('spaceId').equals(space.id).filter(t => !t.deletedAt).count();
      if (thoughtCount > 0) localCount++;
    }

    console.log(`[AUTH] Matrix Assessment: Local=${localCount}, Cloud=${cloudCount}`);

    // Helper: Runs after matrix resolves to prep the workspace & establish sync loops
    const finalizeSetup = async () => {
      // Final Catch: If absolutely 0 spaces exist after matrix completes, create the default workspace
      const finalUserSpaces = await db.spaces.where('userId').equals(user.id).filter(s => !s.deletedAt).count();
      if (finalUserSpaces === 0 && typeof store.ensureWorkspaceForCurrentUser === 'function') {
        await store.ensureWorkspaceForCurrentUser();
      }

      await store.refreshSpaces();
      await store.refreshThoughts();

      // Ensure active space belongs to the user, not a ghost/deleted space
      const currentStore = useStore.getState();
      const spaces = currentStore.spaces;
      const currentActive = currentStore.activeSpaceId;
      const validActive = currentActive && spaces.some(s => s.id === currentActive && !s.deletedAt);
      
      if (!validActive && spaces.length > 0) {
        const targetSpace = spaces.find(s => s.userId === user.id) || spaces[0];
        await store.setActiveSpace(targetSpace.id);
      }

      // Start the background synchronization engines (will catch any newly migrated local spaces)
      if (typeof get().handlePostAuthSync === 'function') {
        await get().handlePostAuthSync();
      }
    };

    // PHASE 3: Decision Matrix
    const isDismissed = localStorage.getItem('cyberia-migration-dismissed') === user.id;

    if (isDismissed) {
      console.log('[AUTH] Phase 3: Migration previously dismissed. Skipping.');
      await finalizeSetup();
      return;
    }

    if (localCount > 0 && cloudCount === 0) {
      // Case 1: Auto-Migrate (Seamless)
      console.log('[AUTH] Phase 3: Auto-Migrating local work...');
      if (typeof store.migrateGuestSpaces === 'function') {
        await store.migrateGuestSpaces(user.id);
      }
      await finalizeSetup();

    } else if (localCount === 0 && cloudCount > 0) {
      // Case 2: Cloud Skip
      console.log('[AUTH] Phase 3: Cloud only. Proceeding...');
      await finalizeSetup();

    } else if (localCount > 0 && cloudCount > 0) {
      // Case 3: Conflict (Modal)
      console.log('[AUTH] Phase 3: Conflict detected. Checking quota...');
      const limits = store.getLimits();
      const totalSpaces = localCount + cloudCount;
      const isWithinLimit = totalSpaces <= limits.MAX_SPACES;

      await new Promise<void>((resolve) => {
        if (isWithinLimit) {
          useModalStore.getState().openModal({
            title: 'Move Local Work?',
            description: `You have ${localCount} local space(s) and ${cloudCount} account space(s). Would you like to move your local work into your account?`,
            type: 'alert',
            confirmText: 'Move to Account',
            cancelText: 'Keep Separate',
            onConfirm: async () => {
              useStore.setState({ isInitializing: true });
              if (typeof store.migrateGuestSpaces === 'function') {
                await store.migrateGuestSpaces(user.id);
              }
              await finalizeSetup();
              resolve();
            },
            onCancel: async () => {
              localStorage.setItem('cyberia-migration-dismissed', user.id);
              await finalizeSetup();
              resolve();
            }
          });
        } else {
          useModalStore.getState().openModal({
            title: 'Space Limit Reached',
            description: `Moving local work would exceed your plan limit of ${limits.MAX_SPACES} spaces. Upgrade to Pro or keep them local for now.`,
            type: 'alert',
            confirmText: 'Upgrade to Pro',
            cancelText: 'Keep Separate',
            onConfirm: async () => {
              useModalStore.getState().openPricing();
              await finalizeSetup();
              resolve();
            },
            onCancel: async () => {
              localStorage.setItem('cyberia-migration-dismissed', user.id);
              await finalizeSetup();
              resolve();
            }
          });
        }
      });
    } else {
      // Case 0: Fresh Start
      console.log('[AUTH] Phase 3: Fresh start (No local or cloud spaces).');
      await finalizeSetup();
    }

  } catch (err) {
    console.error('[AUTH] Authentication flow failed:', err);
    // Fallback: Ensure UI un-suspends and sync tries to recover
    if (typeof get().handlePostAuthSync === 'function') {
      await get().handlePostAuthSync();
    }
  } finally {
    useStore.setState({ isInitializing: false });
  }
}

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
      if (typeof get().processOfflineChanges === 'function') {
        await get().processOfflineChanges();
      }
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
      syncOrchestrator.setupRealtimeListener(currentUser.id);
      
      console.log('[AUTH] initAuth: Running sync flow for returning authenticated user');
      // Pass false for isFreshLogin -> prevents re-downloading/overwriting offline work
      await runAuthenticationFlow(currentUser, get, false);
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

    // If switching accounts in the same session, strictly clear in-memory caches
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
    localStorage.setItem('cyberia-token', token);
    localStorage.setItem('cyberia-token-expiry', expiryTime.toString());
    
    if (refreshSecret) {
      localStorage.setItem('cyberia-refresh-secret', refreshSecret);
    }
    if (scopes) {
      localStorage.setItem('cyberia-scopes', JSON.stringify(scopes));
    }

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
    syncOrchestrator.setupRealtimeListener(userWithDefaults.id);

    console.log('[AUTH] setAuthenticatedUser started for user:', userWithDefaults.id);

    try {
      // Step 1: Establish current profile limits & plan status
      await get().refreshProfile();

      // Step 2: Execute robust initialization matrix (isFreshLogin = true)
      await runAuthenticationFlow(userWithDefaults, get, true);

      console.log('[AUTH] Full login sequence complete');
    } catch (e) {
      console.error('Initial login sync failed', e);
      set({ syncStatus: 'error' });
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
      
      if (typeof get().syncData === 'function') {
        get().syncData();
      }
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
    localStorage.removeItem('cyberia-migration-dismissed');
    
    set({ 
      user: null, 
      accessToken: null, 
      refreshSecret: null,
      grantedScopes: [],
      status: 'unauthenticated', 
      syncStatus: 'offline', 
      lastSync: null 
    });
    
    // Wipe local volatile state to isolate user sessions entirely
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
    
    // Construct local guest safe-haven state
    if (typeof useStore.getState().createInitialWorkspace === 'function') {
      await useStore.getState().createInitialWorkspace();
    }
    
    const guestSpacesCount = await db.spaces.filter(s => s.userId === 'guest' && !s.deletedAt).count();
    if (guestSpacesCount === 0) {
      console.log('[Auth] No guest space found after logout, generating safe-haven workspace...');
      const { ulid } = await import('ulid');
      const workspaceId = ulid();
      const now = Date.now();
      const guestSpace = {
        id: workspaceId,
        userId: 'guest',
        name: 'Workspace',
        mode: 'spatial' as const,
        physics: true,
        order: 0,
        updatedAt: now,
      };
      await db.spaces.add(guestSpace);
      localStorage.setItem('cyberia-active-space-id', workspaceId);
      await useStore.getState().refreshSpaces();
    }
    
    useStore.setState({ isInitializing: false });
    window.location.reload(); // Expected hard reload upon logout to fully discard React DOM memory
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

    if (refreshProfilePromise) return refreshProfilePromise;

    refreshProfilePromise = (async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);

        // 1. Background Token Exchange
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
            console.warn('[Auth] Session expired (401), executing safety sign-out');
            clearTimeout(timeoutId);
            get().signOut();
            return;
          }
        } catch (err: any) {
          if (err.name === 'AbortError') {
            console.log('[Auth] Token refresh heartbeat timed out.');
          } else {
            console.warn('[Auth] Token refresh error:', err.message);
          }
        }

        // 2. Profile Differential Sync
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
                console.log('[Auth] Plan regression (pro -> free) detected remotely.');
                get().handlePlanRegression();
              }
              setHasRegressedToFree(true);
            } else {
              if (getHasRegressedToFree()) {
                console.log('[Auth] Plan renewed, lifting capability restrictions.');
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
        console.warn('[Auth] Refresh profile hard failure:', e);
      } finally {
        refreshProfilePromise = null;
      }
    })();

    return refreshProfilePromise;
  },

  getOrRefreshToken: async () => {
    const { accessToken, accessTokenExpiresAt, status, isOnline } = get();
    if (status !== 'authenticated' || !isOnline) return accessToken;

    const BUFFER_MS = 5 * 60 * 1000;
    const now = Date.now();
    
    if (!accessToken || !accessTokenExpiresAt || (accessTokenExpiresAt - now) < BUFFER_MS) {
      console.log('[Auth] OIDC token critically near expiry, enforcing manual refresh.');
      await get().refreshProfile();
      return get().accessToken;
    }

    return accessToken;
  },

  setupRefreshInterval: () => {
    if (refreshInterval) clearInterval(refreshInterval);
    
    // Heartbeat profile synchronizer
    refreshInterval = setInterval(() => {
      const { status, isOnline } = get();
      if (status === 'authenticated' && isOnline) {
        console.log('[Auth] Core Loop: Processing token/profile maintenance.');
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
      console.warn('Settings synchronization rejected', e);
    }
  },

  handlePlanRegression: async () => {
    console.log('[Auth] Engaging Plan Regression routines...');
    const { user, accessToken } = get();
    if (!user || !accessToken) return;

    const freeThemes = PLAN_CONFIG.free.THEMES_ENABLED;
    const spaces = await db.spaces.where('userId').equals(user.id).toArray();
    const now = Date.now();
    
    for (const space of spaces) {
      let needsUpdate = false;
      const updates: any = { updatedAt: now, syncStatus: 'local' };
      
      // Enforce theme gating
      if (space.theme && !freeThemes.includes(space.theme)) {
        updates.theme = 'cyberia';
        needsUpdate = true;
      }
      
      // Demolish cloud-hosted custom environments
      if (space.customBg && isStorageUrl(space.customBg)) {
        try {
          await supabaseStorage.deleteSpaceBackground(user.id, space.id);
        } catch (e) {
          console.warn('[Auth] Remote storage clean failed on regression:', e);
        }
        updates.customBg = null;
        needsUpdate = true;
      }
      
      if (needsUpdate) {
        await db.spaces.update(space.id, updates);
        try {
          await supabaseSync.updateSpace(space.id, updates, user.id);
        } catch (e) {
          console.warn('[Auth] Space regression-sync failed:', e);
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
    console.log('[Auth] Initiating catastrophic cloud deletion wipe...');

    try {
      await syncOrchestrator.setSyncBlocked(true);
      await syncOrchestrator.deleteCloudContent();

      await db.transaction('rw', [db.spaces, db.stacks, db.thoughts], async () => {
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

      localStorage.removeItem('cyberia-last-sync');
      set({ syncStatus: 'offline', lastSync: null });
      
      console.log('[Auth] Catastrophic wipe resolved gracefully.');
    } catch (error) {
      console.error('[Auth] Wipe failed:', error);
      set({ syncStatus: 'error' });
    } finally {
      await syncOrchestrator.setSyncBlocked(false);
    }
  }

});