import { create } from 'zustand';
import { db, type Space, type Thought, type Stack } from '../db';
import { useAuthStore } from './useAuthStore';
import { useModalStore } from './useModalStore';
import { PLAN_CONFIG, DEFAULT_MODEL, type SubscriptionPlan } from '../constants';

interface CyberiaState {
  activeSpaceId: string | null;
  spaces: Space[];
  thoughts: Thought[];
  stacks: Stack[];
  selectedThoughtId: number | null;
  selectedThoughtIds: number[];
  isInspectorOpen: boolean;
  activeFocusId: number | null;
  focusType: 'text' | 'table' | 'paint' | 'tasks' | 'embed' | null;
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
  isInitializing: boolean;
  performanceMode: boolean;
  setPerformanceMode: (mode: boolean) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deferredPrompt: any;
  layerActionTrigger: { id: number; time: number } | null;

  // Plan Helper
  getLimits: () => typeof PLAN_CONFIG['free'];

  // Oracle (AI) State
  oracleMode: boolean; // True = AI Enabled
  isChatOpen: boolean;

  // Initialization
  init: () => Promise<void>;

  // Actions
  setTheme: (theme: 'cyberia' | 'sea' | 'forest' | 'rain') => void;
  setCustomBg: (bg: string | null) => Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setDeferredPrompt: (prompt: any) => void;

  // AI Actions
  toggleOracleMode: () => void;
  setChatOpen: (isOpen: boolean) => void;

  // Space Actions
  setActiveSpace: (id: string) => void;
  setCalendarViewDate: (date: Date) => void;
  addSpace: (name: string) => Promise<void>;
  updateSpace: (id: string, updates: Partial<Space>) => Promise<void>;
  deleteSpace: (id: string) => Promise<void>;
  reorderSpaces: (spaces: Space[]) => Promise<void>;
  saveSpaceTransform: (id: string, transform: { x: number; y: number; scale: number }) => Promise<void>;

  // Thought Actions
  addThought: (thought: Partial<Thought>) => Promise<number>;
  updateThought: (id: number, updates: Partial<Thought>) => Promise<void>;
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
  setActiveFocus: (id: number | null, type: 'text' | 'table' | 'paint' | 'tasks' | 'embed' | null) => void;
  setHoveredCalDate: (date: string | null) => void;
  setCalendarSearchQuery: (query: string) => void;
  setCalendarStackFilter: (stackId: string | null) => void;
  setKanbanSearchQuery: (query: string) => void;
  setKanbanStackFilter: (stackId: string | null) => void;
  setLinkingSourceId: (id: number | null) => void;

  // Stack Actions
  createStack: (name: string, thoughtId: number) => Promise<void>;
  updateStack: (id: string, updates: Partial<Stack>) => Promise<void>;
  deleteStack: (id: string) => Promise<void>;
  cleanupStacks: () => Promise<void>;

  // Share Actions
  isReadOnly: boolean;
  creatorName: string | null;
  lastUpdated: string | null;
  publishSpace: (id: string) => Promise<string | void>;
  unpublishSpace: (id: string) => Promise<void>;

  // Data Lifecycle
  exportData: () => Promise<void>;
  importData: (data: File | unknown) => Promise<void>;
  clearWorkspace: () => Promise<void>;

  // Lightbox
  isLightboxOpen: boolean;
  lightboxImage: string | null;
  openLightbox: (image: string) => void;
  closeLightbox: () => void;

  // Transform State (Moved from Viewport)
  transform: { x: number; y: number; scale: number };
  setTransform: (transform: { x: number; y: number; scale: number }) => void;
  resetTransform: () => void;
  zoomIn: () => void;
  zoomOut: () => void;

  // History (Undo/Redo)
  history: Thought[][];
  historyIndex: number;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  pushHistory: () => void;

  // Refresh data
  refreshThoughts: (spaceId?: string) => Promise<void>;
  refreshSpaces: (spaceId?: string) => Promise<void>;
  refreshStacks: (spaceId?: string) => Promise<void>;
  refreshTotalThoughtCount: () => Promise<void>;
  totalThoughtCount: number;
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
  linkingSourceId: null,
  theme: (localStorage.getItem('cyberia-theme') as 'cyberia' | 'sea' | 'forest' | 'rain') || 'cyberia',
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

