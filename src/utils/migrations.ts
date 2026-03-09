import { db, type Thought, type ThoughtPayload } from '../db';

const MIGRATION_KEY = 'cyberia_thought_migration_v3'; 

export async function migrateThoughtsToModular(): Promise<void> {
  // Check if migration already ran
  if (localStorage.getItem(MIGRATION_KEY)) {
    return;
  }

  console.log('[Migration] Starting robust thought data migration...');
  
  const thoughts = await db.thoughts.toArray();
  
  // 1. Convert all 'image' types to 'file'
  const imageThoughts = thoughts.filter(t => t.type === ('image' as any));
  if (imageThoughts.length > 0) {
    await db.transaction('rw', db.thoughts, async () => {
      for (const t of imageThoughts) {
        await db.thoughts.update(t.id, { type: 'file' });
      }
    });
  }

  // 2. Add modular data to thoughts that don't have it
  const needsPayload = thoughts.filter(t => !t.data);
  if (needsPayload.length > 0) {
    const updates = needsPayload.map(t => ({
      id: t.id,
      data: constructDataFromLegacy(t)
    }));

    await db.transaction('rw', db.thoughts, async () => {
      for (const update of updates) {
        await db.thoughts.update(update.id, { data: update.data });
      }
    });
  }

  // 3. Update existing modular data if it has type 'image'
  const hasImagePayload = thoughts.filter(t => t.data && (t.data.type as any) === 'image');
  if (hasImagePayload.length > 0) {
    await db.transaction('rw', db.thoughts, async () => {
      for (const t of hasImagePayload) {
        if (t.data && (t.data as any).type === 'image') {
          const newData = { ...t.data, type: 'file' } as any;
          await db.thoughts.update(t.id, { data: newData });
        }
      }
    });
  }

  localStorage.setItem(MIGRATION_KEY, 'true');
}

function constructDataFromLegacy(t: Thought): ThoughtPayload {
  const type = t.type as any;
  switch (type) {
    case 'text':
      return { type: 'text', content: (t as any).content || '' };
    
    case 'tasks':
      return { type: 'tasks', tasks: (t as any).tasks || [] };
    
    case 'table':
      return { type: 'table', rows: (t as any).table || [] };
    
    case 'paint':
      return { type: 'paint', drawing: (t as any).drawing || '' };
    
    case 'image':
    case 'file':
      return { 
        type: 'file', 
        url: (t as any).image || '', 
        name: t.text || 'Untitled',
        size: (t.meta as any)?.file?.size || 0,
        meta: t.meta
      };
    
    case 'embed':
      return { 
        type: 'embed', 
        url: (t as any).content || '',
      };
    
    case 'label':
    default:
      return { type: 'label' };
  }
}
