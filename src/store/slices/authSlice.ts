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
      syncOrchestrator.setupRealtimeListener(currentUser.id);

      console.log('[AUTH] Phase 1: Importing cloud data...');
      await get().handlePostAuthSync();

      console.log('[AUTH] Phase 2: Assessing State for Migration...');
      const { useStore } = await import('../useStore');
      const { useModalStore } = await import('../useModalStore');
      const store = useStore.getState();

      // Prevention: Don't show the migration prompt if the user dismissed it in this session
      const isDismissed = localStorage.getItem('cyberia-migration-dismissed') === currentUser.id;

      try {
        // 1. Get Cloud Count (Reliable Source from Supabase directly)
        const cloudSpaces = await supabaseSync.getSpaces(currentUser.id, 'id');
        const cloudCount = cloudSpaces.spaces?.length || 0;

        // 2. Get Local Count (Spaces with Thoughts)
        // We filter for spaces that actually have content to avoid migrating empty "New Tab" spaces
        const localGuestSpaces = await db.spaces.where('userId').equals('guest').toArray();
        let localCount = 0;
        
        for (const space of localGuestSpaces) {
          const thoughtCount = await db.thoughts.where('spaceId').equals(space.id).filter(t => !t.deletedAt).count();
          if (thoughtCount > 0) localCount++;
        }

        console.log(`[AUTH] Matrix Assessment: Local=${localCount}, Cloud=${cloudCount}`);

        if (isDismissed) {
          console.log('[AUTH] Migration prompt was previously dismissed, skipping assessment.');
          return;
        }

        // 3. Execute Matrix
        if (localCount > 0 && cloudCount === 0) {
          // Case 1: Auto-migrate (Local content, no cloud content)
          console.log('[AUTH] Case 1: Auto-migrating local work...');
          if (typeof store.migrateGuestSpaces === 'function') {
            await store.migrateGuestSpaces(currentUser.id);
            await store.refreshSpaces();
            await store.refreshThoughts();
          }
        } else if (localCount === 0 && cloudCount > 0) {
          // Case 2: Cloud content only (No local content with thoughts)
          console.log('[AUTH] Case 2: Cloud content only. No migration needed.');
        } else if (localCount > 0 && cloudCount > 0) {
          // Case 3: Conflict (Both exist) -> Quota Check & Modal
          console.log('[AUTH] Case 3: Conflict detected. Checking quota...');
          
          const limits = store.getLimits();
          const totalSpaces = localCount + cloudCount;
          const isWithinLimit = totalSpaces <= limits.MAX_SPACES;

          if (isWithinLimit) {
            // Prompt: Migrate?
            useModalStore.getState().openModal({
              title: 'Move Local Work?',
              description: `You have ${localCount} local space(s) and ${cloudCount} account space(s). Would you like to move your local work into your account?`,
              type: 'alert',
              confirmText: 'Move to Account',
              cancelText: 'Keep Separate',
              onConfirm: async () => {
                useStore.setState({ isInitializing: true });
                if (typeof store.migrateGuestSpaces === 'function') {
                  await store.migrateGuestSpaces(currentUser.id);
                }
                window.location.reload();
              },
              onCancel: () => {
                // Set dismissal flag to prevent loop
                localStorage.setItem('cyberia-migration-dismissed', currentUser.id);
                window.location.reload();
              }
            });
          } else {
            // Prompt: Limit Exceeded
            useModalStore.getState().openModal({
              title: 'Space Limit Reached',
              description: `Moving local work would exceed your plan limit of ${limits.MAX_SPACES} spaces. Upgrade to Pro or keep them local for now.`,
              type: 'alert',
              confirmText: 'Upgrade to Pro',
              cancelText: 'Keep Separate',
              onConfirm: () => {
                useModalStore.getState().openPricing();
                useStore.setState({ isInitializing: false });
              },
              onCancel: () => {
                localStorage.setItem('cyberia-migration-dismissed', currentUser.id);
                window.location.reload();
              }
            });
          }
        } else {
          console.log('[AUTH] Case 0: Fresh start.');
        }

      } catch (err) {
        console.warn('[Auth] Initialization matrix failed:', err);
      } finally {
        // Ensure initialization flag is cleared so UI can render
        useStore.setState({ isInitializing: false });
      }

      try {
        await get().refreshProfile();
      } catch (err) {
        console.warn('[Auth] Initialization failed:', err);
      }

      if (get().autoSync && get().isOnline) {
        setTimeout(() => syncOrchestrator.triggerSync(true), 500);
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

    set({
      user: userWithDefaults,
      accessToken: token,
      accessTokenExpiresAt: expiryTime,
      refreshSecret: refreshSecret || get().refreshSecret,
      grantedScopes: scopes || get().grantedScopes,
      status: 'authenticated',
      syncStatus: 'syncing'
    });

    const { useStore } = await import('../useStore');
    useStore.setState({ isInitializing: true });

    get().setupRefreshInterval();

    // Start instant realtime listener
    syncOrchestrator.setupRealtimeListener(userWithDefaults.id);

    try {
      console.log('[AUTH] setAuthenticatedUser started for user:', userWithDefaults.id);
      const store = useStore.getState();

      // Step 1: Ensure user has at least one workspace
      console.log('[AUTH] Step 1: Running ensureWorkspaceForCurrentUser');
      if (typeof store.ensureWorkspaceForCurrentUser === 'function') {
        await store.ensureWorkspaceForCurrentUser();
      }

      // Step 2: Get latest profile (plan, etc.)
      console.log('[AUTH] Step 2: Running refreshProfile');
      await get().refreshProfile();

      // Step 3: Import cloud data (the cloud handshake)
      console.log('[AUTH] Step 3: Running handlePostAuthSync');
      await get().handlePostAuthSync();
      
      console.log('[AUTH] Step 4: Migrating guest spaces...');
      const migratedStore = useStore.getState();
      if (typeof migratedStore.migrateGuestSpaces === 'function') {
        const result = await migratedStore.migrateGuestSpaces(userWithDefaults.id);
        console.log('[AUTH] Guest migration complete:', result);
      }
      
      console.log('[AUTH] Full login sequence complete');
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
    
    // Ensure a guest space exists (createInitialWorkspace may skip if old user spaces exist)
    const guestSpacesCount = await db.spaces.filter(s => s.userId === 'guest' && !s.deletedAt).count();
    if (guestSpacesCount === 0) {
      console.log('[Auth] No guest space found after logout, creating one...');
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
    
    // Refresh page to re-initialize everything (view switcher, etc.)
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
