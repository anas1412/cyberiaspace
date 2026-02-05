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

interface Thought {
  id: number;
  spaceId: string;
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
  tags: string[];
  status: 'none' | 'todo' | 'doing' | 'done';
  tasks: { text: string; done: boolean }[];
  table: string[][];
  date: string;
  priority: 'none' | 'low' | 'medium' | 'high' | 'urgent';
  order: number;
}

const db = new Dexie('CyberiaDB') as Dexie & {
  spaces: EntityTable<Space, 'id'>;
  thoughts: EntityTable<Thought, 'id'>;
};

db.version(1).stores({
  spaces: 'id, name, order',
  thoughts: '++id, spaceId, text, *tags, status, date, priority, order'
});

export type { Space, Thought };
export { db };
