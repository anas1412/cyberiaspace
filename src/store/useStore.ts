import { create } from 'zustand';
import { db, type Space, type Thought } from '../db';

interface CyberiaState {
  activeSpaceId: string | null;
  spaces: Space[];
  thoughts: Thought[];
  selectedThoughtId: number | null;
  isInspectorOpen: boolean;
  activeFocusId: number | null;
  focusType: 'text' | 'table' | 'paint' | 'tasks' | null;
  calendarViewDate: Date;
  linkingSourceId: number | null;
  theme: 'cyberia' | 'rose' | 'neon';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deferredPrompt: any;
  
  // Initialization
  init: () => Promise<void>;
  
  // Actions
  setTheme: (theme: 'cyberia' | 'rose' | 'neon') => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setDeferredPrompt: (prompt: any) => void;
  
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
  setInspectorOpen: (open: boolean) => void;
  setActiveFocus: (id: number | null, type: 'text' | 'table' | 'paint' | 'tasks' | null) => void;
  setLinkingSourceId: (id: number | null) => void;
  
  // Data Lifecycle
  exportData: () => Promise<void>;
  importData: (file: File) => Promise<void>;
  
  // Lightbox
  isLightboxOpen: boolean;
  lightboxImage: string | null;
  openLightbox: (image: string) => void;
  closeLightbox: () => void;
  
  // Refresh data
  refreshThoughts: () => Promise<void>;
  refreshSpaces: () => Promise<void>;
}

export const useStore = create<CyberiaState>((set, get) => ({
  activeSpaceId: null,
  spaces: [],
  thoughts: [],
  selectedThoughtId: null,
  isInspectorOpen: false,
  activeFocusId: null,
  focusType: null,
  calendarViewDate: new Date(),
  isLightboxOpen: false,
  lightboxImage: null,
  linkingSourceId: null,
  theme: (localStorage.getItem('cyberia-theme') as 'cyberia' | 'rose' | 'neon') || 'cyberia',
  deferredPrompt: null,

  openLightbox: (image) => set({ isLightboxOpen: true, lightboxImage: image }),
  closeLightbox: () => set({ isLightboxOpen: false, lightboxImage: null }),

  setTheme: (theme) => {
    set({ theme });
    localStorage.setItem('cyberia-theme', theme);
    document.body.setAttribute('data-theme', theme);
  },

  setDeferredPrompt: (prompt) => set({ deferredPrompt: prompt }),

  init: async () => {
    // Apply theme on init
    const savedTheme = localStorage.getItem('cyberia-theme') || 'cyberia';
    document.body.setAttribute('data-theme', savedTheme);

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
    set({ thoughts });
  },

  setActiveSpace: (id) => {
    set({ activeSpaceId: id });
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
    // Update local state silently to avoid full refresh if possible, 
    // but refreshSpaces is safer for consistency.
    await get().refreshSpaces();
  },

  addThought: async (partialThought) => {
    const { activeSpaceId } = get();
    if (!activeSpaceId) throw new Error('No active space');

    const result = await db.transaction('rw', db.thoughts, async () => {
      const currentCount = await db.thoughts.where('spaceId').equals(activeSpaceId).count();
      if (currentCount >= 40) return -1;

      const thought: Thought = {
        spaceId: activeSpaceId,
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
        vx: 0,
        vy: 0,
        text: '',
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
        order: currentCount,
        ...partialThought
      } as Thought;

      return await db.thoughts.add(thought);
    });

    if (result !== -1) {
      await get().refreshThoughts();
    }
    
    return result as number;
  },

  updateThought: async (id, updates) => {
    await db.thoughts.update(id, updates);
    await get().refreshThoughts();
  },

  deleteThought: async (id) => {
    await db.thoughts.delete(id);
    await get().refreshThoughts();
    if (get().selectedThoughtId === id) {
      set({ selectedThoughtId: null, isInspectorOpen: false });
    }
  },

  setSelectedThoughtId: (id) => {
    set({ selectedThoughtId: id });
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

