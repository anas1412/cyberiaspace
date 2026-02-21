import { create } from 'zustand';
import { db, type Space, type Thought, type Stack } from '../db';
import { useAuthStore } from './useAuthStore';
import { useModalStore } from './useModalStore';
import { PLAN_CONFIG, type SubscriptionPlan } from '../constants';

interface CyberiaState {
  activeSpaceId: string | null;
  spaces: Space[];
  thoughts: Thought[];
  stacks: Stack[];
  selectedThoughtId: number | null;
  selectedThoughtIds: number[];
  isInspectorOpen: boolean;
  activeFocusId: number | null;
  focusType: 'text' | 'table' | 'paint' | 'tasks' | 'embed' | 'file' | 'image' | null;
  calendarViewDate: Date;
  hoveredCalDate: string | null;
  linkingSourceId: number | null;
  calendarSearchQuery: string;
  calendarStackFilter: string | null;
  kanbanSearchQuery: string;
  kanbanStackFilter: string | null;
  theme: 'cyberia' | 'sea' | 'forest' | 'rain';
  customBg: string | null;
  isSpaceLoading: boolean;
  totalThoughtCount: number;
  isInitializing: boolean;
  performanceMode: boolean;
  setPerformanceMode: (mode: boolean) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deferredPrompt: any;
  layerActionTrigger: { id: number; time: number } | null;
  history: any[];
  historyIndex: number;
  isLightboxOpen: boolean;
  lightboxImage: string | null;
  lightboxThoughtId: number | null;
  transform: { x: number; y: number; scale: number };
  deletingThoughtIds: number[];
  onboardingDismissed: boolean;

  getLimits: () => typeof PLAN_CONFIG['free'];

  oracleMode: boolean;
  isChatOpen: boolean;

  init: () => Promise<void>;
  refreshTotalThoughtCount: () => Promise<void>;
  refreshSpaces: () => Promise<void>;
  refreshThoughts: (spaceId?: string) => Promise<void>;
  refreshStacks: (spaceId?: string) => Promise<void>;
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  openLightbox: (image: string, thoughtId: number) => void;
  closeLightbox: () => void;
  setTransform: (transform: { x: number; y: number; scale: number }) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetTransform: () => void;
  clearWorkspace: () => Promise<void>;
  completeOnboarding: () => Promise<void>;

  setTheme: (theme: 'cyberia' | 'sea' | 'forest' | 'rain') => void;
  setCustomBg: (bg: string | null) => Promise<void>;
  setDeferredPrompt: (prompt: any) => void;

  toggleOracleMode: () => void;
  setChatOpen: (isOpen: boolean) => void;

  setActiveSpace: (id: string) => void;
  setCalendarViewDate: (date: Date) => void;
  addSpace: (name: string) => Promise<void>;
  updateSpace: (id: string, updates: Partial<Space>) => Promise<void>;
  deleteSpace: (id: string) => Promise<void>;
  reorderSpaces: (spaces: Space[]) => Promise<void>;
  saveSpaceTransform: (id: string, transform: { x: number; y: number; scale: number }) => Promise<void>;

  addThought: (thought: Partial<Thought>) => Promise<number>;
  updateThought: (id: number, updates: Partial<Thought>) => Promise<void>;
  updateThoughts: (ids: number[], updates: Partial<Thought>) => Promise<void>;
  deleteThought: (id: number) => Promise<void>;
  deleteThoughts: (ids: number[]) => Promise<void>;
  bringToFront: (id: number) => Promise<void>;
  sendToBack: (id: number) => Promise<void>;
  setSelectedThoughtId: (id: number | null) => void;
  setSelectedThoughtIds: (ids: number[]) => void;
  toggleThoughtSelection: (id: number) => void;
  clearSelection: () => void;
  deleteSelectedThoughts: () => Promise<void>;
  linkSelectedThoughts: (name?: string) => Promise<void>;
  unlinkSelectedThoughts: () => Promise<void>;
  setInspectorOpen: (open: boolean) => void;
  setActiveFocus: (id: number | null, type: 'text' | 'table' | 'paint' | 'tasks' | 'embed' | 'file' | 'image' | null) => void;

  setHoveredCalDate: (date: string | null) => void;
  setCalendarSearchQuery: (query: string) => void;
  setCalendarStackFilter: (stackId: string | null) => void;
  setKanbanSearchQuery: (query: string) => void;
  setKanbanStackFilter: (stackId: string | null) => void;
  setLinkingSourceId: (id: number | null) => void;

  createStack: (name: string, thoughtId: number) => Promise<void>;
  updateStack: (id: string, updates: Partial<Stack>) => Promise<void>;
  deleteStack: (id: string) => Promise<void>;
  cleanupStacks: () => Promise<void>;

  isReadOnly: boolean;
  creatorName: string | null;
  lastUpdated: string | null;
  publishSpace: (id: string) => Promise<string | void>;
  unpublishSpace: (id: string) => Promise<void>;
  importFullState: (data: any) => Promise<void>;

