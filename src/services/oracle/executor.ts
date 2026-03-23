/**
 * Oracle Tool Executor
 * 
 * Handles the execution of client-side tool calls from the Oracle AI.
 */

import { db } from '../../db';
import { sanitizeStatus, sanitizePriority } from '../../utils/thought';

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

const readFileHelper = async (id: string, store: any) => {
  const t = store.thoughts.find((thought: any) => thought.id === id);
  if (!t) return { id, success: false, error: 'Not found' };

  const { useAuthStore } = await import('../../store/useAuthStore');
  const currentUserId = useAuthStore.getState().user?.id ?? 'guest';
  if (t.userId !== currentUserId) {
    return { id, success: false, error: 'Access denied: thought belongs to another user' };
  }

  const data = t.data;
  const isImage = t.meta?.file?.type?.startsWith('image/') || 
                  t.text?.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp|svg)$/);
  const isPdf = t.meta?.file?.type?.includes('pdf') || 
                t.text?.toLowerCase().endsWith('.pdf');

  if (isImage) {
    const url = data?.type === 'file' ? data.url : (t as any).image;
    return { id, success: true, type: 'image', url, name: t.text };
  }

  if (isPdf) {
    const url = t.storageUrl || (data?.type === 'file' ? data.url : null);
    // If we have a local blob, we might need to get it
    let finalUrl = url;
    if (!finalUrl) {
      const blobEntry = await db.blobs.filter(b => b.thoughtId === id && b.userId === currentUserId).first();
      if (blobEntry) finalUrl = URL.createObjectURL(blobEntry.blob);
    }
    return { id, success: true, type: 'pdf', url: finalUrl, name: t.text };
  }

  // Default to text content
  const content = data?.type === 'text' ? data.content : (t as any).content;
  return { id, success: true, type: 'text', content, name: t.text };
};

