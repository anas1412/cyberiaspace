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
      case 'get_thought_details': {
        const { ids } = args;
        if (!ids || !Array.isArray(ids)) return { success: false, error: 'Invalid IDs' };
        
        const results = ids.map(id => {
          const t = store.thoughts.find((thought: any) => thought.id === id);
          if (!t) return { id, error: 'Not found' };
          
          return {
            id: t.id,
            text: t.text,
            type: t.type,
            content: t.content,
            description: t.description,
            tasks: t.type === 'tasks' ? t.tasks : undefined,
            table: t.type === 'table' ? t.table : undefined,
            drawing: t.type === 'paint' ? t.drawing : undefined,
            date: t.date,
            status: t.status,
            priority: t.priority,
            meta: t.meta,
            syncStatus: t.syncStatus
          };

        });
        
        return { success: true, thoughts: results };
      }

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

      case 'update_stacks': {
        const { stacks } = args;
        if (!stacks || !Array.isArray(stacks)) {
          return { success: false, error: 'Invalid stacks array' };
        }
        let updatedCount = 0;
        for (const stack of stacks) {
          if (stack.id && stack.name) {
            await store.updateStack(stack.id, { name: stack.name });
            updatedCount++;
          }
        }
        return { success: true, count: updatedCount };
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

      case 'delete_stacks': {
        const { ids } = args;
        if (!ids || !Array.isArray(ids)) {
          return { success: false, error: 'Invalid IDs array' };
        }
        let deletedCount = 0;
        for (const id of ids) {
          if (id) {
            await store.deleteStack(id);
            deletedCount++;
          }
        }
        return { success: true, count: deletedCount };
      }

      case 'read_file_content': {
        const { id } = args;
        const thought = store.thoughts.find((t: any) => t.id === id);
        if (!thought) return { success: false, error: 'Thought not found' };

        try {
          const { db } = await import('../../db');
          const { driveService } = await import('../google/driveService');
          const authStore = (await import('../../store/useAuthStore')).useAuthStore.getState();

          // Try to get from local blobs first
          let blob: Blob | null = null;
          const blobEntry = await db.blobs.where('thoughtId').equals(id).first();
          
          if (blobEntry) {
            blob = blobEntry.blob;
          } else if (thought.driveFileId && authStore.accessToken) {
            blob = await driveService.downloadFile(authStore.accessToken, thought.driveFileId);
          }

          if (!blob) return { success: false, error: 'File content not available (might be local-only and you are on a different device)' };

          // Only read as text if it's a readable type
          const readableTypes = ['text/', 'application/json', 'application/javascript', 'application/x-javascript'];
          const isPDF = blob.type.includes('pdf');
          
          if (isPDF) {
            // For now, we can't parse PDF on client easily, but we can return the metadata
            return { success: true, type: 'pdf', message: "This is a PDF file. Direct text extraction is pending implementation, but I can see it's a valid document." };
          }

          const isText = readableTypes.some(t => blob!.type.startsWith(t)) || thought.text?.endsWith('.md') || thought.text?.endsWith('.txt');
          
          if (isText) {
            const text = await blob.text();
            return { success: true, type: 'text', content: text.substring(0, 10000) }; // Limit to 10k chars for safety
          }

          return { success: false, error: 'File type is not readable as text.' };
        } catch (e: any) {
          return { success: false, error: e.message };
        }
      }

      case 'read_files_content': {
        const { ids } = args;
        if (!ids || !Array.isArray(ids)) {
          return { success: false, error: 'Invalid IDs array' };
        }

        const results = [];
        for (const id of ids) {
          const thought = store.thoughts.find((t: any) => t.id === id);
          if (!thought) {
            results.push({ id, success: false, error: 'Thought not found' });
            continue;
          }

          try {
            const { db } = await import('../../db');
            const { driveService } = await import('../google/driveService');
            const authStore = (await import('../../store/useAuthStore')).useAuthStore.getState();

            let blob: Blob | null = null;
            const blobEntry = await db.blobs.where('thoughtId').equals(id).first();
            
            if (blobEntry) {
              blob = blobEntry.blob;
            } else if (thought.driveFileId && authStore.accessToken) {
              blob = await driveService.downloadFile(authStore.accessToken, thought.driveFileId);
            }

            if (!blob) {
              results.push({ id, success: false, error: 'File content not available' });
              continue;
            }

            const readableTypes = ['text/', 'application/json', 'application/javascript', 'application/x-javascript'];
            const isPDF = blob.type.includes('pdf');
            const isText = readableTypes.some(t => blob!.type.startsWith(t)) || thought.text?.endsWith('.md') || thought.text?.endsWith('.txt');

            if (isPDF) {
              results.push({ id, success: true, type: 'pdf', message: 'PDF file' });
            } else if (isText) {
              const text = await blob.text();
              results.push({ id, success: true, type: 'text', content: text.substring(0, 10000) });
            } else {
              results.push({ id, success: false, error: 'File type not readable' });
            }
          } catch (e: any) {
            results.push({ id, success: false, error: e.message });
          }
        }

        return { success: true, files: results };
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
