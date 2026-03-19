import { type StateCreator } from 'zustand';
import { db, type Space } from '../../db';
import { useAuthStore } from '../useAuthStore';
import { useModalStore } from '../useModalStore';
import { syncOrchestrator } from '../../services/sync/syncOrchestrator';
import { type CyberiaState } from '../types';
import { PLAN_CONFIG } from '../../constants';
import { ulid } from 'ulid';

export const createSpaceSlice: StateCreator<CyberiaState, [], [], any> = (set, get, _api) => ({
  activeSpaceId: null,
  spaces: [],
  isSpaceLoading: typeof window !== 'undefined' ? (window.location.hostname !== 'cyberia.tn' && window.location.hostname !== 'www.cyberia.tn') : true,
  isReadOnly: false,
  creatorName: null,
  lastUpdated: null,

  setActiveSpace: async (id: string) => {
    const requestId = Date.now();
    try {
      localStorage.setItem('cyberia-active-space-id', id);
      const space = get().spaces.find((s: Space) => s.id === id);
      
      // Set loading state and clear current thoughts/stacks
      set({ 
        activeSpaceId: id, 
        thoughts: [], 
        stacks: [], 
        isSpaceLoading: true, 
        lastSpaceRequestId: requestId,
        history: [], 
        historyIndex: -1, 
        layerActionTrigger: null 
      });

      if (space) {
        const transform = space.mode === 'spatial' 
          ? { x: space.transformX ?? 0, y: space.transformY ?? 0, scale: space.transformScale ?? 1 } 
          : { x: 0, y: 0, scale: 1 };
        
        set({ transform } as Partial<CyberiaState>);
        
        if (space.theme) { 
          // Enforce theme per user plan
          const { useAuthStore: authImport } = await import('../useAuthStore');
          const authStore = authImport.getState();
          const userPlan = authStore.user?.plan || 'free';
          const allowedThemes = PLAN_CONFIG[userPlan]?.THEMES_ENABLED || PLAN_CONFIG.free.THEMES_ENABLED;
          const enforcedTheme = allowedThemes.includes(space.theme) ? space.theme : 'cyberia';
          
          set({ theme: enforcedTheme });
          document.body.setAttribute('data-theme', enforcedTheme);
          
          // If theme was invalid, update the space
          if (enforcedTheme !== space.theme) {
            await get().updateSpace(id, { theme: enforcedTheme }, { skipSync: false });
          }
        }
        set({ customBg: space.customBg || null });

        // Opportunistic migration: convert Base64 backgrounds to storage URLs
        if (space.customBg && space.customBg.startsWith('data:')) {
          const authStore = useAuthStore.getState();
          if (authStore.status === 'authenticated' && authStore.user) {
            const spaceId = space.id;
            const userId = authStore.user.id;
            const capturedBase64 = space.customBg; // Capture for compare-and-swap
            (async () => {
              try {
                console.log('[BG] Migrating Base64 background for space:', spaceId);
                const response = await fetch(capturedBase64);
                const blob = await response.blob();
                const { supabaseStorage } = await import('../../services/supabaseStorage');
                const { url } = await supabaseStorage.uploadSpaceBackground(userId, spaceId, blob, blob.type);

                // Compare-and-swap: only write if background hasn't changed during upload
                const currentSpace = await db.spaces.get(spaceId);
                if (!currentSpace || currentSpace.customBg !== capturedBase64) {
                  console.log('[BG] Migration aborted: background changed during migration');
                  // Clean up the just-uploaded file since we won't use it
                  supabaseStorage.deleteSpaceBackground(userId, spaceId).catch(() => {});
                  return;
                }

                await db.spaces.update(spaceId, { customBg: url, updatedAt: Date.now(), syncStatus: 'local' as const });
                // Always update spaces array so re-entry doesn't re-migrate
                const migSpaces = get().spaces.map((ms: any) => ms.id === spaceId ? { ...ms, customBg: url } : ms);
                set({ spaces: migSpaces });
                // Only update active UI customBg if still viewing this space
                if (get().activeSpaceId === spaceId) {
                  set({ customBg: url });
                }
                await syncOrchestrator.triggerSync();
                console.log('[BG] Migration complete for space:', spaceId);
              } catch (e) {
                console.warn('[BG] Base64 migration failed, keeping current value:', e);
              }
            })();
          }
        }
      }

      // Load data for the new space
      await Promise.all([
        get().refreshThoughts(id),
        get().refreshStacks(id)
      ]);
    } catch (err) {
      console.error('Failed to set active space:', err);
    } finally {
      // Data loaded (or failed), stop loading state ONLY if this is the latest request
      if (get().lastSpaceRequestId === requestId) {
        set({ isSpaceLoading: false });
      }
    }
  },

  refreshSpaces: async () => {
    // Robust fetching: Query only current user's non-deleted spaces with Dexie filter
    const currentUserId = useAuthStore.getState().user?.id ?? 'guest';
    const activeSpaces = await db.spaces
      .filter((s: any) => !s.deletedAt && s.userId === currentUserId)
      .toArray();
    activeSpaces.sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
    
    set({ spaces: activeSpaces });
  },

  addSpace: async (name: string) => {
    if (get().isReadOnly) return;
    
    // Get user's spaces from DB filtered by current user (not in-memory)
    const currentUserId = useAuthStore.getState().user?.id ?? 'guest';
    const userSpaces = await db.spaces.filter((s: any) => s.userId === currentUserId && !s.deletedAt).toArray();
    
    const limits = get().getLimits();
    if (userSpaces.length >= limits.MAX_SPACES) {
      useModalStore.getState().openModal({ 
        title: 'Space Limit Reached', 
        description: `You've reached the free limit of ${limits.MAX_SPACES} spaces. Upgrade to Cyberia Pro to create more workspaces and unlock premium features.`, 
        type: 'limit_space', 
        confirmText: 'Upgrade to Pro', 
        onConfirm: () => useModalStore.getState().openPricing() 
      });
      return;
    }
    const id = ulid();
    await db.spaces.add({ 
      id, 
      userId: currentUserId,
      name, 
      mode: 'spatial', 
      physics: true, 
      order: userSpaces.length,
      updatedAt: Date.now(),
      syncStatus: 'local'
    });
    await get().refreshSpaces();
    await get().setActiveSpace(id);
    
    const authStore = useAuthStore.getState();
    if (authStore.status === 'authenticated') {
      await syncOrchestrator.triggerSync();
    }
  },

  updateSpace: async (id: string, updates: Partial<Space>, options?: { skipSync?: boolean }) => {
    const { spaces } = get();
    const index = spaces.findIndex((s: Space) => s.id === id);
    if (index !== -1) {
      const newSpaces = [...spaces];
      newSpaces[index] = { ...newSpaces[index], ...updates };
      set({ spaces: newSpaces });
    }
    if (get().isReadOnly) return;
    
    const finalUpdates = {
      ...updates,
      updatedAt: Date.now(),
      syncStatus: 'local' as const
    };
    
    await db.spaces.update(id, finalUpdates);
    await get().refreshSpaces();
    
    const authStore = useAuthStore.getState();
    if (authStore.status === 'authenticated' && !options?.skipSync) {
      await syncOrchestrator.triggerSync();
    }
  },

  deleteSpace: async (id: string) => {
    if (get().isReadOnly) return;
    const { spaces, activeSpaceId } = get();
    
    // Prevent deleting the last space
    const remainingSpaces = spaces.filter(s => s.id !== id && !s.deletedAt);
    if (remainingSpaces.length === 0) {
      useModalStore.getState().openModal({
        title: 'Core Workspace Required',
        description: 'You must have at least one active workspace. Create a new one before removing this dimension.',
        type: 'alert',
        confirmText: 'Acknowledged'
      });
      return;
    }

    const space = spaces.find((s: Space) => s.id === id);
    if (!space) return;
    
    if (space.publishedId) {
      try { await get().unpublishSpace(id); } catch (err) { console.warn('Unpublish failed', err); }
    }
    
    const authStore = useAuthStore.getState();
    
    // SOFT DELETE: Mark everything as deleted
    const now = Date.now();
    try {
      await db.transaction('rw', [db.spaces, db.thoughts, db.stacks], async () => {
        await db.spaces.update(id, { 
          deletedAt: now, 
          updatedAt: now, 
          syncStatus: 'local' 
        });
        
        await db.thoughts.where('spaceId').equals(id).modify({ 
          deletedAt: now, 
          updatedAt: now, 
          syncStatus: 'local' 
        });
        
        await db.stacks.where('spaceId').equals(id).modify({ 
          deletedAt: now, 
          updatedAt: now, 
          syncStatus: 'local' 
        });
      });

      // Update store immediately to reflect disappearance in UI
      await get().refreshSpaces();
      
      // Switch to another space if we deleted the active one
      const freshSpaces = get().spaces;
      if (id === activeSpaceId && freshSpaces.length > 0) {
        await get().setActiveSpace(freshSpaces[Math.max(0, freshSpaces.length - 1)].id);
      }

      if (authStore.status === 'authenticated') {
        await syncOrchestrator.triggerSync(true);
      }
    } catch (err) {
      console.error('[Space] Deletion failed:', err);
    }
  },

  reorderSpaces: async (newSpaces: Space[]) => {
    if (get().isReadOnly) return;
    const now = Date.now();
    await Promise.all(newSpaces.map((s, i) => db.spaces.update(s.id, { 
      order: i, 
      updatedAt: now, 
      syncStatus: 'local' 
    })));
    await get().refreshSpaces();
    
    const authStore = useAuthStore.getState();
    if (authStore.status === 'authenticated') {
      await syncOrchestrator.triggerSync();
    }
  },

  saveSpaceTransform: async (id: string, transform: { x: number; y: number; scale: number }) => {
    const { spaces } = get();
    const space = spaces.find((s: Space) => s.id === id);
    if (!space || space.mode !== 'spatial') return;
    
    const now = Date.now();
    await db.spaces.update(id, { 
      transformX: transform.x, 
      transformY: transform.y, 
      transformScale: transform.scale,
      updatedAt: now,
      syncStatus: 'local'
    });
    
    const index = spaces.findIndex((s: Space) => s.id === id);
    if (index !== -1) {
      const newSpaces = [...spaces];
      newSpaces[index] = { 
        ...newSpaces[index], 
        transformX: transform.x, 
        transformY: transform.y, 
        transformScale: transform.scale 
      };
      set({ spaces: newSpaces });
    }
    
    const authStore = useAuthStore.getState();
    if (authStore.status === 'authenticated') {
      await syncOrchestrator.triggerSync();
    }
  },

  publishSpace: async (spaceId: string) => {
    const { spaces, thoughts, stacks } = get();
    const space = spaces.find((s: Space) => s.id === spaceId);
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
      const spaceThoughts = thoughts.filter((t: any) => t.spaceId === spaceId);
      const spaceStacks = stacks.filter((s: any) => s.spaceId === spaceId);
      const currentTheme = get().theme;
      const currentCustomBg = get().customBg;

      const res = await fetch('/api/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authStore.accessToken}`
        },
        body: JSON.stringify({
          space: { ...space, theme: currentTheme, customBg: currentCustomBg },
          thoughts: spaceThoughts,
          stacks: spaceStacks,
          publishedId: space.publishedId,
          creatorName
        })
      });

      if (!res.ok) throw new Error('Publish failed');
      const data = await res.json();

      const now = Date.now();
      await get().updateSpace(spaceId, {
        publishedId: data.publishedId,
        lastPublished: new Date().toISOString(),
        updatedAt: now
      });

      return data.publishedId;
    } catch (err) {
      console.error('Publish error:', err);
      throw err;
    }
  },

  unpublishSpace: async (spaceId: string) => {
    const { spaces } = get();
    const space = spaces.find((s: Space) => s.id === spaceId);
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

  importFullState: async (data: any, merge: boolean = false) => {
    try {
      const authStore = useAuthStore.getState();
      const currentUserId = authStore.user?.id ?? 'guest';

      console.log(`[Store] ${merge ? 'Merging' : 'Importing'} full state from cloud for user: ${currentUserId}`);
      
      // CRITICAL: Preserve local tombstones (deleted items that haven't synced yet)
      // This ensures offline deletions persist through login/logout cycles
      const localDeletedSpaces = await db.spaces.filter((s: any) => Boolean(s.deletedAt) && s.userId === currentUserId).toArray();
      const localDeletedThoughts = await db.thoughts.filter((t: any) => Boolean(t.deletedAt) && t.userId === currentUserId).toArray();
      const localDeletedStacks = await db.stacks.filter((s: any) => Boolean(s.deletedAt) && s.userId === currentUserId).toArray();
      
      console.log(`[Store] Preserving ${localDeletedSpaces.length} space, ${localDeletedThoughts.length} thought, ${localDeletedStacks.length} stack tombstones`);
      
      await db.transaction('rw', [db.spaces, db.thoughts, db.stacks], async () => {
        if (data.spaces && data.spaces.length > 0) {
          if (!merge) {
            // Only clear spaces belonging to the current user (non-deleted only)
            await db.spaces.where('userId').equals(currentUserId).filter((s: any) => !Boolean(s.deletedAt)).delete();
          }
          // Ensure incoming spaces have the correct userId
          const spacesToPut = data.spaces.map((s: any) => ({ ...s, userId: currentUserId }));
          await db.spaces.bulkPut(spacesToPut);
        }
        if (data.thoughts && data.thoughts.length > 0) {
          if (!merge) {
            await db.thoughts.where('userId').equals(currentUserId).filter((t: any) => !Boolean(t.deletedAt)).delete();
          }
          const thoughtsToPut = data.thoughts.map((t: any) => ({ ...t, userId: currentUserId }));
          await db.thoughts.bulkPut(thoughtsToPut);
        }
        if (data.stacks && data.stacks.length > 0) {
          if (!merge) {
            await db.stacks.where('userId').equals(currentUserId).filter((s: any) => !Boolean(s.deletedAt)).delete();
          }
          const stacksToPut = data.stacks.map((s: any) => ({ ...s, userId: currentUserId }));
          await db.stacks.bulkPut(stacksToPut);
        }
        
        // Restore preserved tombstones (these will be synced to cloud)
        if (localDeletedSpaces.length > 0) {
          await db.spaces.bulkPut(localDeletedSpaces);
        }
        if (localDeletedThoughts.length > 0) {
          await db.thoughts.bulkPut(localDeletedThoughts);
        }
        if (localDeletedStacks.length > 0) {
          await db.stacks.bulkPut(localDeletedStacks);
        }
      });

      if (data.activeSpaceId) {
        localStorage.setItem('cyberia-active-space-id', data.activeSpaceId);
      }
      
      await get().refreshSpaces();
      await get().refreshTotalThoughtCount();
      await get().cleanupTrash();
      
      const { spaces, activeSpaceId } = get();
      if (spaces.length > 0) {
        const targetId = activeSpaceId || data.activeSpaceId || spaces[0].id;
        await get().setActiveSpace(targetId);
      }
      
      console.log('[Store] Full state import complete.');
    } catch (err) {
      console.error('Full state import failed', err);
    }
  },

  mergeGuestSpace: async (sourceSpaceId: string, targetSpaceId: string) => {
    try {
      // Security: Verify both spaces belong to current user
      const authStore = useAuthStore.getState();
      const currentUserId = authStore.user?.id ?? 'guest';
      
      const sourceSpace = await db.spaces.get(sourceSpaceId);
      const targetSpace = await db.spaces.get(targetSpaceId);
      
      if (!sourceSpace || !targetSpace) {
        console.error('[Space] Merge failed: Space not found');
        return false;
      }
      
      if (sourceSpace.userId !== currentUserId || targetSpace.userId !== currentUserId) {
        console.error('[Space] Merge failed: Unauthorized - spaces do not belong to current user');
        return false;
      }

      const sourceThoughts = await db.thoughts.where('spaceId').equals(sourceSpaceId).and(t => !t.deletedAt).toArray();
      const targetThoughtsCount = await db.thoughts.where('spaceId').equals(targetSpaceId).and(t => !t.deletedAt).count();
      
      const limits = get().getLimits();
      if (sourceThoughts.length + targetThoughtsCount > limits.MAX_THOUGHTS_PER_SPACE) {
        useModalStore.getState().openModal({
          title: 'Thought Limit Reached',
          description: `Merging would result in ${sourceThoughts.length + targetThoughtsCount} thoughts, which exceeds the ${limits.MAX_THOUGHTS_PER_SPACE} limit for this space.`,
          type: 'alert',
          confirmText: 'Acknowledged'
        });
        return false;
      }

      await db.transaction('rw', [db.thoughts, db.stacks, db.spaces], async () => {
        const timestamp = Date.now();
        // Move thoughts
        await db.thoughts.where('spaceId').equals(sourceSpaceId).modify({ 
          spaceId: targetSpaceId,
          syncStatus: 'local',
          updatedAt: timestamp
        });
        // Move stacks
        await db.stacks.where('spaceId').equals(sourceSpaceId).modify({ 
          spaceId: targetSpaceId,
          syncStatus: 'local',
          updatedAt: timestamp
        });
        // SOFT DELETE source space to ensure cloud removal
        await db.spaces.update(sourceSpaceId, {
          deletedAt: timestamp,
          updatedAt: timestamp,
          syncStatus: 'local'
        });
      });

      await get().refreshSpaces();
      await get().refreshThoughts(targetSpaceId);
      await get().refreshStacks(targetSpaceId);
      
      if (authStore.status === 'authenticated') {
        syncOrchestrator.triggerSync(true);
      }
      return true;
    } catch (err) {
      console.error('[Space] Merge failed:', err);
      return false;
    }
  },

  replaceCloudSpace: async (sourceSpaceId: string, targetSpaceIdToReplace: string) => {
    try {
      const authStore = useAuthStore.getState();
      if (authStore.status !== 'authenticated') return false;

      // Security: Verify both spaces belong to current user
      const currentUserId = authStore.user?.id ?? 'guest';
      const sourceSpace = await db.spaces.get(sourceSpaceId);
      const targetSpace = await db.spaces.get(targetSpaceIdToReplace);
      
      if (!sourceSpace || !targetSpace) {
        console.error('[Space] Replace failed: Space not found');
        return false;
      }
      
      if (sourceSpace.userId !== currentUserId || targetSpace.userId !== currentUserId) {
        console.error('[Space] Replace failed: Unauthorized - spaces do not belong to current user');
        return false;
      }

      // Check Global Cloud Thought Limit
      const sourceThoughtsCount = await db.thoughts.where('spaceId').equals(sourceSpaceId).and(t => !t.deletedAt).count();
      const targetThoughtsCount = await db.thoughts.where('spaceId').equals(targetSpaceIdToReplace).and(t => !t.deletedAt).count();
      const currentCloudThoughts = authStore.user?.usage?.sync_thoughts || 0;
      
      const limits = get().getLimits();
      // Total will be: CurrentCloud - OldSpaceThoughts + NewSpaceThoughts
      if (currentCloudThoughts - targetThoughtsCount + sourceThoughtsCount > limits.MAX_CLOUD_THOUGHTS) {
        useModalStore.getState().openModal({
          title: 'Account Limit Reached',
          description: `Replacing this space would put you at ${currentCloudThoughts - targetThoughtsCount + sourceThoughtsCount} total thoughts, exceeding your ${authStore.user?.plan} account limit of ${limits.MAX_CLOUD_THOUGHTS}.`,
          type: 'alert',
          confirmText: 'Acknowledged'
        });
        return false;
      }

      await get().deleteSpace(targetSpaceIdToReplace);
      
      // Mark source space as synced (will be pushed on next sync)
      await db.spaces.update(sourceSpaceId, { 
        syncStatus: 'local',
        updatedAt: Date.now()
      });

      await syncOrchestrator.triggerSync(true);
      return true;
    } catch (err) {
      console.error('[Space] Replace failed:', err);
      return false;
    }
  },

  discardGuestSpace: async (id: string) => {
    try {
      // Security: Verify space belongs to current user
      const authStore = useAuthStore.getState();
      const currentUserId = authStore.user?.id ?? 'guest';
      
      const space = await db.spaces.get(id);
      
      if (!space) {
        console.error('[Space] Discard failed: Space not found');
        return false;
      }
      
      if (space.userId !== currentUserId) {
        console.error('[Space] Discard failed: Unauthorized - space does not belong to current user');
        return false;
      }

      const timestamp = Date.now();
      await db.transaction('rw', [db.spaces, db.thoughts, db.stacks], async () => {
        // SOFT DELETE: Create synchronized tombstones
        await db.spaces.update(id, { 
          deletedAt: timestamp, 
          updatedAt: timestamp, 
          syncStatus: 'local' 
        });
        
        await db.thoughts.where('spaceId').equals(id).modify({ 
          deletedAt: timestamp, 
          updatedAt: timestamp, 
          syncStatus: 'local' 
        });
        
        await db.stacks.where('spaceId').equals(id).modify({ 
          deletedAt: timestamp, 
          updatedAt: timestamp, 
          syncStatus: 'local' 
        });
      });

      await get().refreshSpaces();
      
      if (authStore.status === 'authenticated') {
        syncOrchestrator.triggerSync(true);
      }
      return true;
    } catch (err) {
      console.error('[Space] Discard failed:', err);
      return false;
    }
  }
});