export const executeOracleTool = async (toolCall: any, store: any) => {
  const { toolName, args } = toolCall;
  console.log(`[Oracle] Executing Tool: ${toolName}`, args);

  // Security check: restrict write actions in chat mode
  const writeActions = [
    'create_thought', 'create_thoughts', 'update_thought', 'update_thoughts', 'delete_thoughts',
    'create_stack', 'link_thoughts', 'unlink_thoughts', 'update_stack', 'update_stacks',
    'delete_stack', 'delete_stacks'
  ];

  if (store.oracleChatMode === 'chat' && writeActions.includes(toolName)) {
    return {
      success: false,
      error: 'Write actions are disabled in Chat mode. Switch to Action mode to modify the workspace.'
    };
  }

  try {
    switch (toolName) {
      case 'get_thought_details': {
        const { ids } = args;
        if (!ids || !Array.isArray(ids)) return { success: false, error: 'Invalid IDs' };
        
        const results = ids.map(id => {
          const t = store.thoughts.find((thought: any) => thought.id === id);
          if (!t) return { id, error: 'Not found' };
          
          const data = t.data;
          
          return {
            id: t.id,
            text: t.text,
            type: t.type,
            description: t.description,
            content: data?.type === 'text' ? data.content : (t as any).content,
            url: data?.type === 'file' ? data.url : (t as any).image,
            tasks: data?.type === 'tasks' ? data.tasks : (t.type === 'tasks' ? (t as any).tasks : undefined),
            table: data?.type === 'table' ? data.rows : (t.type === 'table' ? (t as any).table : undefined),
            drawing: data?.type === 'paint' ? data.drawing : (t.type === 'paint' ? (t as any).drawing : undefined),
            startTime: t.startTime,
            endTime: t.endTime,
            isAllDay: t.isAllDay,
            reminders: t.reminders,
            recurrenceRule: t.recurrenceRule,
            location: t.location,
            status: t.status,
            priority: t.priority,
            meta: t.meta,
            syncStatus: t.syncStatus
          };
        });
        
        return { success: true, thoughts: results };
      }

      case 'read_file_content': {
        const { id } = args;
        if (!id) return { success: false, error: 'Missing ID' };
        return await readFileHelper(String(id), store);
      }

      case 'read_files_content': {
        const { ids } = args;
        if (!ids || !Array.isArray(ids)) return { success: false, error: 'Invalid IDs' };
        const results = await Promise.all(ids.map(id => readFileHelper(String(id), store)));
        return { success: true, files: results };
      }

      case 'create_thought': {
        const processedArgs = processDrawing({ ...args });
        const { stackName, ...thoughtArgs } = processedArgs;
        
        // Ensure type isn't 'image' (legacy safety)
        if (thoughtArgs.type === ('image' as any)) thoughtArgs.type = 'file';

        if (thoughtArgs.status) thoughtArgs.status = sanitizeStatus(thoughtArgs.status);
        if (thoughtArgs.priority) thoughtArgs.priority = sanitizePriority(thoughtArgs.priority);

        // Transform content to data.url for embed type
        if (thoughtArgs.type === 'embed' && thoughtArgs.content) {
          thoughtArgs.data = { type: 'embed', url: thoughtArgs.content };
          delete thoughtArgs.content;
        }

        // Use bulk addThoughts for consistency (handles jitter, limits, single sync)
        const ids = await store.addThoughts([{ ...thoughtArgs }]);
        if (ids.length === 0) {
          return { success: false, error: 'Thought creation limit reached or invalid data' };
        }
        
        const id = ids[0];
        
        // Link to stack if name provided (linkSelectedThoughts now finds existing stacks by name)
        if (stackName) {
          await store.linkSelectedThoughts(stackName, [id]);
        }
        
        return { success: true, id };
      }

      case 'create_thoughts': {
        const { items } = args;
        if (!items || !Array.isArray(items)) {
          return { success: false, error: 'Invalid items array' };
        }
        
        const partialThoughts: any[] = [];
        const stackGroups: Record<string, number[]> = {};

        items.forEach((item, index) => {
          const processedItem = processDrawing({ ...item });
          const { stackName, ...thoughtArgs } = processedItem;
          
          if (thoughtArgs.type === 'embed' && thoughtArgs.content) {
            thoughtArgs.data = { type: 'embed', url: thoughtArgs.content };
            delete thoughtArgs.content;
          }

          if (thoughtArgs.type === ('image' as any)) thoughtArgs.type = 'file';

          const x = typeof thoughtArgs.x !== 'undefined' ? Number(thoughtArgs.x) : window.innerWidth / 2;
          const y = typeof thoughtArgs.y !== 'undefined' ? Number(thoughtArgs.y) : window.innerHeight / 2;
          
          if (thoughtArgs.status) thoughtArgs.status = sanitizeStatus(thoughtArgs.status);
          if (thoughtArgs.priority) thoughtArgs.priority = sanitizePriority(thoughtArgs.priority);

          partialThoughts.push({ ...thoughtArgs, x, y });
          
          if (stackName) {
            if (!stackGroups[stackName]) stackGroups[stackName] = [];
            stackGroups[stackName].push(index);
          }
        });

        const ids = await store.addThoughts(partialThoughts);
        
        if (ids.length > 0) {
          for (const stackName in stackGroups) {
            const groupIds = stackGroups[stackName].map(idx => ids[idx]).filter(Boolean);
            if (groupIds.length > 0) {
              await store.linkSelectedThoughts(stackName, groupIds);
            }
          }
        }

        return { success: true, count: ids.length };
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
          if (updates.type === ('image' as any)) sanitizedUpdates.type = 'file';
          
          if (updates.status) sanitizedUpdates.status = sanitizeStatus(updates.status);
          if (updates.priority) sanitizedUpdates.priority = sanitizePriority(updates.priority);

          await store.updateThought(String(id), sanitizedUpdates);
          if (stackName) await store.createStack(stackName, String(id));
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
          if (updates.type === ('image' as any)) sanitizedUpdates.type = 'file';

          if (updates.status) sanitizedUpdates.status = sanitizeStatus(updates.status);
          if (updates.priority) sanitizedUpdates.priority = sanitizePriority(updates.priority);

          for (const id of ids) {
            await store.updateThought(String(id), sanitizedUpdates);
            if (stackName) await store.createStack(stackName, String(id));
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
          await store.updateStack(String(id), { name });
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
            await store.updateStack(String(stack.id), { name: stack.name });
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
          await store.deleteStack(String(id));
          return { success: true };
        }
      }

      case 'delete_stacks': {
        const { ids } = args;
        if (!ids?.length) {
          return { success: false, error: 'No IDs provided' };
        } else {
          for (const id of ids) {
            await store.deleteStack(String(id));
          }
          return { success: true };
        }
      }

      default:
        return { success: false, error: `Unknown tool: ${toolName}` };
    }
  } catch (error: any) {
    console.error(`[Oracle] Tool Execution Failed: ${toolName}`, error);
    return { success: false, error: error.message || 'Unknown error occurred' };
  }
};

export default executeOracleTool;
