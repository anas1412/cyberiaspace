/**
 * Oracle Tool Executor
 * 
 * Handles the execution of client-side tool calls from the Oracle AI.
 */

export const executeOracleTool = async (toolCall: any, store: any) => {
  const { toolName, args } = toolCall;
  console.log(`[Oracle] Executing Tool: ${toolName}`, args);

  try {
    switch (toolName) {
      case 'create_thought': {
        const { stackName, ...thoughtArgs } = args;
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
          const { stackName, ...thoughtArgs } = item;
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

      case 'update_thought': {
        const { id, stackName, ...updates } = args;
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

      case 'delete_thoughts': {
        const { ids } = args;
        if (!ids?.length) {
          return { success: false, error: 'No IDs provided' };
        } else {
          await store.deleteThoughts(ids);
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
