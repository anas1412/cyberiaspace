import { create } from 'zustand';
import { type User, type SubscriptionPlan, type AccessPeriod, PLAN_CONFIG } from '../constants';
import { db } from '../db';
import { supabaseSync } from '../services/supabaseSync';
import { supabaseStorage } from '../services/supabaseStorage';
import { syncOrchestrator } from '../services/sync/syncOrchestrator';

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  grantedScopes: string[];
  status: 'idle' | 'loading' | 'authenticated' | 'unauthenticated';
  syncStatus: 'synced' | 'syncing' | 'error' | 'offline';
  lastSync: Date | null;
  autoSync: boolean;
  cloudUsage: number;
  storageUsageMB: number;
  isOnline: boolean;

  setAuthenticatedUser: (user: User, token: string, scopes?: string[]) => Promise<void>;
  handleAuthCode: (code: string) => Promise<void>;
  requestServiceAccess: (scope: string, token: string) => void;
  signOut: () => Promise<void>;
  syncData: () => Promise<void>;
  syncToServices: () => Promise<void>;
  deleteServiceContent: (thought: any) => Promise<void>;
  processPendingDeletions: () => Promise<void>;
  processOfflineChanges: () => Promise<void>;
  processPendingBlobs: () => Promise<void>;
  uploadThoughtBlob: (thoughtId: number) => Promise<void>;
  importCloudData: () => Promise<unknown | null>;
  setAutoSync: (enabled: boolean) => void;
  deleteCloudData: () => Promise<void>;
  calculateUsage: (thoughtCount: number) => void;
  initAuth: () => void;
  handlePostAuthSync: () => Promise<void>;
  _syncPromise: Promise<void> | null;
  mediaSweep: () => Promise<void>;
  upgradePlan: (plan: SubscriptionPlan, period?: AccessPeriod) => void;
  checkExpiry: () => void;
  refreshProfile: () => Promise<void>;
  updateSettings: (settings: Partial<User['settings']>) => Promise<void>;
  cancelSubscription: () => void;
}

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

