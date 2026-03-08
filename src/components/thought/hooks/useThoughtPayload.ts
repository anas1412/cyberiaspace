import { useMemo } from 'react';
import { type Thought } from '../../../db';

export interface UseThoughtPayloadResult {
  content: string;
  tasks: { text: string; done: boolean }[];
  table: string[][];
  image: string | null;
  drawing: string | null;
  meta: any;
  fileInfo: {
    name: string;
    size: number;
    type: string;
  } | null;
}

export function useThoughtPayload(thought: Thought | null | undefined): UseThoughtPayloadResult {
  return useMemo(() => {
    if (!thought) {
      return {
        content: '',
        tasks: [],
        table: [],
        image: null,
        drawing: null,
        meta: undefined,
        fileInfo: null
      };
    }

    const raw = thought as any;
    const data = thought.data || {} as any;
    
    // Legacy fields
    const legacyContent = raw.content || '';
    const legacyTasks = raw.tasks || [];
    const legacyTable = raw.table || [];
    const legacyImage = raw.image || null;
    const legacyDrawing = raw.drawing || null;

    // Modular fields
    const modContent = data.type === 'text' ? data.content : (data.type === 'embed' ? data.url : '');
    const modTasks = data.type === 'tasks' ? data.tasks : [];
    const modTable = data.type === 'table' ? data.rows : [];
    
    // FALLBACK: Use thought.storageUrl if modular data.url is empty for files
    const modImage = data.type === 'file' ? (data.url || thought.storageUrl || null) : null;
    const modDrawing = data.type === 'paint' ? data.drawing : null;

    // NORMALIZE FILE INFO
    // Priority: data.meta (new) -> thought.meta.file (legacy) -> raw fields
    const metaSource = data.meta || thought.meta || {};
    const fileInfo = metaSource.file || (metaSource.type ? metaSource : null);

    return {
      content: modContent || legacyContent,
      tasks: (modTasks && modTasks.length > 0) ? modTasks : legacyTasks,
      table: (modTable && modTable.length > 0) ? modTable : legacyTable,
      image: modImage || legacyImage,
      drawing: modDrawing || legacyDrawing,
      meta: metaSource,
      fileInfo: fileInfo ? {
        name: fileInfo.name || thought.text || 'Untitled',
        size: fileInfo.size || 0,
        type: fileInfo.type || ''
      } : null
    };
  }, [thought]);
}
