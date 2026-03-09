import { type StateCreator } from 'zustand';
import { db, type Space, type Thought, type Stack } from '../../db';
import { useModalStore } from '../useModalStore';
import { PLAN_CONFIG, type SubscriptionPlan } from '../../constants';
import { syncOrchestrator } from '../../services/sync/syncOrchestrator';
import { useAuthStore } from '../useAuthStore';
import { type CyberiaState } from '../types';
import { migrateThoughtsToModular } from '../../utils/migrations';
import { ulid } from 'ulid';

let isCreatingInitialWorkspace = false;

export const createDataSlice: StateCreator<CyberiaState, [], [], any> = (set, get, _api) => ({
  isInitializing: true,
  isDemo: false,
  lastSpaceRequestId: 0,
  _savedUserState: null as { spaces: Space[]; thoughts: Thought[]; stacks: Stack[]; activeSpaceId: string | null } | null,


  init: async () => {
    try {
      if (get().isDemo) {
        set({ isInitializing: false, isSpaceLoading: false });
        return;
      }
      if (get().performanceMode) document.body.classList.add('low-perf');

      // Ensure DB is open and ready
      try {
        await db.open();
      } catch (err) {
        console.error('Failed to open database:', err);
      }

      // Run data migration for modular thought payloads
      await migrateThoughtsToModular();

      const { useAuthStore: dynamicAuthStore } = await import('../useAuthStore');
      // Fire initAuth in background to prevent blocking workspace render
      dynamicAuthStore.getState().initAuth();
      
      const user = dynamicAuthStore.getState().user;
      if (user) set({ oracleMode: true });

      const path = window.location.pathname;
      if (path.startsWith('/s/')) {
        const parts = path.split('/s/');
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
            const theme = data.space.theme || 'cyberia';
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

      set({ isSpaceLoading: true });
      const savedTheme = localStorage.getItem('cyberia-theme') || 'cyberia';
      document.body.setAttribute('data-theme', savedTheme);
      
      try {
        await get().refreshSpaces();
        await get().refreshTotalThoughtCount();
        await get().cleanupTrash();
      } catch (err) {
        console.error('Failed to load data, resetting to initial workspace:', err);
        await get().createInitialWorkspace();
        return;
      }
      
      const { spaces } = get();
      if (spaces.length === 0) {
        // No data in DB, create initial empty workspace
        await get().createInitialWorkspace();
      } else {
        const savedSpaceId = localStorage.getItem('cyberia-active-space-id');
        const spaceExists = savedSpaceId ? spaces.find((s: Space) => s.id === savedSpaceId) : null;
        if (spaceExists) await get().setActiveSpace(savedSpaceId!);
        else await get().setActiveSpace(spaces[0].id);
      }
    } finally {
      set({ isInitializing: false, isSpaceLoading: false });
    }
  },

  createInitialWorkspace: async () => {
    if (isCreatingInitialWorkspace) return;
    isCreatingInitialWorkspace = true;
    
    try {
      // IDEMPOTENCY CHECK: Ensure we don't create multiple initial workspaces
      const existingCount = await db.spaces.filter(s => !s.deletedAt).count();
      if (existingCount > 0) {
        console.log('[Store] Initial workspace already exists, skipping creation.');
        await get().refreshSpaces();
        return;
      }

      const workspaceId = ulid();
      const now = Date.now();
      
      const initialSpace: Space = {
        id: workspaceId,
        name: 'Workspace',
        mode: 'spatial',
        physics: true,
        order: 0,
        updatedAt: now,
        syncStatus: 'local'
      };

      await db.spaces.add(initialSpace);
      localStorage.setItem('cyberia-active-space-id', workspaceId);
      await get().refreshSpaces();
      await get().setActiveSpace(workspaceId);
    } catch (err) {
      console.error('Failed to create initial workspace:', err);
    } finally {
      isCreatingInitialWorkspace = false;
    }
  },

  loadDemoData: async () => {
    // This is purely for demo/temporary use (e.g., Homepage)
    const demoSpaceId = ulid();
    const s1 = ulid();
    const s2 = ulid();
    const s3 = ulid();
    const now = Date.now();
    
    const demoSpaces: Space[] = [{
      id: demoSpaceId,
      name: 'Demo Workspace',
      mode: 'spatial',
      physics: true,
      order: 0,
      isOnboarding: true,
      updatedAt: now,
      syncStatus: 'local'
    }];

    const demoStacks: Stack[] = [
      { id: s1, name: 'Spatial Flux', color: '#6366f1', spaceId: demoSpaceId, isOnboarding: true, updatedAt: now, syncStatus: 'local' },
      { id: s2, name: 'Dynamic Views', color: '#8b5cf6', spaceId: demoSpaceId, isOnboarding: true, updatedAt: now, syncStatus: 'local' },
      { id: s3, name: 'Oracle AI', color: '#3b82f6', spaceId: demoSpaceId, isOnboarding: true, updatedAt: now, syncStatus: 'local' },
    ];

    const demoThoughts: Thought[] = [
      { id: ulid(), text: 'Physical Thinking', type: 'text', x: 300, y: 200, vx: 0, vy: 0, stackId: s1, status: 'none', spaceId: demoSpaceId, layer: 1, priority: 'urgent', description: '', author: 'Cyberia', size: 1.2, order: 0, date: '2026-03-01', data: { type: 'text', content: 'Thoughts have mass and velocity. Drag them to interact with the engine.' }, updatedAt: now, syncStatus: 'local' },
      { id: ulid(), text: 'Physical Links', type: 'text', x: 300, y: 400, vx: 0, vy: 0, stackId: s1, status: 'doing', spaceId: demoSpaceId, layer: 2, priority: 'high', description: '', author: 'Cyberia', size: 1.0, order: 1, date: '2026-03-01', data: { type: 'text', content: 'Nodes in a stack physically orbit each other.' }, updatedAt: now, syncStatus: 'local' },
      { id: ulid(), text: 'Spatial Logic', type: 'label', x: 300, y: 100, vx: 0, vy: 0, stackId: s1, status: 'todo', spaceId: demoSpaceId, layer: 500, priority: 'none', description: '', author: 'Cyberia', size: 1.0, order: 2, date: '', data: { type: 'label' }, updatedAt: now, syncStatus: 'local' },
      { id: ulid(), text: 'Infinite Canvas.jpg', type: 'file', description: 'Visual mapping across infinite space.', x: 600, y: 300, vx: 0, vy: 0, stackId: s2, status: 'none', spaceId: demoSpaceId, layer: 3, priority: 'high', author: 'Cyberia', size: 1.3, order: 0, date: '2026-03-05', data: { type: 'file', url: '/onboarding.jpg', name: 'onboarding.jpg', size: 0, meta: { file: { name: 'onboarding.jpg', type: 'image/jpeg', size: 0 } } }, updatedAt: now, syncStatus: 'local' },
      { id: ulid(), text: 'Dynamic Stacks', type: 'tasks', x: 600, y: 500, vx: 0, vy: 0, stackId: s2, status: 'none', spaceId: demoSpaceId, layer: 4, priority: 'medium', description: '', author: 'Cyberia', size: 1.0, order: 1, date: '2026-03-05', data: { type: 'tasks', tasks: [{ text: 'Move a node', done: true }, { text: 'Toggle View', done: false }] }, updatedAt: now, syncStatus: 'local' },
      { id: ulid(), text: 'Morphing Views', type: 'label', x: 600, y: 200, vx: 0, vy: 0, stackId: s2, status: 'todo', spaceId: demoSpaceId, layer: 501, priority: 'none', description: '', author: 'Cyberia', size: 1.0, order: 2, date: '', data: { type: 'label' }, updatedAt: now, syncStatus: 'local' },
      { id: ulid(), text: 'Artificial Reasoning', type: 'text', x: 900, y: 200, vx: 0, vy: 0, stackId: s3, status: 'none', spaceId: demoSpaceId, layer: 5, priority: 'urgent', description: '', author: 'Cyberia', size: 1.4, order: 0, date: '2026-03-10', data: { type: 'text', content: 'Ask Oracle to analyze your workspace, suggest connections, or automate repetitive tasks.' }, updatedAt: now, syncStatus: 'local' },
      { id: ulid(), text: 'Action Intelligence', type: 'tasks', x: 900, y: 400, vx: 0, vy: 0, stackId: s3, status: 'todo', spaceId: demoSpaceId, layer: 6, priority: 'high', description: '', author: 'Cyberia', size: 1.1, order: 1, date: '2026-03-10', data: { type: 'tasks', tasks: [{ text: 'Toggle Oracle Mode', done: true }, { text: 'Enable Action Mode', done: false }] }, updatedAt: now, syncStatus: 'local' },
      { id: ulid(), text: 'Cognitive Layer', type: 'label', x: 900, y: 100, vx: 0, vy: 0, stackId: s3, status: 'none', spaceId: demoSpaceId, layer: 502, priority: 'none', description: '', author: 'Cyberia', size: 1.0, order: 2, date: '', data: { type: 'label' }, updatedAt: now, syncStatus: 'local' },
    ];

    set({ 
      spaces: demoSpaces, 
      stacks: demoStacks, 
      thoughts: demoThoughts, 
      activeSpaceId: demoSpaceId,
      isSpaceLoading: false,
      transform: { x: 0, y: 0, scale: 0.8 } 
    });
  },

  clearWorkspace: async () => {
    if (get().isReadOnly) return;
    try {
      const { useAuthStore: dynamicAuthStore } = await import('../useAuthStore');
      const authStore = dynamicAuthStore.getState();
      const isAuthenticated = authStore.status === 'authenticated';
      
      console.log('[Store] Initiating GLOBAL workspace clear...');
      
      // Block sync during destructive operation
      await syncOrchestrator.setSyncBlocked(true);

      const workspaceId = ulid();
      const now = Date.now();
      
      // 1. Deep Local Wipe (ALL tables)
      await db.transaction('rw', [db.spaces, db.thoughts, db.stacks, db.blobs], async () => {
        await Promise.all([
          db.spaces.clear(),
          db.thoughts.clear(),
          db.stacks.clear(),
          db.blobs.clear()
        ]);
        
        // Create one fresh entry
        await db.spaces.add({ id: workspaceId, name: 'Workspace', mode: 'spatial', physics: true, order: 0, updatedAt: now, syncStatus: 'local' });
        localStorage.setItem('cyberia-active-space-id', workspaceId);
      });

      // 2. Global Cloud Wipe (if authenticated)
      if (isAuthenticated) {
        console.log('[Store] Cleaning cloud backup to match local slate...');
        await authStore.deleteCloudData(); 
      }

      // 3. Update Store State
      set({ 
        spaces: [{ id: workspaceId, name: 'Workspace', mode: 'spatial', physics: true, order: 0, updatedAt: now, syncStatus: 'local' }], 
        stacks: [], 
        thoughts: [], 
        activeSpaceId: workspaceId,
        transform: { x: 0, y: 0, scale: 1 }
      });
      
      console.log('[Store] Global clear complete.');
    } catch (err) { 
      console.error('Global clear failed:', err); 
    } finally {
      await syncOrchestrator.setSyncBlocked(false);
    }
  },

  importFullState: async (data: any) => {
    if (get().isReadOnly) return;
    try {
      console.log('[Store] Importing full state from cloud...');
      await db.transaction('rw', db.spaces, db.thoughts, db.stacks, async () => {
        // Clear and add only if data exists
        if (data.spaces && data.spaces.length > 0) {
          await db.spaces.clear();
          await db.spaces.bulkPut(data.spaces);
        }
        if (data.thoughts && data.thoughts.length > 0) {
          await db.thoughts.clear();
          await db.thoughts.bulkPut(data.thoughts);
        }
        if (data.stacks && data.stacks.length > 0) {
          await db.stacks.clear();
          await db.stacks.bulkPut(data.stacks);
        }
      });

      if (data.activeSpaceId) {
        localStorage.setItem('cyberia-active-space-id', data.activeSpaceId);
      }
      
      await get().refreshSpaces();
      await get().refreshTotalThoughtCount();
      await get().cleanupTrash();
      
      const { spaces } = get();
      if (spaces.length > 0) {
        const targetId = data.activeSpaceId || spaces[0].id;
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

      // 1. Deep Database Purge
      await db.transaction('rw', [db.spaces, db.thoughts, db.stacks, db.blobs], async () => {
        await Promise.all([
          db.spaces.clear(),
          db.thoughts.clear(),
          db.stacks.clear(),
          db.blobs.clear()
        ]);
      });
      
      // 2. Graceful Session Termination (Handles localStorage + Tokens)
      if (authStore.status === 'authenticated') {
        await authStore.signOut();
      } else {
        localStorage.clear();
      }
      
      // 3. Reload Initial Workspace
      await get().createInitialWorkspace();
      console.log('[Store] Factory reset complete.');
      
    } catch (err) { console.error('Local reset failed:', err); }
  },

  exportData: async () => {
    const allSpaces = await db.spaces.toArray();
    const allThoughts = await db.thoughts.toArray();
    const allStacks = await db.stacks.toArray();
    const allBlobs = await db.blobs.toArray();
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
      await db.transaction('rw', db.spaces, db.thoughts, db.stacks, db.blobs, async () => {
        await db.spaces.clear();
        await db.thoughts.clear();
        await db.stacks.clear();
        await db.blobs.clear();
        await db.spaces.bulkAdd(data.spaces);
        await db.thoughts.bulkAdd(data.thoughts);
        if (data.stacks) await db.stacks.bulkAdd(data.stacks);
        if (data.blobs) await db.blobs.bulkAdd(data.blobs);
      });
      if (data.activeSpaceId) localStorage.setItem('cyberia-active-space-id', data.activeSpaceId);
      if (data.settings?.theme) localStorage.setItem('cyberia-theme', data.settings.theme);
      window.location.reload();
    };
    if (input instanceof File) {
      const reader = new FileReader();
      reader.onload = async (e) => { 
        try { await processData(JSON.parse(e.target?.result as string)); } 
        catch (err) { 
          console.error('Import failed', err);
          useModalStore.getState().openModal({ 
            title: 'Import Failed', 
            description: 'The backup file is invalid or corrupted.', 
            type: 'alert', 
            confirmText: 'Okay' 
          });
        } 
      };
      reader.readAsText(input);
    } else {
      try { await processData(input); } catch (err) { console.error('Import failed', err); }
    }
  },

  isLocalWorkspaceEmpty: async () => {
    const thoughtsCount = await db.thoughts.filter(t => !t.deletedAt).count();
    const spacesCount = await db.spaces.filter(s => !s.deletedAt).count();
    
    if (thoughtsCount === 0) return true;

    const mediaCount = await db.thoughts.filter(t => t.type === 'file' && !t.deletedAt).count();
    if (mediaCount > 0) return false;

    const allSpaces = await db.spaces.toArray();
    const onboardingSpaceIds = new Set(allSpaces.filter(s => s.isOnboarding === true).map(s => s.id));
    
    const customThoughts = await db.thoughts
      .filter(t => !onboardingSpaceIds.has(t.spaceId) && !t.deletedAt)
      .count();
    
    if (customThoughts > 0) return false;
    
    if (thoughtsCount > 1) return false;
    if (spacesCount > 2) return false;

    return true; 
  },

  getLimits: () => {
    const plan = (useAuthStore.getState().user?.plan as SubscriptionPlan) || 'free';
    return PLAN_CONFIG[plan] || PLAN_CONFIG.free;
  },

  setDemoMode: (enabled: boolean) => {
    const state = get();
    if (enabled) {
      // Temporary IDs for demo
      const demoSpaceId = ulid();
      const s1 = ulid();
      const s2 = ulid();
      const s3 = ulid();
      const now = Date.now();

      const demoSpaces: Space[] = [{
        id: demoSpaceId,
        name: 'Demo Workspace',
        mode: 'spatial',
        physics: true,
        order: 0,
        isOnboarding: true,
        updatedAt: now,
        syncStatus: 'synced'
      }];

      const demoStacks: Stack[] = [
        { id: s1, name: 'Spatial Flux', color: '#6366f1', spaceId: demoSpaceId, isOnboarding: true, updatedAt: now, syncStatus: 'synced' },
        { id: s2, name: 'Dynamic Views', color: '#8b5cf6', spaceId: demoSpaceId, isOnboarding: true, updatedAt: now, syncStatus: 'synced' },
        { id: s3, name: 'Oracle AI', color: '#3b82f6', spaceId: demoSpaceId, isOnboarding: true, updatedAt: now, syncStatus: 'synced' },
      ];

      const demoThoughts: Thought[] = [
        { id: ulid(), text: 'Physical Thinking', type: 'text', x: 300, y: 200, vx: 0, vy: 0, stackId: s1, status: 'none', spaceId: demoSpaceId, layer: 1, priority: 'urgent', description: '', author: 'Cyberia', size: 1.2, order: 0, date: '2026-03-01', data: { type: 'text', content: 'Thoughts have mass and velocity. Drag them to interact with the engine.' }, updatedAt: now, syncStatus: 'synced' },
        { id: ulid(), text: 'Physical Links', type: 'text', x: 300, y: 400, vx: 0, vy: 0, stackId: s1, status: 'doing', spaceId: demoSpaceId, layer: 2, priority: 'high', description: '', author: 'Cyberia', size: 1.0, order: 1, date: '2026-03-01', data: { type: 'text', content: 'Nodes in a stack physically orbit each other.' }, updatedAt: now, syncStatus: 'synced' },
        { id: ulid(), text: 'Spatial Logic', type: 'label', x: 300, y: 100, vx: 0, vy: 0, stackId: s1, status: 'todo', spaceId: demoSpaceId, layer: 500, priority: 'none', description: '', author: 'Cyberia', size: 1.0, order: 2, date: '', data: { type: 'label' }, updatedAt: now, syncStatus: 'synced' },
        { id: ulid(), text: 'Infinite Canvas.jpg', type: 'file', description: 'Visual mapping across infinite space.', x: 600, y: 300, vx: 0, vy: 0, stackId: s2, status: 'none', spaceId: demoSpaceId, layer: 3, priority: 'high', author: 'Cyberia', size: 1.3, order: 0, date: '2026-03-05', data: { type: 'file', url: '/onboarding.jpg', name: 'onboarding.jpg', size: 0, meta: { file: { name: 'onboarding.jpg', type: 'image/jpeg', size: 0 } } }, updatedAt: now, syncStatus: 'synced' },
        { id: ulid(), text: 'Dynamic Stacks', type: 'tasks', x: 600, y: 500, vx: 0, vy: 0, stackId: s2, status: 'none', spaceId: demoSpaceId, layer: 4, priority: 'medium', description: '', author: 'Cyberia', size: 1.0, order: 1, date: '2026-03-05', data: { type: 'tasks', tasks: [{ text: 'Move a node', done: true }, { text: 'Toggle View', done: false }] }, updatedAt: now, syncStatus: 'synced' },
        { id: ulid(), text: 'Morphing Views', type: 'label', x: 600, y: 200, vx: 0, vy: 0, stackId: s2, status: 'todo', spaceId: demoSpaceId, layer: 501, priority: 'none', description: '', author: 'Cyberia', size: 1.0, order: 2, date: '', data: { type: 'label' }, updatedAt: now, syncStatus: 'synced' },
        { id: ulid(), text: 'Autonomous Agents', type: 'text', x: 900, y: 200, vx: 0, vy: 0, stackId: s3, status: 'none', spaceId: demoSpaceId, layer: 5, priority: 'urgent', description: '', author: 'Cyberia', size: 1.4, order: 0, date: '2026-03-10', data: { type: 'text', content: 'Deploy AI to research the web and automate connections.' }, updatedAt: now, syncStatus: 'synced' },
        { id: ulid(), text: 'Data Structures', type: 'table', x: 900, y: 400, vx: 0, vy: 0, stackId: s3, status: 'todo', spaceId: demoSpaceId, layer: 6, priority: 'high', description: '', author: 'Cyberia', size: 1.1, order: 1, date: '2026-03-10', data: { type: 'table', rows: [['Type', 'Function'], ['Text', 'Knowledge'], ['AI', 'Oracle']] }, updatedAt: now, syncStatus: 'synced' },
        { id: ulid(), text: 'Cognitive Layer', type: 'label', x: 900, y: 100, vx: 0, vy: 0, stackId: s3, status: 'none', spaceId: demoSpaceId, layer: 502, priority: 'none', description: '', author: 'Cyberia', size: 1.0, order: 2, date: '', data: { type: 'label' }, updatedAt: now, syncStatus: 'synced' },
      ];

      set({ 
        _savedUserState: {
          spaces: state.spaces,
          thoughts: state.thoughts,
          stacks: state.stacks,
          activeSpaceId: state.activeSpaceId
        },
        spaces: demoSpaces,
        stacks: demoStacks,
        thoughts: demoThoughts,
        activeSpaceId: demoSpaceId,
        isDemo: true, 
        isReadOnly: true, 
        isSpaceLoading: false,
        transform: { x: 0, y: 0, scale: 0.8 }
      });
    } else {
      const saved = state._savedUserState;
      if (saved) {
        set({ 
          spaces: saved.spaces,
          thoughts: saved.thoughts,
          stacks: saved.stacks,
          activeSpaceId: saved.activeSpaceId,
          isDemo: false, 
          isReadOnly: false,
          _savedUserState: null
        });
      } else {
        set({ isDemo: false, isReadOnly: false });
      }
    }
  },
  cleanupTrash: async () => {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const thoughtsToPurge = await db.thoughts
      .filter(t => t.deletedAt !== undefined && t.deletedAt !== null && t.deletedAt < thirtyDaysAgo)
      .toArray();
    
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
});
