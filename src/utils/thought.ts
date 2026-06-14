import { type Thought } from '../db';

export function sanitizeStatus(status: any): Thought['status'] {
  if (!status || status === '' || status === 'null') return 'none';
  const valid: Thought['status'][] = ['none', 'todo', 'doing', 'done'];
  return valid.includes(status) ? status : 'none';
}

export function sanitizePriority(priority: any): Thought['priority'] {
  if (!priority || priority === '' || priority === 'null') return 'none';
  const valid: Thought['priority'][] = ['none', 'low', 'medium', 'high', 'urgent'];
  return valid.includes(priority) ? priority : 'none';
}

/**
 * Given a numeric kanban column index, return the status + kanbanCol to set.
 * Columns 0-3 map to standard status values; 4+ use status='none' + kanbanCol.
 */
export function resolveKanbanCol(col: any): { status: Thought['status']; kanbanCol: number } {
  const colIdx = typeof col === 'number' ? col : parseInt(col, 10);
  if (isNaN(colIdx) || colIdx < 0) return { status: 'none', kanbanCol: 0 };
  if (colIdx === 0) return { status: 'none', kanbanCol: 0 };
  if (colIdx === 1) return { status: 'todo' as const, kanbanCol: 1 };
  if (colIdx === 2) return { status: 'doing' as const, kanbanCol: 2 };
  if (colIdx === 3) return { status: 'done' as const, kanbanCol: 3 };
  return { status: 'none', kanbanCol: colIdx };
}
