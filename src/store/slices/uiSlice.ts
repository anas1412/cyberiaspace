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
      // If it's a File, upload to Supabase Storage FIRST, then store the storage URL
      if (bg instanceof File) {
        const { useAuthStore } = await import('../useAuthStore');
        const authStore = useAuthStore.getState();
        
        if (authStore.status !== 'authenticated' || !authStore.user) {
          console.warn('[BG] Cannot upload background: not authenticated');
          return;
        }

        const userId = authStore.user.id;
        const { supabaseStorage } = await import('../../services/supabaseStorage');
        
        // Upload to Supabase Storage and get the permanent URL
        console.log('[BG] Uploading background to storage...');
        const { url } = await supabaseStorage.uploadSpaceBackground(userId, activeSpaceId, bg, bg.type);
        
        if (isStale()) return;
        
        // Store the storage URL (not blob URL)
        set({ customBg: url });
        const updated = get().spaces.map((s: any) => s.id === activeSpaceId ? { ...s, customBg: url } : s);
        set({ spaces: updated });
        // Verify space belongs to current user
        const currentUserId = authStore.user.id;
        const space = await db.spaces.filter(s => s.id === activeSpaceId && s.userId === currentUserId).first();
        if (!space) {
          console.warn('[BG] Space not found or access denied:', activeSpaceId);
          return;
        }

        await db.spaces.update(activeSpaceId, { customBg: url, updatedAt: Date.now(), syncStatus: 'local' as const });
        
        if (!isStale()) await syncOrchestrator.triggerSync();
        console.log('[BG] Background uploaded and saved:', url);
        return;
      }
      
      // If it's a string (URL or null), use it directly
      const blobUrl = bg; // Could be null or an existing URL
      
      if (isStale()) return;

      // Verify space belongs to current user
      const { useAuthStore: verifyAuthStore } = await import('../useAuthStore');
      const verifyUserId = verifyAuthStore.getState().user?.id ?? 'guest';
      const verifySpace = await db.spaces.filter(s => s.id === activeSpaceId && s.userId === verifyUserId).first();
      if (!verifySpace) {
        console.warn('[BG] Space not found or access denied:', activeSpaceId);
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
