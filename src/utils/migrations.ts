import { db, type Thought, type ThoughtPayload } from '../db';

const MIGRATION_KEY = 'thought_migration_v3';
const MIGRATION_TIME_KEY = 'thought_time_migration_v1';

async function hasMigrationRun(key: string): Promise<boolean> {
  const stored = await db.settings.get(key);
  return stored?.value === 'true';
}

async function markMigrationDone(key: string): Promise<void> {
  await db.settings.put({ key, value: 'true' });
}

export async function migrateThoughtsToModular(): Promise<void> {
  // Check if migration already ran
  if (await hasMigrationRun(MIGRATION_KEY)) {
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
        if (t.data && (t.data.type as any) === 'image') {
          const newData = { ...t.data, type: 'file' } as any;
          await db.thoughts.update(t.id, { data: newData });
        }
      }
    });
  }

  await markMigrationDone(MIGRATION_KEY);
}

export async function migrateThoughtsToTimeFields(): Promise<void> {
  if (await hasMigrationRun(MIGRATION_TIME_KEY)) return;

  console.log('[Migration] Migrating thoughts to new time-based fields...');
  const thoughts = await db.thoughts.toArray();
  // Migrate thoughts that have a legacy 'date' property but no 'startTime'
  const needsMigration = thoughts.filter((t: any) => (t.date || t.startTime === undefined) && !t.startTime);

  if (needsMigration.length > 0) {
    await db.transaction('rw', db.thoughts, async () => {
      for (const t of needsMigration) {
        if ((t as any).date) {
          const timeValue = new Date((t as any).date).getTime();
          if (!isNaN(timeValue)) {
            await db.thoughts.update(t.id, {
              startTime: timeValue,
              endTime: timeValue,
              isAllDay: true
            } as any);
          }
        } else {
          // Initialize fields for thoughts without any date
          await db.thoughts.update(t.id, {
            startTime: null,
            endTime: null,
            isAllDay: false
          } as any);
        }
      }
    });
  }
  await markMigrationDone(MIGRATION_TIME_KEY);
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
        url: '', 
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
