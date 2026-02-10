import Dexie, { type EntityTable } from 'dexie';

interface Space {
  id: string;
  name: string;
  mode: 'spatial' | 'kanban' | 'calendar';
  physics: boolean;
  order: number;
  transformX?: number;
  transformY?: number;
  transformScale?: number;
}

interface Stack {
  id: string;
  name: string;
  color: string;
  spaceId: string;
}

interface Thought {
  id: number;
  spaceId: string;
  stackId: string | null; // Unique Stack Reference
  x: number;
  y: number;
  vx: number;
  vy: number;
  text: string;
  placeholder?: string;
  description: string;
  type: 'text' | 'tasks' | 'paint' | 'table' | 'image' | 'embed';
  content: string;
  image: string | null;
  drawing: string | null;
  status: 'none' | 'todo' | 'doing' | 'done';
  tasks: { text: string; done: boolean }[];
  table: string[][];
  date: string;
  priority: 'none' | 'low' | 'medium' | 'high' | 'urgent';
  size: number; // 0.5 to 2.0
  order: number;
  layer?: number;
}

const db = new Dexie('CyberiaDB') as Dexie & {
  spaces: EntityTable<Space, 'id'>;
  thoughts: EntityTable<Thought, 'id'>;
  stacks: EntityTable<Stack, 'id'>;
};

db.version(2).stores({
  spaces: 'id, name, order',
  thoughts: '++id, spaceId, stackId, text, status, date, priority, order',
  stacks: 'id, spaceId, name'
});

export type { Space, Thought, Stack };
export { db };
