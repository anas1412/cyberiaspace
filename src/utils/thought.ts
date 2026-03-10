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