  clearLocalData: () => Promise<void>;
  exportData: () => Promise<void>;
  importData: (file: File) => Promise<void>;
  isLocalWorkspaceEmpty: () => Promise<boolean>;
}

export const useStore = create<CyberiaState>((set, get) => ({
  activeSpaceId: null,
  spaces: [],
  thoughts: [],
  stacks: [],
  totalThoughtCount: 0,
  selectedThoughtId: null,
  selectedThoughtIds: [],
  isInspectorOpen: false,
  activeFocusId: null,
  focusType: null,
  calendarViewDate: new Date(),
  hoveredCalDate: null,
  calendarSearchQuery: '',
  calendarStackFilter: null,
  kanbanSearchQuery: '',
  kanbanStackFilter: null,
  isLightboxOpen: false,
  lightboxImage: null,
  lightboxThoughtId: null,
  linkingSourceId: null,
  theme: (localStorage.getItem('cyberia-theme') as any) || 'cyberia',
  customBg: null,
  isSpaceLoading: true,
  isInitializing: true,
  performanceMode: typeof window !== 'undefined' ? (window.innerWidth < 763) : false,
  setPerformanceMode: (performanceMode) => {
    set({ performanceMode });
    if (performanceMode) document.body.classList.add('low-perf');
    else document.body.classList.remove('low-perf');
  },
  deferredPrompt: null,
  layerActionTrigger: null,
  isReadOnly: false,
  creatorName: null,
  lastUpdated: null,
  transform: { x: 0, y: 0, scale: 1 },
  deletingThoughtIds: [],
  onboardingDismissed: localStorage.getItem('cyberia-onboarding-dismissed') === 'true',
  history: [],
  historyIndex: -1,

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

  publishSpace: async (spaceId) => {
    const { spaces, thoughts, stacks } = get();
    const space = spaces.find(s => s.id === spaceId);
    if (!space) return;

    const authStore = useAuthStore.getState();
    const user = authStore.user;
    if (authStore.status !== 'authenticated' || !user) {
      useModalStore.getState().openModal({
        title: 'Authentication Required',
        description: 'You must be signed in to publish a space.',
        type: 'alert',
        confirmText: 'Okay'
      });
      return;
    }

    const creatorName = user.name.split(' ')[0];

    try {
      const spaceThoughts = thoughts.filter(t => t.spaceId === spaceId);
      const spaceStacks = stacks.filter(s => s.spaceId === spaceId);
      const currentTheme = get().theme;
      const currentCustomBg = get().customBg;

      const res = await fetch('/api/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authStore.accessToken}`
        },
        body: JSON.stringify({
          space: { ...space, theme: currentTheme, customBg: currentCustomBg },
          thoughts: spaceThoughts,
          stacks: spaceStacks,
          publishedId: space.publishedId,
          creatorName
        })
      });

      if (!res.ok) throw new Error('Publish failed');
      const data = await res.json();

      const now = new Date().toISOString();
      await get().updateSpace(spaceId, {
        publishedId: data.publishedId,
        lastPublished: data.lastPublished || now,
        updatedAt: data.lastPublished || now
      });

      return data.publishedId;
    } catch (err) {
      console.error('Publish error:', err);
      throw err;
    }
  },

  unpublishSpace: async (spaceId) => {
    const { spaces } = get();
    const space = spaces.find(s => s.id === spaceId);
    if (!space || !space.publishedId) return;

    const authStore = useAuthStore.getState();

    try {
      const res = await fetch(`/api/publish?id=${space.publishedId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authStore.accessToken}`
        }
      });

      if (!res.ok) throw new Error('Unpublish failed');

      await get().updateSpace(spaceId, {
        publishedId: null,
        lastPublished: null
      });
    } catch (err) {
      console.error('Unpublish error:', err);
      throw err;
    }
  },

  getLimits: () => {
    const plan = useAuthStore.getState().user?.plan as SubscriptionPlan;
    return PLAN_CONFIG[plan] || PLAN_CONFIG.free;
  },

  setTransform: (transform) => set({ transform }),
  resetTransform: () => set({ transform: { x: 0, y: 0, scale: 1 } }),
  zoomIn: () => {
    const { transform } = get();
    const newScale = Math.min(transform.scale * 1.2, 2);
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const wx = (centerX - transform.x) / transform.scale;
    const wy = (centerY - transform.y) / transform.scale;
    set({ transform: { x: centerX - wx * newScale, y: centerY - wy * newScale, scale: newScale } });
  },
  zoomOut: () => {
    const { transform } = get();
    const newScale = Math.max(transform.scale / 1.2, 0.1);
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const wx = (centerX - transform.x) / transform.scale;
    const wy = (centerY - transform.y) / transform.scale;
    set({ transform: { x: centerX - wx * newScale, y: centerY - wy * newScale, scale: newScale } });
  },

  pushHistory: () => {
    const { thoughts, history, historyIndex } = get();
    const newHistory = history.slice(0, historyIndex + 1);
    const last = newHistory[newHistory.length - 1];
    if (last && JSON.stringify(last) === JSON.stringify(thoughts)) return;
    newHistory.push(JSON.parse(JSON.stringify(thoughts)));
    if (newHistory.length > 50) newHistory.shift();
    set({ history: newHistory, historyIndex: newHistory.length - 1 });
  },

  undo: async () => {
    const { history, historyIndex, activeSpaceId } = get();
    if (historyIndex <= 0 || !activeSpaceId) return;
    const newIndex = historyIndex - 1;
    const prevThoughts = history[newIndex];
    await db.transaction('rw', db.thoughts, async () => {
      await db.thoughts.where('spaceId').equals(activeSpaceId).delete();
      await db.thoughts.bulkAdd(prevThoughts);
    });
    set({ thoughts: prevThoughts, historyIndex: newIndex });
  },

  redo: async () => {
    const { history, historyIndex, activeSpaceId } = get();
    if (historyIndex >= history.length - 1 || !activeSpaceId) return;
    const newIndex = historyIndex + 1;
    const nextThoughts = history[newIndex];
    await db.transaction('rw', db.thoughts, async () => {
      await db.thoughts.where('spaceId').equals(activeSpaceId).delete();
      await db.thoughts.bulkAdd(nextThoughts);
    });
    set({ thoughts: nextThoughts, historyIndex: newIndex });
  },

  oracleMode: false,
  isChatOpen: false,
  openLightbox: (image, thoughtId) => set({ isLightboxOpen: true, lightboxImage: image, lightboxThoughtId: thoughtId }),
  closeLightbox: () => set({ isLightboxOpen: false, lightboxImage: null, lightboxThoughtId: null }),

  setTheme: (theme) => {
    if (get().isReadOnly) return;
    const { activeSpaceId } = get();
    set({ theme });
    localStorage.setItem('cyberia-theme', theme);
    document.body.setAttribute('data-theme', theme);
    if (activeSpaceId && !get().isReadOnly) get().updateSpace(activeSpaceId, { theme });
    const authStore = useAuthStore.getState();
    if (authStore.status === 'authenticated') authStore.updateSettings({ theme } as any);
  },

  setCustomBg: async (bg) => {
    const { activeSpaceId, isReadOnly, spaces } = get();
    if (isReadOnly || !activeSpaceId) return;
    set({ customBg: bg });
    const updatedSpaces = spaces.map(s => s.id === activeSpaceId ? { ...s, customBg: bg } : s);
    set({ spaces: updatedSpaces });
    await db.spaces.update(activeSpaceId, { customBg: bg });
  },

  setDeferredPrompt: (prompt) => set({ deferredPrompt: prompt }),

  toggleOracleMode: () => {
    const user = useAuthStore.getState().user;
    if (!user) {
      useModalStore.getState().openModal({
        title: 'Authentication Required',
        description: 'Oracle AI features require a connected account.',
        type: 'alert',
        confirmText: 'Sign In'
      });
      return;
    }
    set({ oracleMode: true });
  },

  setChatOpen: (isOpen) => set({ isChatOpen: isOpen }),

  init: async () => {
    if (get().performanceMode) document.body.classList.add('low-perf');
    
    // Ensure DB is open and ready
    try {
      await db.open();
    } catch (err) {
      console.error('Failed to open database:', err);
      // If version change fails, we might need to reset or wait
    }

    await useAuthStore.getState().initAuth();
    const user = useAuthStore.getState().user;
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
    await get().refreshSpaces();
    await get().refreshTotalThoughtCount();
    const { spaces } = get();
    if (spaces.length > 0) {
      const savedSpaceId = localStorage.getItem('cyberia-active-space-id');
      const spaceExists = savedSpaceId ? spaces.find(s => s.id === savedSpaceId) : null;
      if (spaceExists) get().setActiveSpace(savedSpaceId!);
      else get().setActiveSpace(spaces[0].id);
    }
    set({ isInitializing: false });
  },

  completeOnboarding: async () => {
    localStorage.setItem('cyberia-onboarding-dismissed', 'true');
    set({ onboardingDismissed: true });
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

  refreshSpaces: async () => {
    const spaces = await db.spaces.orderBy('order').toArray();
    set({ spaces });
  },

  refreshTotalThoughtCount: async () => {
    const count = await db.thoughts.count();
    set({ totalThoughtCount: count });
  },

  refreshThoughts: async (spaceId) => {
    const targetId = spaceId || get().activeSpaceId;
    if (!targetId) return;
    const thoughts = await db.thoughts.where('spaceId').equals(targetId).toArray();
    set({ thoughts, isSpaceLoading: false });
    get().refreshTotalThoughtCount();
    if (get().history.length === 0) set({ history: [JSON.parse(JSON.stringify(thoughts))], historyIndex: 0 });
  },

  refreshStacks: async (spaceId) => {
    const targetId = spaceId || get().activeSpaceId;
    if (!targetId) return;
    const stacks = await db.stacks.where('spaceId').equals(targetId).toArray();
    set({ stacks });
  },

  setActiveSpace: (id) => {
    localStorage.setItem('cyberia-active-space-id', id);
    const space = get().spaces.find(s => s.id === id);
    const updates: any = { activeSpaceId: id, thoughts: [], stacks: [], isSpaceLoading: true, history: [], historyIndex: -1, layerActionTrigger: null };
    if (space) {
      updates.transform = space.mode === 'spatial' ? { x: space.transformX ?? 0, y: space.transformY ?? 0, scale: space.transformScale ?? 1 } : { x: 0, y: 0, scale: 1 };
      if (space.theme) { updates.theme = space.theme; document.body.setAttribute('data-theme', space.theme); }
      updates.customBg = space.customBg || null;
    }
    set(updates);
    get().refreshThoughts(id);
    get().refreshStacks(id);
  },

  setCalendarViewDate: (date) => set({ calendarViewDate: date }),

  addSpace: async (name) => {
    if (get().isReadOnly) return;
    const { spaces } = get();
    const limits = get().getLimits();
    if (spaces.length >= limits.MAX_SPACES) {
      useModalStore.getState().openModal({ title: 'Limit Reached', description: `Max ${limits.MAX_SPACES} spaces on Free.`, type: 'limit_space', confirmText: 'Upgrade', onConfirm: () => useModalStore.getState().openPricing() });
      return;
    }
    const id = 's' + Date.now();
    await db.spaces.add({ id, name, mode: 'spatial', physics: true, order: spaces.length });
    await get().refreshSpaces();
    get().setActiveSpace(id);
  },

  updateSpace: async (id, updates) => {
    const { spaces } = get();
    const index = spaces.findIndex(s => s.id === id);
    if (index !== -1) {
      const newSpaces = [...spaces];
      newSpaces[index] = { ...newSpaces[index], ...updates };
      set({ spaces: newSpaces });
    }
    if (get().isReadOnly) return;
    await db.spaces.update(id, updates);
    await get().refreshSpaces();
  },

  deleteSpace: async (id) => {
    if (get().isReadOnly) return;
    const { spaces, activeSpaceId } = get();
    const space = spaces.find(s => s.id === id);
    const deleteIndex = spaces.findIndex(s => s.id === id);
    if (space?.publishedId) {
      try { await get().unpublishSpace(id); } catch (err) { console.warn('Unpublish failed', err); }
    }
    const thoughtsInSpace = await db.thoughts.where('spaceId').equals(id).toArray();
    const authStore = useAuthStore.getState();
    for (const t of thoughtsInSpace) { if (t.driveFileId) await authStore.deleteServiceContent(t); }
    await db.spaces.delete(id);
    await db.thoughts.where('spaceId').equals(id).delete();
    await db.stacks.where('spaceId').equals(id).delete();
    await get().refreshSpaces();
    const updatedSpaces = get().spaces;
    if (updatedSpaces.length > 0) {
      if (id === activeSpaceId) get().setActiveSpace(updatedSpaces[Math.max(0, deleteIndex - 1)].id);
    } else {
      localStorage.removeItem('cyberia-active-space-id');
      set({ activeSpaceId: null, thoughts: [], stacks: [] });
    }
  },

  reorderSpaces: async (newSpaces) => {
    if (get().isReadOnly) return;
    await Promise.all(newSpaces.map((s, i) => db.spaces.update(s.id, { order: i })));
    await get().refreshSpaces();
  },

  saveSpaceTransform: async (id, transform) => {
    const { spaces } = get();
    const space = spaces.find(s => s.id === id);
    if (!space || space.mode !== 'spatial') return;
    await db.spaces.update(id, { transformX: transform.x, transformY: transform.y, transformScale: transform.scale });
    const index = spaces.findIndex(s => s.id === id);
    if (index !== -1) {
      const newSpaces = [...spaces];
      newSpaces[index] = { ...newSpaces[index], ...transform };
      set({ spaces: newSpaces });
    }
  },

  addThought: async (partialThought) => {
    if (get().isReadOnly) return -1;
    const { activeSpaceId } = get();
    const targetSpaceId = partialThought.spaceId || activeSpaceId;
    if (!targetSpaceId) throw new Error('No space');
    const limits = get().getLimits();
    const isBlobType = partialThought.type === 'file' || partialThought.type === 'image';
    if (JSON.stringify(partialThought).length > 2 * 1024 * 1024 && !isBlobType) {
      useModalStore.getState().openModal({ title: 'Buffer Overflow', description: 'Payload > 2MB.', type: 'alert', confirmText: 'Okay' });
      return -1;
    }
    const QUIRKY_TITLES = ["Name Pending", "Just Go With It", "Something Is Happening", "Trust the Process"];
    const result = await db.transaction('rw', db.thoughts, async () => {
      const currentCount = await db.thoughts.where('spaceId').equals(targetSpaceId).count();
      if (currentCount >= limits.MAX_THOUGHTS_PER_SPACE) {
        useModalStore.getState().openModal({ title: 'Space is Full', description: `Limit ${limits.MAX_THOUGHTS_PER_SPACE}.`, type: 'limit_thought', confirmText: 'Go Pro', onConfirm: () => useModalStore.getState().openPricing() });
        return -1;
      }
      const randomTitle = QUIRKY_TITLES[Math.floor(Math.random() * QUIRKY_TITLES.length)];
      const maxLayer = await db.thoughts.where('spaceId').equals(targetSpaceId).reverse().sortBy('layer').then(t => t[0]?.layer || 0);
      const thought: Thought = {
        spaceId: targetSpaceId, stackId: null, x: window.innerWidth / 2, y: window.innerHeight / 2, vx: 0, vy: 0, text: '', placeholder: randomTitle, description: '', type: 'label', content: '', image: null, drawing: null, status: 'none', tasks: [], table: [['', ''], ['', '']], date: '', priority: 'none', size: 1.0, author: '', order: currentCount, layer: maxLayer + 1, syncStatus: 'local', ...partialThought
      } as Thought;
      return await db.thoughts.add(thought);
    });
    if (result !== -1) {
      await get().updateSpace(targetSpaceId, { updatedAt: new Date().toISOString() });
      await get().refreshThoughts(targetSpaceId);
      await get().refreshTotalThoughtCount();
      get().pushHistory();
      const authStore = (await import('./useAuthStore')).useAuthStore.getState();
      if (authStore.autoSync && authStore.status === 'authenticated') authStore.syncData();
    }
    return result as number;
  },

  updateThought: async (id, updates) => {
    const { thoughts, activeSpaceId, isReadOnly } = get();
    const thought = thoughts.find(t => t.id === id);
    const isBlobType = thought?.type === 'file' || updates.type === 'file' || thought?.type === 'image' || updates.type === 'image';
    if (!(Object.keys(updates).length <= 4 && !updates.content && !updates.image && !updates.drawing) && !isBlobType) {
      if (JSON.stringify(updates).length > 2 * 1024 * 1024) {
        useModalStore.getState().openModal({ title: 'Payload Reached', description: 'Thought > 2MB.', type: 'alert', confirmText: 'Okay' });
        return;
      }
    }
    const index = thoughts.findIndex(t => t.id === id);
    if (index !== -1) {
      const newThoughts = [...thoughts];
      const hasContentChange = Object.keys(updates).some(k => ['text', 'content', 'tasks', 'table', 'drawing', 'image', 'date'].includes(k));
      const syncStatus = (updates.syncStatus || (hasContentChange ? 'pending' : newThoughts[index].syncStatus)) as any;
      newThoughts[index] = { ...newThoughts[index], ...updates, syncStatus };
      set({ thoughts: newThoughts });
    }
    if (isReadOnly) return;
    if (activeSpaceId) get().updateSpace(activeSpaceId, { updatedAt: new Date().toISOString() });
    const saveTimers = (window as any)._cyberia_save_timers || {};
    if (saveTimers[id]) clearTimeout(saveTimers[id]);
    saveTimers[id] = setTimeout(async () => {
      const hasContentChange = Object.keys(updates).some(k => ['text', 'content', 'tasks', 'table', 'drawing', 'image', 'date'].includes(k));
      const syncStatus = (updates.syncStatus || (hasContentChange ? 'pending' : thought?.syncStatus)) as any;
      await db.thoughts.update(id, { ...updates, syncStatus });
      delete saveTimers[id];
      get().pushHistory();
      const authStore = (await import('./useAuthStore')).useAuthStore.getState();
      if (authStore.autoSync && authStore.status === 'authenticated') {
        if ((window as any)._cyberia_cloud_timer) clearTimeout((window as any)._cyberia_cloud_timer);
        (window as any)._cyberia_cloud_timer = setTimeout(() => authStore.syncData(), 5000);
      }
    }, 500);
    (window as any)._cyberia_save_timers = saveTimers;
  },

  updateThoughts: async (ids, updates) => {
    if (get().isReadOnly) return;
    const { thoughts, activeSpaceId } = get();
    if (activeSpaceId) get().updateSpace(activeSpaceId, { updatedAt: new Date().toISOString() });
    set({ thoughts: thoughts.map(t => ids.includes(t.id) ? { ...t, ...updates } : t) });
    await db.thoughts.where('id').anyOf(ids).modify(updates);
    get().pushHistory();
    const authStore = (await import('./useAuthStore')).useAuthStore.getState();
    if (authStore.autoSync && authStore.status === 'authenticated') {
      if ((window as any)._cyberia_cloud_timer) clearTimeout((window as any)._cyberia_cloud_timer);
      (window as any)._cyberia_cloud_timer = setTimeout(() => authStore.syncData(), 5000);
    }
  },

  deleteThought: async (id) => {
    if (get().isReadOnly) return;
    const thought = get().thoughts.find(t => t.id === id);
    const affectedStackId = thought?.stackId;
    const authStore = (await import('./useAuthStore')).useAuthStore.getState();
    set(state => ({ deletingThoughtIds: [...state.deletingThoughtIds, id] }));
    if (thought) {
      await get().updateSpace(thought.spaceId, { updatedAt: new Date().toISOString() });
      if (authStore.status === 'authenticated') await authStore.deleteServiceContent(thought);
    }
    await db.thoughts.delete(id);
    await db.blobs.where('thoughtId').equals(id).delete();
    await get().refreshThoughts();
    await get().refreshTotalThoughtCount();
    if (affectedStackId) await get().cleanupStacks();
    if (get().selectedThoughtId === id) set({ selectedThoughtId: null, isInspectorOpen: false });
    if (get().selectedThoughtIds.includes(id)) set({ selectedThoughtIds: get().selectedThoughtIds.filter(tid => tid !== id) });
    set(state => ({ deletingThoughtIds: state.deletingThoughtIds.filter(tid => tid !== id) }));
    get().pushHistory();
    if (authStore.autoSync && authStore.status === 'authenticated') authStore.syncData();
  },

  deleteThoughts: async (ids) => {
    if (get().isReadOnly || !ids.length) return;
    const { thoughts, selectedThoughtId, selectedThoughtIds } = get();
    const authStore = (await import('./useAuthStore')).useAuthStore.getState();
    set(state => ({ deletingThoughtIds: [...state.deletingThoughtIds, ...ids] }));
    const affectedStackIds = Array.from(new Set(thoughts.filter(t => ids.includes(t.id)).map(t => t.stackId).filter(Boolean))) as string[];
    if (authStore.status === 'authenticated') {
      for (const t of thoughts.filter(t => ids.includes(t.id))) {
        try { await authStore.deleteServiceContent(t); } catch (e) { console.warn('Delete failed', e); }
      }
    }
    await db.thoughts.bulkDelete(ids);
    await db.blobs.where('thoughtId').anyOf(ids).delete();
    await get().refreshThoughts();
    await get().refreshTotalThoughtCount();
    if (affectedStackIds.length) await get().cleanupStacks();
    if (selectedThoughtId && ids.includes(selectedThoughtId)) set({ selectedThoughtId: null, isInspectorOpen: false });
    set({ selectedThoughtIds: selectedThoughtIds.filter(tid => !ids.includes(tid)) });
    set(state => ({ deletingThoughtIds: state.deletingThoughtIds.filter(tid => !ids.includes(tid)) }));
    get().pushHistory();
    if (authStore.autoSync && authStore.status === 'authenticated') authStore.syncData();
  },

  bringToFront: async (id) => {
    if (get().isReadOnly) return;
    const { thoughts, activeSpaceId } = get();
    if (!activeSpaceId) return;
    const sorted = [...thoughts].sort((a, b) => (a.layer || 0) - (b.layer || 0));
    const filtered = sorted.filter(t => t.id !== id);
    const target = thoughts.find(t => t.id === id);
    if (!target) return;
    filtered.push(target);
    await db.transaction('rw', db.thoughts, async () => {
      await Promise.all(filtered.map((t, i) => db.thoughts.update(t.id, { layer: i + 1 })));
    });
    set({ layerActionTrigger: { id, time: Date.now() } });
    await get().refreshThoughts(activeSpaceId);
  },

  sendToBack: async (id) => {
    if (get().isReadOnly) return;
    const { thoughts, activeSpaceId } = get();
    if (!activeSpaceId) return;
    const sorted = [...thoughts].sort((a, b) => (a.layer || 0) - (b.layer || 0));
    const filtered = sorted.filter(t => t.id !== id);
    const target = thoughts.find(t => t.id === id);
    if (!target) return;
    filtered.unshift(target);
    await db.transaction('rw', db.thoughts, async () => {
      await Promise.all(filtered.map((t, i) => db.thoughts.update(t.id, { layer: i + 1 })));
    });
    set({ layerActionTrigger: { id, time: Date.now() } });
    await get().refreshThoughts(activeSpaceId);
  },

  setSelectedThoughtId: (id) => set({ selectedThoughtId: id, selectedThoughtIds: id ? [id] : [] }),
  setSelectedThoughtIds: (ids) => set({ selectedThoughtIds: ids, selectedThoughtId: ids.length === 1 ? ids[0] : null, isInspectorOpen: ids.length === 1 && !get().isReadOnly }),
  toggleThoughtSelection: (id) => {
    const { selectedThoughtIds, selectedThoughtId } = get();
    let currentIds = [...selectedThoughtIds];
    if (selectedThoughtId && !currentIds.includes(selectedThoughtId)) currentIds.push(selectedThoughtId);
    let newIds = currentIds.includes(id) ? currentIds.filter(tid => tid !== id) : [...currentIds, id];
    set({ selectedThoughtIds: newIds, selectedThoughtId: newIds.length === 1 ? newIds[0] : null, isInspectorOpen: newIds.length === 1 && !get().isReadOnly });
  },
  clearSelection: () => set({ selectedThoughtIds: [], selectedThoughtId: null, isInspectorOpen: false }),

  deleteSelectedThoughts: async () => {
    if (get().isReadOnly) return;
    const { selectedThoughtIds, thoughts } = get();
    if (selectedThoughtIds.length === 0) return;
    set(state => ({ deletingThoughtIds: [...state.deletingThoughtIds, ...selectedThoughtIds] }));
    const authStore = (await import('./useAuthStore')).useAuthStore.getState();
    const affectedStackIds = Array.from(new Set(thoughts.filter(t => selectedThoughtIds.includes(t.id)).map(t => t.stackId).filter(Boolean))) as string[];
    if (authStore.status === 'authenticated') {
      for (const t of thoughts.filter(t => selectedThoughtIds.includes(t.id))) {
        try { await authStore.deleteServiceContent(t); } catch (e) { console.warn('Delete failed', e); }
      }
    }
    await db.thoughts.bulkDelete(selectedThoughtIds);
    await db.blobs.where('thoughtId').anyOf(selectedThoughtIds).delete();
    await get().refreshThoughts();
    if (affectedStackIds.length > 0) await get().cleanupStacks();
    const deletedIds = [...selectedThoughtIds];
    set({ selectedThoughtIds: [], selectedThoughtId: null, isInspectorOpen: false });
    set(state => ({ deletingThoughtIds: state.deletingThoughtIds.filter(tid => !deletedIds.includes(tid)) }));
    get().pushHistory();
    if (authStore.autoSync && authStore.status === 'authenticated') authStore.syncData();
  },

  linkSelectedThoughts: async (name) => {
    if (get().isReadOnly) return;
    const { selectedThoughtIds, thoughts, activeSpaceId } = get();
    if (selectedThoughtIds.length < 2 || !activeSpaceId) return;
    const thoughtsInSelection = thoughts.filter(t => selectedThoughtIds.includes(t.id));
    const existingStackIds = Array.from(new Set(thoughtsInSelection.map(t => t.stackId).filter(Boolean))) as string[];
    let targetStackId: string;
    if (existingStackIds.length > 0) {
      targetStackId = existingStackIds[0];
      await db.transaction('rw', db.thoughts, db.stacks, async () => {
        await db.thoughts.where('id').anyOf(selectedThoughtIds).modify({ stackId: targetStackId });
        if (existingStackIds.length > 1) {
          const otherStackIds = existingStackIds.slice(1);
          await db.thoughts.where('stackId').anyOf(otherStackIds).modify({ stackId: targetStackId });
          await db.stacks.where('id').anyOf(otherStackIds).delete();
        }
        if (name) await db.stacks.update(targetStackId, { name: name.trim() });
      });
    } else {
      targetStackId = 'st-' + Date.now();
      await db.stacks.add({ id: targetStackId, name: name?.trim() || 'Unnamed Stack', color: `hsla(${Math.floor(Math.random() * 360)}, 70%, 50%, 1)`, spaceId: activeSpaceId });
      await db.thoughts.where('id').anyOf(selectedThoughtIds).modify({ stackId: targetStackId });
    }
    await get().refreshThoughts();
    await get().refreshStacks();
    get().pushHistory();
  },

  unlinkSelectedThoughts: async () => {
    if (get().isReadOnly) return;
    const { selectedThoughtIds } = get();
    if (!selectedThoughtIds.length) return;
    await db.thoughts.where('id').anyOf(selectedThoughtIds).modify({ stackId: null });
    await get().cleanupStacks();
    await get().refreshThoughts();
    await get().refreshStacks();
    get().pushHistory();
  },

  cleanupStacks: async () => {
    const { activeSpaceId } = get();
    if (!activeSpaceId) return;
    await db.transaction('rw', db.thoughts, db.stacks, async () => {
      const allThoughts = await db.thoughts.where('spaceId').equals(activeSpaceId).toArray();
      const allStacks = await db.stacks.where('spaceId').equals(activeSpaceId).toArray();
      for (const stack of allStacks) {
        const stackThoughts = allThoughts.filter(t => t.stackId === stack.id);
        if (stackThoughts.length < 2) {
          if (stackThoughts.length === 1) await db.thoughts.update(stackThoughts[0].id, { stackId: null });
          await db.stacks.delete(stack.id);
        }
      }
    });
    await get().refreshThoughts();
    await get().refreshStacks();
  },

  createStack: async (name, thoughtId) => {
    const { activeSpaceId, stacks } = get();
    if (!activeSpaceId) return;
    const trimmedName = name?.trim() || 'Unnamed Stack';
    const existingStack = stacks.find(s => s.name.toLowerCase() === trimmedName.toLowerCase() && s.spaceId === activeSpaceId);
    if (existingStack) {
      await db.thoughts.update(thoughtId, { stackId: existingStack.id });
      await get().refreshThoughts();
      return;
    }
    const newStackId = 'st-' + Date.now();
    await db.stacks.add({ id: newStackId, name: trimmedName, color: `hsla(${Math.floor(Math.random() * 360)}, 70%, 50%, 1)`, spaceId: activeSpaceId });
    await db.thoughts.update(thoughtId, { stackId: newStackId });
    await get().refreshThoughts();
    await get().refreshStacks();
    get().pushHistory();
  },

  updateStack: async (id, updates) => {
    const { stacks } = get();
    const index = stacks.findIndex(s => s.id === id);
    if (index !== -1) {
      const newStacks = [...stacks];
      newStacks[index] = { ...newStacks[index], ...updates };
      set({ stacks: newStacks });
    }
    if (get().isReadOnly) return;
    await db.stacks.update(id, updates);
    await get().refreshStacks();
  },

  deleteStack: async (id) => {
    if (get().isReadOnly) return;
    await db.transaction('rw', db.thoughts, db.stacks, async () => {
      await db.thoughts.where('stackId').equals(id).modify({ stackId: null });
      await db.stacks.delete(id);
    });
    await get().refreshThoughts();
    await get().refreshStacks();
    get().pushHistory();
  },

  setInspectorOpen: (open) => set({ isInspectorOpen: open }),
  setActiveFocus: (id, type) => set({ activeFocusId: id, focusType: id ? type : null }),
  setHoveredCalDate: (date) => set({ hoveredCalDate: date }),
  setCalendarSearchQuery: (query) => set({ calendarSearchQuery: query }),
  setCalendarStackFilter: (stackId) => set({ calendarStackFilter: stackId }),
  setKanbanSearchQuery: (query) => set({ kanbanSearchQuery: query }),
  setKanbanStackFilter: (stackId) => set({ kanbanStackFilter: stackId }),
  setLinkingSourceId: (id) => set({ linkingSourceId: id }),

  exportData: async () => {
    const allSpaces = await db.spaces.toArray();
    const allThoughts = await db.thoughts.toArray();
    const allStacks = await db.stacks.toArray();
    const data = { spaces: allSpaces, thoughts: allThoughts, stacks: allStacks, activeSpaceId: get().activeSpaceId, version: 2, timestamp: Date.now() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cyberia_space_backup_${new Date().toLocaleDateString('en-CA')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  importData: async (input) => {
    if (get().isReadOnly) return;
    const processData = async (data: any) => {
      if (!data || typeof data !== 'object' || !('spaces' in data) || !('thoughts' in data)) throw new Error('Invalid backup');
      await db.transaction('rw', db.spaces, db.thoughts, db.stacks, async () => {
        await db.spaces.clear();
        await db.thoughts.clear();
        await db.stacks.clear();
        await db.spaces.bulkAdd(data.spaces);
        await db.thoughts.bulkAdd(data.thoughts);
        if (data.stacks) await db.stacks.bulkAdd(data.stacks);
      });
      if (data.activeSpaceId) localStorage.setItem('cyberia-active-space-id', data.activeSpaceId);
      if (data.settings?.theme) localStorage.setItem('cyberia-theme', data.settings.theme);
      window.location.reload();
    };
    if (input instanceof File) {
      const reader = new FileReader();
      reader.onload = async (e) => { try { await processData(JSON.parse(e.target?.result as string)); } catch (err) { console.error('Import failed', err); } };
      reader.readAsText(input);
    } else {
      try { await processData(input); } catch (err) { console.error('Import failed', err); }
    }
  },

  clearWorkspace: async () => {
    if (get().isReadOnly) return;
    try {
      await db.transaction('rw', db.spaces, db.thoughts, db.stacks, db.blobs, async () => {
        await db.spaces.clear();
        await db.thoughts.clear();
        await db.stacks.clear();
        await db.blobs.clear();
        const workspaceId = 's-workspace-' + Date.now();
        await db.spaces.add({ id: workspaceId, name: 'Workspace', mode: 'spatial', physics: true, order: 0 });
        localStorage.setItem('cyberia-active-space-id', workspaceId);
      });
      window.location.reload();
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
          await db.spaces.bulkAdd(data.spaces);
        }
        if (data.thoughts && data.thoughts.length > 0) {
          await db.thoughts.clear();
          await db.thoughts.bulkAdd(data.thoughts);
        }
        if (data.stacks && data.stacks.length > 0) {
          await db.stacks.clear();
          await db.stacks.bulkAdd(data.stacks);
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
      await db.transaction('rw', db.spaces, db.thoughts, db.stacks, db.blobs, async () => {
        await db.spaces.clear(); await db.thoughts.clear(); await db.stacks.clear(); await db.blobs.clear();
      });
      localStorage.clear();
      const cookies = document.cookie.split(";");
      for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i];
        const eqPos = cookie.indexOf("=");
        const name = eqPos > -1 ? cookie.substring(0, eqPos) : cookie;
        document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
      }
      window.location.reload();
    } catch (err) { console.error('Local data clear failed', err); }
  }
}));
