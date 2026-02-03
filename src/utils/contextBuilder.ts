import type { Thought, Space } from '../db';

export const serializeWorkspace = (activeSpaceId: string | null, thoughts: Thought[], spaces: Space[]) => {
  const activeSpace = spaces.find(s => s.id === activeSpaceId);
  
  if (!activeSpace) return "No active space selected.";

  // Simplify thoughts for token efficiency (though Gemini 1.5 is generous)
  // We remove the full base64 images from the text context since we use Vision for that.
  const simplifiedThoughts = thoughts.map(t => ({
    id: t.id,
    spaceId: t.spaceId,
    text: t.text,
    description: t.description,
    type: t.type,
    position: { x: Math.round(t.x), y: Math.round(t.y) },
    order: t.order,
    content: t.content?.substring(0, 1000), // Increased limit for better context
    tags: t.tags,
    status: t.status,
    priority: t.priority,
    date: t.date,
    tasks: t.tasks,
    table: t.table,
    // Base64 signals
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
      mode: activeSpace.mode,
      physics: activeSpace.physics,
      order: activeSpace.order
    },
    thoughts: simplifiedThoughts
  };

  return JSON.stringify(context, null, 2);
};
