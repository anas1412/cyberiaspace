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
        ai_top_count: user.usage?.ai_top_count ?? 0,
        ai_medium_count: user.usage?.ai_medium_count ?? 0,
        ai_small_count: user.usage?.ai_small_count ?? 0,
        sync_thoughts: user.usage?.sync_thoughts ?? 0,
        daily_anchor: user.usage?.daily_anchor ?? today,
        weekly_anchor: user.usage?.weekly_anchor ?? today,
        monthly_anchor: user.usage?.monthly_anchor ?? today,
        weekly_top_count: user.usage?.weekly_top_count ?? 0,
        weekly_medium_count: user.usage?.weekly_medium_count ?? 0,
        weekly_small_count: user.usage?.weekly_small_count ?? 0,
        monthly_top_count: user.usage?.monthly_top_count ?? 0,
        monthly_medium_count: user.usage?.monthly_medium_count ?? 0,
        monthly_small_count: user.usage?.monthly_small_count ?? 0,
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
 * Assessment-First logic to prevent data loss and deadlocks.
 */
async function runAuthenticationFlow(user: User, get: any, isFreshLogin: boolean) {
  const { useStore } = await import('../useStore');
  const { useModalStore } = await import('../useModalStore');
  const store = useStore.getState();

  // 1. PREVENT RACE: Guard against multiple simultaneous runs
  if (get()._migrationInProgress) return;
  get().setMigrationInProgress(true);

  // Keep loading states active while we set up the local environment
  useStore.setState({ isInitializing: true, isSpaceLoading: true });

  try {
    // PHASE 1: Fetch Cloud Metadata
    console.log('[AUTH] Phase 1: Fetching Cloud Metadata...');
    let cloudData: any = null;
    try {
      cloudData = await syncOrchestrator.fetchCloudData();
    } catch (err) {
      console.warn('[AUTH] Phase 1 Cloud fetch failed (might be offline):', err);
    }
    const cloudCount = (cloudData?.spaces || []).length;

    // PHASE 2: Assess Local Data (Strictly Guest Scope)
    console.log('[AUTH] Phase 2: Assessing Local Guest Data...');
    const localGuestSpaces = await db.spaces.where('userId').equals('guest').filter(s => !s.deletedAt).toArray();
    let localCount = 0;
    
    for (const space of localGuestSpaces) {
      const thoughtCount = await db.thoughts.where('spaceId').equals(space.id).filter(t => !t.deletedAt).count();
      if (thoughtCount > 0) localCount++;
    }
    
    const guestTombstones = await db.thoughts.where('userId').equals('guest').filter(t => !!t.deletedAt).count();
    const hasMeaningfulGuestData = localCount > 0 || guestTombstones > 0;

    console.log(`[AUTH] Matrix Assessment: MeaningfulGuestData=${hasMeaningfulGuestData}, LocalCount=${localCount}, CloudCount=${cloudCount}`);

    // Helper: Safely imports cloud data if the user's local profile cache is entirely missing
    const applyCloudDataIfNeeded = async () => {
      const localAccountSpacesCount = await db.spaces.where('userId').equals(user.id).count();
      const needsCloudImport = isFreshLogin || localAccountSpacesCount === 0;
      
      if (needsCloudImport && cloudData && cloudCount > 0) {
        await store.importFullState(cloudData, false);
      }
    };

    // Helper: Finalizes setup by downloading full sync data BEFORE resolving UI blocks
    const finalizeSetup = async () => {
      if (typeof get().handlePostAuthSync === 'function') {
        await get().handlePostAuthSync();
      }

      await store.refreshSpaces();
      await store.refreshThoughts();

      const currentStore = useStore.getState();
      const spaces = currentStore.spaces;
      const currentActive = currentStore.activeSpaceId;
      const validActive = currentActive && spaces.some(s => s.id === currentActive && !s.deletedAt);
      
      if (!validActive && spaces.length > 0) {
        const targetSpace = spaces.find(s => s.userId === user.id) || spaces[0];
        await store.setActiveSpace(targetSpace.id);
      }

      const finalUserSpaces = await db.spaces.where('userId').equals(user.id).filter(s => !s.deletedAt).count();
      if (finalUserSpaces === 0 && typeof store.ensureWorkspaceForCurrentUser === 'function') {
        await store.ensureWorkspaceForCurrentUser();
      }
    };

    // PHASE 3: Decision Matrix
    const isDismissed = localStorage.getItem('cyberia-migration-dismissed') === user.id;
    if (isDismissed) {
      console.log('[AUTH] Phase 3: Migration previously dismissed. Skipping.');
      await applyCloudDataIfNeeded();
      await finalizeSetup();
      return;
    }

    if (!hasMeaningfulGuestData) {
      // Case 0: Safe Overwrite (Local is just default "Workspace")
      console.log('[AUTH] Phase 3: Setting up local environment (no guest work found).');
      await store.discardGuestSpaces();
      await applyCloudDataIfNeeded();
      await finalizeSetup();

    } else if (hasMeaningfulGuestData && cloudCount === 0) {
      // Case 1: Auto-Migrate (Seamless)
      console.log('[AUTH] Phase 3: Auto-Migrating local work...');
      if (typeof store.migrateGuestSpaces === 'function') {
        await store.migrateGuestSpaces(user.id);
      }
      await finalizeSetup();

    } else if (hasMeaningfulGuestData && cloudCount > 0) {
      // Case 3: Conflict (Modal)
      console.log('[AUTH] Phase 3: Conflict detected. Checking quota...');
      
      // CRITICAL: Stop the loading spinner so the user can see the modal!
      useStore.setState({ isInitializing: false, isSpaceLoading: false });

      const limits = store.getLimits();
      const totalSpaces = localCount + cloudCount;
      const isWithinLimit = totalSpaces <= limits.MAX_SPACES;

      await new Promise<void>((resolve) => {
        if (isWithinLimit) {
          useModalStore.getState().openModal({
            title: 'Merge Data?',
            description: `You have ${localCount} local space(s) and ${cloudCount} account space(s). Would you like to merge your local offline work into your account?`,
            type: 'alert',
            confirmText: 'Merge Data',
            cancelText: 'Keep Separate',
            onConfirm: async () => {
              useStore.setState({ isInitializing: true, isSpaceLoading: true });
              if (typeof store.migrateGuestSpaces === 'function') {
                await store.migrateGuestSpaces(user.id);
              }
              await finalizeSetup();
              resolve();
            },
            onCancel: async () => {
              useStore.setState({ isInitializing: true, isSpaceLoading: true });
              localStorage.setItem('cyberia-migration-dismissed', user.id);
              await applyCloudDataIfNeeded();
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
              useStore.setState({ isInitializing: true, isSpaceLoading: true });
              window.location.href = '/pricing';
              await applyCloudDataIfNeeded();
              await finalizeSetup();
              resolve();
            },
            onCancel: async () => {
              useStore.setState({ isInitializing: true, isSpaceLoading: true });
              localStorage.setItem('cyberia-migration-dismissed', user.id);
              await applyCloudDataIfNeeded();
              await finalizeSetup();
              resolve();
            }
          });
        }
      });
    }

  } catch (err) {
    console.error('[AUTH] Authentication flow failed:', err);
    if (typeof get().handlePostAuthSync === 'function') {
      await get().handlePostAuthSync();
    }
  } finally {
    get().setMigrationInProgress(false);
    useStore.setState({ isInitializing: false, isSpaceLoading: false });
  }
}

