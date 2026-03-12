import type { Thought, Space, Stack } from '../db';

const getRelativeTime = (timestamp: number | null | undefined) => {
  if (!timestamp) return undefined;
  const now = Date.now();
  const diff = now - timestamp;
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(timestamp).toLocaleDateString();
};

export const serializeWorkspace = (
  activeSpaceId: string | null, 
  thoughts: Thought[], 
  spaces: Space[], 
  stacks: Stack[],
  selectedThoughtIds: string[] = [],
  user?: any // Pass user for usage context
) => {
  const activeSpace = spaces.find(s => s.id === activeSpaceId);
  
  if (!activeSpace) return "No active space selected.";

  // Map stacks for quick lookup
  const stackMap = new Map(stacks.map(s => [s.id, s.name]));

  // Simplify thoughts for token efficiency - SKELETON STRATEGY
  const simplifiedThoughts = thoughts.map(t => {
    const isSelected = selectedThoughtIds.includes(t.id);
    const fileMeta = t.meta?.file || {};
    const data = t.data;
    
    return {
      id: t.id,
      text: t.text,
      description: t.description !== t.text ? t.description?.substring(0, 100) : undefined,
      type: t.type,
      status: t.status !== 'none' ? t.status : undefined,
      priority: t.priority !== 'none' ? t.priority : undefined,
      date: t.date || undefined,
      updatedAt: getRelativeTime(t.updatedAt),
      stack: t.stackId ? stackMap.get(t.stackId) || "New Collection" : undefined,
      isSelected: isSelected || undefined,
      syncStatus: t.syncStatus,
      // Metadata indicators - tell AI that data exists without sending it all
      hasContent: !!(data?.type === 'text' ? data.content : (t as any).content)?.trim(),
      hasTasks: (data?.type === 'tasks' ? !!data.tasks?.length : ((t as any).type === 'tasks' && !!(t as any).tasks?.length)),
      hasTable: (data?.type === 'table' ? !!data.rows?.length : ((t as any).type === 'table' && !!(t as any).table?.length)),
      hasImage: !!(data?.type === 'file' ? data.url : (t as any).image),
      hasDrawing: !!(data?.type === 'paint' ? data.drawing : (t as any).drawing),
      fileInfo: t.type === 'file' ? {
        extension: fileMeta.type?.split('/')[1] || t.text?.split('.').pop(),
        size: fileMeta.size ? `${(fileMeta.size / (1024 * 1024)).toFixed(2)}MB` : undefined,
        isCloudSynced: !!t.storageUrl
      } : undefined,
    };
  });

  const context = {
    currentTime: {
      date: new Date().toLocaleDateString('en-CA'),
      full: new Date().toLocaleString(),
      day: new Date().toLocaleDateString('en-US', { weekday: 'long' })
    },
    userQuota: user ? {
      plan: user.plan,
      aiDailyUsed: user.usage?.ai_daily_count,
      syncThoughtsUsed: user.usage?.sync_thoughts
    } : undefined,
    currentSpace: {
      id: activeSpace.id,
      name: activeSpace.name,
      mode: activeSpace.mode,
      physics: activeSpace.physics
    },
    stacks: stacks.map(s => ({ id: s.id, name: s.name, color: s.color })),
    thoughts: simplifiedThoughts
  };

  return JSON.stringify(context, null, 2);
};
