import { type StateCreator } from 'zustand';
import { db, type Space, type Thought, type Stack } from '../../db';
import { useModalStore } from '../useModalStore';
import { PLAN_CONFIG, DEFAULT_THEME, type SubscriptionPlan } from '../../constants';
import { syncOrchestrator } from '../../services/sync/syncOrchestrator';
import { useAuthStore } from '../useAuthStore';
import { type CyberiaState } from '../types';
import { migrateThoughtsToModular, migrateThoughtsToTimeFields } from '../../utils/migrations';
import { isStorageUrl } from '../../services/supabaseStorage';
import { ulid } from 'ulid';

const SPACE_NAMES = ['Orion', 'Cassiopeia', 'Andromeda', 'Pegasus', 'Cygnus', 'Draco', 'Lyra'];

let isCreatingInitialWorkspace = false;

export const createDataSlice: StateCreator<CyberiaState, [], [], any> = (set, get, _api) => ({
  isInitializing: true,
  setInitializing: (isInitializing: boolean) => set({ isInitializing }),
  isSpaceLoading: false,
  setSpaceLoading: (loading: boolean) => set({ isSpaceLoading: loading }),
  setInitializationState: (isInitializing: boolean, isSpaceLoading: boolean) => set({ isInitializing, isSpaceLoading }),
  isDemo: false,
  lastSpaceRequestId: 0,
  _savedUserState: null as { spaces: Space[]; thoughts: Thought[]; stacks: Stack[]; activeSpaceId: string | null } | null,

  init: async () => {
    const hasAuthCode = new URLSearchParams(window.location.search).has('code');

    try {
      // Ensure DB is open and ready
      try {
        await db.open();
      } catch (err) {
        console.error('Failed to open database:', err);
      }

      // Run data migration for modular thought payloads
      await migrateThoughtsToModular();
      await migrateThoughtsToTimeFields();

      const { useAuthStore: dynamicAuthStore } = await import('../useAuthStore');
      // Start auth initialization in background to avoid blocking initial render
      const authPromise = dynamicAuthStore.getState().initAuth();
      
      const path = window.location.pathname;
      if (path.startsWith('/home/s/')) {
        const parts = path.split('/home/s/');
        const sharedId = parts[1]?.split('/')[0];
        if (sharedId) {
          set({ isSpaceLoading: true, isReadOnly: true });
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

            const res = await fetch(`/api/publish?id=${sharedId}`, { signal: controller.signal });
            clearTimeout(timeoutId);
            
            if (!res.ok) throw new Error('Snapshot not found');
            const data = await res.json();
            const creatorName = data.creatorName || 'Anonymous';
            const space = { ...data.space, id: data.id };
            set({
              activeSpaceId: data.id,
              spaces: [space],
              thoughts: data.thoughts,
              stacks: data.stacks,
              isSpaceLoading: false,
              creatorName,
              lastUpdated: data.lastUpdated || null,
              isInitializing: false,
              customBg: space.customBg || null,
              transform: { x: space.transformX || 0, y: space.transformY || 0, scale: space.transformScale || 1 }
            });
            const theme = data.space.theme || DEFAULT_THEME;
            document.body.setAttribute('data-theme', theme);
            set({ theme });
            return;
          } catch (err: any) {
            console.error('Shared init failed:', err);
            useModalStore.getState().openModal({
              title: err.name === 'AbortError' ? 'Connection Timeout' : 'Space Not Found',
              description: err.name === 'AbortError' ? 'The request took too long. Please check your connection.' : 'Link invalid or expired.',
              type: 'alert',
              confirmText: 'Go to Cyberia',
              onConfirm: () => { window.location.href = '/'; }
            });
            set({ isSpaceLoading: false, isInitializing: false });
            return;
          }
        }
      }

      if (!path.startsWith('/home/s/')) {
        set({ isReadOnly: false });
      }

      set({ isSpaceLoading: true });
      const savedTheme = localStorage.getItem('cyberia-theme') || DEFAULT_THEME;
      document.body.setAttribute('data-theme', savedTheme);

      // Early exit: Let handleAuthCode finish the space initialization if handling a redirect
      if (hasAuthCode) {
        console.log('[Store] OAuth code detected in URL, suspending space creation until auth completes.');
        return; 
      }

      // Option 2: Optimistic Local-First Init
      // Load local data immediately and show the app.
      // Auth and Cloud Sync happen in the background.
      
      try {
        // 1. Load local IndexedDB data (fast, local)
        await get().refreshSpaces();
        await get().refreshTotalThoughtCount();
        await get().cleanupTrash();
        
        let currentSpaces = get().spaces;
        let targetSpaceId: string | null = null;
        
        // Determine if user is already authenticated (has localStorage token)
        // This check happens BEFORE authPromise resolves
        const { useAuthStore: authCheck } = await import('../useAuthStore');
        const isAlreadyAuthed = authCheck.getState().status === 'authenticated';
        
        // Ensure the current user has at least one space
        // CRITICAL: Don't create workspace if user is authenticated - let auth flow handle it
        // This prevents race condition where guest workspace is created before auth completes
        // (which would ignore the user's cloud spaces on returning devices)
        if (currentSpaces.length === 0 && !isAlreadyAuthed) {
          console.log('[Init] No local spaces, user not authenticated - creating initial workspace');
          await get().createInitialWorkspace();
          currentSpaces = get().spaces;
        } else if (currentSpaces.length === 0 && isAlreadyAuthed) {
          console.log('[Init] No local spaces but user authenticated - waiting for auth flow to resolve');
          // Don't create workspace - auth flow will handle it via handshake()
        }

        // Determine which space to show
        const savedSpaceId = localStorage.getItem('cyberia-active-space-id');
        const spaceExists = savedSpaceId ? currentSpaces.find((s: Space) => s.id === savedSpaceId) : null;
        targetSpaceId = spaceExists?.id || (currentSpaces.length > 0 ? currentSpaces[0].id : null);
        
        // 2. Set space settings directly (instant)
        const activeSpace = currentSpaces.find((s: Space) => s.id === targetSpaceId);
        if (activeSpace) {
          const transform = activeSpace.mode === 'spatial'
            ? { x: activeSpace.transformX ?? 0, y: activeSpace.transformY ?? 0, scale: activeSpace.transformScale ?? 1 }
            : { x: 0, y: 0, scale: 1 };
          
          set({
            activeSpaceId: targetSpaceId,
            transform,
            customBg: activeSpace.customBg || null,
            isReadOnly: false
          });
        }
        
        // 3. SHOW APP NOW (Local data is ready)
        if (!hasAuthCode) {
          set({ isInitializing: false, isSpaceLoading: false });
        }
        
        // 4. Background: Load thoughts for the active space
        if (targetSpaceId) {
          get().refreshThoughts(targetSpaceId);
          get().refreshStacks(targetSpaceId);
        }
        
        // 5. Background: Auth & Handshake
        // This will reconcile cloud data and patch the store when done.
        if (authPromise) {
          authPromise.catch(err => console.error('[Store] Background auth failed:', err));
        }

        // Background cleanup
        const { useAuthStore: auth } = await import('../useAuthStore');
        if (auth.getState().status === 'authenticated') {
          auth.getState().healSpaceBackgrounds();
          auth.getState().downloadMissingBlobs();
        }
      } catch (err) {
        console.error('Failed to load local data:', err);
        await get().createInitialWorkspace();
        if (!hasAuthCode) {
          set({ isInitializing: false, isSpaceLoading: false });
        }
      }
    } catch (err) {
      console.error('Init failed:', err);
      if (!hasAuthCode) {
        set({ isInitializing: false, isSpaceLoading: false });
      }
    }
  },

  createInitialWorkspace: async () => {
    if (isCreatingInitialWorkspace) return;
    isCreatingInitialWorkspace = true;
    
    try {
      console.log('[Store] Checking if initial space needed...');
      const currentUserId = (useAuthStore.getState().user?.id) ?? 'guest';
      
      // Check if the CURRENT user has any active spaces
      const userSpacesCount = await db.spaces.filter(s => s.userId === currentUserId && !s.deletedAt).count();
      
      if (userSpacesCount > 0) {
        console.log('[Store] Initial space already exists for current user, skipping creation.');
        await get().refreshSpaces();
        return;
      }

      console.log('[Store] No spaces found for current user, creating initial workspace...');
      const workspaceId = ulid();
      const now = Date.now();
      const isGuest = currentUserId === 'guest';
      
      const initialSpace: Space = {
        id: workspaceId,
        userId: currentUserId,
        name: 'Workspace',
        mode: 'spatial',
        physics: localStorage.getItem('cyberia-physics-enabled') !== 'false',
        order: 0,
        updatedAt: now,
        syncStatus: isGuest ? undefined : 'local'
      };

      await db.spaces.add(initialSpace);
      localStorage.setItem('cyberia-active-space-id', workspaceId);
      await get().refreshSpaces();
      await get().setActiveSpace(workspaceId);
    } catch (err) {
        console.error('Failed to create initial space:', err);
    } finally {
      isCreatingInitialWorkspace = false;
    }
  },

  clearWorkspace: async () => {
    if (get().isReadOnly) return;
    try {
      const { useAuthStore: dynamicAuthStore } = await import('../useAuthStore');
      const authStore = dynamicAuthStore.getState();
      const isAuthenticated = authStore.status === 'authenticated';
      const currentUserId = authStore.user?.id ?? 'guest';
      
      console.log('[Store] Initiating GLOBAL space clear...');
      await syncOrchestrator.setSyncBlocked(true);

      const workspaceId = ulid();
      const now = Date.now();
      const randomSpaceName = SPACE_NAMES[Math.floor(Math.random() * SPACE_NAMES.length)];
      const newSpace = { id: workspaceId, userId: currentUserId, name: randomSpaceName, mode: 'spatial' as const, physics: localStorage.getItem('cyberia-physics-enabled') !== 'false', order: 0, updatedAt: now, syncStatus: 'local' as const };
      
      await db.transaction('rw', [db.spaces, db.thoughts, db.stacks, db.blobs], async () => {
        await Promise.all([
          db.spaces.clear(),
          db.thoughts.clear(),
          db.stacks.clear(),
          db.blobs.clear()
        ]);
        await db.spaces.add(newSpace);
        localStorage.setItem('cyberia-active-space-id', workspaceId);
      });

      if (isAuthenticated) {
        console.log('[Store] Cleaning cloud backup to match local slate...');
        await authStore.deleteCloudData(); 
      }

      set({ 
        spaces: [newSpace], 
        stacks: [], 
        thoughts: [],
        activeSpaceId: workspaceId,
        transform: { x: 0, y: 0, scale: 1 }
      });
      get().pushHistory();
      
      console.log('[Store] Global clear complete.');
    } catch (err) { 
      console.error('Global clear failed:', err); 
    } finally {
      await syncOrchestrator.setSyncBlocked(false);
    }
  },

  importFullState: async (data: any, merge: boolean = false) => {
    if (get().isReadOnly) return;
    try {
      console.log(`[Store] ${merge ? 'Merging' : 'Importing'} full state from cloud...`);
      const { useAuthStore: dynamicAuthStore } = await import('../useAuthStore');
      const currentUserId = dynamicAuthStore.getState().user?.id ?? 'guest';
      
      // Ensure syncStatus is set to 'synced' and explicitly stamp with the current user ID
      const cloudSpaces = (data.spaces || []).map((s: any) => ({ ...s, userId: currentUserId, syncStatus: 'synced' }));
      const cloudThoughts = (data.thoughts || []).map((t: any) => ({ ...t, userId: currentUserId, syncStatus: 'synced' }));
      const cloudStacks = (data.stacks || []).map((s: any) => ({ ...s, userId: currentUserId, syncStatus: 'synced' }));

      await db.transaction('rw', [db.spaces, db.thoughts, db.stacks], async () => {
        if (cloudSpaces.length > 0) {
          // IMPORTANT: Only clear data belonging to the current user! Protects "Keep Separate" guest data.
          if (!merge) await db.spaces.where('userId').equals(currentUserId).delete();
          await db.spaces.bulkPut(cloudSpaces);
        }
        if (cloudThoughts.length > 0) {
          if (!merge) await db.thoughts.where('userId').equals(currentUserId).delete();
          await db.thoughts.bulkPut(cloudThoughts);
        }
        if (cloudStacks.length > 0) {
          if (!merge) await db.stacks.where('userId').equals(currentUserId).delete();
          await db.stacks.bulkPut(cloudStacks);
        }
      });

      if (data.activeSpaceId) {
        localStorage.setItem('cyberia-active-space-id', data.activeSpaceId);
      }
      
      await get().refreshSpaces();
      await get().refreshTotalThoughtCount();
      await get().cleanupTrash();
      
      const { spaces, activeSpaceId } = get();
      if (spaces.length > 0) {
        const targetId = activeSpaceId || data.activeSpaceId || spaces[0].id;
        await get().setActiveSpace(targetId);
      }
      
      console.log('[Store] Full state import complete.');
    } catch (err) {
      console.error('Full state import failed', err);
    }
  },

  clearLocalData: async () => {
    try {
      console.log('[Store] Initiating LOCAL Factory Reset...');
      const { useAuthStore: dynamicAuthStore } = await import('../useAuthStore');
      const authStore = dynamicAuthStore.getState();

      await db.transaction('rw', [db.spaces, db.thoughts, db.stacks, db.blobs], async () => {
        await Promise.all([
          db.spaces.clear(),
          db.thoughts.clear(),
          db.stacks.clear(),
          db.blobs.clear()
        ]);
      });
      
      if (authStore.status === 'authenticated') {
        await authStore.signOut();
      } else {
        localStorage.clear();
      }
      
      await get().createInitialWorkspace();
      console.log('[Store] Factory reset complete.');
    } catch (err) { console.error('Local reset failed:', err); }
  },

  exportData: async () => {
    const currentUserId = (useAuthStore.getState().user?.id) ?? 'guest';
    const allSpaces = await db.spaces.filter((s: any) => s.userId === currentUserId).toArray();
    const allThoughts = await db.thoughts.filter((t: any) => t.userId === currentUserId).toArray();
    const allStacks = await db.stacks.filter((s: any) => s.userId === currentUserId).toArray();
    const thoughtIds = new Set(allThoughts.map(t => t.id));
    const allBlobs = await db.blobs.filter((b: any) => thoughtIds.has(b.thoughtId)).toArray();
    const data = { spaces: allSpaces, thoughts: allThoughts, stacks: allStacks, blobs: allBlobs, activeSpaceId: get().activeSpaceId, version: 16, timestamp: Date.now() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cyberia_space_backup_${new Date().toLocaleDateString('en-CA')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  importData: async (input: any) => {
    if (get().isReadOnly) return;
    const processData = async (data: any) => {
      if (!data || typeof data !== 'object' || !('spaces' in data) || !('thoughts' in data)) throw new Error('Invalid backup');
      await syncOrchestrator.setSyncBlocked(true);

      try {
        const currentUserId = (useAuthStore.getState().user?.id) ?? 'guest';

        const remappedSpaces = (data.spaces || []).map((s: any) => ({
          ...s, userId: currentUserId, id: ulid(), updatedAt: Date.now(), syncStatus: 'local',
        }));
        
        const spaceIdMap = new Map<string, string>();
        const oldSpaceIds = (data.spaces || []).map((s: any) => s.id);
        const newSpaceIds = remappedSpaces.map((s: any) => s.id);
        oldSpaceIds.forEach((oldId: string, i: number) => spaceIdMap.set(oldId, newSpaceIds[i]));

        const remappedThoughts = (data.thoughts || []).map((t: any) => ({
          ...t, userId: currentUserId, id: ulid(), spaceId: spaceIdMap.get(t.spaceId) || t.spaceId, updatedAt: Date.now(), syncStatus: 'local',
        }));

        const thoughtIdMap = new Map<string, string>();
        const oldThoughtIds = (data.thoughts || []).map((t: any) => t.id);
        const newThoughtIds = remappedThoughts.map((t: any) => t.id);
        oldThoughtIds.forEach((oldId: string, i: number) => thoughtIdMap.set(oldId, newThoughtIds[i]));

        const remappedStacks = (data.stacks || []).map((s: any) => ({
          ...s, userId: currentUserId, id: ulid(), spaceId: spaceIdMap.get(s.spaceId) || s.spaceId, updatedAt: Date.now(), syncStatus: 'local',
        }));

        const remappedBlobs = (data.blobs || []).map((b: any) => ({
          ...b, id: thoughtIdMap.get(b.thoughtId) || b.thoughtId, thoughtId: thoughtIdMap.get(b.thoughtId) || b.thoughtId, updatedAt: Date.now(),
        }));

        const authStore = useAuthStore.getState();
        let bgPathsToClean: string[] = [];
        if (authStore.status === 'authenticated' && authStore.user) {
          const existingSpaces = await db.spaces.filter((s: any) => !s.deletedAt && s.userId === currentUserId).toArray();
          bgPathsToClean = existingSpaces
            .filter((s: any) => s.customBg && isStorageUrl(s.customBg))
            .map((s: any) => `${authStore.user!.id}/backgrounds/bg_${s.id}`);
        }

        await db.transaction('rw', db.spaces, db.thoughts, db.stacks, db.blobs, async () => {
          await db.spaces.clear();
          await db.thoughts.clear();
          await db.stacks.clear();
          await db.blobs.clear();
          await db.spaces.bulkAdd(remappedSpaces);
          await db.thoughts.bulkAdd(remappedThoughts);
          if (remappedStacks.length > 0) await db.stacks.bulkAdd(remappedStacks);
          if (remappedBlobs.length > 0) await db.blobs.bulkAdd(remappedBlobs);
        });

        if (bgPathsToClean.length > 0) {
          const { supabaseStorage } = await import('../../services/supabaseStorage');
          await Promise.allSettled(
            bgPathsToClean.map(path => supabaseStorage.deleteFile(path).catch((e: any) => console.warn('[Import] Background cleanup failed:', path, e)))
          );
        }

        localStorage.removeItem('cyberia-last-sync');
        if (data.activeSpaceId) localStorage.setItem('cyberia-active-space-id', data.activeSpaceId);
        if (data.settings?.theme) localStorage.setItem('cyberia-theme', data.settings.theme);
      } finally {
        await syncOrchestrator.setSyncBlocked(false);
      }
      window.location.reload();
    };
    if (input instanceof File) {
      const reader = new FileReader();
      reader.onload = async (e) => { 
        try { await processData(JSON.parse(e.target?.result as string)); } 
        catch (err) { 
          useModalStore.getState().openModal({ title: 'Import Failed', description: 'The backup file is invalid or corrupted.', type: 'alert', confirmText: 'Okay' });
        } 
      };
      reader.readAsText(input);
    } else {
      try { await processData(input); } catch (err) { console.error('Import failed', err); }
    }
  },

  isLocalWorkspaceEmpty: async () => {
    const currentUserId = (useAuthStore.getState().user?.id) ?? 'guest';
    
    const thoughtsCount = await db.thoughts.filter((t: any) => !t.deletedAt && !t.archivedAt && t.userId === currentUserId).count();
    const spaces = await db.spaces.filter((s: any) => !s.deletedAt && s.userId === currentUserId).toArray();
    
    if (thoughtsCount > 0) return false;
    if (spaces.length > 1) return false;

    if (spaces.length === 1) {
      const s = spaces[0];
      const defaultNames = ['Workspace', 'New Space', 'Personal'];
      if (!defaultNames.includes(s.name)) return false;
    }

    const deletedThoughtsCount = await db.thoughts.filter((t: any) => Boolean(t.deletedAt) && t.userId === currentUserId).count();
    const deletedSpacesCount = await db.spaces.filter((s: any) => Boolean(s.deletedAt) && s.userId === currentUserId).count();
    
    if (deletedThoughtsCount > 0 || deletedSpacesCount > 0) {
      console.log(`[Store] Found pending deletions - space is NOT empty`);
      return false;
    }

    return true; 
  },

  getLimits: () => {
    const plan = (useAuthStore.getState().user?.plan as SubscriptionPlan) || 'free';
    return PLAN_CONFIG[plan] || PLAN_CONFIG.free;
  },

  cleanupTrash: async () => {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    
    const thoughtsToPurge = await db.thoughts.filter((t: any) => Boolean(t.deletedAt) && t.deletedAt < thirtyDaysAgo && t.syncStatus === 'synced').toArray();
    
    if (thoughtsToPurge.length > 0) {
      const ids = thoughtsToPurge.map(t => t.id);
      await db.transaction("rw", db.thoughts, db.blobs, async () => {
        await db.thoughts.bulkDelete(ids);
        await db.blobs.where("thoughtId").anyOf(ids).delete();
      });
    }

    try {
      const allThoughtIds = new Set((await db.thoughts.toCollection().primaryKeys()));
      const allBlobs = await db.blobs.toArray();
      const orphanedBlobs = allBlobs.filter(b => !allThoughtIds.has(b.thoughtId));
      const blobsToPurge = orphanedBlobs.filter(b => b.updatedAt < thirtyDaysAgo);
      
      if (blobsToPurge.length > 0) {
        const blobIds = blobsToPurge.map(b => b.id);
        await db.blobs.bulkDelete(blobIds);
      }
    } catch (err) {
      console.error('[Storage] Orphaned blob cleanup failed:', err);
    }
  },

  migrateLegacyData: async (userId: string) => {
    const now = Date.now();
    console.log('[Migration] Starting migration for user:', userId);
    try {
      await db.transaction('rw', [db.spaces, db.thoughts, db.stacks, db.blobs], async () => {
        const spaceCount = await db.spaces
          .filter((s: any) => !s.userId || s.userId === 'guest')
          .modify((s: any) => {
            s.userId = userId;
            s.updatedAt = now;
            s.syncStatus = 'local';
            if (s.customBg && s.customBg.includes('/backgrounds/')) {
              const pathParts = s.customBg.split('/backgrounds/')[0].split('/');
              const bgUserId = pathParts[pathParts.length - 1];
              if (bgUserId && bgUserId !== userId) {
                s.customBg = null;
              }
            }
          });

        const thoughtCount = await db.thoughts.filter((t: any) => !t.userId || t.userId === 'guest').modify({ userId, updatedAt: now, syncStatus: 'local' });
        const stackCount = await db.stacks.filter((s: any) => !s.userId || s.userId === 'guest').modify({ userId, updatedAt: now, syncStatus: 'local' });
        const blobCount = await db.blobs.filter((b: any) => !b.userId || b.userId === 'guest').modify({ userId, updatedAt: now });

        console.log(`[Migration] Atomic re-ownership complete: ${spaceCount} spaces, ${thoughtCount} thoughts, ${stackCount} stacks, ${blobCount} blobs.`);
      });
    } catch (err) {
      console.error('[Migration] Failed to migrate legacy data:', err);
      throw err;
    }
  },

  migrateGuestSpaces: async (accountUserId: string) => {
    const now = Date.now();
    let migratedCount = 0;
    let discardedCount = 0;
    
    console.log('[Migration] Starting smart migration for user:', accountUserId);

    await db.transaction('rw', [db.spaces, db.thoughts, db.stacks, db.blobs, db.spaceBackgrounds], async () => {
      const guestSpaces = await db.spaces.filter(s => s.userId === 'guest' && !s.deletedAt).toArray();
      const validSpaceIds: string[] = [];
      const discardedSpaceIds: string[] = [];

      for (const space of guestSpaces) {
        const thoughtCount = await db.thoughts.where('spaceId').equals(space.id).filter(t => !t.deletedAt && !t.archivedAt).count();
        if (thoughtCount > 0) validSpaceIds.push(space.id);
        else discardedSpaceIds.push(space.id);
      }

      migratedCount = validSpaceIds.length;
      discardedCount = discardedSpaceIds.length;

      if (validSpaceIds.length > 0) {
        await db.spaces.where('id').anyOf(validSpaceIds).modify({ userId: accountUserId, updatedAt: now, syncStatus: 'local' });
      }

      if (discardedSpaceIds.length > 0) {
        await db.spaces.where('id').anyOf(discardedSpaceIds).modify({ deletedAt: now, updatedAt: now, syncStatus: 'local' });
      }

      // Migrate all guest data to the account user
      // Update thought userId and syncStatus
      await db.thoughts.where('userId').equals('guest').modify({ userId: accountUserId, updatedAt: now, syncStatus: 'local' });
      await db.stacks.where('userId').equals('guest').modify({ userId: accountUserId, updatedAt: now, syncStatus: 'local' });
      // Update blob userId to match the migrated thoughts
      await db.blobs.where('userId').equals('guest').modify({ userId: accountUserId });
      // Update space background userId to match the migrated spaces
      await db.spaceBackgrounds.where('userId').equals('guest').modify({ userId: accountUserId });
    });
    
    console.log(`[Migration] Migrated ${migratedCount} spaces, discarded ${discardedCount} empty spaces`);
    return { migrated: migratedCount, discarded: discardedCount };
  },

  calculatePendingUploadSize: async (userId: string) => {
    // Sum all blob sizes for the given user that need cloud upload
    // (blobs for thoughts with syncStatus: 'local' or no storagePath)
    const currentUserId = userId;
    const userThoughtIds = new Set(
      (await db.thoughts.filter((t: any) => t.userId === currentUserId && !t.deletedAt).toArray())
        .filter((t: any) => t.syncStatus === 'local' || !t.storagePath)
        .map((t: any) => t.id)
    );
    
    let totalBytes = 0;
    
    // Count thought blobs
    const pendingBlobs = await db.blobs.filter((b: any) => userThoughtIds.has(b.thoughtId) && b.userId === currentUserId).toArray();
    totalBytes += pendingBlobs.reduce((sum: number, b: any) => sum + (b.blob?.size || 0), 0);
    
    // Count space background blobs
    const pendingBgs = await db.spaceBackgrounds.filter((b: any) => b.userId === currentUserId).toArray();
    totalBytes += pendingBgs.reduce((sum: number, b: any) => sum + (b.blob?.size || 0), 0);
    
    return totalBytes / (1024 * 1024); // Return MB
  },

  discardGuestSpaces: async () => {
    const now = Date.now();
    console.log('[Migration] Discarding all guest data...');
    
    await db.transaction('rw', [db.spaces, db.thoughts, db.stacks, db.blobs, db.spaceBackgrounds], async () => {
      await db.spaces.where('userId').equals('guest').modify({ deletedAt: now, updatedAt: now, syncStatus: 'local' });
      await db.thoughts.where('userId').equals('guest').modify({ deletedAt: now, updatedAt: now, syncStatus: 'local' });
      await db.stacks.where('userId').equals('guest').modify({ deletedAt: now, updatedAt: now, syncStatus: 'local' });
      
      // Delete guest blobs (associated with discarded guest thoughts)
      await db.blobs.where('userId').equals('guest').delete();
      // Delete guest space backgrounds (for discarded spaces)
      await db.spaceBackgrounds.where('userId').equals('guest').delete();
    });
  },

  ensureWorkspaceForCurrentUser: async () => {
    const currentUserId = (useAuthStore.getState().user?.id) ?? 'guest';
    const spaces = await db.spaces.filter((s: any) => s.userId === currentUserId && !s.deletedAt).toArray();
    console.log('[Store] ensureWorkspace: found', spaces.length, 'existing spaces for user', currentUserId);
    if (spaces.length === 0) {
      console.log('[ensureWorkspaceForCurrentUser] No spaces found, creating new space');
      const workspaceId = ulid();
      const now = Date.now();
      await db.spaces.add({ id: workspaceId, userId: currentUserId, name: 'My Space', mode: 'spatial', physics: true, order: 0, updatedAt: now, syncStatus: 'local' });
      localStorage.setItem('cyberia-active-space-id', workspaceId);
      await get().refreshSpaces();
      await get().setActiveSpace(workspaceId);
    }
  },

  resetStoreState: (theme?: 'dark' | 'light') => {
    set({
      thoughts: [],
      spaces: [],
      stacks: [],
      activeSpaceId: null,
      transform: { x: 0, y: 0, scale: 1 },
      selectedThoughtIds: [],
      creatorName: null,
      customBg: null,
      theme: theme || DEFAULT_THEME
    });
  },

  clearWorkspaceData: () => {
    set({
      thoughts: [],
      spaces: [],
      stacks: []
    });
  },
});