export const createAuthSlice: StateCreator<AuthState, [], [], any> = (set, get, _api) => ({
  user: getInitialUser(),
  accessToken: localStorage.getItem('cyberia-token'),
  accessTokenExpiresAt: localStorage.getItem('cyberia-token-expiry') ? Number(localStorage.getItem('cyberia-token-expiry')) : null,
  refreshSecret: localStorage.getItem('cyberia-refresh-secret'),
  grantedScopes: JSON.parse(localStorage.getItem('cyberia-scopes') || '[]'),
  status: localStorage.getItem('cyberia-user') ? 'authenticated' : 'unauthenticated' as 'idle' | 'loading' | 'authenticated' | 'unauthenticated',
  _migrationInProgress: false,
  setMigrationInProgress: (inProgress: boolean) => set({ _migrationInProgress: inProgress }),
  modelConfig: null,

  fetchModelConfig: async () => {
    try {
      const res = await fetch('/api/models');
      const data = await res.json();
      if (data.tiers && data.config) {
        set({ modelConfig: data });
        console.log('[Auth] Model config fetched successfully');
      }
    } catch (err) {
      console.error('[Auth] Failed to fetch model config:', err);
    }
  },

  initAuth: async () => {
    window.addEventListener('online', async () => { 
      set({ isOnline: true });
      const { status } = get();
      
      if (status === 'authenticated') {
        console.log('[Auth] Back online, refreshing profile...');
        await get().refreshProfile();
      }
      
      if (typeof get().processOfflineChanges === 'function') {
        await get().processOfflineChanges();
      }
    });
    window.addEventListener('offline', () => set({ isOnline: false, syncStatus: 'offline' }));
    
    // Debounce timer for visibility changes
    let visibilityDebounceTimer: NodeJS.Timeout | null = null;
    
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && get().status === 'authenticated') {
        // Clear any pending debounce
        if (visibilityDebounceTimer) {
          clearTimeout(visibilityDebounceTimer);
        }
        
        // Debounce by 2 seconds to prevent rapid refreshes
        visibilityDebounceTimer = setTimeout(() => {
          console.log('[Auth] Tab became visible, refreshing profile...');
          get().refreshProfile();
        }, 2000);
      }
    });
    
    get().checkExpiry();
    get().setupRefreshInterval();
    get().fetchModelConfig();

    const { accessTokenExpiresAt, refreshSecret, accessToken, user } = get();
    const now = Date.now();
    const BUFFER_MS = 60 * 1000; // 1 minute - only refresh when truly needed
    
    // Try to fetch refreshSecret from database if not in localStorage
    if (!refreshSecret && accessToken && user) {
      console.log('[Auth] No refreshSecret in memory, fetching from database...');
      try {
        const profileData = await supabaseSync.getProfile(user.id);
        const profileAny = profileData?.user as any;
        if (profileAny?.refreshSecret) {
          localStorage.setItem('cyberia-refresh-secret', profileAny.refreshSecret);
          set({ refreshSecret: profileAny.refreshSecret });
          console.log('[Auth] Retrieved refreshSecret from database on startup');
        }
      } catch (e) {
        console.warn('[Auth] Could not fetch profile on startup:', e);
      }
    }
    
    // Now check if we have refreshSecret after the fetch
    const currentRefreshSecret = get().refreshSecret;
    
    if (accessTokenExpiresAt && (accessTokenExpiresAt - now) < BUFFER_MS) {
      console.log('[Auth] Token expired/near expiry on startup, attempting refresh...');
      if (currentRefreshSecret) {
        await get().refreshProfile();
      } else if (accessToken && user) {
        // Legacy user without refreshSecret - try to verify token validity
        console.log('[Auth] No refreshSecret (legacy user), verifying token validity...');
        try {
          const tokenInfoRes = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${accessToken}`);
          if (!tokenInfoRes.ok) {
            console.warn('[Auth] Token invalid, signing out legacy user');
            get().signOut();
          } else {
            console.log('[Auth] Token still valid for legacy user, proceeding');
          }
        } catch (e) {
          console.warn('[Auth] Could not verify token, proceeding anyway:', e);
        }
      } else {
        console.warn('[Auth] No accessToken or user, cannot refresh token');
      }
    }

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
        ai_top_count: user.usage?.ai_top_count ?? 0,
        ai_medium_count: user.usage?.ai_medium_count ?? 0,
        ai_small_count: user.usage?.ai_small_count ?? 0,
        sync_thoughts: user.usage?.sync_thoughts ?? 0,
        daily_anchor: user.usage?.daily_anchor ?? today,
        weekly_anchor: user.usage?.weekly_anchor ?? today,
        monthly_anchor: user.usage?.monthly_anchor ?? today,
        weekly_top_count: user.usage?.weekly_top_count ?? 0,
        weekly_medium_count: user.usage?.weekly_medium_count ?? 0,
        weekly_small_count: user.usage?.weekly_small_count ?? 0,
        monthly_top_count: user.usage?.monthly_top_count ?? 0,
        monthly_medium_count: user.usage?.monthly_medium_count ?? 0,
        monthly_small_count: user.usage?.monthly_small_count ?? 0,
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
      await get().refreshProfile();
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
      // Ensure UI suspends while we process the login flow and build the user DB.
      const { useStore } = await import('../useStore');
      useStore.setState({ isInitializing: true, isSpaceLoading: true });

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

      // Clean up the URL securely so a manual refresh doesn't replay the auth code
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (err: any) {
      console.error('Auth code handling failed:', err);
      const { useModalStore } = await import('../useModalStore');
      const { useStore } = await import('../useStore');

      // Clear the loading lock on failure
      useStore.setState({ isInitializing: false, isSpaceLoading: false });

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
    
    if (typeof useStore.getState().createInitialWorkspace === 'function') {
      await useStore.getState().createInitialWorkspace();
    }
    
    const guestSpacesCount = await db.spaces.filter(s => s.userId === 'guest' && !s.deletedAt).count();
    if (guestSpacesCount === 0) {
      console.log('[Auth] No guest space found after logout, generating safe-haven space...');
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
    window.location.reload(); 
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
    if (!accessToken || !user) {
      console.warn('[Auth] refreshProfile: No accessToken or user, cannot refresh');
      return;
    }

    if (refreshProfilePromise) return refreshProfilePromise;

    refreshProfilePromise = (async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);

        // 1. First, always try to refresh the profile data from Supabase to ensure we have the latest plan
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

            // Save refreshSecret if present in profile
            const profileAny = supabaseUser as any;
            if (profileAny.refreshSecret) {
              localStorage.setItem('cyberia-refresh-secret', profileAny.refreshSecret);
              set({ refreshSecret: profileAny.refreshSecret });
            }

            set({ user: updatedUser });
            localStorage.setItem('cyberia-user', JSON.stringify(updatedUser));
            console.log('[Auth] Profile refreshed from Supabase. Plan:', updatedUser.plan);
          }
        } catch (err: any) {
          console.warn('[Auth] Profile sync failed:', err.message);
        }

        // 2. Then, try to refresh the Google OAuth token if we have a refreshSecret
        if (refreshSecret) {
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
            if (err.name === 'AbortError') {
              console.log('[Auth] Token refresh heartbeat timed out.');
            } else {
              console.warn('[Auth] Token refresh error:', err.message);
            }
          }
        } else {
          // Legacy/missing refreshSecret fallback
          console.warn('[Auth] No refreshSecret, skipping OAuth token refresh');
        }

        clearTimeout(timeoutId);
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

    // Reduced buffer to 1 minute to minimize unnecessary refreshes
    const BUFFER_MS = 60 * 1000;
    const now = Date.now();
    
    if (!accessToken || !accessTokenExpiresAt || (accessTokenExpiresAt - now) < BUFFER_MS) {
      console.log('[Auth] OIDC token near expiry, enforcing manual refresh.');
      await get().refreshProfile();
      return get().accessToken;
    }

    return accessToken;
  },

  setupRefreshInterval: () => {
    if (refreshInterval) clearInterval(refreshInterval);
    
    refreshInterval = setInterval(() => {
      const { status, isOnline } = get();
      if (status === 'authenticated' && isOnline) {
        console.log('[Auth] Core Loop: Processing token/profile maintenance.');
        get().refreshProfile();
      }
    }, 55 * 60 * 1000); // 55 minutes - tokens expire at 60 min
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

  // Centralized quota update - single source of truth for all components
  updateQuotaUsage: (usageData: {
    daily_anchor?: string;
    weekly_anchor?: string;
    monthly_anchor?: string;
    ai_daily_count?: number;
    ai_top_count?: number;
    ai_medium_count?: number;
    ai_small_count?: number;
    weekly_top_count?: number;
    weekly_medium_count?: number;
    weekly_small_count?: number;
    monthly_top_count?: number;
    monthly_medium_count?: number;
    monthly_small_count?: number;
  }) => {
    const { user } = get();
    if (!user) return;
    
    const updatedUser = {
      ...user,
      usage: {
        ...user.usage,
        ...usageData,
      }
    };
    
    set({ user: updatedUser });
    // Note: We don't persist to localStorage here - quota is fetched fresh from API
    // This in-memory state is shared across all components for real-time updates
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
      
      if (space.theme && !freeThemes.includes(space.theme)) {
        updates.theme = 'cyberia';
        needsUpdate = true;
      }
      
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