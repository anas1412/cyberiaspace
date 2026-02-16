import type { Thought, Space, Stack } from '../db';

export const serializeWorkspace = (
  activeSpaceId: string | null, 
  thoughts: Thought[], 
  spaces: Space[], 
  stacks: Stack[],
  selectedThoughtIds: number[] = []
) => {
  const activeSpace = spaces.find(s => s.id === activeSpaceId);
  
  if (!activeSpace) return "No active space selected.";

  // Map stacks for quick lookup
  const stackMap = new Map(stacks.map(s => [s.id, s.name]));

  // Simplify thoughts for token efficiency
  const simplifiedThoughts = thoughts.map(t => {
    const isSelected = selectedThoughtIds.includes(t.id);
    
    return {
      id: t.id,
      text: t.text,
      placeholder: t.placeholder,
      description: t.description,
      type: t.type,
      order: t.order,
      layer: t.layer,
      size: t.size,
      // God-Like Hybrid Strategy: Full content for selected thoughts, 500 chars for others
      content: isSelected ? t.content : t.content?.substring(0, 500),
      isSelected: isSelected || undefined, // Explicitly tell AI what is selected
      author: t.author,
      stack: t.stackId ? { id: t.stackId, name: stackMap.get(t.stackId) || "Unnamed Stack" } : null,
      status: t.status,
      priority: t.priority,
      date: t.date,
      hasImage: !!t.image,
      hasDrawing: !!t.drawing,
      // Include structured data only if it exists/relevant
      ...(t.type === 'tasks' && t.tasks?.length ? { tasks: t.tasks } : {}),
      ...(t.type === 'table' && t.table?.length ? { table: t.table } : {})
    };
  });

  const context = {
    currentTime: {
      date: new Date().toLocaleDateString('en-CA'),
      full: new Date().toLocaleString(),
      day: new Date().toLocaleDateString('en-US', { weekday: 'long' })
    },
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
