import { create } from 'zustand';
import { db, type Space, type Thought, type Stack } from '../db';
import { aiService } from '../services/ai';
import { useAuthStore } from './useAuthStore';
import { DEFAULT_MODEL } from '../constants';

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
  linkingSourceId: number | null;
  theme: 'cyberia' | 'sakura' | 'neon';
  isSpaceLoading: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deferredPrompt: any;

  // God Mode (AI) State
  apiKey: string | null;
  activeModel: string;
  oracleMode: boolean; // True = AI Enabled
  isChatOpen: boolean;
  
  // Initialization
  init: () => Promise<void>;
  
  // Actions
  setTheme: (theme: 'cyberia' | 'sakura' | 'neon') => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setDeferredPrompt: (prompt: any) => void;

  // AI Actions
  setApiKey: (key: string) => void;
  setActiveModel: (model: string) => void;
  removeApiKey: () => void;
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
  setSelectedThoughtId: (id: number | null) => void;
  setSelectedThoughtIds: (ids: number[]) => void;
  toggleThoughtSelection: (id: number) => void;
  clearSelection: () => void;
  deleteSelectedThoughts: () => Promise<void>;
  linkSelectedThoughts: (name?: string) => Promise<void>;
  unlinkSelectedThoughts: () => Promise<void>;
  setInspectorOpen: (open: boolean) => void;
  setActiveFocus: (id: number | null, type: 'text' | 'table' | 'paint' | 'tasks' | 'embed' | null) => void;
  setLinkingSourceId: (id: number | null) => void;

  // Stack Actions
  createStack: (name: string, thoughtId: number) => Promise<void>;
  updateStack: (id: string, updates: Partial<Stack>) => Promise<void>;
  deleteStack: (id: string) => Promise<void>;
  cleanupStacks: () => Promise<void>;
  
  // Data Lifecycle
  exportData: () => Promise<void>;
  importData: (file: File) => Promise<void>;
  resetData: () => Promise<void>;
  
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
  refreshSpaces: () => Promise<void>;
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
  isLightboxOpen: false,
  lightboxImage: null,
  linkingSourceId: null,
  theme: (localStorage.getItem('cyberia-theme') as 'cyberia' | 'sakura' | 'neon') || 'cyberia',
  isSpaceLoading: true,
  deferredPrompt: null,
  
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
    set({ transform: {
      x: centerX - wx * newScale,
      y: centerY - wy * newScale,
      scale: newScale
    }});
  },
  zoomOut: () => {
    const { transform } = get();
    const newScale = Math.max(transform.scale / 1.2, 0.1);
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const wx = (centerX - transform.x) / transform.scale;
    const wy = (centerY - transform.y) / transform.scale;
    set({ transform: {
      x: centerX - wx * newScale,
      y: centerY - wy * newScale,
      scale: newScale
    }});
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

  apiKey: localStorage.getItem('cyberia-api-key'),
  activeModel: localStorage.getItem('cyberia-active-model') || DEFAULT_MODEL,
  oracleMode: localStorage.getItem('cyberia-oracle-mode') === 'true',
  isChatOpen: false,

  openLightbox: (image) => set({ isLightboxOpen: true, lightboxImage: image }),
  closeLightbox: () => set({ isLightboxOpen: false, lightboxImage: null }),

  setTheme: (theme) => {
    set({ theme });
    localStorage.setItem('cyberia-theme', theme);
    document.body.setAttribute('data-theme', theme);
  },

  setDeferredPrompt: (prompt) => set({ deferredPrompt: prompt }),

  setApiKey: (key) => {
    set({ apiKey: key });
    localStorage.setItem('cyberia-api-key', key);
    if (key) {
      aiService.initialize(key, get().activeModel);
    }
  },

  setActiveModel: (model) => {
    set({ activeModel: model });
    localStorage.setItem('cyberia-active-model', model);
    const { apiKey } = get();
    if (apiKey) {
      aiService.initialize(apiKey, model);
    }
  },

  removeApiKey: () => {
    set({ apiKey: null, oracleMode: false, isChatOpen: false });
    localStorage.removeItem('cyberia-api-key');
    localStorage.removeItem('cyberia-oracle-mode');
  },

  toggleOracleMode: () => {
    const newMode = !get().oracleMode;
    set({ oracleMode: newMode });
    localStorage.setItem('cyberia-oracle-mode', String(newMode));
  },

  setChatOpen: (isOpen) => set({ isChatOpen: isOpen }),

  init: async () => {
    set({ isSpaceLoading: true });
    // Initialize Auth
    useAuthStore.getState().initAuth();
    
    // Apply theme on init
    const savedTheme = localStorage.getItem('cyberia-theme') || 'cyberia';
    document.body.setAttribute('data-theme', savedTheme);

    // Initialize AI if key exists
    const savedKey = localStorage.getItem('cyberia-api-key');
    const savedModel = localStorage.getItem('cyberia-active-model') || DEFAULT_MODEL;
    if (savedKey) {
      aiService.initialize(savedKey, savedModel);
    }

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
        name: 'Core Concepts',
        color: 'hsla(230, 80%, 60%, 1)',
        spaceId: onboardingId
      });

      await get().addThought({
        text: 'Welcome to Cyberia',
        content: 'This is a **kinetic spatial workspace**. Thoughts are physical objects that interact with each other. \n\nDrag nodes to move them, or let the physics engine form natural clusters.',
        x: cx - 400, y: cy - 200, priority: 'high', stackId: basicsId,
        status: 'done',
        spaceId: onboardingId
      });

      await get().addThought({
        text: 'The Art of Interaction',
        content: 'Click a node to **Edit**. \n\nGive it a gentle pull to **Move**. Cyberia distinguishes between your intent to refine and your intent to organize automatically.',
        x: cx - 400, y: cy, priority: 'medium', stackId: basicsId,
        status: 'doing',
        spaceId: onboardingId
      });

      await get().addThought({
        text: 'Morphing Views',
        content: 'Switch between views in the top right: \n\n- **Spatial:** Free-form physics playground. \n- **Kanban:** Structured columnar workflow. \n- **Calendar:** Time-based stacking grid. \n\nYour data adapts to the shape you need.',
        x: cx - 400, y: cy + 200, priority: 'medium', stackId: basicsId,
        status: 'todo',
        spaceId: onboardingId
      });

      // STACK 2: THE wired SYSTEM (PURPLE)
      const mediaId = 'st-media';
      await db.stacks.add({
        id: mediaId,
        name: 'The Wired',
        color: 'hsla(280, 80%, 65%, 1)',
        spaceId: onboardingId
      });

      await get().addThought({
        text: 'Cyberia - An Epic Ambient Cyberpunk Journey',
        type: 'embed',
        content: 'https://youtu.be/P6kS_CD9H6I',
        description: 'Cyberia supports full YouTube integration. Experience the Wired. Click to open the video, or drag the node to reposition it in your mental landscape.',
        x: cx + 400, y: cy - 250, priority: 'low', stackId: mediaId,
        status: 'doing',
        spaceId: onboardingId
      });

      await get().addThought({
        text: 'Protocol 7',
        type: 'image',
        image: 'https://media.tenor.com/v-d5E2Xnv_sAAAAM/lain-serial-experiments-lain.gif',
        description: 'Visualizing non-linear thought patterns. Cyberia’s spatial canvas allows you to break free from hierarchical constraints and explore ideas in a truly multidimensional way.',
        x: cx + 400, y: cy + 50, priority: 'medium', stackId: mediaId,
        status: 'done',
        spaceId: onboardingId
      });

      await get().addThought({
        text: 'System Security',
        type: 'image',
        image: 'https://media.tenor.com/40W5BiKcSBEAAAAM/serial-experiments-lain-police.gif',
        description: 'Managing the boundaries of the digital self. All your data are hosted locally in your browser, and never leaves it without your explicit action.',
        x: cx + 650, y: cy - 100, priority: 'low', stackId: mediaId,
        status: 'todo',
        spaceId: onboardingId
      });

      await get().addThought({
        text: 'README',
        content: '# Cyberia: The Kinetic Mind\n\nCyberia is a **spatial operating system** for your thoughts. In a world of flat lists and rigid folders, Cyberia treats information as **physical matter**.\n\n### 1. Kinetic Architecture\nIdeas here have mass, velocity, and gravity. Using our custom physics engine, your thoughts form natural clusters—**Stacks**—based on your internal logic. It moves with you, resisting the static nature of traditional apps.\n\n### 2. Dimensional Morphing\nInformation is fluid. Switch between **Spatial**, **Kanban**, and **Calendar** modes to see your data transform. What was a free-form brainstorm becomes a structured workflow, then a temporal roadmap, all without losing context.\n\n### 3. The Oracle (AI)\nPowered by Gemini, the **Oracle** is your spatial assistant. It doesn\'t just chat; it can research the Wired for you, create new thoughts, and help you bridge connections by organizing your mental landscape into Stacks.\n\n### 4. Local & Secure\nYour mind belongs to you. All data is stored locally in your browser. Cyberia is a private sanctuary for non-linear thinking.\n\n---\n*Welcome to the Wired.*',
        x: cx + 650, y: cy + 150, priority: 'urgent', stackId: mediaId,
        status: 'done',
        spaceId: onboardingId
      });

      // STACK 3: PRODUCTIVITY (AMBER)
      const toolsId = 'st-tools';
      await db.stacks.add({
        id: toolsId,
        name: 'Deep Tools',
        color: 'hsla(40, 90%, 55%, 1)',
        spaceId: onboardingId
      });

      await get().addThought({
        text: 'Task Management',
        type: 'tasks',
        tasks: [
          { text: 'Double-click to expand', done: true },
          { text: 'Drag tasks to reorder', done: false },
          { text: 'Mark items as done', done: false }
        ],
        x: cx, y: cy + 300, priority: 'high', stackId: toolsId,
        status: 'todo',
        spaceId: onboardingId
      });

      await get().addThought({
        text: 'Structured Tables',
        type: 'table',
        table: [
          ['Feature', 'Status'],
          ['Physics', 'Active'],
          ['Vision', 'Online'],
          ['Stacks', 'Unique']
        ],
        x: cx + 250, y: cy + 400, priority: 'none', stackId: toolsId,
        status: 'todo',
        spaceId: onboardingId
      });

      await get().refreshThoughts(onboardingId);
      await get().refreshStacks(onboardingId);
      set({ isSpaceLoading: false });
    } else {
      const savedSpaceId = localStorage.getItem('cyberia-active-space-id');
      const spaceExists = savedSpaceId ? spaces.find(s => s.id === savedSpaceId) : null;
      
      if (spaceExists) {
        get().setActiveSpace(savedSpaceId!);
      } else {
        get().setActiveSpace(spaces[0].id);
      }
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
    const updates: any = { activeSpaceId: id, thoughts: [], stacks: [], isSpaceLoading: true, history: [], historyIndex: -1 };
    
    if (space && space.mode === 'spatial') {
      updates.transform = {
        x: space.transformX ?? 0,
        y: space.transformY ?? 0,
        scale: space.transformScale ?? 1
      };
    } else {
      updates.transform = { x: 0, y: 0, scale: 1 };
    }

    set(updates);
    get().refreshThoughts(id);
    get().refreshStacks(id);
  },

  setCalendarViewDate: (date) => {
    set({ calendarViewDate: date });
  },

  addSpace: async (name) => {
    const id = 's' + Date.now();
    const order = get().spaces.length;
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
    await db.spaces.update(id, updates);
    await get().refreshSpaces();
  },

  deleteSpace: async (id) => {
    const { spaces, activeSpaceId } = get();
    const deleteIndex = spaces.findIndex(s => s.id === id);
    
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
    const { activeSpaceId } = get();
    const targetSpaceId = partialThought.spaceId || activeSpaceId;
    if (!targetSpaceId) throw new Error('No active space');

    const QUIRKY_TITLES = [
      "Still Thinking About It",
      "Name Pending",
      "This Will Make Sense Later",
      "I’ll Rename This, I Promise",
      "Untitled but Trying Its Best",
      "Just Go With It",
      "Something Is Happening Here",
      "Please Ignore the Title",
      "This Seemed Like a Good Idea",
      "We’ll Call It This for Now",
      "Don’t Worry About the Name",
      "Almost Had a Title",
      "This Exists",
      "Title in Progress",
      "No Name, Just Vibes",
      "I Panicked and Picked This",
      "It’s Not What It Looks Like",
      "Temporary, Probably",
      "Let’s Pretend This Is Clever",
      "Trust the Process"
    ];

    const result = await db.transaction('rw', db.thoughts, async () => {
      const currentCount = await db.thoughts.where('spaceId').equals(targetSpaceId).count();
      if (currentCount >= 40) return -1;

      const randomTitle = QUIRKY_TITLES[Math.floor(Math.random() * QUIRKY_TITLES.length)];

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
        order: currentCount,
        ...partialThought
      } as Thought;

      return await db.thoughts.add(thought);
    });

    if (result !== -1) {
      await get().refreshThoughts(targetSpaceId);
      await get().refreshTotalThoughtCount();
      get().pushHistory();
    }
    
    return result as number;
  },

  // Centralized Debounced Save Logic
  updateThought: async (id, updates) => {
    // 1. Optimistic Update (Instant UI feedback)
    const { thoughts } = get();
    const index = thoughts.findIndex(t => t.id === id);
    if (index !== -1) {
      const newThoughts = [...thoughts];
      newThoughts[index] = { ...newThoughts[index], ...updates };
      set({ thoughts: newThoughts });
    }

    // 2. Debounced Database Persistence
    const saveTimers = (window as any)._cyberia_save_timers || {};
    if (saveTimers[id]) clearTimeout(saveTimers[id]);

    saveTimers[id] = setTimeout(async () => {
      await db.thoughts.update(id, updates);
      delete saveTimers[id];
      get().pushHistory(); // Push history after debounce
    }, 500); // 500ms debounce

    (window as any)._cyberia_save_timers = saveTimers;
  },

  deleteThought: async (id) => {
    const thought = get().thoughts.find(t => t.id === id);
    const affectedStackId = thought?.stackId;

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
      isInspectorOpen: ids.length === 1
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
      isInspectorOpen: newIds.length === 1
    });
  },

  clearSelection: () => {
    set({ selectedThoughtIds: [], selectedThoughtId: null, isInspectorOpen: false });
  },

  deleteSelectedThoughts: async () => {
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
    await db.stacks.update(id, updates);
    await get().refreshStacks();
  },

  deleteStack: async (id) => {
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

    importData: async (file) => {

      const reader = new FileReader();

      reader.onload = async (e) => {

        try {

          const data = JSON.parse(e.target?.result as string);

          if (!data.spaces || !data.thoughts) throw new Error('Invalid backup file');

          

          await db.transaction('rw', db.spaces, db.thoughts, db.stacks, async () => {

            await db.spaces.clear();

            await db.thoughts.clear();

            await db.stacks.clear();

            await db.spaces.bulkAdd(data.spaces);

            await db.thoughts.bulkAdd(data.thoughts);

            if (data.stacks) await db.stacks.bulkAdd(data.stacks);

          });

          

          window.location.reload();

        } catch (err) {

          console.error('Import failed:', err);

          alert('Import failed. Please make sure the file is a valid Cyberia backup.');

        }

      };

      reader.readAsText(file);

    },

  

    resetData: async () => {

      try {

        await db.transaction('rw', db.spaces, db.thoughts, db.stacks, async () => {

          await db.spaces.clear();

          await db.thoughts.clear();

          await db.stacks.clear();

        });

        localStorage.clear();

        window.location.reload();

      } catch (err) {

        console.error('Reset failed:', err);

      }

    }

  }));

  