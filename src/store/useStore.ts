import { create } from 'zustand';
import { db, type Space, type Thought } from '../db';
import { aiService } from '../services/ai';
import { DEFAULT_MODEL } from '../constants';

interface CyberiaState {
  activeSpaceId: string | null;
  spaces: Space[];
  thoughts: Thought[];
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
  linkSelectedThoughts: () => Promise<void>;
  unlinkSelectedThoughts: () => Promise<void>;
  setInspectorOpen: (open: boolean) => void;
  setActiveFocus: (id: number | null, type: 'text' | 'table' | 'paint' | 'tasks' | 'embed' | null) => void;
  setLinkingSourceId: (id: number | null) => void;
  
  // Data Lifecycle
  exportData: () => Promise<void>;
  importData: (file: File) => Promise<void>;
  
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
  refreshThoughts: () => Promise<void>;
  refreshSpaces: () => Promise<void>;
}

export const useStore = create<CyberiaState>((set, get) => ({
  activeSpaceId: null,
  spaces: [],
  thoughts: [],
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
  isSpaceLoading: false,
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
    const { spaces } = get();
    
    if (spaces.length === 0) {
      const defaultSpaceId = 's' + Date.now();
      await db.spaces.add({
        id: defaultSpaceId,
        name: 'My First Space',
        mode: 'spatial',
        physics: true,
        order: 0
      });
      await get().refreshSpaces();
      set({ activeSpaceId: defaultSpaceId });
      
      // Seed Onboarding Thoughts
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      const stackTag = `stack-${Math.random().toString(36).substr(2, 6)}`;

      await get().addThought({
        text: 'Welcome to Cyberia',
        content: 'This is a **spatial workspace**. Ideas are physical objects here. \n\nPress **[Space]** to create a new thought anywhere.',
        x: centerX,
        y: centerY - 150,
        tags: [stackTag],
        priority: 'high'
      });

      await get().addThought({
        text: 'Kinetic Stacking',
        type: 'tasks',
        tasks: [
          { text: 'Drag thoughts to move them', done: true },
          { text: 'Connect them with the Link button', done: false },
          { text: 'Watch them form a cluster', done: false }
        ],
        x: centerX + 250,
        y: centerY,
        tags: [stackTag],
        priority: 'medium'
      });

      await get().addThought({
        text: 'Morphing Views',
        content: 'Use the **View Toggle** in the top right to switch between **Spatial**, **Kanban**, and **Calendar** modes. \n\nYour ideas adapt to the structure you need.',
        x: centerX - 250,
        y: centerY,
        tags: [stackTag],
        priority: 'none'
      });

    } else {
      set({ activeSpaceId: spaces[0].id });
    }
    
    await get().refreshThoughts();
  },

  refreshSpaces: async () => {
    const spaces = await db.spaces.orderBy('order').toArray();
    set({ spaces });
  },

  refreshThoughts: async () => {
    const { activeSpaceId } = get();
    if (!activeSpaceId) return;
    const thoughts = await db.thoughts.where('spaceId').equals(activeSpaceId).toArray();
    set({ thoughts, isSpaceLoading: false });
    if (get().history.length === 0) {
      set({ history: [JSON.parse(JSON.stringify(thoughts))], historyIndex: 0 });
    }
  },

  setActiveSpace: (id) => {
    const space = get().spaces.find(s => s.id === id);
    const updates: any = { activeSpaceId: id, thoughts: [], isSpaceLoading: true, history: [], historyIndex: -1 };
    
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
    get().refreshThoughts();
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
    await db.spaces.delete(id);
    await db.thoughts.where('spaceId').equals(id).delete();
    await get().refreshSpaces();
    
    const { spaces } = get();
    if (spaces.length > 0) {
      get().setActiveSpace(spaces[0].id);
    } else {
      set({ activeSpaceId: null, thoughts: [] });
    }
  },

  reorderSpaces: async (newSpaces) => {
    const updates = newSpaces.map((s, i) => db.spaces.update(s.id, { order: i }));
    await Promise.all(updates);
    await get().refreshSpaces();
  },

  saveSpaceTransform: async (id, transform) => {
    await db.spaces.update(id, {
      transformX: transform.x,
      transformY: transform.y,
      transformScale: transform.scale
    });
    // Update local state silently to avoid full refresh
    const { spaces } = get();
    const index = spaces.findIndex(s => s.id === id);
    if (index !== -1) {
      const newSpaces = [...spaces];
      newSpaces[index] = { ...newSpaces[index], transformX: transform.x, transformY: transform.y, transformScale: transform.scale };
      set({ spaces: newSpaces });
    }
  },

  addThought: async (partialThought) => {
    const { activeSpaceId } = get();
    if (!activeSpaceId) throw new Error('No active space');

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
      const currentCount = await db.thoughts.where('spaceId').equals(activeSpaceId).count();
      if (currentCount >= 40) return -1;

      const randomTitle = QUIRKY_TITLES[Math.floor(Math.random() * QUIRKY_TITLES.length)];

      const thought: Thought = {
        spaceId: activeSpaceId,
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
        tags: [],
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
      await get().refreshThoughts();
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
    await db.thoughts.delete(id);
    await get().refreshThoughts();
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
    // If we are currently linking, don't clear the linkingSourceId
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
    const { selectedThoughtIds } = get();
    if (selectedThoughtIds.length === 0) return;
    
    await db.thoughts.bulkDelete(selectedThoughtIds);
    await get().refreshThoughts();
    set({ selectedThoughtIds: [], selectedThoughtId: null, isInspectorOpen: false });
    get().pushHistory();
  },

  linkSelectedThoughts: async () => {
    const { selectedThoughtIds, thoughts } = get();
    if (selectedThoughtIds.length < 2) return;

    const commonTag = `stack-${Math.random().toString(36).substr(2, 6)}`;
    
    const updates = selectedThoughtIds.map(id => {
      const thought = thoughts.find(t => t.id === id);
      if (!thought) return Promise.resolve();
      const newTags = Array.from(new Set([...thought.tags, commonTag]));
      return get().updateThought(id, { tags: newTags });
    });

    await Promise.all(updates);
    get().pushHistory();
  },

  unlinkSelectedThoughts: async () => {
    const { selectedThoughtIds, thoughts } = get();
    if (selectedThoughtIds.length < 2) return;

    // Find all stack tags shared by ALL selected thoughts
    const firstThought = thoughts.find(t => t.id === selectedThoughtIds[0]);
    if (!firstThought) return;

    const commonStackTags = firstThought.tags.filter(tag => 
      tag.startsWith('stack-') && 
      selectedThoughtIds.every(id => {
        const t = thoughts.find(th => th.id === id);
        return t?.tags.includes(tag);
      })
    );

    if (commonStackTags.length === 0) return;

    const updates = selectedThoughtIds.map(id => {
      const thought = thoughts.find(t => t.id === id);
      if (!thought) return Promise.resolve();
      const newTags = thought.tags.filter(tag => !commonStackTags.includes(tag));
      return get().updateThought(id, { tags: newTags });
    });

    await Promise.all(updates);
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
    const data = {
      spaces: allSpaces,
      thoughts: allThoughts,
      version: 1,
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
        
        await db.transaction('rw', db.spaces, db.thoughts, async () => {
          await db.spaces.clear();
          await db.thoughts.clear();
          await db.spaces.bulkAdd(data.spaces);
          await db.thoughts.bulkAdd(data.thoughts);
        });
        
        window.location.reload();
      } catch (err) {
        console.error('Import failed:', err);
        alert('Import failed. Please make sure the file is a valid Cyberia backup.');
      }
    };
    reader.readAsText(file);
  }
}));

