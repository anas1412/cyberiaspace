import { create } from 'zustand';
import { type User, type SubscriptionPlan, type AccessPeriod, PLAN_CONFIG } from '../constants';
import { db } from '../db';
import { driveService } from '../services/google/driveService';

// Helper to convert base64 to Blob
const base64ToBlob = (base64: string) => {
  try {
    const parts = base64.split(';base64,');
    if (parts.length < 2) return null;
    const contentType = parts[0].split(':')[1];
    const raw = window.atob(parts[1]);
    const rawLength = raw.length;
    const uInt8Array = new Uint8Array(rawLength);
    for (let i = 0; i < rawLength; ++i) {
      uInt8Array[i] = raw.charCodeAt(i);
    }
    return new Blob([uInt8Array], { type: contentType });
  } catch (e) {
    console.error('Base64 to Blob conversion failed', e);
    return null;
  }
};

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  grantedScopes: string[];
  status: 'idle' | 'loading' | 'authenticated' | 'unauthenticated';
  syncStatus: 'synced' | 'syncing' | 'error' | 'offline';
  lastSync: Date | null;
  autoSync: boolean;
  cloudUsage: number;
  isOnline: boolean;

  setAuthenticatedUser: (user: User, token: string, scopes?: string[]) => Promise<void>;
  handleAuthCode: (code: string) => Promise<void>;
  requestServiceAccess: (scope: string, token: string) => void;
  signOut: () => Promise<void>;
  syncData: () => Promise<void>;
  syncToServices: () => Promise<void>;
  deleteServiceContent: (thought: any) => Promise<void>;
  processPendingDeletions: () => Promise<void>;
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
        driveEnabled: user.settings?.driveEnabled ?? false,
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
  isOnline: navigator.onLine,
  _syncPromise: null as Promise<void> | null,

  initAuth: async () => {
    window.addEventListener('online', () => set({ isOnline: true }));
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
          console.log('[Sync] Cloud data is meaningful, checking local state...');
          const localIsEmpty = await useStore.getState().isLocalWorkspaceEmpty();
          console.log('[Sync] Local workspace empty:', localIsEmpty);
          
          if (!localIsEmpty) {
            console.log('[Sync] CONFLICT DETECTED');
            const { useModalStore } = await import('./useModalStore');
            
            // Ensure we stop loading so user can see the modal
            useStore.setState({ isInitializing: false });

            await new Promise((resolve) => {
              useModalStore.getState().openModal({
                title: 'Data Conflict',
                description: 'We found existing data on this device. Would you like to use your cloud backup or keep your local workspace?',
                type: 'conflict_resolver',
                onConfirm: async (choice) => {
                  console.log('[Sync] User choice:', choice);
                  // Only show loader during actual destructive swap
                  useStore.setState({ isInitializing: true });
                  try {
                    if (choice === 'cloud') {
                      await useStore.getState().importFullState(data);
                    } else if (choice === 'local') {
                      await get().syncData();
                    }
                    const now = new Date();
                    set({ lastSync: now, syncStatus: 'synced' });
                    localStorage.setItem('cyberia-last-sync', now.toISOString());
                    
                    // Trigger media sweep after conflict resolution
                    await get().mediaSweep();
                  } finally {
                    useStore.setState({ isInitializing: false });
                    resolve(void 0);
                  }
                }
              });
            });
          } else {
            console.log('[Sync] Local is empty, auto-importing cloud data...');
            await useStore.getState().importFullState(data);
            await get().mediaSweep();
          }
        } else {
          console.log('[Sync] Cloud is empty or missing, keeping local data...');
          if (get().status === 'authenticated') {
            await get().syncData();
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
    const { user, accessToken, grantedScopes } = get();
    if (!user?.settings?.driveEnabled || !accessToken) return;
    if (!grantedScopes.includes('https://www.googleapis.com/auth/drive.file')) return;

    console.log('[Sync] Conducting Media Sweep...');
    try {
      const { useStore } = await import('./useStore');
      // Find all media thoughts that aren't synced yet
      const mediaThoughts = await db.thoughts
        .filter(t => (t.type === 'image' || t.type === 'file') && t.syncStatus !== 'synced')
        .toArray();

      if (mediaThoughts.length === 0) {
        console.log('[Sync] Media sweep: Nothing to upload.');
        return;
      }

      console.log(`[Sync] Media sweep: Found ${mediaThoughts.length} items to upload.`);
      
      // Update UI state for these thoughts so user sees immediate feedback
      for (const t of mediaThoughts) {
        useStore.getState().updateThought(t.id, { syncStatus: 'syncing' });
      }

      // Trigger service sync - syncToServices will handle the DB locking and upload
      await get().syncToServices();
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
        method: 'POST', // Code flow exchange usually POST
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      
      let currentToken = accessToken;
      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        currentToken = refreshData.access_token;
        set({ accessToken: currentToken });
        localStorage.setItem('cyberia-token', currentToken);
      } else if (refreshRes.status === 401) {
        // Refresh token invalid/revoked
        get().signOut();
        return;
      }

      // 2. Fetch full profile
      const res = await fetch(`/api/user?action=profile&email=${encodeURIComponent(user.email)}&name=${encodeURIComponent(user.name)}&avatar=${encodeURIComponent(user.avatar)}`, {
        headers: { Authorization: `Bearer ${currentToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        const updatedUser = { ...user, ...data.user };
        
        // Sync local grantedScopes from profile drive state IF the local session also has the token
        const scopes = [...get().grantedScopes];
        const hasDriveScope = scopes.includes('https://www.googleapis.com/auth/drive.file');
        
        if (updatedUser.settings?.driveEnabled && !hasDriveScope) {
          // If the cloud says drive is enabled, but local doesn't have the scope yet,
          // we only add it if we are sure the current accessToken (refreshed above) 
          // actually has the drive permissions.
          // For safety, we only do this if it's NOT a fresh login.
          if (get().status === 'authenticated') {
            scopes.push('https://www.googleapis.com/auth/drive.file');
          }
        }

        set({ user: updatedUser, grantedScopes: scopes });
        localStorage.setItem('cyberia-user', JSON.stringify(updatedUser));
        localStorage.setItem('cyberia-scopes', JSON.stringify(scopes));
      }
    } catch (e) {
      console.warn('Failed to refresh profile', e);
    }
  },


  updateSettings: async (settings) => {
    const { accessToken, user } = get();
    if (!accessToken || !user) return;
    
    const oldDriveEnabled = user.settings?.driveEnabled;
    const updatedUser = { ...user, settings: { ...user.settings, ...settings } };
    set({ user: updatedUser });
    localStorage.setItem('cyberia-user', JSON.stringify(updatedUser));

    // If Drive was just enabled, trigger a sync to push local media
    if (!oldDriveEnabled && settings.driveEnabled) {
      get().mediaSweep();
    }

    try {
      await fetch('/api/user?action=settings', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}` 
        },
        body: JSON.stringify({ settings })
      });
    } catch (e) {
      console.warn('Settings cloud sync failed', e);
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

  calculateUsage: (thoughtCount: number) => {
    const { user } = get();
    const plan = user?.plan || 'free';
    const limit = PLAN_CONFIG[plan].MAX_CLOUD_THOUGHTS;
    const currentCount = user?.usage?.sync_thoughts ?? thoughtCount;
    set({ cloudUsage: (currentCount / limit) * 100 });
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
        driveEnabled: user.settings?.driveEnabled ?? false,
      }
    };
    
    localStorage.setItem('cyberia-user', JSON.stringify(userWithDefaults));
    localStorage.setItem('cyberia-token', token);
    
    if (scopes) {
      localStorage.setItem('cyberia-scopes', JSON.stringify(scopes));
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

      // Automatically determine granted scopes from server response if possible, 
      // but for now we'll trust the flow that triggered it.
      // The server already updated the profile with driveEnabled if scope was present.
      const scopes = ['openid', 'email', 'profile'];
      if (data.user?.settings?.driveEnabled) {
        scopes.push('https://www.googleapis.com/auth/drive.file');
      }

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
    const { accessToken, grantedScopes, autoSync, user } = get();
    if (!autoSync || !user?.settings?.driveEnabled) {
      console.log('[Sync] Auto-sync or Drive is OFF, keeping blob in local buffer');
      return;
    }
    if (!accessToken || !grantedScopes.includes('https://www.googleapis.com/auth/drive.file')) return;

    try {
      const { useStore } = await import('./useStore');

      const blobEntry = await db.blobs.where('thoughtId').equals(thoughtId).first();
      const thought = await db.thoughts.get(thoughtId);

      if (!blobEntry || !thought) return;

      useStore.getState().updateThought(thoughtId, { syncStatus: 'pending' });

      const rootId = await driveService.ensureRootFolder(accessToken);
      const mediaFolderId = await driveService.ensureSubFolder(accessToken, rootId, 'Media');
      const result = await driveService.uploadFile(accessToken, blobEntry.blob, blobEntry.name, mediaFolderId);

      await db.thoughts.update(thoughtId, {
        driveFileId: result.id,
        syncStatus: 'synced',
        meta: {
          ...thought.meta,
          file: {
            id: result.id,
            name: result.name,
            size: blobEntry.blob.size,
            type: blobEntry.blob.type,
            link: result.webContentLink
          }
        }
      });

      useStore.getState().updateThought(thoughtId, {
        driveFileId: result.id,
        syncStatus: 'synced'
      });

    } catch (err) {
      console.error('[Upload] Failed to upload blob:', err);
      await db.thoughts.update(thoughtId, { syncStatus: 'error' });
    }
  },

  importCloudData: async () => {
    const { accessToken, isOnline } = get();
    if (!accessToken || !isOnline) return null;

    set({ syncStatus: 'syncing' });
    try {
      const response = await fetch('/api/user?action=sync', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      if (!response.ok) {
        if (response.status === 401) {
          get().signOut();
        }
        return null;
      }

      const result = await response.json();
      set({ syncStatus: 'synced' });
      return result.data;
    } catch (err) {
      console.error('[Sync] importCloudData failed:', err);
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
      const allSpaces = await db.spaces.toArray();
      const allThoughts = await db.thoughts.toArray();
      const allStacks = await db.stacks.toArray();

      const metadataThoughts = [];
      for (let i = 0; i < allThoughts.length; i++) {
        const t = allThoughts[i];
        metadataThoughts.push({
          ...t,
          drawing: '',
          image: (t.image && t.image.length > 50000) ? null : t.image
        });
      }

      const payload = {
        spaces: allSpaces,
        thoughts: metadataThoughts,
        stacks: allStacks,
        activeSpaceId: localStorage.getItem('cyberia-active-space-id'),
        settings: { theme: localStorage.getItem('cyberia-theme') },
        version: 3,
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

      if (!response.ok) {
        if (response.status === 401) {
          get().signOut();
          return;
        }
        throw new Error(`Sync failed with status: ${response.status}`);
      }
      
      const resData = await response.json();
      if (resData.usage && user) {
        set({ user: { ...user, usage: resData.usage } });
      }

      await get().syncToServices();
      await get().processPendingDeletions();

      const now = new Date();
      localStorage.setItem('cyberia-last-sync', now.toISOString());

      set({
        syncStatus: 'synced',
        lastSync: now
      });
    } catch (e) {
      console.error('[Sync] Sync process failed:', e);
      set({ syncStatus: 'error' });
    }
  },

  syncToServices: async () => {
    const { accessToken, isOnline, user, grantedScopes } = get();
    if (!accessToken || !isOnline || !user || !user.settings?.driveEnabled) return;

    const hasDrive = grantedScopes.includes('https://www.googleapis.com/auth/drive.file');
    if (!hasDrive) return;

    try {
      console.log('[Sync] Starting service sync...');
      
      const allThoughts = await db.thoughts.toArray();
      // Only pick thoughts that are NOT synced and NOT already syncing
      const thoughtsToSync = allThoughts.filter(t => t.syncStatus !== 'synced' && t.syncStatus !== 'syncing');

      if (thoughtsToSync.length === 0) return;

      const rootId = await driveService.ensureRootFolder(accessToken);
      const thoughtsFolderId = await driveService.ensureSubFolder(accessToken, rootId, 'Thoughts');
      const mediaFolderId = await driveService.ensureSubFolder(accessToken, rootId, 'Media');

      for (const thought of thoughtsToSync) {
        try {
          // Double check DB state right before processing to avoid race conditions
          const currentThought = await db.thoughts.get(thought.id);
          if (!currentThought || currentThought.syncStatus === 'synced' || currentThought.syncStatus === 'syncing') continue;

          // CRITICAL: Mark as syncing in DATABASE immediately to lock this thought
          await db.thoughts.update(currentThought.id, { syncStatus: 'syncing' });
          
          const { useStore } = await import('./useStore');
          useStore.getState().updateThought(currentThought.id, { syncStatus: 'syncing' });

          let driveFileId = currentThought.driveFileId;
          let uploadSuccessful = false;
          
          const jsonTypes = ['text', 'tasks', 'table', 'paint'];
          const isMedia = currentThought.type === 'image' || currentThought.type === 'file';

          if (currentThought.type === 'label') {
            uploadSuccessful = true; // Labels don't need Drive files
          } else if (jsonTypes.includes(currentThought.type)) {
            const payload = {
              id: currentThought.id,
              type: currentThought.type,
              text: currentThought.text,
              content: currentThought.content,
              tasks: currentThought.tasks,
              table: currentThought.table,
              drawing: currentThought.drawing,
              date: currentThought.date,
              priority: currentThought.priority,
              updatedAt: new Date().toISOString()
            };

            const contentString = JSON.stringify(payload, null, 2);
            const fileName = `${currentThought.id}.json`;
            const mimeType = 'application/json';

            const hasActualContent = currentThought.content?.trim() || 
                                   (currentThought.tasks && currentThought.tasks.length > 0) ||
                                   (currentThought.table && currentThought.table.length > 0 && currentThought.table[0][0]) ||
                                   currentThought.drawing;

            if (hasActualContent) {
              if (driveFileId) {
                await driveService.updateFileContent(accessToken, driveFileId, contentString);
              } else {
                const result = await driveService.uploadFile(accessToken, new Blob([contentString], { type: mimeType }), fileName, thoughtsFolderId);
                driveFileId = result.id;
              }
              uploadSuccessful = true;
            } else {
              // It's empty, we don't upload but we can consider it synced to avoid retries
              uploadSuccessful = true;
            }
          } else if (isMedia) {
            let content: Blob | null = null;
            let fileName = `${currentThought.id}`;
            let mimeType = 'application/octet-stream';
            
            const blobEntry = await db.blobs.where('thoughtId').equals(currentThought.id).first();
            if (blobEntry) {
              content = blobEntry.blob;
              fileName = blobEntry.name;
              mimeType = blobEntry.type;
            } else if (currentThought.type === 'image' && currentThought.image && currentThought.image.startsWith('data:')) {
              content = base64ToBlob(currentThought.image);
              mimeType = currentThought.image.split(';base64,')[0].split(':')[1];
              fileName += '.' + (mimeType.split('/')[1] || 'png');
            }

            if (content && mediaFolderId) {
              if (driveFileId) {
                await driveService.updateFileContent(accessToken, driveFileId, content);
              } else {
                const result = await driveService.uploadFile(accessToken, content, fileName, mediaFolderId);
                driveFileId = result.id;
              }
              uploadSuccessful = true;
            } else {
              console.warn(`[Sync] Skipping media thought ${currentThought.id}: Binary content not found.`);
              uploadSuccessful = false; // Stay local/error until content is available
            }
          }

          if (uploadSuccessful) {
            const serviceUpdates: any = { syncStatus: 'synced' };
            if (driveFileId) serviceUpdates.driveFileId = driveFileId;

            await db.thoughts.update(currentThought.id, serviceUpdates);
            useStore.getState().updateThought(currentThought.id, serviceUpdates);
          } else if (isMedia) {
            // Explicitly mark as error if media is missing to alert the user/system
            await db.thoughts.update(currentThought.id, { syncStatus: 'error' });
            useStore.getState().updateThought(currentThought.id, { syncStatus: 'error' });
          }

        } catch (err) {
          console.error(`[Sync] Failed to sync thought ${thought.id}:`, err);
          const { useStore } = await import('./useStore');
          if (err instanceof Error && err.name !== 'DatabaseClosedError') {
            await db.thoughts.update(thought.id, { syncStatus: 'error' }).catch(() => {});
            useStore.getState().updateThought(thought.id, { syncStatus: 'error' });
          }
        }
      }
    } catch (err) {
      console.error('[Sync] Deep sync process failed:', err);
    }
  },

  deleteServiceContent: async (thought: any) => {
    const { accessToken, grantedScopes, user } = get();
    // Only proceed if drive was enabled for this account
    if (!user?.settings?.driveEnabled) return;
    
    // Fetch latest driveFileId from DB just in case
    const latest = await db.thoughts.get(thought.id).catch(() => null);
    const driveFileId = latest?.driveFileId || thought.driveFileId;

    if (!driveFileId) return;

    // Add to queue for persistent deletion (retried during sync)
    await db.pendingDeletions.put({ driveFileId, type: 'drive' }).catch(() => {});

    const hasDrive = grantedScopes.includes('https://www.googleapis.com/auth/drive.file');
    if (get().isOnline && accessToken && hasDrive) {
      try {
        console.log(`[Sync] Attempting immediate cloud deletion for ${driveFileId}`);
        await driveService.deleteFile(accessToken, driveFileId);
        // If success, remove from queue
        await db.pendingDeletions.where('driveFileId').equals(driveFileId).delete();
        console.log('[Sync] Cloud deletion successful');
      } catch (err) {
        console.warn('[Sync] Immediate deletion failed (will retry during sync):', err);
      }
    }
  },

  processPendingDeletions: async () => {
    const { accessToken, isOnline, grantedScopes } = get();
    if (!isOnline || !accessToken) return;
    
    const hasDrive = grantedScopes.includes('https://www.googleapis.com/auth/drive.file');
    if (!hasDrive) return;

    try {
      const pending = await db.pendingDeletions.toArray();
      if (pending.length === 0) return;

      console.log(`[Sync] Processing ${pending.length} pending cloud deletions...`);

      for (const item of pending) {
        try {
          await driveService.deleteFile(accessToken, item.driveFileId);
          await db.pendingDeletions.delete(item.id!);
        } catch (err: any) {
          if (err.message?.includes('404') || err.status === 404) {
            await db.pendingDeletions.delete(item.id!);
          } else {
            console.warn(`[Sync] Failed to process pending deletion ${item.driveFileId}:`, err);
          }
        }
      }
    } catch (err) {
      console.error('[Sync] Pending deletions process failed:', err);
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
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      if (!response.ok) throw new Error('Delete failed');

      localStorage.removeItem('cyberia-last-sync');
      set({ syncStatus: 'offline', lastSync: null });
    } catch (error) {
      console.error('Delete error:', error);
      set({ syncStatus: 'error' });
    }
  }
}));
