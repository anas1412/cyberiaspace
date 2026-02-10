export type SubscriptionPlan = 'free' | 'pro';
export type AccessPeriod = 'monthly' | 'yearly';

export interface PlanLimits {
  MAX_SPACES: number;
  MAX_THOUGHTS_PER_SPACE: number;
  MAX_CLOUD_THOUGHTS: number;
  AI_ENABLED: boolean;
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
    AI_ENABLED: false,
    THEMES_ENABLED: ['cyberia', 'sakura', 'neon'],
  },
  pro: {
    MAX_SPACES: 8,
    MAX_THOUGHTS_PER_SPACE: 50,
    MAX_CLOUD_THOUGHTS: 400,
    AI_ENABLED: true,
    THEMES_ENABLED: ['cyberia', 'sakura', 'neon'],
    PRICE: {
      monthly: { usd: 8, tnd: 19 },
      yearly: { usd: 80, tnd: 190 },
    },
  },
};

export const DEFAULT_MODEL = import.meta.env.VITE_GOOGLE_AI_MODEL || 'gemini-2.5-flash';

export const AVAILABLE_MODELS = [
  'gemini-3-pro-preview',
  'gemini-3-flash-preview',
  'gemini-2.5-pro',
  'gemini-2.5-flash', 
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash', 
  'gemini-2.0-flash-lite',
];

export const VERIFICATION_MODEL = [
/*   'gemma-3-27b-it', */
  'gemma-3-12b-it',
];