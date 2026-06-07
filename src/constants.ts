export type Theme = 'dark' | 'light';

export const DEFAULT_THEME: Theme = (() => {
  try {
    const stored = (globalThis as unknown as { localStorage: { getItem: (key: string) => string | null } }).localStorage.getItem('cyberia-theme');
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {}
  return 'light';
})();

export const DEFAULT_PHYSICS = true;

export const STACK_COLORS = [
  '#6366f1', // Indigo
  '#10b981', // Emerald
  '#f43f5e', // Rose
  '#f59e0b', // Amber
  '#3b82f6', // Blue
  '#8b5cf6', // Violet
  '#06b6d4', // Cyan
  '#ec4899', // Pink
  '#f97316', // Orange
  '#14b8a6', // Teal
  '#71717a', // Zinc
  '#a855f7', // Purple
];

export const MAX_UPLOAD_SIZE = 20 * 1024 * 1024; // 20 MB
export const MAX_UPLOAD_SIZE_MB = 20;
export const MAX_THOUGHTS_PER_STACK = 20;

export const ORACLE_CONFIG = {
  HISTORY_WINDOW_SIZE: 12
};

export const APP_VERSION = '1.1.0';

// Feature Flags
export const SHOW_QUOTA_TAB = false;

const getDefaultModel = () => {
  // @ts-ignore - import.meta.env is available in Vite client
  return (typeof import.meta !== 'undefined' && import.meta?.env?.VITE_OPENROUTER_MODEL) 
    || 'openrouter/free';
};
export const DEFAULT_MODEL = getDefaultModel();

export const VERIFICATION_MODEL = [
  'gemma-3-12b-it',
];

// Homepage assets
export const HOMEPAGE_SCREENSHOT = '/Screenshot4.png';
export const YOUTUBE_VIDEO_ID = 'hP92Obd9hFA';

// GitHub
export const GITHUB_URL = 'https://github.com/anas1412/cyberia';

// Discord
export const DISCORD_INVITE_URL = 'https://discord.gg/wjHTsaGpc4';

// Tavily Web Search Configuration
export const TAVILY_CONFIG = {
  API_URL: 'https://api.tavily.com/search',
  SEARCH_DEPTH: 'fast' as const,
  MAX_RESULTS: 5,
  TIMEOUT_MS: 8000,
  INCLUDE_ANSWER: true,
};
