/**
 * Oracle Tool Executor
 * 
 * Handles the execution of client-side tool calls from the Oracle AI.
 */

const svgToDataUrl = (svg: string): string => {
  if (svg.startsWith('data:image/svg+xml')) return svg;
  
  // Basic validation/cleanup
  let cleanSvg = svg.trim();
  if (!cleanSvg.includes('xmlns="http://www.w3.org/2000/svg"')) {
    cleanSvg = cleanSvg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  
  // Ensure we have a viewbox if not present, or at least width/height
  if (!cleanSvg.includes('viewBox')) {
    cleanSvg = cleanSvg.replace('<svg', '<svg viewBox="0 0 1920 1080"');
  }

  const encoded = encodeURIComponent(cleanSvg)
    .replace(/'/g, '%27')
    .replace(/"/g, '%22');

  return `data:image/svg+xml;utf8,${encoded}`;
};

const processDrawing = (args: any) => {
  if (args.drawing && typeof args.drawing === 'string' && args.drawing.includes('<svg')) {
    args.drawing = svgToDataUrl(args.drawing);
  }
  return args;
};

export const executeOracleTool = async (toolCall: any, store: any) => {
  const { toolName, args } = toolCall;
  console.log(`[Oracle] Executing Tool: ${toolName}`, args);

  try {
    switch (toolName) {
      case 'create_thought': {
        const processedArgs = processDrawing({ ...args });
        const { stackName, ...thoughtArgs } = processedArgs;
        const x = typeof thoughtArgs.x !== 'undefined' ? Number(thoughtArgs.x) : window.innerWidth / 2;
        const y = typeof thoughtArgs.y !== 'undefined' ? Number(thoughtArgs.y) : window.innerHeight / 2;

        const id = await store.addThought({ ...thoughtArgs, x, y });
        if (id === -1) {
          return { success: false, error: 'Thought creation limit reached or invalid data' };
        } else {
          if (stackName) await store.createStack(stackName, id);
          return { success: true, id };
        }
      }

      case 'create_thoughts': {
        const { items } = args;
        if (!items || !Array.isArray(items)) {
          return { success: false, error: 'Invalid items array' };
        }
        
        let createdCount = 0;
        for (const item of items) {
          const processedItem = processDrawing({ ...item });
          const { stackName, ...thoughtArgs } = processedItem;
          const x = typeof thoughtArgs.x !== 'undefined' ? Number(thoughtArgs.x) : window.innerWidth / 2;
          const y = typeof thoughtArgs.y !== 'undefined' ? Number(thoughtArgs.y) : window.innerHeight / 2;
          
          const id = await store.addThought({ ...thoughtArgs, x, y });
          if (id !== -1) {
            createdCount++;
            if (stackName) await store.createStack(stackName, id);
          }
        }
        return { success: true, count: createdCount };
      }

      case 'create_stack': {
        const { ids, name } = args;
        if (!ids?.length) {
          return { success: false, error: 'No IDs provided' };
        } else {
          store.setSelectedThoughtIds(ids);
          await store.linkSelectedThoughts(name);
          store.clearSelection();
          return { success: true };
        }
      }

      case 'link_thoughts': {
        const { ids, name } = args;
        if (!ids?.length) {
          return { success: false, error: 'No IDs provided' };
        } else {
          store.setSelectedThoughtIds(ids);
          await store.linkSelectedThoughts(name);
          store.clearSelection();
          return { success: true };
        }
      }

      case 'unlink_thoughts': {
        const { ids } = args;
        if (!ids?.length) {
          return { success: false, error: 'No IDs provided' };
        } else {
          store.setSelectedThoughtIds(ids);
          await store.unlinkSelectedThoughts();
          store.clearSelection();
          return { success: true };
        }
      }

      case 'update_thought': {
        const processedArgs = processDrawing({ ...args });
        const { id, stackName, ...updates } = processedArgs;
        if (!id) {
          return { success: false, error: 'Missing ID' };
        } else {
          const sanitizedUpdates: any = { ...updates };
          if (typeof updates.x !== 'undefined') sanitizedUpdates.x = Number(updates.x);
          if (typeof updates.y !== 'undefined') sanitizedUpdates.y = Number(updates.y);

          await store.updateThought(id, sanitizedUpdates);
          if (stackName) await store.createStack(stackName, id);
          return { success: true };
        }
      }

      case 'update_thoughts': {
        const processedArgs = processDrawing({ ...args });
        const { ids, stackName, ...updates } = processedArgs;
        if (!ids?.length) {
          return { success: false, error: 'No IDs provided' };
        } else {
          const sanitizedUpdates: any = { ...updates };
          if (typeof updates.x !== 'undefined') sanitizedUpdates.x = Number(updates.x);
          if (typeof updates.y !== 'undefined') sanitizedUpdates.y = Number(updates.y);

          for (const id of ids) {
            await store.updateThought(id, sanitizedUpdates);
            if (stackName) await store.createStack(stackName, id);
          }
          return { success: true };
        }
      }

      case 'delete_thoughts': {
        const { ids } = args;
        if (!ids?.length) {
          return { success: false, error: 'No IDs provided' };
        } else {
          await store.deleteThoughts(ids);
          return { success: true };
        }
      }

      case 'update_stack': {
        const { id, name } = args;
        if (!id || !name) {
          return { success: false, error: 'Missing ID or Name' };
        } else {
          await store.updateStack(id, { name });
          return { success: true };
        }
      }

      case 'delete_stack': {
        const { id } = args;
        if (!id) {
          return { success: false, error: 'Missing ID' };
        } else {
          await store.deleteStack(id);
          return { success: true };
        }
      }

      default:
        console.warn(`[Oracle] Unknown client-side tool: ${toolName}`);
        return { success: false, error: `Unknown tool: ${toolName}` };
    }
  } catch (error: any) {
    console.error(`[Oracle] Tool Execution Error (${toolName}):`, error);
    return { success: false, error: error.message || 'Internal client tool error' };
  }
};
