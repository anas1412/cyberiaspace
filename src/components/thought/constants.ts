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

export const PROVIDER_CONFIG: Record<string, { icon: any, color: string, label: string }> = {
  youtube: { icon: Youtube, color: '#ef4444', label: 'YouTube' },
  spotify: { icon: Music, color: '#1db954', label: 'Spotify' },
  twitter: { icon: Twitter, color: '#1da1f2', label: 'Twitter' },
  reddit: { icon: MessageCircle, color: '#ff4500', label: 'Reddit' },
  facebook: { icon: Share2, color: '#1877f2', label: 'Facebook' },
  instagram: { icon: Share2, color: '#e1306c', label: 'Instagram' },
  unknown: { icon: LinkIcon, color: '#64748b', label: 'Link' }
};