      const res = await fetch('/api/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authStore.accessToken}`
        },
        body: JSON.stringify({
          space: { ...space, theme: currentTheme },
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

  transform: { x: 0, y: 0, scale: 1 },
  history: [],
  historyIndex: -1,

  setTransform: (transform) => set({ transform }),
  resetTransform: () => set({ transform: { x: 0, y: 0, scale: 1 } }),
  zoomIn: () => {
    const { transform } = get();
    const newScale = Math.min(transform.scale * 1.2, 2);
    // Zoom centered on screen
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const wx = (centerX - transform.x) / transform.scale;
    const wy = (centerY - transform.y) / transform.scale;
    set({
      transform: {
        x: centerX - wx * newScale,
        y: centerY - wy * newScale,
        scale: newScale
      }
    });
  },
  zoomOut: () => {
    const { transform } = get();
    const newScale = Math.max(transform.scale / 1.2, 0.1);
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const wx = (centerX - transform.x) / transform.scale;
    const wy = (centerY - transform.y) / transform.scale;
    set({
      transform: {
        x: centerX - wx * newScale,
        y: centerY - wy * newScale,
        scale: newScale
      }
    });
  },

  pushHistory: () => {
    const { thoughts, history, historyIndex } = get();
    const newHistory = history.slice(0, historyIndex + 1);
    // Only push if different from last
    const last = newHistory[newHistory.length - 1];
    if (last && JSON.stringify(last) === JSON.stringify(thoughts)) return;

    newHistory.push(JSON.parse(JSON.stringify(thoughts)));
    if (newHistory.length > 50) newHistory.shift(); // Limit history
    set({ history: newHistory, historyIndex: newHistory.length - 1 });
  },

  undo: async () => {
    const { history, historyIndex, activeSpaceId } = get();
    if (historyIndex <= 0 || !activeSpaceId) return;

    const newIndex = historyIndex - 1;
    const prevThoughts = history[newIndex];

    // Sync to DB
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

    // Sync to DB
    await db.transaction('rw', db.thoughts, async () => {
      await db.thoughts.where('spaceId').equals(activeSpaceId).delete();
      await db.thoughts.bulkAdd(nextThoughts);
    });

    set({ thoughts: nextThoughts, historyIndex: newIndex });
  },

  oracleMode: false,
  isChatOpen: false,

  openLightbox: (image) => set({ isLightboxOpen: true, lightboxImage: image }),
  closeLightbox: () => set({ isLightboxOpen: false, lightboxImage: null }),

  setTheme: (theme) => {
    const { activeSpaceId } = get();
    set({ theme });
    localStorage.setItem('cyberia-theme', theme);
    document.body.setAttribute('data-theme', theme);
    
    // Save theme to current space if not in a shared read-only space
    if (activeSpaceId && !get().isReadOnly) {
      get().updateSpace(activeSpaceId, { theme });
    }
  },

  setCustomBg: async (bg) => {
    const { activeSpaceId, isReadOnly } = get();
    if (isReadOnly || !activeSpaceId) return;

    set({ customBg: bg });
    await db.spaces.update(activeSpaceId, { customBg: bg });
  },

  setDeferredPrompt: (prompt) => set({ deferredPrompt: prompt }),

  toggleOracleMode: () => {
    const user = useAuthStore.getState().user;
    if (!user) {
      useModalStore.getState().openModal({
        title: 'Authentication Required',
        description: 'Oracle AI features require a connected account. Please sign in to activate the spatial assistant.',
        type: 'alert',
        confirmText: 'Sign In',
        onConfirm: () => {
          // Trigger logic to open account menu or login?
          // For now just informational since the button is usually in the tray
        }
      });
      return;
    }
    // Authenticated users: Oracle is always activated.
    set({ oracleMode: true });
  },

  setChatOpen: (isOpen) => set({ isChatOpen: isOpen }),

  init: async () => {
    // 1. Initialize Performance Mode
    if (get().performanceMode) {
      document.body.classList.add('low-perf');
    }

    // 2. Initialize Auth regardless (needed for UI consistency/Oracle status)
    useAuthStore.getState().initAuth();

    // Reconcile Oracle status immediately from current auth state
    const user = useAuthStore.getState().user;
    if (user) {
      set({ oracleMode: true });
    }

    // 2. Detect if we are in a Shared Space
    const path = window.location.pathname;
    if (path.startsWith('/s/')) {
      const parts = path.split('/s/');
      const sharedId = parts[1]?.split('/')[0]; // Handle trailing slashes

      if (sharedId) {
        set({ isSpaceLoading: true, isReadOnly: true });
        try {
          const res = await fetch(`/api/publish?id=${sharedId}`);
          if (!res.ok) throw new Error('Snapshot not found');
          const data = await res.json();

          // Apply Snapshot
          const creatorName = data.creatorName || 'Anonymous';
          const space = { ...data.space, id: data.id }; // Sync ID for find() logic
          set({
            activeSpaceId: data.id,
            spaces: [space],
            thoughts: data.thoughts,
            stacks: data.stacks,
            isSpaceLoading: false,
            creatorName,
            lastUpdated: data.lastUpdated || null,
            isInitializing: false,
            transform: {
              x: space.transformX || 0,
              y: space.transformY || 0,
              scale: space.transformScale || 1
            }
          });

          // Apply theme from snapshot if available, or default
          const theme = data.space.theme || 'cyberia';
          document.body.setAttribute('data-theme', theme);
          set({ theme });

          return; // Exit early for shared spaces
        } catch (err) {
          console.error('Shared init failed:', err);
          useModalStore.getState().openModal({
            title: 'Space Not Found or Expired',
            description: 'The link you followed is invalid or has expired after 30 days of inactivity.',
            type: 'alert',
            confirmText: 'Go to Cyberia',
            onConfirm: () => {
              window.location.href = '/';
            }
          });
          // Also set loading to false so the user isn't stuck behind a skeleton
          set({ isSpaceLoading: false, isInitializing: false });
          return;
        }
      }
    }

    set({ isSpaceLoading: true });
    // Initialize Auth
    useAuthStore.getState().initAuth();

    // Apply theme on init
    const savedTheme = localStorage.getItem('cyberia-theme') || 'cyberia';
    document.body.setAttribute('data-theme', savedTheme);

    await get().refreshSpaces();
    await get().refreshTotalThoughtCount();
    const { spaces } = get();

    if (spaces.length === 0) {
      const workspaceId = 's-workspace';
      const onboardingId = 's-onboarding';

      // Create "Workspace" (Empty)
      await db.spaces.add({
        id: workspaceId,
        name: 'Workspace',
        mode: 'spatial',
        physics: true,
        order: 0
      });

      // Create "Onboarding"
      await db.spaces.add({
        id: onboardingId,
        name: 'Onboarding',
        mode: 'spatial',
        physics: true,
        order: 1
      });

      await get().refreshSpaces();
      set({ activeSpaceId: onboardingId });
      localStorage.setItem('cyberia-active-space-id', onboardingId);

      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;

      // STACK 1: THE BASICS (INDIGO)
      const basicsId = 'st-basics';
      await db.stacks.add({
        id: basicsId,
        name: 'The Basics',
        color: 'hsla(230, 80%, 60%, 1)',
        spaceId: onboardingId
      });

      await get().addThought({
        text: 'Welcome to Cyberia!',
        content: 'Think of this as a digital desk. You can move your notes anywhere you like. \n\n**Try it:** Drag this note around!',
        x: cx - 400, y: cy - 200, priority: 'high', stackId: basicsId,
        status: 'done',
        spaceId: onboardingId
      });

      await get().addThought({
        text: 'Move & Group',
        content: 'If you move two notes close to each other, they will form a **Stack** (like the one these notes are in). \n\nThis helps you keep related ideas together naturally.',
        x: cx - 400, y: cy, priority: 'medium', stackId: basicsId,
        status: 'doing',
        spaceId: onboardingId
      });

      await get().addThought({
        text: 'Click to Edit',
        content: 'Click any note to open it. You can change the text, add a checklist, or even create a table. \n\nEverything saves automatically.',
        x: cx - 400, y: cy + 200, priority: 'medium', stackId: basicsId,
        status: 'todo',
        spaceId: onboardingId
      });

      await get().addThought({
        text: 'Quick Start Guide',
        content: `# Getting Started\n\n1. **Move Things**: Drag any note to organize your space.\n2. **Change View**: Use the buttons in the top-right to see your work as a Map, a Board, or a Calendar.\n3. **Create**: Double-click anywhere on the empty space to add a new note.\n4. **Organize**: Use the 'Link' button on a note to connect it to another one.\n\nEnjoy your new workspace!`,
        x: cx + 650, y: cy + 450, priority: 'high', stackId: basicsId,
        status: 'todo',
        spaceId: onboardingId
      });

      // STACK 2: CONTENT (PURPLE)
      const mediaId = 'st-media';
      await db.stacks.add({
        id: mediaId,
        name: 'Adding Content',
        color: 'hsla(280, 80%, 65%, 1)',
        spaceId: onboardingId
      });

      await get().addThought({
        text: 'Watch Videos',
        type: 'embed',
        content: 'https://youtu.be/P6kS_CD9H6I',
        description: 'You can paste links from YouTube, Spotify, and more to see them directly on your board.',
        x: cx + 400, y: cy - 250, priority: 'low', stackId: mediaId,
        status: 'doing',
        spaceId: onboardingId
      });

      await get().addThought({
        text: 'Add Images',
        type: 'image',
        image: 'https://media.tenor.com/v-d5E2Xnv_sAAAAM/lain-serial-experiments-lain.gif',
        description: 'Paste or drag images here to keep your visual ideas organized.',
        x: cx + 400, y: cy + 50, priority: 'medium', stackId: mediaId,
        status: 'done',
        spaceId: onboardingId
      });

      await get().addThought({
        text: 'Private & Secure',
        content: 'Your notes are private by default. They are stored in your browser and never leave your device unless you choose to sync them.',
        x: cx + 650, y: cy - 100, priority: 'low', stackId: mediaId,
        status: 'todo',
        spaceId: onboardingId
      });

      await get().addThought({
        text: 'README',
        content: `# Cyberia: The Kinetic Mind\n\nDesigned for non-linear thinkers, visionaries, and digital architects. We believe productivity shouldn't feel like a spreadsheet. It should feel like a world.\n\n### 1. Kinetic Architecture\nIdeas here have mass, velocity, and gravity. Using our custom physics engine, your thoughts form natural clusters—**Stacks**—based on your internal logic.\n\n### 2. Multi-Dimensional Views\nInformation is fluid. Switch between **Spatial**, **Kanban**, and **Calendar** modes without losing context.\n\n### 3. Rich Media & Tools\nCreate **Task Lists**, **Structured Tables**, **Freehand Drawings**, and **Image Bulbs**. You can even **Embed YouTube** videos directly.\n\n### 4. Oracle (AI)\nPowered by high-speed Llama models, **Oracle** (${DEFAULT_MODEL}) is your Pro spatial assistant. It can research the web, generate ideas, and help you organize your mental landscape.\n\n### 5. Cloud Sync & Security\nYour mind is private by default. However, you can **Connect your Google Account** to sync your data across devices securely.\n\n### 6. Power User Features\nTake control with **Multi-selection**, **History (Undo/Redo)**, and **Universal Search**. Customize your experience with **Themes** and use **Import/Export** for full data ownership.\n\n---\n*Welcome to the Cyber Space.*`,
        x: cx + 650, y: cy + 150, priority: 'urgent', stackId: mediaId,
        status: 'done',
        spaceId: onboardingId
      });

      // STACK 3: TOOLS (AMBER)
      const toolsId = 'st-tools';
      await db.stacks.add({
        id: toolsId,
        name: 'Smart Tools',
        color: 'hsla(40, 90%, 55%, 1)',
        spaceId: onboardingId
      });

      await get().addThought({
        text: 'Task Lists',
        type: 'tasks',
        tasks: [
          { text: 'Try dragging this task', done: true },
          { text: 'Add a new item', done: false },
          { text: 'Check it off', done: false }
        ],
        x: cx, y: cy + 300, priority: 'high', stackId: toolsId,
        status: 'todo',
        spaceId: onboardingId
      });

      await get().addThought({
        text: 'Simple Tables',
        type: 'table',
        table: [
          ['Item', 'Status'],
          ['Project A', 'Active'],
          ['Project B', 'Planning']
        ],
        x: cx + 250, y: cy + 400, priority: 'none', stackId: toolsId,
        status: 'todo',
        spaceId: onboardingId
      });

      await get().refreshThoughts(onboardingId);
      await get().refreshStacks(onboardingId);
      set({ isSpaceLoading: false, isInitializing: false });
    } else {
      const savedSpaceId = localStorage.getItem('cyberia-active-space-id');
      const spaceExists = savedSpaceId ? spaces.find(s => s.id === savedSpaceId) : null;

      if (spaceExists) {
        get().setActiveSpace(savedSpaceId!);
      } else {
        get().setActiveSpace(spaces[0].id);
      }
      set({ isInitializing: false });
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

  refreshThoughts: async (spaceId?: string) => {
    const targetId = spaceId || get().activeSpaceId;
    if (!targetId) return;
    const thoughts = await db.thoughts.where('spaceId').equals(targetId).toArray();
    set({ thoughts, isSpaceLoading: false });
    get().refreshTotalThoughtCount();
    if (get().history.length === 0) {
      set({ history: [JSON.parse(JSON.stringify(thoughts))], historyIndex: 0 });
    }
  },

  refreshStacks: async (spaceId?: string) => {
    const targetId = spaceId || get().activeSpaceId;
    if (!targetId) return;
    const stacks = await db.stacks.where('spaceId').equals(targetId).toArray();
    set({ stacks });
  },

  setActiveSpace: (id) => {
    localStorage.setItem('cyberia-active-space-id', id);
    const space = get().spaces.find(s => s.id === id);
    const updates: any = { 
      activeSpaceId: id, 
      thoughts: [], 
      stacks: [], 
      isSpaceLoading: true, 
      history: [], 
      historyIndex: -1,
      layerActionTrigger: null 
    };

    if (space) {
      if (space.mode === 'spatial') {
        updates.transform = {
          x: space.transformX ?? 0,
          y: space.transformY ?? 0,
          scale: space.transformScale ?? 1
        };
      } else {
        updates.transform = { x: 0, y: 0, scale: 1 };
      }

      // Apply Space-Specific Theme
      if (space.theme) {
        updates.theme = space.theme;
        document.body.setAttribute('data-theme', space.theme);
      }

      // Apply Space-Specific Background
      updates.customBg = space.customBg || null;
    }

    set(updates);
    get().refreshThoughts(id);
    get().refreshStacks(id);
  },

  setCalendarViewDate: (date) => {
    set({ calendarViewDate: date });
  },

  addSpace: async (name) => {
    if (get().isReadOnly) return;
    const { spaces } = get();
    const limits = get().getLimits();

    if (spaces.length >= limits.MAX_SPACES) {
      useModalStore.getState().openModal({
        title: 'Limit Reached',
        description: `You can only have ${limits.MAX_SPACES} spaces on the Free plan. Upgrade to Pro for more.`,
        type: 'limit_space',
        confirmText: 'Upgrade Now',
        onConfirm: () => useModalStore.getState().openPricing()
      });
      return;
    }

    const id = 's' + Date.now();
    const order = spaces.length;
    await db.spaces.add({
      id,
      name,
      mode: 'spatial',
      physics: true,
      order
    });
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

    // Attempt to unpublish from cloud if it was public
    if (space?.publishedId) {
      try {
        await get().unpublishSpace(id);
      } catch (err) {
        // Silently fail if unpublish fails (e.g. no internet/auth), 
        // as we are deleting the local copy anyway.
        console.warn('Auto-unpublish on deletion failed:', err);
      }
    }

    await db.spaces.delete(id);
    await db.thoughts.where('spaceId').equals(id).delete();
    await db.stacks.where('spaceId').equals(id).delete();
    await get().refreshSpaces();

    const updatedSpaces = get().spaces;

    if (updatedSpaces.length > 0) {
      if (id === activeSpaceId) {
        // Find the most logical 'next' space: 
        // The one before the deleted one, or the new first one if we deleted index 0
        const fallbackIndex = Math.max(0, deleteIndex - 1);
        get().setActiveSpace(updatedSpaces[fallbackIndex].id);
      }
    } else {
      localStorage.removeItem('cyberia-active-space-id');
      set({ activeSpaceId: null, thoughts: [], stacks: [] });
    }
  },

  reorderSpaces: async (newSpaces) => {
    if (get().isReadOnly) return;
    const updates = newSpaces.map((s, i) => db.spaces.update(s.id, { order: i }));
    await Promise.all(updates);
    await get().refreshSpaces();
  },

  saveSpaceTransform: async (id, transform) => {
    const { spaces } = get();
    const space = spaces.find(s => s.id === id);

    // SAFETY: Never save the transform if we aren't in spatial mode.
    // This prevents structural view resets from overwriting spatial coordinates.
    if (!space || space.mode !== 'spatial') return;

    await db.spaces.update(id, {
      transformX: transform.x,
      transformY: transform.y,
      transformScale: transform.scale
    });
    // Update local state silently to avoid full refresh
    const index = spaces.findIndex(s => s.id === id);
    if (index !== -1) {
      const newSpaces = [...spaces];
      newSpaces[index] = { ...newSpaces[index], transformX: transform.x, transformY: transform.y, transformScale: transform.scale };
      set({ spaces: newSpaces });
    }
  },

  addThought: async (partialThought) => {
    if (get().isReadOnly) return -1;
    const { activeSpaceId } = get();
    const targetSpaceId = partialThought.spaceId || activeSpaceId;
    if (!targetSpaceId) throw new Error('No active space');

    const limits = get().getLimits();

    // 1. Size Validation (2MB Limit)
    const payloadSize = JSON.stringify(partialThought).length;
    if (payloadSize > 2 * 1024 * 1024) {
      useModalStore.getState().openModal({
        title: 'Buffer Overflow',
        description: 'Initial payload exceeds 2MB limit. Attempting to spawn an object too large for current neural architecture.',
        type: 'alert',
        confirmText: 'Acknowledged'
      });
      return -1;
    }

    const QUIRKY_TITLES = [
      "Still Thinking About It", "Name Pending", "This Will Make Sense Later",
      "I’ll Rename This, I Promise", "Untitled but Trying Its Best", "Just Go With It",
      "Something Is Happening Here", "Please Ignore the Title", "This Seemed Like a Good Idea",
      "We’ll Call It This for Now", "Don’t Worry About the Name", "Almost Had a Title",
      "This Exists", "Title in Progress", "No Name, Just Vibes", "I Panicked and Picked This",
      "It’s Not What It Looks Like", "Temporary, Probably", "Let’s Pretend This Is Clever",
      "Trust the Process"
    ];

    const result = await db.transaction('rw', db.thoughts, async () => {
      const currentCount = await db.thoughts.where('spaceId').equals(targetSpaceId).count();
      if (currentCount >= limits.MAX_THOUGHTS_PER_SPACE) {
        useModalStore.getState().openModal({
          title: 'Space is Full',
          description: `You've reached the limit of ${limits.MAX_THOUGHTS_PER_SPACE} thoughts per space. Upgrade to Pro for more capacity.`,
          type: 'limit_thought',
          confirmText: 'Go Pro',
          onConfirm: () => useModalStore.getState().openPricing()
        });
        return -1;
      }

      const randomTitle = QUIRKY_TITLES[Math.floor(Math.random() * QUIRKY_TITLES.length)];
      const maxLayer = await db.thoughts.where('spaceId').equals(targetSpaceId).reverse().sortBy('layer').then(t => t[0]?.layer || 0);

      const thought: Thought = {
        spaceId: targetSpaceId,
        stackId: null,
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
        vx: 0,
        vy: 0,
        text: '',
        placeholder: randomTitle,
        description: '',
        type: 'text',
        content: '',
        image: null,
        drawing: null,
        status: 'none',
        tasks: [],
        table: [['', ''], ['', '']],
        date: '',
        priority: 'none',
        size: 1.0,
        author: '',
        order: currentCount,
        layer: maxLayer + 1,
        ...partialThought
      } as Thought;

      return await db.thoughts.add(thought);
    });

    if (result !== -1) {
      await get().updateSpace(targetSpaceId, { updatedAt: new Date().toISOString() });
      await get().refreshThoughts(targetSpaceId);
      await get().refreshTotalThoughtCount();
      get().pushHistory();

      // Trigger Cloud Sync
      const authStore = (await import('./useAuthStore')).useAuthStore.getState();
      if (authStore.autoSync && authStore.status === 'authenticated') {
        authStore.syncData();
      }
    }

    return result as number;
  },

  // Centralized Debounced Save Logic
  updateThought: async (id, updates) => {
    // 1. Size Validation (2MB Limit)
    // Approximate size calculation for Base64 and large text
    const payloadSize = JSON.stringify(updates).length;
    if (payloadSize > 2 * 1024 * 1024) {
      useModalStore.getState().openModal({
        title: 'Payload Reached',
        description: 'This thought has exceeded the 2MB kinetic buffer. Reduce image resolution or text volume to synchronize.',
        type: 'alert',
        confirmText: 'Understood'
      });
      return;
    }

    // Optimistic Update (Instant UI feedback) - Runs for everyone
    const { thoughts } = get();
    const index = thoughts.findIndex(t => t.id === id);
    if (index !== -1) {
      const newThoughts = [...thoughts];
      newThoughts[index] = { ...newThoughts[index], ...updates };
      set({ thoughts: newThoughts });
    }

    if (get().isReadOnly) {
      const mode = get().spaces.find(s => s.id === get().activeSpaceId)?.mode || 'spatial';
      // Only allow optimistic updates for x,y positions in spatial mode
      const allowedKeys = ['x', 'y', 'vx', 'vy'];
      const keys = Object.keys(updates);
      const isPositionUpdate = keys.every(k => allowedKeys.includes(k));

      if (mode === 'spatial' && isPositionUpdate) {
        const { thoughts } = get();
        const index = thoughts.findIndex(t => t.id === id);
        if (index !== -1) {
          const newThoughts = [...thoughts];
          newThoughts[index] = { ...newThoughts[index], ...updates };
          set({ thoughts: newThoughts });
        }
      }
      return;
    }
    const activeSpaceId = get().activeSpaceId;
    if (activeSpaceId) {
      get().updateSpace(activeSpaceId, { updatedAt: new Date().toISOString() });
    }

    const saveTimers = (window as any)._cyberia_save_timers || {};
    if (saveTimers[id]) clearTimeout(saveTimers[id]);

    saveTimers[id] = setTimeout(async () => {
      await db.thoughts.update(id, updates);
      delete saveTimers[id];
      get().pushHistory(); // Push history after debounce

      // 3. Trigger Cloud Sync if Auto-Sync is ON
      const authStore = (await import('./useAuthStore')).useAuthStore.getState();
      if (authStore.autoSync && authStore.status === 'authenticated') {
        // Debounce cloud sync separately to avoid spamming the API
        if ((window as any)._cyberia_cloud_timer) clearTimeout((window as any)._cyberia_cloud_timer);
        (window as any)._cyberia_cloud_timer = setTimeout(() => {
          authStore.syncData();
        }, 5000); // Increased to 5 seconds of inactivity before pushing to cloud
      }
    }, 500); // 500ms local debounce

    (window as any)._cyberia_save_timers = saveTimers;
  },

  deleteThought: async (id) => {
    if (get().isReadOnly) return;
    const thought = get().thoughts.find(t => t.id === id);
    const affectedStackId = thought?.stackId;

    if (thought) {
      await get().updateSpace(thought.spaceId, { updatedAt: new Date().toISOString() });
    }

    await db.thoughts.delete(id);
    await get().refreshThoughts();
    await get().refreshTotalThoughtCount();

    if (affectedStackId) {
      await get().cleanupStacks();
    }

    if (get().selectedThoughtId === id) {
      set({ selectedThoughtId: null, isInspectorOpen: false });
    }
    if (get().selectedThoughtIds.includes(id)) {
      const newIds = get().selectedThoughtIds.filter(tid => tid !== id);
      set({ selectedThoughtIds: newIds });
    }
    get().pushHistory();

    // Trigger Cloud Sync
    const authStore = (await import('./useAuthStore')).useAuthStore.getState();
    if (authStore.autoSync && authStore.status === 'authenticated') {
      authStore.syncData();
    }
  },

  deleteThoughts: async (ids) => {
    if (get().isReadOnly) return;
    if (!ids || ids.length === 0) return;
    const { thoughts, selectedThoughtId, selectedThoughtIds } = get();

    const affectedStackIds = Array.from(new Set(
      thoughts.filter(t => ids.includes(t.id)).map(t => t.stackId).filter(Boolean)
    )) as string[];

    await db.thoughts.bulkDelete(ids);
    await get().refreshThoughts();
    await get().refreshTotalThoughtCount();

    if (affectedStackIds.length > 0) {
      await get().cleanupStacks();
    }

    // Clean up selection state
    if (selectedThoughtId && ids.includes(selectedThoughtId)) {
      set({ selectedThoughtId: null, isInspectorOpen: false });
    }
    const newSelectedIds = selectedThoughtIds.filter(tid => !ids.includes(tid));
    set({ selectedThoughtIds: newSelectedIds });

    get().pushHistory();

    const authStore = (await import('./useAuthStore')).useAuthStore.getState();
    if (authStore.autoSync && authStore.status === 'authenticated') {
      authStore.syncData();
    }
  },

  bringToFront: async (id) => {
    if (get().isReadOnly) return;
    const { thoughts, activeSpaceId } = get();
    if (!activeSpaceId) return;

    // 1. Get all nodes in current space sorted by current layer
    const sorted = [...thoughts].sort((a, b) => (a.layer || 0) - (b.layer || 0));

    // 2. Remove the target node from its current position
    const filtered = sorted.filter(t => t.id !== id);
    const target = thoughts.find(t => t.id === id);
    if (!target) return;

    // 3. Append target to the end (Top)
    filtered.push(target);

    // 4. Normalize: Re-assign clean 1, 2, 3... layers to everyone
    await db.transaction('rw', db.thoughts, async () => {
      const updates = filtered.map((t, i) => db.thoughts.update(t.id, { layer: i + 1 }));
      await Promise.all(updates);
    });

    set({ layerActionTrigger: { id, time: Date.now() } });
    await get().refreshThoughts(activeSpaceId);
  },

  sendToBack: async (id) => {
    if (get().isReadOnly) return;
    const { thoughts, activeSpaceId } = get();
    if (!activeSpaceId) return;

    // 1. Get all nodes in current space sorted by current layer
    const sorted = [...thoughts].sort((a, b) => (a.layer || 0) - (b.layer || 0));

    // 2. Remove the target node from its current position
    const filtered = sorted.filter(t => t.id !== id);
    const target = thoughts.find(t => t.id === id);
    if (!target) return;

    // 3. Prepend target to the start (Bottom)
    filtered.unshift(target);

    // 4. Normalize: Re-assign clean 1, 2, 3... layers to everyone
    await db.transaction('rw', db.thoughts, async () => {
      const updates = filtered.map((t, i) => db.thoughts.update(t.id, { layer: i + 1 }));
      await Promise.all(updates);
    });

    set({ layerActionTrigger: { id, time: Date.now() } });
    await get().refreshThoughts(activeSpaceId);
  },

  setSelectedThoughtId: (id) => {
    set({
      selectedThoughtId: id,
      selectedThoughtIds: id ? [id] : []
    });
  },

  setSelectedThoughtIds: (ids) => {
    set({
      selectedThoughtIds: ids,
      selectedThoughtId: ids.length === 1 ? ids[0] : null,
      isInspectorOpen: ids.length === 1 && !get().isReadOnly
    });
  },

  toggleThoughtSelection: (id) => {
    const { selectedThoughtIds, selectedThoughtId } = get();
    let currentIds = [...selectedThoughtIds];

    // If we have a single selectedThoughtId that isn't in selectedThoughtIds yet, add it
    if (selectedThoughtId && !currentIds.includes(selectedThoughtId)) {
      currentIds.push(selectedThoughtId);
    }

    let newIds;
    if (currentIds.includes(id)) {
      newIds = currentIds.filter(tid => tid !== id);
    } else {
      newIds = [...currentIds, id];
    }

    set({
      selectedThoughtIds: newIds,
      selectedThoughtId: newIds.length === 1 ? newIds[0] : null,
      isInspectorOpen: newIds.length === 1 && !get().isReadOnly
    });
  },

  clearSelection: () => {
    set({ selectedThoughtIds: [], selectedThoughtId: null, isInspectorOpen: false });
  },

  deleteSelectedThoughts: async () => {
    if (get().isReadOnly) return;
    const { selectedThoughtIds, thoughts } = get();
    if (selectedThoughtIds.length === 0) return;

    const affectedStackIds = Array.from(new Set(
      thoughts.filter(t => selectedThoughtIds.includes(t.id)).map(t => t.stackId).filter(Boolean)
    )) as string[];

    await db.thoughts.bulkDelete(selectedThoughtIds);
    await get().refreshThoughts();

    if (affectedStackIds.length > 0) {
      await get().cleanupStacks();
    }

    set({ selectedThoughtIds: [], selectedThoughtId: null, isInspectorOpen: false });
    get().pushHistory();
  },

  linkSelectedThoughts: async (name) => {
    if (get().isReadOnly) return;
    const { selectedThoughtIds, thoughts, activeSpaceId } = get();
    if (selectedThoughtIds.length < 2 || !activeSpaceId) return;

    // Find existing stacks among selected thoughts
    const thoughtsInSelection = thoughts.filter(t => selectedThoughtIds.includes(t.id));
    const existingStackIds = Array.from(new Set(thoughtsInSelection.map(t => t.stackId).filter(Boolean))) as string[];

    let targetStackId: string;

    if (existingStackIds.length > 0) {
      // MERGE: Move everything to the first stack found
      targetStackId = existingStackIds[0];

      // Update all thoughts in the selection to the targetStackId
      // AND update all thoughts that were in the other stacks to the targetStackId
      await db.transaction('rw', db.thoughts, db.stacks, async () => {
        // 1. Update thoughts in selection
        await db.thoughts.where('id').anyOf(selectedThoughtIds).modify({ stackId: targetStackId });

        // 2. Update thoughts in other merged stacks
        if (existingStackIds.length > 1) {
          const otherStackIds = existingStackIds.slice(1);
          await db.thoughts.where('stackId').anyOf(otherStackIds).modify({ stackId: targetStackId });
          // 3. Delete the now empty stacks
          await db.stacks.where('id').anyOf(otherStackIds).delete();
        }

        // If a name was provided, rename the merged stack
        if (name) {
          await db.stacks.update(targetStackId, { name: name?.trim() || 'Unnamed Stack' });
        }
      });
    } else {
      // CREATE NEW STACK
      targetStackId = 'st-' + Date.now();
      const randomHue = Math.floor(Math.random() * 360);
      await db.stacks.add({
        id: targetStackId,
        name: name?.trim() || 'Unnamed Stack',
        color: `hsla(${randomHue}, 70%, 50%, 1)`,
        spaceId: activeSpaceId
      });
      await db.thoughts.where('id').anyOf(selectedThoughtIds).modify({ stackId: targetStackId });
    }

    await get().refreshThoughts();
    await get().refreshStacks();
    get().pushHistory();
  },

  unlinkSelectedThoughts: async () => {
    if (get().isReadOnly) return;
    const { selectedThoughtIds } = get();
    if (selectedThoughtIds.length === 0) return;

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

        // If 0 or 1 thoughts remain, the stack is invalid
        if (stackThoughts.length < 2) {
          if (stackThoughts.length === 1) {
            await db.thoughts.update(stackThoughts[0].id, { stackId: null });
          }
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
    const randomHue = Math.floor(Math.random() * 360);

    await db.stacks.add({
      id: newStackId,
      name: trimmedName,
      color: `hsla(${randomHue}, 70%, 50%, 1)`,
      spaceId: activeSpaceId
    });

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

  setInspectorOpen: (open) => {
    set({ isInspectorOpen: open });
  },

  setActiveFocus: (id, type) => {
    set({ activeFocusId: id, focusType: id ? type : null });
  },

  setHoveredCalDate: (date) => {
    set({ hoveredCalDate: date });
  },

  setCalendarSearchQuery: (query) => {
    set({ calendarSearchQuery: query });
  },

  setCalendarStackFilter: (stackId) => {
    set({ calendarStackFilter: stackId });
  },

  setKanbanSearchQuery: (query) => {
    set({ kanbanSearchQuery: query });
  },

  setKanbanStackFilter: (stackId) => {
    set({ kanbanStackFilter: stackId });
  },

  setLinkingSourceId: (id) => {
    set({ linkingSourceId: id });
  },

  exportData: async () => {
    const allSpaces = await db.spaces.toArray();
    const allThoughts = await db.thoughts.toArray();
    const allStacks = await db.stacks.toArray();
    const data = {
      spaces: allSpaces,
      thoughts: allThoughts,
      stacks: allStacks,
      activeSpaceId: get().activeSpaceId,
      version: 2,
      timestamp: Date.now()
    };
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
      if (!data || typeof data !== 'object' || !('spaces' in data) || !('thoughts' in data)) {
        throw new Error('Invalid backup file');
      }
      const backup = data as { spaces: Space[], thoughts: Thought[], stacks?: Stack[], activeSpaceId?: string, settings?: { theme?: string } };

      await db.transaction('rw', db.spaces, db.thoughts, db.stacks, async () => {
        await db.spaces.clear();
        await db.thoughts.clear();
        await db.stacks.clear();
        await db.spaces.bulkAdd(backup.spaces);
        await db.thoughts.bulkAdd(backup.thoughts);
        if (backup.stacks) await db.stacks.bulkAdd(backup.stacks);
      });

      if (backup.activeSpaceId) {
        localStorage.setItem('cyberia-active-space-id', backup.activeSpaceId);
      }

      if (backup.settings?.theme) {
        localStorage.setItem('cyberia-theme', backup.settings.theme);
      }

      window.location.reload();
    };

    if (input instanceof File) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = JSON.parse(e.target?.result as string);
          await processData(data);
        } catch (err) {
          console.error('Import failed:', err);
          useModalStore.getState().openModal({
            title: 'Import Failed',
            description: 'This file is corrupted or not a valid Cyberia backup. Please try a different file.',
            type: 'alert',
            confirmText: 'Okay'
          });
        }
      };
      reader.readAsText(input);
    } else {
      try {
        await processData(input);
      } catch (err) {
        console.error('Import failed:', err);
        useModalStore.getState().openModal({
          title: 'Import Failed',
          description: 'This data is invalid. Please make sure you are using a real Cyberia backup file.',
          type: 'alert',
          confirmText: 'Okay'
        });
      }
    }
  },

  clearWorkspace: async () => {
    if (get().isReadOnly) return;
    try {
      await db.transaction('rw', db.spaces, db.thoughts, db.stacks, async () => {
        await db.spaces.clear();
        await db.thoughts.clear();
        await db.stacks.clear();
      });

      // Preserve auth and settings, clear only workspace state
      localStorage.removeItem('cyberia-active-space-id');

      window.location.reload();
    } catch (err) {
      console.error('Clear failed:', err);
    }
  }
}));