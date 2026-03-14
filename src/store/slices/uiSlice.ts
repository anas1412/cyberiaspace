import { type StateCreator } from 'zustand';
import { db } from '../../db';
import { syncOrchestrator } from '../../services/sync/syncOrchestrator';
import { useModalStore } from '../useModalStore';
import { type CyberiaState } from '../types';
import { supabaseStorage, isStorageUrl } from '../../services/supabaseStorage';

// Generation counter to prevent concurrent setCustomBg races
let bgOperationId = 0;

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
    const { activeSpaceId, isReadOnly } = get();
    if (isReadOnly || !activeSpaceId) return;

    // Increment generation counter — any prior in-flight operation becomes stale
    const operationId = ++bgOperationId;
    const isStale = () => bgOperationId !== operationId;

    const { useAuthStore } = await import('../useAuthStore');
    const authStore = useAuthStore.getState();
    const user = authStore.user;

    // 1. Clean up the old background file if it was a storage URL
    const currentSpace = get().spaces.find((s: any) => s.id === activeSpaceId);
    const oldBg = currentSpace?.customBg;

    if (oldBg && isStorageUrl(oldBg) && user) {
      supabaseStorage.deleteSpaceBackground(user.id, activeSpaceId)
        .catch((e: any) => console.warn('[BG] Old background cleanup failed:', e));
    }

    // Helper: apply a customBg value to store + DB (with stale check)
    const applyBg = async (value: string | null) => {
      if (isStale()) return; // Another setCustomBg call superseded this one
      if (get().activeSpaceId !== activeSpaceId) return; // User switched spaces
      set({ customBg: value });
      const updated = get().spaces.map((s: any) => s.id === activeSpaceId ? { ...s, customBg: value } : s);
      set({ spaces: updated });
      await db.spaces.update(activeSpaceId, { customBg: value, updatedAt: Date.now(), syncStatus: 'local' as const });
    };

    // 2a. If null, clear the background
    if (bg === null) {
      await applyBg(null);
      if (!isStale() && authStore.status === 'authenticated') await syncOrchestrator.triggerSync();
      return;
    }

    // 2b. If it's already a URL string (e.g. from sync), use it directly
    if (typeof bg === 'string') {
      await applyBg(bg);
      if (!isStale() && authStore.status === 'authenticated') await syncOrchestrator.triggerSync();
      return;
    }

    // 2c. It's a File object — local preview first, then upload
    const file = bg as File;

    // Instant local preview via object URL
    const localPreviewUrl = URL.createObjectURL(file);
    if (!isStale()) {
      set({ customBg: localPreviewUrl });
      const previewSpaces = get().spaces.map((s: any) => s.id === activeSpaceId ? { ...s, customBg: localPreviewUrl } : s);
      set({ spaces: previewSpaces });
    }

    // If not authenticated, store as Base64 for local-only use
    if (!user || authStore.status !== 'authenticated') {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target?.result as string);
        reader.readAsDataURL(file);
      });
      URL.revokeObjectURL(localPreviewUrl);
      await applyBg(base64);
      return;
    }

    // Upload to storage
    try {
      const { url } = await supabaseStorage.uploadSpaceBackground(user.id, activeSpaceId, file, file.type);
      URL.revokeObjectURL(localPreviewUrl);
      await applyBg(url);
      if (!isStale()) await syncOrchestrator.triggerSync();
    } catch (e) {
      console.error('[BG] Upload failed, falling back to Base64:', e);
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target?.result as string);
        reader.readAsDataURL(file);
      });
      URL.revokeObjectURL(localPreviewUrl);
      await applyBg(base64);
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
