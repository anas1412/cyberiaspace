import { type StateCreator } from 'zustand';
import { db } from '../../db';
import { getSetting, setSetting } from '../../utils/settings';
import { type CyberiaState } from '../types';

let activeAbortController: AbortController | null = null;

const revokeCurrentBg = (bg: string | null) => {
  if (bg && bg.startsWith('blob:')) {
    URL.revokeObjectURL(bg);
  }
};

export const createUiSlice: StateCreator<CyberiaState, [], [], any> = (set, get, _api) => {
  const getInitialTheme = (): 'dark' | 'light' => {
    const stored = getSetting('theme');
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
    aiChatMode: 'chat',
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

    // Directory mode state
    directorySearchQuery: '',
    directoryGroupBy: 'stack' as const,
    directorySortBy: 'order' as const,
    directoryCollapsedGroups: new Set<string>(),
    directorySelectedThoughtId: null,

    setTheme: async (theme: 'dark' | 'light') => {
      const { theme: currentTheme } = get();
      if (theme === currentTheme) return;

      set({ theme });
      await setSetting('theme', theme);
      document.documentElement.setAttribute('data-theme', theme);
      document.body.setAttribute('data-theme', theme);
      document.documentElement.style.removeProperty('--bg-page');
      document.documentElement.style.removeProperty('--text-primary');
      document.documentElement.style.removeProperty('--accent');
      document.documentElement.style.removeProperty('--glass-border');

      const customNodeBg = getSetting('node-bg');
      if (customNodeBg) {
        document.documentElement.style.setProperty('--node-bg', customNodeBg, 'important');
      } else {
        const defaultNodeBg = theme === 'dark' ? '#12121af5' : '#f8fafc';
        document.documentElement.style.setProperty('--node-bg', defaultNodeBg, 'important');
      }

      const customAccent = getSetting('accent');
      if (customAccent) {
        document.documentElement.style.setProperty('--accent', customAccent, 'important');
      } else {
        document.documentElement.style.removeProperty('--accent');
      }

      const spaceId = get().activeSpaceId;
      if (spaceId && !get().isReadOnly) get().updateSpace(spaceId, { theme });
    },

    setCustomBg: async (bg: File | string | null) => {
      const { activeSpaceId, isReadOnly, customBg } = get();
      if (isReadOnly || !activeSpaceId) return;

      if (activeAbortController) {
        activeAbortController.abort();
      }
      const controller = new AbortController();
      activeAbortController = controller;
      revokeCurrentBg(customBg);

      try {
        const currentUserId = 'guest';

        if (bg instanceof File) {
          set({ customBgLoading: true });

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

          set({ customBg: blobUrl, customBgLoading: false });

          const updated = get().spaces.map((s: any) => s.id === activeSpaceId ? { ...s, customBg: blobUrl } : s);
          set({ spaces: updated });

          await db.spaces.update(activeSpaceId, {
            customBg: blobUrl,
            updatedAt: now,
          });

          return;
        }

        if (bg === null) {
          await db.spaceBackgrounds.delete(activeSpaceId);

          set({ customBg: null });
          const updated = get().spaces.map((s: any) => s.id === activeSpaceId ? { ...s, customBg: null } : s);
          set({ spaces: updated });
          await db.spaces.update(activeSpaceId, { customBg: null, updatedAt: Date.now() });
          return;
        }

        if (bg.startsWith('http')) {
          set({ customBgLoading: true });

          try {
            const res = await fetch(bg);
            const blob = await res.blob();
            const blobUrl = URL.createObjectURL(blob);
            const now = Date.now();

            await db.spaceBackgrounds.put({
              id: activeSpaceId,
              spaceId: activeSpaceId,
              blob,
              name: 'background',
              type: blob.type,
              userId: currentUserId,
              updatedAt: now
            });

            set({ customBg: blobUrl, customBgLoading: false });
            const updated = get().spaces.map((s: any) => s.id === activeSpaceId ? { ...s, customBg: blobUrl } : s);
            set({ spaces: updated });
            await db.spaces.update(activeSpaceId, { customBg: blobUrl, updatedAt: now });
          } catch (err) {
            console.error('[BG] Failed to download background:', err);
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
    setAiChatMode: (mode: 'chat' | 'action') => set({ aiChatMode: mode }),
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
    setDirectorySearchQuery: (query: string) => set({ directorySearchQuery: query }),
    setDirectoryGroupBy: (groupBy: 'stack' | 'status' | 'date' | 'priority' | 'type') => set({ directoryGroupBy: groupBy }),
    setDirectorySortBy: (sortBy: 'order' | 'alpha' | 'alpha-reverse' | 'date-newest' | 'date-oldest') => set({ directorySortBy: sortBy }),
    setDirectoryCollapsedGroups: (groups: Set<string>) => set({ directoryCollapsedGroups: groups }),
    toggleDirectoryGroupCollapse: (groupId: string) => set((state) => {
      const next = new Set(state.directoryCollapsedGroups);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return { directoryCollapsedGroups: next };
    }),
    setDirectorySelectedThoughtId: (id: string | null) => set({ directorySelectedThoughtId: id }),

    setShowArchived: (show: boolean) => set({ showArchived: show }),
    setLinkingSourceId: (id: string | null) => set({ linkingSourceId: id }),
    setInspectorOpen: (open: boolean) => set({ isInspectorOpen: open }),

    setCustomBgValue: (bg: string | null) => set({ customBg: bg }),
  };
};
