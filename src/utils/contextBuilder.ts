import type { Thought, Space, Stack } from '../db';

export const serializeWorkspace = (activeSpaceId: string | null, thoughts: Thought[], spaces: Space[], stacks: Stack[]) => {
  const activeSpace = spaces.find(s => s.id === activeSpaceId);
  
  if (!activeSpace) return "No active space selected.";

  // Map stacks for quick lookup
  const stackMap = new Map(stacks.map(s => [s.id, s.name]));

  // Simplify thoughts for token efficiency
  const simplifiedThoughts = thoughts.map(t => ({
    id: t.id,
    text: t.text,
    description: t.description,
    type: t.type,
    position: { x: Math.round(t.x), y: Math.round(t.y) },
    order: t.order,
    content: t.content?.substring(0, 500), // Slightly reduced to save tokens
    stack: t.stackId ? { id: t.stackId, name: stackMap.get(t.stackId) || "Unnamed Stack" } : null,
    status: t.status,
    priority: t.priority,
    date: t.date,
    hasImage: !!t.image,
    hasDrawing: !!t.drawing
  }));

  const context = {
    currentTime: {
      date: new Date().toLocaleDateString('en-CA'),
      full: new Date().toLocaleString(),
      day: new Date().toLocaleDateString('en-US', { weekday: 'long' })
    },
    currentSpace: {
      id: activeSpace.id,
      name: activeSpace.name,
      mode: activeSpace.mode
    },
    stacks: stacks.map(s => ({ id: s.id, name: s.name })),
    thoughts: simplifiedThoughts
  };

  return JSON.stringify(context, null, 2);
};
