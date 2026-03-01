import { type StateCreator } from 'zustand';
import { db, type Space, type Thought, type Stack } from '../../db';
import { useModalStore } from '../useModalStore';
import { PLAN_CONFIG, type SubscriptionPlan } from '../../constants';
import { syncOrchestrator } from '../../services/sync/syncOrchestrator';
import { useAuthStore } from '../useAuthStore';
import { type CyberiaState } from '../types';

export const createDataSlice: StateCreator<CyberiaState, [], [], any> = (set, get, _api) => ({
  isInitializing: typeof window !== 'undefined' ? (window.location.hostname !== 'cyberia.tn' && window.location.hostname !== 'www.cyberia.tn') : true,
  isDemo: false,
  _savedUserState: null as { spaces: Space[]; thoughts: Thought[]; stacks: Stack[]; activeSpaceId: string | null } | null,

  init: async () => {
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
      // If version change fails, we might need to reset or wait
    }

    const { useAuthStore: dynamicAuthStore } = await import('../useAuthStore');
    await dynamicAuthStore.getState().initAuth();
    const user = dynamicAuthStore.getState().user;
    if (user) set({ oracleMode: true });

    const path = window.location.pathname;
    if (path.startsWith('/s/')) {
      const parts = path.split('/s/');
      const sharedId = parts[1]?.split('/')[0];
      if (sharedId) {
        set({ isSpaceLoading: true, isReadOnly: true });
        try {
          const res = await fetch(`/api/publish?id=${sharedId}`);
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
        } catch (err) {
          console.error('Shared init failed:', err);
          useModalStore.getState().openModal({
            title: 'Space Not Found',
            description: 'Link invalid or expired.',
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
    } catch (err) {
      console.error('Failed to load data, resetting to onboarding:', err);
      get().loadOnboardingData();
      set({ isInitializing: false });
      return;
    }
    
    const { spaces } = get();
    if (spaces.length === 0) {
      // No data in DB, load onboarding
      get().loadOnboardingData();
    } else {
      const savedSpaceId = localStorage.getItem('cyberia-active-space-id');
      const spaceExists = savedSpaceId ? spaces.find((s: Space) => s.id === savedSpaceId) : null;
      if (spaceExists) get().setActiveSpace(savedSpaceId!);
      else get().setActiveSpace(spaces[0].id);
    }
    set({ isInitializing: false });
  },

  loadOnboardingData: async () => {
    const demoSpaceId = 'demo-space';
    const s1 = 'demo-s1';
    const s2 = 'demo-s2';
    const s3 = 'demo-s3';

    const demoSpaces: Space[] = [{
      id: demoSpaceId,
      name: 'Demo Workspace',
      mode: 'spatial',
      physics: true,
      order: 0
    }];

    const demoStacks: Stack[] = [
      { id: s1, name: 'Spatial Flux', color: '#6366f1', spaceId: demoSpaceId },
      { id: s2, name: 'Dynamic Views', color: '#8b5cf6', spaceId: demoSpaceId },
      { id: s3, name: 'Oracle AI', color: '#3b82f6', spaceId: demoSpaceId },
    ];

    const demoThoughts: Thought[] = [
      // STACK 1
      { id: 1001, text: 'Physical Thinking', type: 'text', content: 'Thoughts have mass and velocity. Drag them to interact with the engine.', x: 300, y: 200, vx: 0, vy: 0, stackId: s1, status: 'done', spaceId: demoSpaceId, layer: 1, priority: 'urgent', description: '', author: 'Cyberia', size: 1.2, order: 0, image: null, drawing: null, tasks: [], table: [], date: '2026-03-01' },
      { id: 1002, text: 'Physical Links', type: 'text', content: 'Nodes in a stack physically orbit each other.', x: 300, y: 400, vx: 0, vy: 0, stackId: s1, status: 'doing', spaceId: demoSpaceId, layer: 2, priority: 'high', description: '', author: 'Cyberia', size: 1.0, order: 1, image: null, drawing: null, tasks: [], table: [], date: '2026-03-01' },
      { id: 1003, text: 'Spatial Logic', type: 'label', x: 300, y: 100, vx: 0, vy: 0, stackId: s1, status: 'todo', spaceId: demoSpaceId, layer: 500, priority: 'none', description: '', author: 'Cyberia', size: 1.0, order: 2, image: null, drawing: null, tasks: [], table: [], content: '', date: '' },
      
      // STACK 2
      { id: 1004, text: 'Infinite Canvas', type: 'image', image: '/onboarding.jpg', description: 'Visual mapping across infinite space.', x: 600, y: 300, vx: 0, vy: 0, stackId: s2, status: 'done', spaceId: demoSpaceId, layer: 3, priority: 'high', author: 'Cyberia', size: 1.3, order: 0, drawing: null, tasks: [], table: [], content: '', date: '2026-03-05' },
      { id: 1005, text: 'Dynamic Stacks', type: 'tasks', tasks: [{ text: 'Move a node', done: true }, { text: 'Toggle View', done: false }], x: 600, y: 500, vx: 0, vy: 0, stackId: s2, status: 'doing', spaceId: demoSpaceId, layer: 4, priority: 'medium', description: '', author: 'Cyberia', size: 1.0, order: 1, image: null, drawing: null, table: [], content: '', date: '2026-03-05' },
      { id: 1006, text: 'Morphing Views', type: 'label', x: 600, y: 200, vx: 0, vy: 0, stackId: s2, status: 'todo', spaceId: demoSpaceId, layer: 501, priority: 'none', description: '', author: 'Cyberia', size: 1.0, order: 2, image: null, drawing: null, tasks: [], table: [], content: '', date: '' },

      // STACK 3
      { id: 1007, text: 'Autonomous Agents', type: 'text', content: 'Deploy AI to research the web and automate connections.', x: 900, y: 200, vx: 0, vy: 0, stackId: s3, status: 'done', spaceId: demoSpaceId, layer: 5, priority: 'urgent', description: '', author: 'Cyberia', size: 1.4, order: 0, image: null, drawing: null, tasks: [], table: [], date: '2026-03-10' },
      { id: 1008, text: 'Data Structures', type: 'table', table: [['Type', 'Function'], ['Text', 'Knowledge'], ['AI', 'Oracle']], x: 900, y: 400, vx: 0, vy: 0, stackId: s3, status: 'todo', spaceId: demoSpaceId, layer: 6, priority: 'high', description: '', author: 'Cyberia', size: 1.1, order: 1, image: null, drawing: null, tasks: [], content: '', date: '2026-03-10' },
      { id: 1009, text: 'Cognitive Layer', type: 'label', x: 900, y: 100, vx: 0, vy: 0, stackId: s3, status: 'none', spaceId: demoSpaceId, layer: 502, priority: 'none', description: '', author: 'Cyberia', size: 1.0, order: 2, image: null, drawing: null, tasks: [], table: [], content: '', date: '' },
    ];

    // Save to database
    try {
      await db.transaction('rw', db.spaces, db.thoughts, db.stacks, async () => {
        await db.spaces.bulkPut(demoSpaces);
        await db.stacks.bulkPut(demoStacks);
        await db.thoughts.bulkPut(demoThoughts);
      });
      localStorage.setItem('cyberia-active-space-id', demoSpaceId);
    } catch (err) {
      console.error('Failed to save onboarding data to DB:', err);
    }

    set({ 
      spaces: demoSpaces, 
      stacks: demoStacks, 
      thoughts: demoThoughts, 
      activeSpaceId: demoSpaceId,
      isSpaceLoading: false,
      transform: { x: 0, y: 0, scale: 0.8 } 
    });
  },

  completeOnboarding: async () => {
    const { spaces } = get();
    if (spaces.length === 0) {
      set({ isSpaceLoading: true });
      const workspaceId = 's-workspace';
      const onboardingId = 's-onboarding';
      await db.spaces.bulkAdd([
        { id: workspaceId, name: 'Workspace', mode: 'spatial', physics: true, order: 0 },
        { id: onboardingId, name: 'Onboarding', mode: 'spatial', physics: true, order: 1 }
      ]);
      await get().refreshSpaces();
      set({ activeSpaceId: onboardingId });
      localStorage.setItem('cyberia-active-space-id', onboardingId);
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      const spatialId = 'st-spatial';
      const toolsId = 'st-tools';
      const logicId = 'st-logic';
      await db.stacks.bulkAdd([
        { id: spatialId, name: 'Spatial Engine', color: 'hsla(230, 80%, 60%, 1)', spaceId: onboardingId },
        { id: toolsId, name: 'Universal Tools', color: 'hsla(280, 80%, 65%, 1)', spaceId: onboardingId },
        { id: logicId, name: 'Logic Matrix', color: 'hsla(40, 90%, 55%, 1)', spaceId: onboardingId }
      ]);
      
      // 3. Populate Onboarding Constellation
      
      // --- STACK 1: SPATIAL ---
      await get().addThought({ text: 'Physical Thinking', type: 'text', content: 'Thoughts have mass and velocity. Drag them to interact with the engine.', x: cx - 500, y: cy - 100, stackId: spatialId, status: 'done', spaceId: onboardingId, layer: 1 });
      await get().addThought({ text: 'Physical Links', type: 'text', content: 'Use the Link tool to form Stacks. Nodes in a stack physically orbit each other.', x: cx - 500, y: cy + 100, stackId: spatialId, status: 'doing', spaceId: onboardingId, layer: 2 });
      await get().addThought({ text: 'Spatial Foundations', type: 'label', x: cx - 500, y: cy - 200, stackId: spatialId, spaceId: onboardingId, layer: 500 });

      // --- STACK 2: TOOLS ---
      await get().addThought({ text: 'Interface Asset', type: 'image', image: '/onboarding.jpg', description: 'Automated thumbnail processing for all visual formats.', x: cx + 500, y: cy - 100, stackId: toolsId, status: 'done', spaceId: onboardingId, layer: 3 });
      await get().addThought({ text: 'Media Stream', type: 'embed', content: 'https://www.youtube.com/watch?v=kvlbwbuJUiw', description: 'Zero-latency media embedding.', x: cx + 500, y: cy + 100, stackId: toolsId, status: 'doing', spaceId: onboardingId, layer: 4 });
      await get().addThought({ text: 'Creative Layers', type: 'label', x: cx + 500, y: cy - 200, stackId: toolsId, spaceId: onboardingId, layer: 501 });

      // --- STACK 3: LOGIC ---
      await get().addThought({ text: 'System Checklist', type: 'tasks', tasks: [{ text: 'Move a thought', done: true }, { text: 'Toggle Board view', done: false }, { text: 'Call the Oracle', done: false }], x: cx, y: cy + 350, stackId: logicId, status: 'todo', spaceId: onboardingId, layer: 5 });
      await get().addThought({ text: 'Format Specs', type: 'table', table: [['Type', 'Function'], ['Label', 'Header'], ['Text', 'Knowledge'], ['Tasks', 'Action']], x: cx, y: cy + 550, stackId: logicId, status: 'todo', spaceId: onboardingId, layer: 6 });
      await get().addThought({ text: 'Data Structures', type: 'label', x: cx, y: cy + 250, stackId: logicId, spaceId: onboardingId, layer: 502 });
      
      await get().refreshThoughts(onboardingId);
      await get().refreshStacks(onboardingId);
      set({ isSpaceLoading: false });
    }
  },

  clearWorkspace: async () => {
    if (get().isReadOnly) return;
    try {
      const { useAuthStore: dynamicAuthStore } = await import('../useAuthStore');
      const authStore = dynamicAuthStore.getState();
      const isAuthenticated = authStore.status === 'authenticated';
      
      const workspaceId = 's-workspace-' + Date.now();
      
      await db.transaction('rw', db.spaces, db.thoughts, db.stacks, db.blobs, async () => {
        await db.spaces.clear();
        await db.thoughts.clear();
        await db.stacks.clear();
        await db.blobs.clear();
        
        // Create one empty workspace
        await db.spaces.add({ id: workspaceId, name: 'Workspace', mode: 'spatial', physics: true, order: 0 });
        localStorage.setItem('cyberia-active-space-id', workspaceId);
      });
      
      // Refresh state without reload
      set({ 
        spaces: [{ id: workspaceId, name: 'Workspace', mode: 'spatial', physics: true, order: 0 }], 
        stacks: [], 
        thoughts: [], 
        activeSpaceId: workspaceId,
        transform: { x: 0, y: 0, scale: 1 }
      });
      
      if (isAuthenticated) {
        await syncOrchestrator.triggerSync();
      }
      
    } catch (err) { console.error('Clear failed', err); }
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
      
      // Instead of full init() which might trigger recursive auth syncs,
      // just refresh the data and state.
      await get().refreshSpaces();
      await get().refreshTotalThoughtCount();
      
      const { spaces } = get();
      if (spaces.length > 0) {
        const targetId = data.activeSpaceId || spaces[0].id;
        get().setActiveSpace(targetId);
      }
      
      console.log('[Store] Full state import complete.');
    } catch (err) {
      console.error('Full state import failed', err);
    }
  },

  clearLocalData: async () => {
    try {
      // Clear database
      await db.transaction('rw', db.spaces, db.thoughts, db.stacks, db.blobs, async () => {
        await db.spaces.clear();
        await db.thoughts.clear();
        await db.stacks.clear();
        await db.blobs.clear();
      });
      
      // Clear localStorage
      localStorage.clear();
      
      // Clear cookies
      const cookies = document.cookie.split(";");
      for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i];
        const eqPos = cookie.indexOf("=");
        const name = eqPos > -1 ? cookie.substring(0, eqPos) : cookie;
        document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
      }
      
      // Load onboarding data into store (this populates the demo thoughts)
      get().loadOnboardingData();
      
    } catch (err) { console.error('Local data clear failed', err); }
  },

  exportData: async () => {
    const allSpaces = await db.spaces.toArray();
    const allThoughts = await db.thoughts.toArray();
    const allStacks = await db.stacks.toArray();
    const allBlobs = await db.blobs.toArray();
    const data = { spaces: allSpaces, thoughts: allThoughts, stacks: allStacks, blobs: allBlobs, activeSpaceId: get().activeSpaceId, version: 3, timestamp: Date.now() };
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
            description: 'The backup file is invalid or corrupted. Please select a valid Cyberia backup file.', 
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
    const thoughtsCount = await db.thoughts.count();
    const spacesCount = await db.spaces.count();
    console.log(`[Conflict] Checking local state: ${thoughtsCount} thoughts, ${spacesCount} spaces`);
    
    // If absolutely zero thoughts, it's definitely empty
    if (thoughtsCount === 0) return true;

    // If there are ANY images or files, it's definitely NOT empty
    const mediaCount = await db.thoughts.filter(t => t.type === 'image' || t.type === 'file').count();
    if (mediaCount > 0) {
      console.log(`[Conflict] Detected ${mediaCount} media thoughts. Not empty.`);
      return false;
    }

    // Check for any thoughts that are NOT part of the default onboarding set
    // Onboarding thoughts have specific space IDs.
    const customThoughts = await db.thoughts
      .filter(t => t.spaceId !== 's-onboarding' && t.spaceId !== 's-workspace')
      .count();
    
    if (customThoughts > 0) {
      console.log(`[Conflict] Detected ${customThoughts} thoughts in custom spaces. Not empty.`);
      return false;
    }
    
    // Even if in default spaces, if there are many thoughts, it's not empty
    // Default onboarding has about 8-10 thoughts.
    if (thoughtsCount > 1) {
      console.log(`[Conflict] Detected ${thoughtsCount} thoughts in default spaces. Not empty.`);
      return false;
    }

    if (spacesCount > 2) {
      console.log(`[Conflict] Detected ${spacesCount} spaces. Not empty.`);
      return false;
    }

    console.log('[Conflict] Local workspace is considered empty/insignificant.');
    return true; 
  },

  getLimits: () => {
    const plan = (useAuthStore.getState().user?.plan as SubscriptionPlan) || 'free';
    return PLAN_CONFIG[plan] || PLAN_CONFIG.free;
  },

  setDemoMode: (enabled: boolean) => {
    const state = get();
    if (enabled) {
      const demoSpaceId = 'demo-space';
      const s1 = 'demo-s1';
      const s2 = 'demo-s2';
      const s3 = 'demo-s3';

      const demoSpaces: Space[] = [{
        id: demoSpaceId,
        name: 'Demo Workspace',
        mode: 'spatial',
        physics: true,
        order: 0
      }];

      const demoStacks: Stack[] = [
        { id: s1, name: 'Spatial Flux', color: '#6366f1', spaceId: demoSpaceId },
        { id: s2, name: 'Dynamic Views', color: '#8b5cf6', spaceId: demoSpaceId },
        { id: s3, name: 'Oracle AI', color: '#3b82f6', spaceId: demoSpaceId },
      ];

      const demoThoughts: Thought[] = [
        { id: 1001, text: 'Physical Thinking', type: 'text', content: 'Thoughts have mass and velocity. Drag them to interact with the engine.', x: 300, y: 200, vx: 0, vy: 0, stackId: s1, status: 'done', spaceId: demoSpaceId, layer: 1, priority: 'urgent', description: '', author: 'Cyberia', size: 1.2, order: 0, image: null, drawing: null, tasks: [], table: [], date: '2026-03-01' },
        { id: 1002, text: 'Physical Links', type: 'text', content: 'Nodes in a stack physically orbit each other.', x: 300, y: 400, vx: 0, vy: 0, stackId: s1, status: 'doing', spaceId: demoSpaceId, layer: 2, priority: 'high', description: '', author: 'Cyberia', size: 1.0, order: 1, image: null, drawing: null, tasks: [], table: [], date: '2026-03-01' },
        { id: 1003, text: 'Spatial Logic', type: 'label', x: 300, y: 100, vx: 0, vy: 0, stackId: s1, status: 'todo', spaceId: demoSpaceId, layer: 500, priority: 'none', description: '', author: 'Cyberia', size: 1.0, order: 2, image: null, drawing: null, tasks: [], table: [], content: '', date: '' },
        { id: 1004, text: 'Infinite Canvas', type: 'image', image: '/onboarding.jpg', description: 'Visual mapping across infinite space.', x: 600, y: 300, vx: 0, vy: 0, stackId: s2, status: 'done', spaceId: demoSpaceId, layer: 3, priority: 'high', author: 'Cyberia', size: 1.3, order: 0, drawing: null, tasks: [], table: [], content: '', date: '2026-03-05' },
        { id: 1005, text: 'Dynamic Stacks', type: 'tasks', tasks: [{ text: 'Move a node', done: true }, { text: 'Toggle View', done: false }], x: 600, y: 500, vx: 0, vy: 0, stackId: s2, status: 'doing', spaceId: demoSpaceId, layer: 4, priority: 'medium', description: '', author: 'Cyberia', size: 1.0, order: 1, image: null, drawing: null, table: [], content: '', date: '2026-03-05' },
        { id: 1006, text: 'Morphing Views', type: 'label', x: 600, y: 200, vx: 0, vy: 0, stackId: s2, status: 'todo', spaceId: demoSpaceId, layer: 501, priority: 'none', description: '', author: 'Cyberia', size: 1.0, order: 2, image: null, drawing: null, tasks: [], table: [], content: '', date: '' },
        { id: 1007, text: 'Autonomous Agents', type: 'text', content: 'Deploy AI to research the web and automate connections.', x: 900, y: 200, vx: 0, vy: 0, stackId: s3, status: 'done', spaceId: demoSpaceId, layer: 5, priority: 'urgent', description: '', author: 'Cyberia', size: 1.4, order: 0, image: null, drawing: null, tasks: [], table: [], date: '2026-03-10' },
        { id: 1008, text: 'Data Structures', type: 'table', table: [['Type', 'Function'], ['Text', 'Knowledge'], ['AI', 'Oracle']], x: 900, y: 400, vx: 0, vy: 0, stackId: s3, status: 'todo', spaceId: demoSpaceId, layer: 6, priority: 'high', description: '', author: 'Cyberia', size: 1.1, order: 1, image: null, drawing: null, tasks: [], content: '', date: '2026-03-10' },
        { id: 1009, text: 'Cognitive Layer', type: 'label', x: 900, y: 100, vx: 0, vy: 0, stackId: s3, status: 'none', spaceId: demoSpaceId, layer: 502, priority: 'none', description: '', author: 'Cyberia', size: 1.0, order: 2, image: null, drawing: null, tasks: [], table: [], content: '', date: '' },
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
      // Restore saved user state
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
});
