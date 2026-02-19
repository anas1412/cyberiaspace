import type { Thought, Space, Stack } from '../db';

export const serializeWorkspace = (
  activeSpaceId: string | null, 
  thoughts: Thought[], 
  spaces: Space[], 
  stacks: Stack[],
  selectedThoughtIds: number[] = [],
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
    
    return {
      id: t.id,
      text: t.text,
      description: t.description !== t.text ? t.description?.substring(0, 100) : undefined,
      type: t.type,
      status: t.status !== 'none' ? t.status : undefined,
      priority: t.priority !== 'none' ? t.priority : undefined,
      date: t.date || undefined,
      stack: t.stackId ? stackMap.get(t.stackId) || "Unnamed Stack" : undefined,
      isSelected: isSelected || undefined,
      syncStatus: t.syncStatus,
      // Metadata indicators - tell AI that data exists without sending it all
      hasContent: !!t.content?.trim(),
      hasTasks: t.type === 'tasks' && !!t.tasks?.length,
      hasTable: t.type === 'table' && !!t.table?.length,
      hasImage: !!t.image,
      hasDrawing: !!t.drawing,
      fileInfo: t.type === 'file' || t.type === 'image' ? {
        extension: fileMeta.type?.split('/')[1] || t.text?.split('.').pop(),
        size: fileMeta.size ? `${(fileMeta.size / (1024 * 1024)).toFixed(2)}MB` : undefined,
        isCloudSynced: !!t.driveFileId
      } : undefined,
      // REMOVED: preview - moving to strict tool-based retrieval for token efficiency
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

