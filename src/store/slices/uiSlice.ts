import { type StateCreator } from 'zustand';
import { db } from '../../db';
import { syncOrchestrator } from '../../services/sync/syncOrchestrator';
import { type CyberiaState } from '../types';

// Generation counter and abort controller to prevent concurrent setCustomBg races
let bgOperationId = 0;
let activeAbortController: AbortController | null = null;

const revokeCurrentBg = (bg: string | null) => {
  if (bg && bg.startsWith('blob:')) {
    URL.revokeObjectURL(bg);
  }
};

export const createUiSlice: StateCreator<CyberiaState, [], [], any> = (set, get, _api) => {
  const getInitialTheme = (): 'dark' | 'light' => {
    const stored = localStorage.getItem('cyberia-theme');
    if (stored === 'dark' || stored === 'light') return stored;
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  };
  
  return {
    theme: getInitialTheme(),
  customBg: null,
  customBgLoading: false,
  oracleChatMode: 'chat',
  isChatOpen: false,
  isInspectorOpen: false,
  deferredPrompt: null,
  calendarViewDate: new Date(),
  hoveredCalDate: null,
  calendarSearchQuery: '',
  calendarStackFilter: null,
  calendarStatusFilter: null,
  calendarTypeFilter: null,
  kanbanSearchQuery: '',
  kanbanStackFilter: null,
  kanbanStatusFilter: null,
  kanbanDateFilter: null,
  kanbanTypeFilter: null,
  spatialSearchQuery: '',
  spatialStackFilter: null,
  spatialStatusFilter: null,
  spatialDateFilter: null,
  spatialTypeFilter: null,
  showArchived: false,
  linkingSourceId: null,
  layerActionTrigger: null,

  setTheme: async (theme: 'dark' | 'light') => {
    const { activeSpaceId, isReadOnly, theme: currentTheme } = get();
    // Prevent unnecessary updates if theme hasn't changed
    if (theme === currentTheme) return;
    
    set({ theme });
    localStorage.setItem('cyberia-theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);
    // Clear inline styles set by index.html blocking script so CSS variables work
    document.documentElement.style.removeProperty('--bg-page');
    document.documentElement.style.removeProperty('--text-primary');
    document.documentElement.style.removeProperty('--accent');
    document.documentElement.style.removeProperty('--glass-border');
    if (activeSpaceId && !isReadOnly) get().updateSpace(activeSpaceId, { theme });
    
    const { useAuthStore } = await import('../useAuthStore');
    const authStore = useAuthStore.getState();
    if (authStore.status === 'authenticated') authStore.updateSettings({ theme } as any);
  },

  setCustomBg: async (bg: File | string | null) => {
    const { activeSpaceId, isReadOnly, customBg } = get();
    if (isReadOnly || !activeSpaceId) return;

    // 1. Supersede previous operation
    if (activeAbortController) {
      activeAbortController.abort();
    }
    const operationId = ++bgOperationId;
    const controller = new AbortController();
    activeAbortController = controller;
    const isStale = () => bgOperationId !== operationId;

    // 2. Revoke previous background blob URL
    revokeCurrentBg(customBg);

    // 3. Process new background
    try {
      // Get current user
      const { useAuthStore } = await import('../useAuthStore');
      const authStore = useAuthStore.getState();
      const currentUserId = authStore.user?.id ?? 'guest';

      // If it's a File - store locally FIRST, upload later via sync
      if (bg instanceof File) {
        set({ customBgLoading: true });

        // A. Store blob in IndexedDB immediately
        const blobUrl = URL.createObjectURL(bg);
        const now = Date.now();
        
        await db.spaceBackgrounds.put({
          id: activeSpaceId,
          spaceId: activeSpaceId,
          blob: bg,
          name: bg.name,
          type: bg.type,
          userId: currentUserId,
          updatedAt: now
        });

        // B. Show immediately from local blob
        set({ customBg: blobUrl, customBgLoading: false });
        
        const updated = get().spaces.map((s: any) => s.id === activeSpaceId ? { ...s, customBg: blobUrl } : s);
        set({ spaces: updated });

        // C. Update IndexedDB spaces with blob URL (not cloud URL)
        await db.spaces.update(activeSpaceId, { 
          customBg: blobUrl, 
          updatedAt: now, 
          syncStatus: 'local' as const 
        });

        // D. Trigger background sync (will upload blob to cloud)
        if (authStore.status === 'authenticated' && !isStale()) {
          await syncOrchestrator.triggerSync();
        }
        
        console.log('[BG] Background saved locally, will sync to cloud:', blobUrl);
        return;
      }
      
      // If it's null (clear background)
      if (bg === null) {
        // Delete local blob
        await db.spaceBackgrounds.delete(activeSpaceId);
        
        set({ customBg: null });
        const updated = get().spaces.map((s: any) => s.id === activeSpaceId ? { ...s, customBg: null } : s);
        set({ spaces: updated });
        await db.spaces.update(activeSpaceId, { customBg: null, updatedAt: Date.now(), syncStatus: 'local' as const });
        
        if (authStore.status === 'authenticated') await syncOrchestrator.triggerSync();
        return;
      }
      
      // If it's a string URL (e.g., cloud URL from another device)
      // Download to local first, then show local blob
      if (bg.startsWith('http')) {
        set({ customBgLoading: true });
        
        try {
          // Download from cloud
          const res = await fetch(bg);
          const blob = await res.blob();
          const blobUrl = URL.createObjectURL(blob);
          const now = Date.now();

          // Store locally
          await db.spaceBackgrounds.put({
            id: activeSpaceId,
            spaceId: activeSpaceId,
            blob,
            name: 'background',
            type: blob.type,
            userId: currentUserId,
            updatedAt: now
          });

          // Show local blob
          set({ customBg: blobUrl, customBgLoading: false });
          const updated = get().spaces.map((s: any) => s.id === activeSpaceId ? { ...s, customBg: blobUrl } : s);
          set({ spaces: updated });
          await db.spaces.update(activeSpaceId, { customBg: blobUrl, updatedAt: now, syncStatus: 'synced' as const });
          
          console.log('[BG] Downloaded cloud background to local:', blobUrl);
        } catch (err) {
          console.error('[BG] Failed to download cloud background:', err);
          set({ customBgLoading: false });
        }
        return;
      }

    } catch (e: any) {
      if (e.name === 'AbortError') return;
      set({ customBgLoading: false });
      console.error('[BG] Failed to process background:', e);
    }
  },

  setDeferredPrompt: (prompt: any) => set({ deferredPrompt: prompt }),

  setChatOpen: (isOpen: boolean) => set({ isChatOpen: isOpen }),
  setOracleChatMode: (mode: 'chat' | 'action') => set({ oracleChatMode: mode }),
  setCalendarViewDate: (date: Date) => set({ calendarViewDate: date }),
  setHoveredCalDate: (date: string | null) => set({ hoveredCalDate: date }),
  setCalendarSearchQuery: (query: string) => set({ calendarSearchQuery: query }),
  setCalendarStackFilter: (stackIds: string[] | null) => set({ calendarStackFilter: stackIds } as any),
  setCalendarStatusFilter: (statuses: Array<'todo' | 'doing' | 'done'> | null) => set({ calendarStatusFilter: statuses } as any),
  setCalendarTypeFilter: (types: import('../../db').ThoughtType[] | null) => set({ calendarTypeFilter: types } as any),
  setKanbanSearchQuery: (query: string) => set({ kanbanSearchQuery: query }),
  setKanbanStackFilter: (stackIds: string[] | null) => set({ kanbanStackFilter: stackIds } as any),
  setKanbanStatusFilter: (statuses: Array<'todo' | 'doing' | 'done'> | null) => set({ kanbanStatusFilter: statuses } as any),
  setKanbanDateFilter: (date: string | null) => set({ kanbanDateFilter: date }),
  setKanbanTypeFilter: (types: import('../../db').ThoughtType[] | null) => set({ kanbanTypeFilter: types }),
  setSpatialSearchQuery: (query: string) => set({ spatialSearchQuery: query }),
  setSpatialStackFilter: (stackIds: string[] | null) => set({ spatialStackFilter: stackIds } as any),
  setSpatialStatusFilter: (statuses: Array<'todo' | 'doing' | 'done'> | null) => set({ spatialStatusFilter: statuses } as any),
  setSpatialDateFilter: (date: string | null) => set({ spatialDateFilter: date }),
  setSpatialTypeFilter: (types: import('../../db').ThoughtType[] | null) => set({ spatialTypeFilter: types }),
  setShowArchived: (show: boolean) => set({ showArchived: show }),
  setLinkingSourceId: (id: string | null) => set({ linkingSourceId: id }),
  setInspectorOpen: (open: boolean) => set({ isInspectorOpen: open }),

  setCustomBgValue: (bg: string | null) => set({ customBg: bg }),
  };
};
