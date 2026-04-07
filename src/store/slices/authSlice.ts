import { syncOrchestrator } from '../../services/sync/syncOrchestrator';
import { type StateCreator } from 'zustand';
import { type User, type SubscriptionPlan, type AccessPeriod, PLAN_CONFIG } from '../../constants';
import { db } from '../../db';
import { supabaseSync } from '../../services/supabaseSync';
import { type AuthState } from '../types';
import { supabaseStorage, isStorageUrl } from '../../services/supabaseStorage';
import { supabase } from '../../services/supabase';

let refreshInterval: ReturnType<typeof setInterval> | null = null;
let planHealthCheckInterval: ReturnType<typeof setInterval> | null = null;

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
          theme: (typeof window !== 'undefined' && localStorage.getItem('cyberia-theme') as 'dark' | 'light') || 'light',
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

  // Only show loading if we don't have an active space yet or it's a fresh login
  const isAlreadyInitialized = !store.isInitializing;
  if (isFreshLogin || !isAlreadyInitialized) {
    store.setInitializationState(true, true);
  }

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
      const thoughtCount = await db.thoughts.where('spaceId').equals(space.id).filter(t => !t.deletedAt && !t.archivedAt).count();
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
      // Use the unified handshake to reconcile cloud vs local
      if (cloudData) {
        await syncOrchestrator.handshake(cloudData);
      } else {
        // Fallback if cloud fetch failed
        if (typeof get().handlePostAuthSync === 'function') {
          await get().handlePostAuthSync();
        }
        await store.refreshSpaces();
        await store.refreshThoughts();
      }

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
      store.setInitializationState(false, false);

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
              store.setInitializationState(true, true);
              if (typeof store.migrateGuestSpaces === 'function') {
                await store.migrateGuestSpaces(user.id);
              }
              await finalizeSetup();
              resolve();
            },
            onCancel: async () => {
              store.setInitializationState(true, true);
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
              store.setInitializationState(true, true);
              window.location.href = '/pricing';
              await applyCloudDataIfNeeded();
              await finalizeSetup();
              resolve();
            },
            onCancel: async () => {
              store.setInitializationState(true, true);
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
    store.setInitializationState(false, false);
  }
}

