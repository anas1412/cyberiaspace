import { type Thought, type Stack, type ThoughtType } from '../db';

export type DirectoryGroupBy = 'stack' | 'status' | 'date' | 'priority' | 'type';
export type DirectorySortBy = 'order' | 'alpha' | 'alpha-reverse' | 'date-newest' | 'date-oldest';

export interface DirectoryGroup {
  id: string;
  label: string;
  color?: string;
  thoughtIds: string[];
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const STATUS_LABELS: Record<string, string> = {
  none: 'No Status',
  todo: 'Todo',
  doing: 'Doing',
  done: 'Done',
};

const PRIORITY_LABELS: Record<string, string> = {
  none: 'No Priority',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

const TYPE_LABELS: Record<ThoughtType, string> = {
  label: 'Labels',
  text: 'Text',
  tasks: 'Tasks',
  paint: 'Paint',
  table: 'Tables',
  embed: 'Embeds',
  file: 'Files',
};

function sortThoughtIds(
  thoughtIds: string[],
  thoughtsMap: Map<string, Thought>,
  sortBy: DirectorySortBy,
): string[] {
  return [...thoughtIds].sort((aId, bId) => {
    const a = thoughtsMap.get(aId);
    const b = thoughtsMap.get(bId);
    if (!a || !b) return 0;

    switch (sortBy) {
      case 'alpha':
        return a.text.localeCompare(b.text);
      case 'alpha-reverse':
        return b.text.localeCompare(a.text);
      case 'date-newest': {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      }
      case 'date-oldest': {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return aTime - bTime;
      }
      case 'order':
      default:
        return (a.order ?? 0) - (b.order ?? 0);
    }
  });
}

export function buildDirectoryGroups(
  thoughts: Thought[],
  stacks: Stack[],
  groupBy: DirectoryGroupBy,
  sortBy: DirectorySortBy,
  searchQuery?: string,
  spaceId?: string,
): DirectoryGroup[] {
  // Filter thoughts: active, correct space, not deleted, not labels
  const filtered = thoughts.filter(
    (t) => !t.deletedAt && t.type !== 'label' && (!spaceId || t.spaceId === spaceId),
  );

  // Apply search filter
  const searched = searchQuery && searchQuery.trim()
    ? filtered.filter((t) =>
        t.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description?.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : filtered;

  const thoughtsMap = new Map(searched.map((t) => [t.id, t]));
  const stacksMap = new Map(stacks.map((s) => [s.id, s]));

  switch (groupBy) {
    case 'stack':
      return buildStackGroups(searched, stacksMap, thoughtsMap, sortBy);
    case 'status':
      return buildStatusGroups(searched, thoughtsMap, sortBy);
    case 'date':
      return buildDateGroups(searched, thoughtsMap, sortBy);
    case 'priority':
      return buildPriorityGroups(searched, thoughtsMap, sortBy);
    case 'type':
      return buildTypeGroups(searched, thoughtsMap, sortBy);
    default:
      return buildStackGroups(searched, stacksMap, thoughtsMap, sortBy);
  }
}

function buildStackGroups(
  thoughts: Thought[],
  stacksMap: Map<string, Stack>,
  thoughtsMap: Map<string, Thought>,
  sortBy: DirectorySortBy,
): DirectoryGroup[] {
  const groups = new Map<string, string[]>();
  const stackOrder = new Map<string, number>();

  // Track stack order for consistent group ordering (Stacks don't have order field, use name)
  stacksMap.forEach((_stack, id) => {
    stackOrder.set(id, 0);
  });

  thoughts.forEach((t) => {
    const groupId = t.stackId ?? '__unfiled__';
    if (!groups.has(groupId)) groups.set(groupId, []);
    groups.get(groupId)!.push(t.id);
  });

  // Sort groups: stacks by order, unfiled last
  const sortedGroupIds = [...groups.keys()].sort((a, b) => {
    if (a === '__unfiled__') return 1;
    if (b === '__unfiled__') return -1;
    return (stackOrder.get(a) ?? 0) - (stackOrder.get(b) ?? 0);
  });

  return sortedGroupIds.map((groupId) => {
    const stack = stacksMap.get(groupId);
    const thoughtIds = sortThoughtIds(groups.get(groupId)!, thoughtsMap, sortBy);

    return {
      id: groupId,
      label: stack ? stack.name : 'Unfiled',
      color: stack?.color,
      thoughtIds,
    };
  });
}

function buildStatusGroups(
  thoughts: Thought[],
  thoughtsMap: Map<string, Thought>,
  sortBy: DirectorySortBy,
): DirectoryGroup[] {
  const statusOrder = ['todo', 'doing', 'done', 'none'] as const;
  const groups = new Map<string, string[]>();

  statusOrder.forEach((s) => groups.set(s, []));
  thoughts.forEach((t) => {
    const status = t.status ?? 'none';
    if (!groups.has(status)) groups.set(status, []);
    groups.get(status)!.push(t.id);
  });

  return statusOrder
    .filter((s) => groups.get(s)?.length)
    .map((status) => ({
      id: status,
      label: STATUS_LABELS[status] ?? status,
      thoughtIds: sortThoughtIds(groups.get(status)!, thoughtsMap, sortBy),
    }));
}

function buildDateGroups(
  thoughts: Thought[],
  thoughtsMap: Map<string, Thought>,
  sortBy: DirectorySortBy,
): DirectoryGroup[] {
  const groups = new Map<string, string[]>();

  thoughts.forEach((t) => {
    const date = t.createdAt ? new Date(t.createdAt) : new Date();
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t.id);
  });

  // Sort by date key descending (newest first)
  const sortedKeys = [...groups.keys()].sort((a, b) => b.localeCompare(a));

  return sortedKeys.map((key) => {
    const [year, month] = key.split('-');
    const label = `${MONTH_NAMES[parseInt(month, 10) - 1]} ${year}`;
    return {
      id: key,
      label,
      thoughtIds: sortThoughtIds(groups.get(key)!, thoughtsMap, sortBy),
    };
  });
}

function buildPriorityGroups(
  thoughts: Thought[],
  thoughtsMap: Map<string, Thought>,
  sortBy: DirectorySortBy,
): DirectoryGroup[] {
  const priorityOrder = ['urgent', 'high', 'medium', 'low', 'none'] as const;
  const groups = new Map<string, string[]>();

  priorityOrder.forEach((p) => groups.set(p, []));
  thoughts.forEach((t) => {
    const priority = t.priority ?? 'none';
    if (!groups.has(priority)) groups.set(priority, []);
    groups.get(priority)!.push(t.id);
  });

  return priorityOrder
    .filter((p) => groups.get(p)?.length)
    .map((priority) => ({
      id: priority,
      label: PRIORITY_LABELS[priority] ?? priority,
      thoughtIds: sortThoughtIds(groups.get(priority)!, thoughtsMap, sortBy),
    }));
}

function buildTypeGroups(
  thoughts: Thought[],
  thoughtsMap: Map<string, Thought>,
  sortBy: DirectorySortBy,
): DirectoryGroup[] {
  const groups = new Map<string, string[]>();

  thoughts.forEach((t) => {
    const type = t.type ?? 'text';
    if (!groups.has(type)) groups.set(type, []);
    groups.get(type)!.push(t.id);
  });

  // Sort by type label alphabetically
  const sortedTypes = [...groups.keys()].sort((a, b) =>
    (TYPE_LABELS[a as ThoughtType] ?? a).localeCompare(TYPE_LABELS[b as ThoughtType] ?? b),
  );

  return sortedTypes.map((type) => ({
    id: type,
    label: TYPE_LABELS[type as ThoughtType] ?? type,
    thoughtIds: sortThoughtIds(groups.get(type)!, thoughtsMap, sortBy),
  }));
}
