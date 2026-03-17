import { type StateCreator } from 'zustand';
import { db } from '../../db';
import { syncOrchestrator } from '../../services/sync/syncOrchestrator';
import { useModalStore } from '../useModalStore';
import { type CyberiaState } from '../types';

// Generation counter and abort controller to prevent concurrent setCustomBg races
let bgOperationId = 0;
let activeAbortController: AbortController | null = null;

const revokeCurrentBg = (bg: string | null) => {
  if (bg && bg.startsWith('blob:')) {
    URL.revokeObjectURL(bg);
  }
};

const processSourceToBlob = async (source: File | string | null, abortSignal: AbortSignal): Promise<string | null> => {
  if (source === null) return null;
  if (source instanceof File) {
    return URL.createObjectURL(source);
  }
  
  const res = await fetch(source, { signal: abortSignal });
  const blob = await res.blob();
  return URL.createObjectURL(blob);
};

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

    // 2. Revoke previous background if it's a blob
    revokeCurrentBg(customBg);

    // 3. Process new background
    try {
      const blobUrl = await processSourceToBlob(bg, controller.signal);
      
      if (isStale()) {
        if (blobUrl) URL.revokeObjectURL(blobUrl);
        return;
      }

      set({ customBg: blobUrl });
      const updated = get().spaces.map((s: any) => s.id === activeSpaceId ? { ...s, customBg: blobUrl } : s);
      set({ spaces: updated });
      await db.spaces.update(activeSpaceId, { customBg: blobUrl, updatedAt: Date.now(), syncStatus: 'local' as const });
      
      const { useAuthStore } = await import('../useAuthStore');
      if (!isStale() && useAuthStore.getState().status === 'authenticated') await syncOrchestrator.triggerSync();
    } catch (e: any) {
      if (e.name === 'AbortError') return;
      console.error('[BG] Failed to process background:', e);
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