export const useAuthStore = create<AuthState>((set, get) => ({
  user: getInitialUser(),
  accessToken: localStorage.getItem('cyberia-token'),
  grantedScopes: JSON.parse(localStorage.getItem('cyberia-scopes') || '[]'),
  status: localStorage.getItem('cyberia-user') ? 'authenticated' : 'unauthenticated',
  syncStatus: navigator.onLine ? (localStorage.getItem('cyberia-user') ? 'synced' : 'offline') : 'offline',
  lastSync: localStorage.getItem('cyberia-last-sync') ? new Date(localStorage.getItem('cyberia-last-sync')!) : null,
  autoSync: localStorage.getItem('cyberia-auto-sync') !== 'false',
  cloudUsage: 0,
  storageUsageMB: 0,
  isOnline: navigator.onLine,
  _syncPromise: null as Promise<void> | null,

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

  handlePostAuthSync: async () => {
    // Coalesce multiple calls into one
    if (get()._syncPromise) {
      console.log('[Sync] Coalescing handlePostAuthSync call...');
      return get()._syncPromise!;
    }

    const syncTask = (async () => {
      const { useStore } = await import('./useStore');
      const isBooting = useStore.getState().isInitializing;
      
      console.log('[Sync] Starting handlePostAuthSync...');
      set({ syncStatus: 'syncing' });
      
      // Start global loading state
      useStore.setState({ isInitializing: true });
      
      try {
        const data: any = await get().importCloudData();
        console.log('[Sync] Cloud data fetched:', data ? 'Data exists' : 'No data');
        
        // Check if cloud data is actually meaningful
        const cloudIsEmpty = !data || (
          (!data.thoughts || data.thoughts.length === 0) && 
          (!data.spaces || data.spaces.length <= 1)
        );

        if (data && !cloudIsEmpty) {
          console.log('[Sync] Cloud data found, showing conflict modal...');
          const { useModalStore } = await import('./useModalStore');
          
          useStore.setState({ isInitializing: false });

          await new Promise((resolve) => {
            useModalStore.getState().openModal({
              title: 'Choose Data Source',
              description: 'Do you want to use your cloud backup or keep your local workspace?',
              type: 'conflict_resolver',
              onConfirm: async (choice) => {
                console.log('[Sync] User choice:', choice);
                useStore.setState({ isInitializing: true });
                try {
                  if (choice === 'cloud') {
                    await useStore.getState().importFullState(data);
                  } else if (choice === 'local') {
                    await syncOrchestrator.fullPushSync();
                  }
                  const now = new Date();
                  set({ lastSync: now, syncStatus: 'synced' });
                  localStorage.setItem('cyberia-last-sync', now.toISOString());
                  
                  const validPaths = new Set<string>();
                  const allThoughts = await db.thoughts.toArray();
                  for (const t of allThoughts) {
                    if (t.storagePath) validPaths.add(t.storagePath);
                  }
                  await supabaseStorage.cleanupOrphanedFiles(get().user!.id, validPaths);
                  
                  await get().mediaSweep();
                } finally {
                  useStore.setState({ isInitializing: false });
                  resolve(void 0);
                }
              }
            });
          });
        } else if (!data || cloudIsEmpty) {
          console.log('[Sync] Cloud is empty or no data, pushing local data to cloud...');
          if (get().status === 'authenticated') {
            await syncOrchestrator.fullPushSync();
            await get().mediaSweep();
          }
        }
        
        const now = new Date();
        set({ syncStatus: 'synced', lastSync: now });
        localStorage.setItem('cyberia-last-sync', now.toISOString());
        console.log('[Sync] Post-auth sync complete.');
      } catch (e: any) {
        console.error('[Sync] Post-auth sync failed:', e);
        set({ syncStatus: 'error' });
      } finally {
        set({ _syncPromise: null });
        // Only clear initializing if we are actually in a booting sequence
        if (isBooting) {
          useStore.setState({ isInitializing: false });
        }
      }
    })();

    set({ _syncPromise: syncTask });
    return syncTask;
  },

  mediaSweep: async () => {
    const { autoSync, user, isOnline } = get();
    if (!autoSync || !user) return;

    console.log('[Storage] Conducting Media Sweep...');
    try {
      const { useStore } = await import('./useStore');
      const mediaThoughts = await db.thoughts
        .filter(t => (t.type === 'image' || t.type === 'file') && t.syncStatus !== 'synced')
        .toArray();

      if (mediaThoughts.length === 0) {
        console.log('[Sync] Media sweep: Nothing to upload.');
        return;
      }

      console.log(`[Sync] Media sweep: Found ${mediaThoughts.length} items to upload.`);
      
      for (const t of mediaThoughts) {
        const blobEntry = await db.blobs.where('thoughtId').equals(t.id).first();
        
        if (!blobEntry) {
          console.log(`[Sync] Media sweep: Blob not found for thought ${t.id}, skipping`);
          continue;
        }

        if (!isOnline) {
          await db.pendingBlobs.add({
            thoughtId: t.id,
            name: blobEntry.name,
            type: blobEntry.type,
            createdAt: Date.now(),
            retryCount: 0
          });
          await db.thoughts.update(t.id, { syncStatus: 'pending' });
          continue;
        }

        useStore.getState().updateThought(t.id, { syncStatus: 'syncing' });

        try {
          const result = await supabaseStorage.uploadFile(
            user.id,
            blobEntry.blob,
            blobEntry.name
          );

          await db.thoughts.update(t.id, {
            storageUrl: result.url,
            storagePath: result.path,
            syncStatus: 'synced'
          });
          
          console.log(`[Sync] Media sweep: Uploaded ${t.id}`);
        } catch (err) {
          console.error(`[Sync] Media sweep: Failed to upload ${t.id}:`, err);
          await db.thoughts.update(t.id, { syncStatus: 'error' });
        }
      }
      
      console.log('[Sync] Media sweep complete.');
    } catch (err) {
      console.error('[Sync] Media sweep failed:', err);
    }
  },


  checkExpiry: () => {
    const { user } = get();
    if (!user || user.plan === 'free' || !user.expiryDate) return;
    if (new Date(user.expiryDate) < new Date()) {
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
      const supabaseProfile = await supabaseSync.getProfile(user.id);
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
        // User doesn't exist in Supabase - create them
        console.log('[Auth] Creating new user in Supabase...');
        await supabaseSync.upsertProfile(user.id, user.email || '', user.name || '', user.avatar || '');
      }
    } catch (e) {
      console.warn('Failed to refresh profile', e);
    }
  },


  updateSettings: async (settings) => {
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

  upgradePlan: (plan, period) => {
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

  cancelSubscription: () => {
    const { user } = get();
    if (!user) return;
    const updatedUser: User = { ...user, plan: 'free', expiryDate: null };
    set({ user: updatedUser });
    localStorage.setItem('cyberia-user', JSON.stringify(updatedUser));
  },

  calculateUsage: async (thoughtCount: number) => {
    const { user } = get();
    const plan = user?.plan || 'free';
    
    // Calculate cloud thoughts usage
    const thoughtLimit = PLAN_CONFIG[plan].MAX_CLOUD_THOUGHTS;
    const currentCount = user?.usage?.sync_thoughts ?? thoughtCount;
    
    // Calculate storage usage
    let storageMB = 0;
    if (user?.id) {
      try {
        const bytes = await supabaseStorage.getStorageUsage(user.id);
        storageMB = bytes / (1024 * 1024);
      } catch (e) {
        console.warn('[Storage] Could not fetch storage usage:', e);
      }
    }
    
    set({ 
      cloudUsage: (currentCount / thoughtLimit) * 100,
      storageUsageMB: storageMB 
    });
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

    // Sync user to Supabase on login
    console.log('[Supabase] Starting user sync to Supabase...')
    try {
      console.log('[Supabase] Syncing user to Supabase:', user.id, user.email)
      const result = await supabaseSync.upsertProfile(user.id, user.email, user.name, user.avatar || '')
      console.log('[Supabase] User synced successfully:', result)
    } catch (e) {
      console.error('[Supabase] ❌ Failed to sync user:', e)
    }

    const { useStore } = await import('./useStore');
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
      const { useModalStore } = await import('./useModalStore');
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
    const { useStore } = await import('./useStore');
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

  uploadThoughtBlob: async (thoughtId: number) => {
    const { autoSync, user, isOnline } = get();
    if (!autoSync || !user) {
      console.log('[Storage] Auto-sync is OFF, keeping blob locally');
      return;
    }

    try {
      const { useStore } = await import('./useStore');

      const blobEntry = await db.blobs.where('thoughtId').equals(thoughtId).first();
      const thought = await db.thoughts.get(thoughtId);

      if (!blobEntry || !thought) return;

      // Check file size
      const sizeCheck = supabaseStorage.checkFileSize(blobEntry.blob)
      if (!sizeCheck.valid) {
        console.error('[Storage] File too large:', sizeCheck.message)
        await db.thoughts.update(thoughtId, { syncStatus: 'error' })
        return
      }

      // If offline, queue for later
      if (!isOnline) {
        console.log('[Storage] Offline, queuing blob for later upload');
        await db.pendingBlobs.add({
          thoughtId,
          name: blobEntry.name,
          type: blobEntry.type,
          createdAt: Date.now(),
          retryCount: 0
        });
        await db.thoughts.update(thoughtId, { syncStatus: 'pending' });
        return;
      }

      useStore.getState().updateThought(thoughtId, { syncStatus: 'syncing' });

      const result = await supabaseStorage.uploadFile(
        user.id,
        blobEntry.blob,
        blobEntry.name
      );

      await db.thoughts.update(thoughtId, {
        storageUrl: result.url,
        storagePath: result.path,
        syncStatus: 'synced',
      });

      useStore.getState().updateThought(thoughtId, {
        storageUrl: result.url,
        storagePath: result.path,
        syncStatus: 'synced'
      });

    } catch (err) {
      console.error('[Storage] Failed to upload blob:', err);
      await db.thoughts.update(thoughtId, { syncStatus: 'error' });
    }
  },

  importCloudData: async () => {
    const { accessToken, isOnline, user } = get();
    if (!accessToken || !isOnline || !user) return null;

    set({ syncStatus: 'syncing' });
    try {
      const data = await syncOrchestrator.fetchCloudData();
      set({ syncStatus: 'synced' });
      return data;
    } catch (err) {
      console.warn('[Sync] importCloudData failed (user may not exist in Supabase yet):', err);
      set({ syncStatus: 'synced' });
      return null;
    }
  },

  _syncDebounceTimer: null as NodeJS.Timeout | null,
  
  syncData: async () => {
    console.log('[Auth] syncData called - forcing manual sync');
    await syncOrchestrator.fullPushSync();
  },

  syncToServices: async () => {
    const { autoSync, user } = get();
    if (!autoSync || !user) return;

    // Media files are now synced via uploadThoughtBlob
    // This function can be used for additional cloud operations if needed
    console.log('[Storage] Service sync is now handled via Supabase Storage');
  },

  deleteServiceContent: async (thought: any) => {
    const { user } = get();
    if (!user) return;

    // Get storage path from thought
    const latest = await db.thoughts.get(thought.id).catch(() => null);
    const storagePath = latest?.storagePath || thought.storagePath;

    if (!storagePath) return;

    // Add to pending deletions for retry
    await db.pendingDeletions.add({
      tableName: 'thoughts',
      localId: thought.id,
      storagePath: storagePath,
      createdAt: Date.now(),
    }).catch(() => {});

    // Try immediate deletion
    if (get().isOnline) {
      try {
        console.log(`[Storage] Deleting: ${storagePath}`);
        await supabaseStorage.deleteFile(storagePath);
        // Remove from pending
        const pending = await db.pendingDeletions.where('storagePath').equals(storagePath).first();
        if (pending?.id) {
          await db.pendingDeletions.delete(pending.id);
        }
        console.log('[Storage] Deletion successful');
      } catch (err) {
        console.warn('[Storage] Immediate deletion failed (will retry):', err);
      }
    }
  },

  processPendingDeletions: async () => {
    const { isOnline, user } = get();
    if (!isOnline || !user) return;

    try {
      const pending = await db.pendingDeletions.toArray();
      if (pending.length === 0) return;

      console.log(`[Storage] Processing ${pending.length} pending deletions...`);

      for (const item of pending) {
        if (item.storagePath) {
          try {
            await supabaseStorage.deleteFile(item.storagePath);
            await db.pendingDeletions.delete(item.id!);
            console.log(`[Storage] Deleted: ${item.storagePath}`);
          } catch (err: any) {
            if (err.message?.includes('404') || err.message?.includes('not found')) {
              await db.pendingDeletions.delete(item.id!);
            } else {
              console.warn(`[Storage] Failed to delete ${item.storagePath}:`, err);
            }
          }
        }
      }
    } catch (err) {
      console.error('[Storage] Pending deletions failed:', err);
    }
  },

  processOfflineChanges: async () => {
    const { isOnline, user, autoSync } = get();
    if (!isOnline || !user || !autoSync) return;

    await syncOrchestrator.fullPushSync();
  },

  processPendingBlobs: async () => {
    const { isOnline, user, autoSync } = get();
    if (!isOnline || !user || !autoSync) return;

    try {
      const blobs = await db.pendingBlobs.where('retryCount').below(3).toArray();
      if (blobs.length === 0) return;

      console.log(`[Storage] Processing ${blobs.length} pending blob uploads...`);

      for (const blob of blobs) {
        try {
          // Get the blob from db.blobs
          const blobEntry = await db.blobs.where('thoughtId').equals(blob.thoughtId).first();
          if (!blobEntry) {
            // Blob no longer exists, remove from queue
            await db.pendingBlobs.delete(blob.id!);
            continue;
          }

          const result = await supabaseStorage.uploadFile(
            user.id,
            blobEntry.blob,
            blobEntry.name
          );

          await db.thoughts.update(blob.thoughtId, {
            storageUrl: result.url,
            storagePath: result.path,
            syncStatus: 'synced'
          });

          await db.pendingBlobs.delete(blob.id!);
          console.log(`[Storage] Uploaded pending blob for thought:`, blob.thoughtId);
        } catch (err) {
          console.error(`[Storage] Failed to upload pending blob:`, err);
          await db.pendingBlobs.update(blob.id!, { retryCount: blob.retryCount + 1 });
        }
      }
    } catch (err) {
      console.error('[Storage] Process pending blobs failed:', err);
    }
  },

  setAutoSync: async (enabled: boolean) => {
    localStorage.setItem('cyberia-auto-sync', String(enabled));
    set({ autoSync: enabled });
    
    // Save to Supabase for cross-device persistence
    const { user, accessToken } = get();
    if (user && accessToken) {
      try {
        await supabaseSync.updateSettings(user.id, { autoSync: enabled });
        const updatedUser = { ...user, settings: { ...user.settings, autoSync: enabled } };
        set({ user: updatedUser });
        localStorage.setItem('cyberia-user', JSON.stringify(updatedUser));
      } catch (e) {
        console.warn('[Auth] Failed to save autoSync preference:', e);
      }
    }
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
}));
