export type SubscriptionPlan = 'free' | 'pro';
export type AccessPeriod = 'monthly' | 'yearly';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  plan: SubscriptionPlan;
  subscriptionStatus: 'active' | 'trialing' | 'past_due' | 'unpaid' | 'canceled' | 'none';
  expiryDate: string | null;
  polarCustomerId?: string | null;
  paymentProvider?: 'polar' | 'flouci';
  usage: {
    // Daily counters
    ai_daily_count: number;
    ai_top_count: number;
    ai_medium_count: number;
    ai_small_count: number;
    sync_thoughts: number;
    // Anchors (local date strings)
    daily_anchor: string;
    weekly_anchor: string;
    monthly_anchor: string;
    // Weekly counters
    weekly_top_count: number;
    weekly_medium_count: number;
    weekly_small_count: number;
    // Monthly counters
    monthly_top_count: number;
    monthly_medium_count: number;
    monthly_small_count: number;
  };
  settings: {
    // Account-wide settings only
    autoSync: boolean;
    space: string;
    personality?: string;
  };
}


export interface PlanLimits {
  MAX_SPACES: number;
  MAX_THOUGHTS_PER_SPACE: number;
  MAX_CLOUD_THOUGHTS: number;
  MAX_STORAGE_MB: number;
  AI_ENABLED: boolean;
  AI_DAILY_LIMIT?: number;
  AI_TOP_LIMIT?: number;
  AI_MEDIUM_LIMIT?: number;
  AI_SMALL_LIMIT?: number;
  // Weekly limits
  AI_TOP_WEEKLY?: number;
  AI_MEDIUM_WEEKLY?: number;
  AI_SMALL_WEEKLY?: number;
  // Monthly limits
  AI_TOP_MONTHLY?: number;
  AI_MEDIUM_MONTHLY?: number;
  AI_SMALL_MONTHLY?: number;
  THEMES_ENABLED: string[];
  PRICE?: {
    monthly: { usd: number; tnd: number };
    yearly: { usd: number; tnd: number };
  };
}

export const PLAN_CONFIG: Record<SubscriptionPlan, PlanLimits> = {
  free: {
    MAX_SPACES: 4,
    MAX_THOUGHTS_PER_SPACE: 30,
    MAX_CLOUD_THOUGHTS: 120,
    MAX_STORAGE_MB: 20,
    AI_ENABLED: true,
    AI_DAILY_LIMIT: 15,
    AI_TOP_LIMIT: 0,
    AI_MEDIUM_LIMIT: 0,
    AI_SMALL_LIMIT: 0,
    AI_TOP_WEEKLY: 0,
    AI_MEDIUM_WEEKLY: 0,
    AI_SMALL_WEEKLY: 0,
    AI_TOP_MONTHLY: 0,
    AI_MEDIUM_MONTHLY: 0,
    AI_SMALL_MONTHLY: 0,
    THEMES_ENABLED: ['cyberia'],
  },
  pro: {
    MAX_SPACES: 20,
    MAX_THOUGHTS_PER_SPACE: 100,
    MAX_CLOUD_THOUGHTS: 2000,
    MAX_STORAGE_MB: 200,
    AI_ENABLED: true,
    AI_DAILY_LIMIT: 10000, // Legacy - AI limits now fetched from /api/models
    AI_TOP_LIMIT: 0,       // Legacy - now fetched from /api/models
    AI_MEDIUM_LIMIT: 0,    // Legacy - now fetched from /api/models
    AI_SMALL_LIMIT: 0,     // Legacy - now fetched from /api/models
    AI_TOP_WEEKLY: 0,      // Legacy - now fetched from /api/models
    AI_MEDIUM_WEEKLY: 0,   // Legacy - now fetched from /api/models
    AI_SMALL_WEEKLY: 0,    // Legacy - now fetched from /api/models
    AI_TOP_MONTHLY: 0,     // Legacy - now fetched from /api/models
    AI_MEDIUM_MONTHLY: 0,  // Legacy - now fetched from /api/models
    AI_SMALL_MONTHLY: 0,   // Legacy - now fetched from /api/models
    THEMES_ENABLED: ['cyberia', 'sea', 'forest', 'rain', 'sakura'],
    PRICE: {
      monthly: { usd: 8, tnd: 19 },
      yearly: { usd: 80, tnd: 190 },
    },
  },
};

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

export const MAX_FILE_SIZE_MB = 10;
export const MAX_THOUGHTS_PER_STACK = 20;

export const ORACLE_CONFIG = {
  HISTORY_WINDOW_SIZE: 12
};

export const APP_VERSION = '1.0.5';

// Use process.env for server-side (Vercel), import.meta.env for client-side
const getDefaultModel = () => {
  if (typeof process !== 'undefined' && process.env?.VITE_OPENROUTER_MODEL) {
    return process.env.VITE_OPENROUTER_MODEL;
  }
  // @ts-ignore - import.meta.env is available in Vite client
  return (typeof import.meta !== 'undefined' && import.meta?.env?.VITE_OPENROUTER_MODEL) 
    || 'openrouter/free';
};
export const DEFAULT_MODEL = getDefaultModel();

export const VERIFICATION_MODEL = [
/*   'gemma-3-27b-it', */
  'gemma-3-12b-it',
];