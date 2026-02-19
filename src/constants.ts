export type SubscriptionPlan = 'free' | 'pro';
export type AccessPeriod = 'monthly' | 'yearly';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  plan: SubscriptionPlan;
  subscriptionStatus: 'active' | 'canceled' | 'none';
  expiryDate: string | null;
  usage: {
    ai_daily_count: number;
    sync_thoughts: number;
    last_ai_reset: string;
  };
  settings: {
    // Account-wide settings only
    autoSync: boolean;
    driveEnabled: boolean;
    theme: string;
  };
}


export interface PlanLimits {
  MAX_SPACES: number;
  MAX_THOUGHTS_PER_SPACE: number;
  MAX_CLOUD_THOUGHTS: number;
  AI_ENABLED: boolean;
  AI_DAILY_LIMIT?: number;
  THEMES_ENABLED: string[];
  PRICE?: {
    monthly: { usd: number; tnd: number };
    yearly: { usd: number; tnd: number };
  };
}

export const PLAN_CONFIG: Record<SubscriptionPlan, PlanLimits> = {
  free: {
    MAX_SPACES: 3,
    MAX_THOUGHTS_PER_SPACE: 20,
    MAX_CLOUD_THOUGHTS: 60,
    AI_ENABLED: true,
    AI_DAILY_LIMIT: 15,
    THEMES_ENABLED: ['cyberia', 'sea', 'forest', 'rain'],
  },
  pro: {
    MAX_SPACES: 12,
    MAX_THOUGHTS_PER_SPACE: 40,
    MAX_CLOUD_THOUGHTS: 480,
    AI_ENABLED: true,
    AI_DAILY_LIMIT: 120,
    THEMES_ENABLED: ['cyberia', 'sea', 'forest', 'rain'],
    PRICE: {
      monthly: { usd: 8, tnd: 19 },
      yearly: { usd: 80, tnd: 190 },
    },
  },
};

export const MAX_FILE_SIZE_MB = 10;

export const DEFAULT_MODEL = import.meta.env.VITE_GROQ_MODEL || 'openai/gpt-oss-120b';


export const BASIC_MODELS = [
  'openai/gpt-oss-20b',
];

export const PREMIUM_MODELS = [
  'openai/gpt-oss-120b',
];

export const AVAILABLE_MODELS = [
  ...BASIC_MODELS,
  ...PREMIUM_MODELS,
];

export const VERIFICATION_MODEL = [
/*   'gemma-3-27b-it', */
  'gemma-3-12b-it',
];