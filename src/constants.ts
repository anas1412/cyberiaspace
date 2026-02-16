export type SubscriptionPlan = 'free' | 'pro';
export type AccessPeriod = 'monthly' | 'yearly';

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
    AI_DAILY_LIMIT: 30,
    THEMES_ENABLED: ['cyberia', 'sea', 'forest', 'rain'],
  },
  pro: {
    MAX_SPACES: 8,
    MAX_THOUGHTS_PER_SPACE: 50,
    MAX_CLOUD_THOUGHTS: 400,
    AI_ENABLED: true,
    AI_DAILY_LIMIT: 1000,
    THEMES_ENABLED: ['cyberia', 'sea', 'forest', 'rain'],
    PRICE: {
      monthly: { usd: 8, tnd: 19 },
      yearly: { usd: 80, tnd: 190 },
    },
  },
};

// Environment-safe constant access
const getEnv = (key: string) => {
  if (typeof process !== 'undefined' && process.env?.[key]) return process.env[key];
  try {
    // @ts-ignore - Vite specific
    if (import.meta.env?.[key]) return import.meta.env[key];
  } catch (e) { }
  return null;
};

export const DEFAULT_MODEL = getEnv('VITE_GROQ_MODEL') || 'openai/gpt-oss-120b';

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