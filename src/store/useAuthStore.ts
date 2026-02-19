import { create } from 'zustand';
import { type User, type SubscriptionPlan, type AccessPeriod, PLAN_CONFIG } from '../constants';

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
  requestServiceAccess: (scope: string, token: string) => void;
  signOut: () => Promise<void>;
  syncData: () => Promise<void>;
  syncToServices: () => Promise<void>;
  deleteServiceContent: (thought: any) => Promise<void>;
  uploadThoughtBlob: (thoughtId: number) => Promise<void>;
  importCloudData: () => Promise<unknown | null>;
  setAutoSync: (enabled: boolean) => void;
  deleteCloudData: () => Promise<void>;
  calculateUsage: (thoughtCount: number) => void;
  initAuth: () => void;
  upgradePlan: (plan: SubscriptionPlan, period?: AccessPeriod) => void;
  checkExpiry: () => void;
  refreshProStatus: () => Promise<void>;
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
  },

  checkExpiry: () => {
    const { user } = get();
    if (!user || user.plan === 'free' || !user.expiresAt) return;
    if (new Date(user.expiresAt) < new Date()) {
      set({ user: { ...user, plan: 'free' } });
      localStorage.setItem('cyberia-user', JSON.stringify({ ...user, plan: 'free' }));
    }
  },

  refreshProStatus: async () => {
    const { accessToken, user } = get();
    if (!accessToken || !user) return;
    try {
      const res = await fetch('/api/user?action=profile', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        const updatedUser = { ...user, ...data.user };
        set({ user: updatedUser });
        localStorage.setItem('cyberia-user', JSON.stringify(updatedUser));
      }
    } catch (e) {
      console.warn('Failed to refresh pro status', e);
    }
  },

  upgradePlan: (plan, period) => {
    const { user } = get();
    if (!user) return;
    const expiresAt = period === 'yearly' 
      ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      : period === 'monthly'
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        : null;
    
    const updatedUser: User = { ...user, plan, expiresAt };
    set({ user: updatedUser });
    localStorage.setItem('cyberia-user', JSON.stringify(updatedUser));
  },

  cancelSubscription: () => {
    const { user } = get();
    if (!user) return;
    const updatedUser: User = { ...user, plan: 'free', expiresAt: null };
    set({ user: updatedUser });
    localStorage.setItem('cyberia-user', JSON.stringify(updatedUser));
  },

  calculateUsage: (thoughtCount: number) => {
    const { user } = get();
    const plan = user?.plan || 'free';
    const limit = PLAN_CONFIG[plan].MAX_CLOUD_THOUGHTS;
    set({ cloudUsage: (thoughtCount / limit) * 100 });
  },

  setAuthenticatedUser: async (user: User, token: string, scopes?: string[]) => {
    const userWithPlan = { ...user, plan: user.plan || 'free' };
    localStorage.setItem('cyberia-user', JSON.stringify(userWithPlan));
    localStorage.setItem('cyberia-token', token);
    
    if (scopes) {
      localStorage.setItem('cyberia-scopes', JSON.stringify(scopes));
    }

    const { useStore } = await import('./useStore');
    useStore.getState().isInitializing = true;

    set({
      user: userWithPlan,
      accessToken: token,
      grantedScopes: scopes || get().grantedScopes,
      status: 'authenticated',
      syncStatus: 'syncing'
    });

    try {
      const data = await get().importCloudData();
      if (data) {
        await useStore.getState().importFullState(data);
      }
      set({ syncStatus: 'synced', lastSync: new Date() });
    } catch (e) {
      console.error('Initial sync failed', e);
      set({ syncStatus: 'error' });
    } finally {
      useStore.getState().isInitializing = false;
    }
  },

  requestServiceAccess: (scope: string, token: string) => {
    const currentScopes = get().grantedScopes;
    if (!currentScopes.includes(scope)) {
      const newScopes = [...currentScopes, scope];
      localStorage.setItem('cyberia-scopes', JSON.stringify(newScopes));
      localStorage.setItem('cyberia-token', token);
      set({ grantedScopes: newScopes, accessToken: token });
      
      // Trigger immediate sync to push existing data to the newly connected service
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
    const { accessToken, grantedScopes } = get();
    if (!accessToken || !grantedScopes.includes('https://www.googleapis.com/auth/drive.file')) return;

    try {
      const { db } = await import('../db');
      const { driveService } = await import('../services/google/driveService');
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
      const { db } = await import('../db');
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
      const { db } = await import('../db');
      const allSpaces = await db.spaces.toArray();
      const allThoughts = await db.thoughts.toArray();
      const allStacks = await db.stacks.toArray();

      // PERFORMANCE: Manual loop to reduce main thread lag during heavy sync
      const metadataThoughts = [];
      for (let i = 0; i < allThoughts.length; i++) {
        const t = allThoughts[i];
        metadataThoughts.push({
          ...t,
          drawing: '',
          image: (t.image && t.image.length > 50000) ? null : t.image
        });
      }

      const plan = (user?.plan as SubscriptionPlan) || 'free';
      const limits = PLAN_CONFIG[plan] || PLAN_CONFIG.free;

      if (allThoughts.length > limits.MAX_CLOUD_THOUGHTS) {
        const { useModalStore } = await import('./useModalStore');
        useModalStore.getState().openModal({
          title: 'Sync Blocked',
          description: `You have too many thoughts for the Free plan (${allThoughts.length}/${limits.MAX_CLOUD_THOUGHTS}). Upgrade to Pro to sync everything.`,
          type: 'alert',
          confirmText: 'View Plans',
          onConfirm: () => useModalStore.getState().openPricing()
        });
        set({ syncStatus: 'error' });
        return;
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

      await get().syncToServices();

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
    if (!accessToken || !isOnline || !user) return;

    const hasDrive = grantedScopes.includes('https://www.googleapis.com/auth/drive.file');
    const hasTasks = grantedScopes.includes('https://www.googleapis.com/auth/tasks');
    const hasCalendar = grantedScopes.includes('https://www.googleapis.com/auth/calendar.events');

    if (!hasDrive && !hasTasks && !hasCalendar) return;

    try {
      const { db } = await import('../db');
      const { driveService } = await import('../services/google/driveService');
      const { tasksService } = await import('../services/google/tasksService');
      const { calendarService } = await import('../services/google/calendarService');

      const thoughtsToSync = await db.thoughts
        .where('syncStatus')
        .notEqual('synced')
        .toArray();

      if (thoughtsToSync.length === 0) return;

      console.log(`[Sync] Deep syncing ${thoughtsToSync.length} thoughts to Google Services...`);

      let thoughtsFolderId: string | undefined;
      let drawingsFolderId: string | undefined;
      let mediaFolderId: string | undefined;

      if (hasDrive) {
        try {
          const rootId = await driveService.ensureRootFolder(accessToken);
          thoughtsFolderId = await driveService.ensureSubFolder(accessToken, rootId, 'Thoughts');
          drawingsFolderId = await driveService.ensureSubFolder(accessToken, rootId, 'Drawings');
          mediaFolderId = await driveService.ensureSubFolder(accessToken, rootId, 'Media');
        } catch (e) {
          console.error('[Sync] Drive folder setup failed:', e);
        }
      }

      for (const thought of thoughtsToSync) {
        try {
          let driveFileId = thought.driveFileId;
          
          if (hasDrive && thoughtsFolderId && thought.type !== 'image' && thought.type !== 'embed') {
            let content = '';
            let fileName = `${thought.id}`;
            let mimeType = 'text/plain';
            let targetFolderId: string | undefined = thoughtsFolderId;

            if (thought.type === 'text') {
              content = thought.content;
              fileName += '.md';
              mimeType = 'text/markdown';
            } else if (thought.type === 'tasks') {
              content = JSON.stringify(thought.tasks, null, 2);
              fileName += '.tasks.json';
              mimeType = 'application/json';
            } else if (thought.type === 'table') {
              content = JSON.stringify(thought.table, null, 2);
              fileName += '.table.json';
              mimeType = 'application/json';
            } else if (thought.type === 'paint' && thought.drawing) {
              content = thought.drawing;
              fileName += '.svg';
              mimeType = 'image/svg+xml';
              targetFolderId = drawingsFolderId;
            } else if (thought.type === 'file') {
              targetFolderId = mediaFolderId;
            }

            if (content && targetFolderId) {
              if (driveFileId) {
                await driveService.updateFileContent(accessToken, driveFileId, content);
              } else {
                const result = await driveService.uploadFile(accessToken, new Blob([content], { type: mimeType }), fileName, targetFolderId);
                driveFileId = result.id;
              }
            }
          }

          let googleTaskListId = thought.googleTaskListId;
          if (hasTasks && thought.type === 'tasks') {
            try {
              if (!googleTaskListId) {
                console.log(`[Sync] Creating new Google Task List for thought ${thought.id}...`);
                googleTaskListId = await tasksService.ensureTaskList(accessToken, thought.text || 'Cyberia Tasks');
                await db.thoughts.update(thought.id, { googleTaskListId });
              }
              console.log(`[Sync] Pushing ${thought.tasks.length} items to Google Task List ${googleTaskListId}...`);
              const success = await tasksService.syncTasks(accessToken, googleTaskListId, thought.tasks);
              if (success) console.log(`[Sync] Google Tasks sync successful for thought ${thought.id}`);
            } catch (e) {
              console.error('[Sync] Tasks sync failed for thought:', thought.id, e);
            }
          }

          let googleCalendarEventId = thought.googleCalendarEventId;
          if (hasCalendar && thought.date) {
            try {
              console.log(`[Sync] Syncing thought ${thought.id} to Google Calendar...`);
              const event = await calendarService.upsertEvent(accessToken, googleCalendarEventId, {
                title: thought.text || 'Cyberia Event',
                date: thought.date,
                thoughtId: thought.id
              });
              googleCalendarEventId = event.id;
              await db.thoughts.update(thought.id, { googleCalendarEventId });
            } catch (e) {
              console.error('[Sync] Calendar sync failed for thought:', thought.id, e);
            }
          }

          const serviceUpdates: any = {
            syncStatus: (hasDrive || hasTasks || hasCalendar) ? 'synced' : 'local'
          };
          if (driveFileId) serviceUpdates.driveFileId = driveFileId;
          if (googleTaskListId) serviceUpdates.googleTaskListId = googleTaskListId;
          if (googleCalendarEventId) serviceUpdates.googleCalendarEventId = googleCalendarEventId;

          await db.thoughts.update(thought.id, serviceUpdates);

          if (hasDrive && mediaFolderId) {
            const blobEntry = await db.blobs.where('thoughtId').equals(thought.id).first();
            if (blobEntry && !thought.driveFileId) {
              const result = await driveService.uploadFile(accessToken, blobEntry.blob, blobEntry.name, mediaFolderId);
              await db.thoughts.update(thought.id, { 
                driveFileId: result.id,
                meta: { ...thought.meta, file: { id: result.id, name: result.name, size: blobEntry.blob.size, type: blobEntry.blob.type, link: result.webContentLink } }
              });
            }
          }

        } catch (err) {
          console.error(`[Sync] Failed to process thought ${thought.id}:`, err);
          await db.thoughts.update(thought.id, { syncStatus: 'error' });
        }
      }
    } catch (err) {
      console.error('[Sync] Critical deep sync error:', err);
      throw err;
    }
  },

  deleteServiceContent: async (thought: any) => {
    const { accessToken, isOnline, grantedScopes } = get();
    if (!accessToken || !isOnline) return;

    const hasDrive = grantedScopes.includes('https://www.googleapis.com/auth/drive.file');
    const hasTasks = grantedScopes.includes('https://www.googleapis.com/auth/tasks');
    const hasCalendar = grantedScopes.includes('https://www.googleapis.com/auth/calendar.events');

    try {
      const { driveService } = await import('../services/google/driveService');
      const { tasksService } = await import('../services/google/tasksService');
      const { calendarService } = await import('../services/google/calendarService');

      const promises = [];

      if (hasDrive && thought.driveFileId) {
        promises.push(driveService.deleteFile(accessToken, thought.driveFileId).catch(e => console.warn('[Sync] Drive delete failed:', e)));
      }

      if (hasTasks && thought.googleTaskListId) {
        promises.push(tasksService.deleteTaskList(accessToken, thought.googleTaskListId).catch(e => console.warn('[Sync] Tasks delete failed:', e)));
      }

      if (hasCalendar && thought.googleCalendarEventId) {
        promises.push(calendarService.deleteEvent(accessToken, thought.googleCalendarEventId).catch(e => console.warn('[Sync] Calendar delete failed:', e)));
      }

      await Promise.all(promises);
    } catch (err) {
      console.error('[Sync] Content deletion process failed:', err);
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
