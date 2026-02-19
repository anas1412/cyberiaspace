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
  upgradePlan: (plan: SubscriptionPlan, period?: AccessPeriod) => void;
  checkExpiry: () => void;
  refreshProfile: () => Promise<void>;
  updateSettings: (settings: Partial<User['settings']>) => Promise<void>;
  cancelSubscription: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: JSON.parse(localStorage.getItem('cyberia-user') || 'null'),
  accessToken: localStorage.getItem('cyberia-token'),
  grantedScopes: JSON.parse(localStorage.getItem('cyberia-scopes') || '[]'),
  status: localStorage.getItem('cyberia-user') ? 'authenticated' : 'unauthenticated',
  syncStatus: navigator.onLine ? (localStorage.getItem('cyberia-user') ? 'synced' : 'offline') : 'offline',
  lastSync: localStorage.getItem('cyberia-last-sync') ? new Date(localStorage.getItem('cyberia-last-sync')!) : null,
  autoSync: localStorage.getItem('cyberia-auto-sync') !== 'false',
  cloudUsage: 0,
  isOnline: navigator.onLine,

  initAuth: () => {
    window.addEventListener('online', () => set({ isOnline: true }));
    window.addEventListener('offline', () => set({ isOnline: false, syncStatus: 'offline' }));
    get().checkExpiry();
    if (get().status === 'authenticated') {
      get().refreshProfile();
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
    
    const updatedUser = { ...user, settings: { ...user.settings, ...settings } };
    set({ user: updatedUser });
    localStorage.setItem('cyberia-user', JSON.stringify(updatedUser));

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
    const userWithDefaults: User = { 
      ...user, 
      plan: user.plan || 'free',
      subscriptionStatus: user.subscriptionStatus || 'none',
      usage: user.usage || { ai_daily_count: 0, sync_thoughts: 0, last_ai_reset: new Date().toISOString().split('T')[0] },
      settings: user.settings || { theme: 'cyberia', autoSync: true, driveEnabled: false }
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
      
      const data = await get().importCloudData();
      if (data) {
        await useStore.getState().importFullState(data);
      }
      set({ syncStatus: 'synced', lastSync: new Date() });
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

      if (response.status === 401) {
        get().signOut();
        return;
      }

      if (!response.ok) throw new Error('Sync failed');
      
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
      const thoughtsToSync = allThoughts.filter(t => t.syncStatus !== 'synced');

      if (thoughtsToSync.length === 0) return;

      const rootId = await driveService.ensureRootFolder(accessToken);
      const thoughtsFolderId = await driveService.ensureSubFolder(accessToken, rootId, 'Thoughts');
      const mediaFolderId = await driveService.ensureSubFolder(accessToken, rootId, 'Media');

      for (const thought of thoughtsToSync) {
        try {
          const currentThought = await db.thoughts.get(thought.id);
          if (!currentThought) continue;

          let driveFileId = currentThought.driveFileId;
          
          const jsonTypes = ['text', 'tasks', 'table', 'paint'];
          const isMedia = currentThought.type === 'image' || currentThought.type === 'file';

          if (currentThought.type === 'label') {
            // No Drive file needed
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
            }
          }

          const serviceUpdates: any = { syncStatus: 'synced' };
          if (driveFileId) serviceUpdates.driveFileId = driveFileId;

          await db.thoughts.update(currentThought.id, serviceUpdates);
          const { useStore } = await import('./useStore');
          useStore.getState().updateThought(currentThought.id, serviceUpdates);

        } catch (err) {
          console.error(`[Sync] Failed to sync thought ${thought.id}:`, err);
          if (err instanceof Error && err.name !== 'DatabaseClosedError') {
            await db.thoughts.update(thought.id, { syncStatus: 'error' }).catch(() => {});
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
