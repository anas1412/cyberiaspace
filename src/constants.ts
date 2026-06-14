export type Theme = 'dark' | 'light';

// Default fallback — actual theme is read from Dexie settings cache in store init
export const DEFAULT_THEME: Theme = 'light';

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

export const MAX_UPLOAD_SIZE = 100 * 1024 * 1024; // 100 MB
export const MAX_UPLOAD_SIZE_MB = 100;

export const MAX_BG_UPLOAD_SIZE = 5 * 1024 * 1024; // 5 MB
export const MAX_BG_UPLOAD_SIZE_MB = 5;
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

// Tavily Web Search
export const TAVILY_CONFIG = {
  API_URL: 'https://api.tavily.com/search',
  SEARCH_DEPTH: 'basic' as const,
  MAX_RESULTS: 5,
  INCLUDE_ANSWER: false,
};

// Discord
export const DISCORD_INVITE_URL = 'https://discord.gg/wjHTsaGpc4';
