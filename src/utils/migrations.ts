import { db, type Thought, type ThoughtPayload } from '../db';

const MIGRATION_KEY = 'cyberia_thought_migration_v3'; // Increment to re-run for image consolidation
const MIGRATION_ID_KEY = 'cyberia_id_migration_v1';

export async function migrateLegacyIds(): Promise<void> {
  if (localStorage.getItem(MIGRATION_ID_KEY)) return;

  console.log('[Migration] Starting ID sanitization...');

  const spaces = await db.spaces.toArray();

  await db.transaction('rw', db.spaces, db.stacks, db.thoughts, async () => {
    // 1. Migrate Spaces
    for (const space of spaces) {
      const isLegacy = space.id.startsWith('s-') || !/^\d+$/.test(space.id);
      if (isLegacy) {
        let newId = space.id.replace('s-', '').replace(/\D/g, '');
        let isOnboarding = space.isOnboarding;

        if (space.id === 's-onboarding') {
          newId = '10002';
          isOnboarding = true;
        } else if (space.id === 's-workspace') {
          newId = '10001';
        }

        if (!newId || !/^\d+$/.test(newId)) {
          newId = String(Date.now() + Math.floor(Math.random() * 1000));
        }

        console.log(`[Migration] Converting space ${space.id} -> ${newId}`);

        // Update Thoughts and Stacks first
        await db.thoughts.where('spaceId').equals(space.id).modify({ spaceId: newId });
        await db.stacks.where('spaceId').equals(space.id).modify({ spaceId: newId });

        // Delete old space and add new one
        await db.spaces.delete(space.id);
        await db.spaces.add({ ...space, id: newId, isOnboarding });

        // Update active space ID in localStorage
        if (localStorage.getItem('cyberia-active-space-id') === space.id) {
          localStorage.setItem('cyberia-active-space-id', newId);
        }
      }
    }

    // 2. Migrate Stacks
    // We need to fetch stacks again because their spaceId might have changed above
    const currentStacks = await db.stacks.toArray();
    for (const stack of currentStacks) {
      const isLegacy = stack.id.startsWith('st-') || !/^\d+$/.test(stack.id);
      if (isLegacy) {
        let newId = stack.id.replace('st-', '').replace(/\D/g, '');
        if (!newId || !/^\d+$/.test(newId)) {
          newId = String(Date.now() + Math.floor(Math.random() * 1000));
        }

        console.log(`[Migration] Converting stack ${stack.id} -> ${newId}`);

        // Update Thoughts
        await db.thoughts.where('stackId').equals(stack.id).modify({ stackId: newId });

        // Delete old stack and add new one
        await db.stacks.delete(stack.id);
        await db.stacks.add({ ...stack, id: newId });
      }
    }
  });

  localStorage.setItem(MIGRATION_ID_KEY, 'true');
  console.log('[Migration] ID sanitization complete.');
}

export async function migrateThoughtsToModular(): Promise<void> {
  // Check if migration already ran
  if (localStorage.getItem(MIGRATION_KEY)) {
    console.log('[Migration] V3 already completed, skipping...');
    return;
  }

  console.log('[Migration] Starting robust thought data migration...');
  
  const thoughts = await db.thoughts.toArray();
  
  // 1. Convert all 'image' types to 'file'
  const imageThoughts = thoughts.filter(t => t.type === ('image' as any));
  if (imageThoughts.length > 0) {
    console.log(`[Migration] Consolidating ${imageThoughts.length} images into files...`);
    await db.transaction('rw', db.thoughts, async () => {
      for (const t of imageThoughts) {
        await db.thoughts.update(t.id, { type: 'file' });
      }
    });
  }

  // 2. Add modular data to thoughts that don't have it
  const needsPayload = thoughts.filter(t => !t.data);
  if (needsPayload.length > 0) {
    console.log(`[Migration] Migrating ${needsPayload.length} thoughts to modular payloads...`);
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
    console.log(`[Migration] Updating ${hasImagePayload.length} modular payloads from image to file...`);
    await db.transaction('rw', db.thoughts, async () => {
      for (const t of hasImagePayload) {
        if (t.data && (t.data as any).type === 'image') {
          const newData = { ...t.data, type: 'file' } as any;
          await db.thoughts.update(t.id, { data: newData });
        }
      }
    });
  }

  console.log('[Migration] All migrations complete!');
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
