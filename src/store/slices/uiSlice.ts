import { type StateCreator } from 'zustand';
import { db } from '../../db';
import { syncOrchestrator } from '../../services/sync/syncOrchestrator';
import { useModalStore } from '../useModalStore';
import { type CyberiaState } from '../types';

export const createUiSlice: StateCreator<CyberiaState, [], [], any> = (set, get, _api) => ({
  theme: (localStorage.getItem('cyberia-theme') as any) || 'cyberia',
  customBg: null,
  oracleMode: false,
  oracleChatMode: 'chat',
  isChatOpen: false,
  isInspectorOpen: false,
  deferredPrompt: null,
  calendarViewDate: new Date(),
  hoveredCalDate: null,
  calendarSearchQuery: '',
  calendarStackFilter: null,
  kanbanSearchQuery: '',
  kanbanStackFilter: null,
  linkingSourceId: null,
  layerActionTrigger: null,

  setTheme: async (theme: 'cyberia' | 'sea' | 'forest' | 'rain') => {
    if (get().isReadOnly) return;
    const { activeSpaceId } = get();
    set({ theme });
    localStorage.setItem('cyberia-theme', theme);
    document.body.setAttribute('data-theme', theme);
    if (activeSpaceId && !get().isReadOnly) get().updateSpace(activeSpaceId, { theme });
    
    const { useAuthStore } = await import('../useAuthStore');
    const authStore = useAuthStore.getState();
    if (authStore.status === 'authenticated') authStore.updateSettings({ theme } as any);
  },

  setCustomBg: async (bg: string | null) => {
    const { activeSpaceId, isReadOnly, spaces } = get();
    if (isReadOnly || !activeSpaceId) return;
    set({ customBg: bg });
    const updatedSpaces = spaces.map((s: any) => s.id === activeSpaceId ? { ...s, customBg: bg } : s);
    set({ spaces: updatedSpaces });
    await db.spaces.update(activeSpaceId, { customBg: bg });
    
    const { useAuthStore } = await import('../useAuthStore');
    const authStore = useAuthStore.getState();
    if (authStore.status === 'authenticated') {
      await syncOrchestrator.triggerSync();
    }
  },

  setDeferredPrompt: (prompt: any) => set({ deferredPrompt: prompt }),

  toggleOracleMode: async () => {
    const { useAuthStore } = await import('../useAuthStore');
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

  setChatOpen: (isOpen: boolean) => set({ isChatOpen: isOpen }),
  setOracleChatMode: (mode: 'chat' | 'action') => set({ oracleChatMode: mode }),
  setCalendarViewDate: (date: Date) => set({ calendarViewDate: date }),
  setHoveredCalDate: (date: string | null) => set({ hoveredCalDate: date }),
  setCalendarSearchQuery: (query: string) => set({ calendarSearchQuery: query }),
  setCalendarStackFilter: (stackId: string | null) => set({ calendarStackFilter: stackId }),
  setKanbanSearchQuery: (query: string) => set({ kanbanSearchQuery: query }),
  setKanbanStackFilter: (stackId: string | null) => set({ kanbanStackFilter: stackId }),
  setLinkingSourceId: (id: string | null) => set({ linkingSourceId: id }),
  setInspectorOpen: (open: boolean) => set({ isInspectorOpen: open }),
});