export const createAuthSlice: StateCreator<AuthState, [], [], any> = (set, get, _api) => ({
  user: getInitialUser(),
  accessToken: null,
  accessTokenExpiresAt: null,
  refreshSecret: null,
  grantedScopes: [],
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
    // Store cleanup functions for signOut
    const handleOnline = async () => { 
      set({ isOnline: true });
      if (typeof get().processOfflineChanges === 'function') {
        await get().processOfflineChanges();
      }
    };
    const handleOffline = () => set({ isOnline: false, syncStatus: 'offline' });
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Store cleanup functions on the slice for removal in signOut
    (get() as any)._eventListenerCleanup = () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
    
    get().fetchModelConfig();

    const currentUser = get().user;
    if (get().status === 'authenticated' && currentUser?.id) {
      syncOrchestrator.setupRealtimeListener(currentUser.id);
      
      console.log('[AUTH] initAuth: Running sync flow for returning authenticated user');
      
      // Always fetch fresh profile from database - this ensures plan updates
      // are picked up on every app load (like logout/login does)
      await get().refreshProfile();
      
      // Pass false for isFreshLogin -> prevents re-downloading/overwriting offline work
      await runAuthenticationFlow(currentUser, get, false);
    }

    // ============================================================
    // Handle Supabase OAuth session
    // ============================================================
    
    // 1. Check for existing session (from OAuth redirect)
    const { data: { session: existingSession } } = await supabase.auth.getSession();
    if (existingSession) {
      console.log('[Auth] Found existing Supabase session on init, processing...');
      await get().handleSupabaseSession(existingSession);
      return; // handleSupabaseSession will run full auth flow
    }

    // 2. Set up auth state listener for future session changes
    supabase.auth.onAuthStateChange((event, session) => {
      console.log('[Auth] Auth state changed:', event, session ? 'with session' : 'no session');
      
      if (event === 'SIGNED_IN' && session) {
        get().handleSupabaseSession(session);
      } else if (event === 'SIGNED_OUT') {
        get().signOut();
      } else if (event === 'TOKEN_REFRESHED' && session) {
        // Token refreshed - Supabase handles this automatically
        console.log('[Auth] Token refreshed by Supabase');
      }
    });
  },

  setAuthenticatedUser: async (user: User, token: string, _refreshSecret?: string, _scopes?: string[], _expiresIn?: number) => {
    const today = new Date().toISOString().split('T')[0];
    
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
        theme: (typeof window !== 'undefined' && localStorage.getItem('cyberia-theme') as 'dark' | 'light') || 'light',
        autoSync: user.settings?.autoSync ?? true,
        space: user.settings?.space ?? 'default',
      }
    };

    // If switching accounts in the same session, strictly clear in-memory caches
    try {
      const prevUserId = get().user?.id;
      if (prevUserId && prevUserId !== userWithDefaults.id) {
        const { useStore } = await import('../useStore');
        useStore.getState().clearWorkspaceData();
      }
    } catch {
      // ignore cleanup if store isn't ready yet
    }
    
    localStorage.setItem('cyberia-user', JSON.stringify(userWithDefaults));
    
    // Note: Token is managed by Supabase client, not stored in localStorage
    // The `token` parameter is kept for API compatibility but not persisted

    set({
      user: userWithDefaults,
      accessToken: token,
      accessTokenExpiresAt: null,
      refreshSecret: null,
      grantedScopes: [],
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

  signOut: async () => {
    const { useStore } = await import('../useStore');
    useStore.getState().setInitializing(true);
    
    set({ status: 'loading' });
    await new Promise(resolve => setTimeout(resolve, 500));
    syncOrchestrator.cleanupRealtimeListener();
    
    // Cleanup event listeners from initAuth
    const cleanup = (get() as any)._eventListenerCleanup;
    if (typeof cleanup === 'function') {
      cleanup();
      (get() as any)._eventListenerCleanup = null;
    }
    
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
    if (planHealthCheckInterval) {
      clearInterval(planHealthCheckInterval);
      planHealthCheckInterval = null;
    }
    
    // Sign out from Supabase first (clears session cookie)
    try {
      await supabase.auth.signOut();
      console.log('[Auth] Supabase signed out');
    } catch (err) {
      console.warn('[Auth] Supabase sign out error:', err);
    }
    
    localStorage.removeItem('cyberia-user');
    localStorage.removeItem('cyberia-token');
    localStorage.removeItem('cyberia-token-expiry');
    localStorage.removeItem('cyberia-last-sync');
    localStorage.removeItem('cyberia-scopes');
    localStorage.removeItem('cyberia-refresh-secret');
    localStorage.removeItem('cyberia-active-space-id');
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
    
    const storedTheme = (typeof window !== 'undefined' && localStorage.getItem('cyberia-theme')) || 'light';
    useStore.getState().resetStoreState(storedTheme as 'dark' | 'light');
    document.body.setAttribute('data-theme', storedTheme);
    
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
        physics: localStorage.getItem('cyberia-physics-enabled') !== 'false',
        order: 0,
        updatedAt: now,
      };
      await db.spaces.add(guestSpace);
      localStorage.setItem('cyberia-active-space-id', workspaceId);
      await useStore.getState().refreshSpaces();
    }
    
    useStore.getState().setInitializing(false);
    
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
        subscriptionStatus: 'expired',
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
    const { user } = get();
    if (!user) {
      console.warn('[Auth] refreshProfile: No user, cannot refresh');
      return;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      // Refresh profile data from Supabase
      const supabaseProfile = await supabaseSync.getProfile(user.id);
      if (supabaseProfile?.user) {
        const supabaseUser = supabaseProfile.user;
        
        const updatedUser = { 
          ...user, 
          plan: supabaseUser.plan || 'free',
          settings: {
            ...user.settings,
            autoSync: supabaseUser.settings?.autoSync ?? user.settings?.autoSync ?? true,
            personality: supabaseUser.settings?.personality ?? user.settings?.personality,
          }
        };
        
        const wasPro = user.plan === 'pro';
        const isProNow = updatedUser.plan === 'pro';
        
        if (wasPro && !isProNow) {
          console.log('[Auth] Plan regression detected.');
          get().handlePlanRegression();
          setHasRegressedToFree(true);
        } else if (!wasPro && isProNow) {
          console.log('[Auth] Plan renewed.');
          setHasRegressedToFree(false);
        } else if (isProNow && getHasRegressedToFree()) {
          setHasRegressedToFree(false);
        }

        set({ user: updatedUser });
        localStorage.setItem('cyberia-user', JSON.stringify(updatedUser));
        console.log('[Auth] Profile refreshed. Plan:', updatedUser.plan);
      }
      
      clearTimeout(timeoutId);
    } catch (err: any) {
      console.warn('[Auth] Profile refresh failed:', err.message);
    }
  },

  getOrRefreshToken: async () => {
    // Delegates to Supabase session - Supabase handles token refresh automatically
    return get().getSessionToken();
  },

  getSessionToken: async () => {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.error('[Auth] Session error:', error);
        return null;
      }
      return data.session?.access_token ?? null;
    } catch (err) {
      console.error('[Auth] Failed to get session token:', err);
      return null;
    }
  },

  /**
   * Process a Supabase OAuth session and convert it to app user.
   * users.id = auth.users.id (UUID), so we query directly by id.
   */
  handleSupabaseSession: async (session: any) => {
    if (!session?.user) {
      console.warn('[Auth] No session user to process');
      return;
    }

    const sbUser = session.user;
    const userId = sbUser.id; // users.id = auth.users.id
    const accessToken = session.access_token;
    const email = sbUser.email || '';
    const name = sbUser.user_metadata?.full_name || sbUser.user_metadata?.name || '';
    const avatar = sbUser.user_metadata?.avatar_url || sbUser.user_metadata?.picture || '';

    console.log('[Auth] Processing Supabase session for:', email, 'userId:', userId);

    try {
      // Try to find existing user by id (users.id = auth.users.id)
      let { data: existingUser, error: lookupError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (lookupError) {
        console.error('[Auth] Error looking up user:', lookupError);
      }

      let isNewUser = false;

      if (existingUser) {
        // Use existing user
        console.log('[Auth] Found existing user:', userId);
      } else {
        // Create new user - use the auth UUID as the ID
        isNewUser = true;
        console.log('[Auth] Creating new user:', userId);
      }

      // Upsert user profile in public.users
      const { error: upsertError } = await supabase
        .from('users')
        .upsert({
          id: userId,
          email,
          name,
          avatar,
        }, { onConflict: 'id' });

      if (upsertError) {
        console.error('[Auth] Error upserting user:', upsertError);
      }

      // Create user_usage row for new users
      if (isNewUser) {
        const { error: usageError } = await supabase
          .from('user_usage')
          .insert({ user_id: userId });
        if (usageError) {
          console.error('[Auth] Error creating user_usage:', usageError);
        }
      }

      // Build the app User object
      const appUser: User = {
        id: userId,
        email,
        name,
        avatar,
        plan: 'free',
        subscriptionStatus: 'none',
        expiryDate: null,
        usage: {
          ai_daily_count: 0,
          ai_top_count: 0,
          ai_medium_count: 0,
          ai_small_count: 0,
          sync_thoughts: 0,
          daily_anchor: new Date().toISOString().split('T')[0],
          weekly_anchor: new Date().toISOString().split('T')[0],
          monthly_anchor: new Date().toISOString().split('T')[0],
          weekly_top_count: 0,
          weekly_medium_count: 0,
          weekly_small_count: 0,
          monthly_top_count: 0,
          monthly_medium_count: 0,
          monthly_small_count: 0,
        },
        settings: {
          theme: (typeof window !== 'undefined' && localStorage.getItem('cyberia-theme') as 'dark' | 'light') || 'light',
          autoSync: true,
          space: 'default',
        },
      };

      // Write to localStorage and Zustand using setAuthenticatedUser
      await get().setAuthenticatedUser(appUser, accessToken, undefined, undefined, undefined);

      console.log('[Auth] handleSupabaseSession complete. isNewUser:', isNewUser);

    } catch (err) {
      console.error('[Auth] handleSupabaseSession error:', err);
    }
  },

  setupRefreshInterval: () => {
    // Plan health check - 5 minute fallback if realtime disconnects
    if (planHealthCheckInterval) clearInterval(planHealthCheckInterval);
    planHealthCheckInterval = setInterval(() => {
      const { status, isOnline } = get();
      if (status === 'authenticated' && isOnline) {
        console.log('[Auth] Plan health check (realtime fallback)...');
        get().refreshProfile();
      }
    }, 5 * 60 * 1000); // 5 minutes

    // Supabase handles token refresh automatically - no manual refresh needed
  },

  updateSettings: async (settings: Partial<User['settings']>) => {
    const { user } = get();
    if (!user) return;
    
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
    const { user } = get();
    if (!user) return;

    const freeThemes = PLAN_CONFIG.free.THEMES_ENABLED;
    const spaces = await db.spaces.where('userId').equals(user.id).toArray();
    const now = Date.now();
    
    for (const space of spaces) {
      let needsUpdate = false;
      const updates: any = { updatedAt: now, syncStatus: 'local' };
      
      if (space.theme && !freeThemes.includes(space.theme)) {
        updates.theme = 'dark';
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

  mergeUserData: (userData: Partial<User>) => {
    const { user } = get();
    if (!user) return;
    const updatedUser = { ...user, ...userData };
    set({ user: updatedUser as User });
    localStorage.setItem('cyberia-user', JSON.stringify(updatedUser));
  },

  deleteCloudData: async () => {
    const { isOnline, user } = get();
    if (!isOnline || !user) return;

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