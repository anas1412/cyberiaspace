import type { Thought, Space } from '../db';

export const serializeWorkspace = (activeSpaceId: string | null, thoughts: Thought[], spaces: Space[]) => {
  const activeSpace = spaces.find(s => s.id === activeSpaceId);
  
  if (!activeSpace) return "No active space selected.";

  // Simplify thoughts for token efficiency (though Gemini 1.5 is generous)
  // We remove the full base64 images from the text context since we use Vision for that.
  const simplifiedThoughts = thoughts.map(t => ({
    id: t.id,
    text: t.text,
    type: t.type,
    position: { x: Math.round(t.x), y: Math.round(t.y) },
    content: t.content?.substring(0, 500), // Truncate long content
    tags: t.tags,
    status: t.status,
    priority: t.priority,
    tasks: t.tasks,
    // We intentionally omit 'image' and 'drawing' base64 strings here
    hasImage: !!t.image,
    hasDrawing: !!t.drawing
  }));

  const context = {
    currentTime: {
      date: new Date().toLocaleDateString('en-CA'), // YYYY-MM-DD
      full: new Date().toLocaleString(),
      day: new Date().toLocaleDateString('en-US', { weekday: 'long' })
    },
    currentSpace: {
      name: activeSpace.name,
      mode: activeSpace.mode,
      physics: activeSpace.physics
    },
    thoughts: simplifiedThoughts
  };

  return JSON.stringify(context, null, 2);
};
