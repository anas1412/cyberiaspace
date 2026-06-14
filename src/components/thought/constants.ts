import { Youtube, Music, Twitter, MessageCircle, Share2, Link as LinkIcon } from 'lucide-react';

export const PRIO_COLORS = {
  none: 'transparent',
  low: 'var(--prio-low)',
  medium: 'var(--prio-medium)',
  high: 'var(--prio-high)',
  urgent: 'var(--prio-urgent)',
};

export const STATUS_COLORS = {
  none: 'transparent',
  todo: 'var(--status-todo)',
  doing: 'var(--status-doing)',
  done: 'var(--status-done)',
};

// Deterministic per-column color palette (used for status buttons anywhere in the app)
export const COLUMN_COLORS = [
  '#6b7280',  // col 0: unplanned/none — gray
  '#6366f1',  // col 1: todo → indigo (matches --status-todo)
  '#eab308',  // col 2: doing → amber (matches --status-doing)
  '#22c55e',  // col 3: done → emerald (matches --status-done)
];

/** Returns a deterministic color for any column index — semantic for 0-3, golden-angle HSL for 4+ */
export function getColumnColor(index: number): string {
  if (index < 4) return COLUMN_COLORS[index];
  // Golden angle (~137.5°) produces evenly-spaced, visually distinct hues
  const hue = ((index - 4) * 137.508 + 200) % 360;
  return `hsl(${hue.toFixed(1)}, 55%, 50%)`;
}

export const PROVIDER_CONFIG: Record<string, { icon: any, color: string, label: string }> = {
  youtube: { icon: Youtube, color: '#ef4444', label: 'YouTube' },
  spotify: { icon: Music, color: '#1db954', label: 'Spotify' },
  twitter: { icon: Twitter, color: '#1da1f2', label: 'Twitter' },
  reddit: { icon: MessageCircle, color: '#ff4500', label: 'Reddit' },
  facebook: { icon: Share2, color: '#1877f2', label: 'Facebook' },
  instagram: { icon: Share2, color: '#e1306c', label: 'Instagram' },
  unknown: { icon: LinkIcon, color: '#64748b', label: 'Link' }
};
