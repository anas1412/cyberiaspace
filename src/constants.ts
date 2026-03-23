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
    ai_daily_count: number;
    sync_thoughts: number;
    last_ai_reset: string;
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
    THEMES_ENABLED: ['cyberia'],
  },
  pro: {
    MAX_SPACES: 20,
    MAX_THOUGHTS_PER_SPACE: 100,
    MAX_CLOUD_THOUGHTS: 2000,
    MAX_STORAGE_MB: 200,
    AI_ENABLED: true,
    AI_DAILY_LIMIT: 40,
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

export const BASIC_MODELS = [
  { id: 'openrouter/free', name: 'Random Free Model', desc: 'Versatile & balanced performance' },
  { id: 'stepfun/step-3.5-flash:free', name: 'Step 3.5 Flash', desc: 'Ultra-low latency processing' },
  { id: 'minimax/minimax-m2.5:free', name: 'MiniMax 2.5', desc: 'Optimized for high-speed chat' },
  { id: 'nvidia/nemotron-3-super-120b-a12b:free', name: 'Nemotron 3 Super', desc: 'High-parameter reasoning power' },
  { id: 'arcee-ai/trinity-large-preview:free', name: 'Trinity Large Preview', desc: 'Broad knowledge & complex tasks' },
];

export const PREMIUM_MODELS = [
  { id: 'openrouter/free', name: 'Random Free Model', desc: 'Versatile & balanced performance' },
  { id: 'stepfun/step-3.5-flash:free', name: 'Step 3.5 Flash', desc: 'Ultra-low latency processing' },
  { id: 'minimax/minimax-m2.5:free', name: 'MiniMax 2.5', desc: 'Optimized for high-speed chat' },
  { id: 'nvidia/nemotron-3-super-120b-a12b:free', name: 'Nemotron 3 Super', desc: 'High-parameter reasoning power' },
  { id: 'arcee-ai/trinity-large-preview:free', name: 'Trinity Large Preview', desc: 'Broad knowledge & complex tasks' },
  //{ id: 'openrouter/auto', name: 'Smarter Models First', desc: 'Auto-routes to the best logic available' },
  //{ id: 'anthropic/claude-opus-4.6', name: 'Claude Opus 4.6', desc: 'Peak reasoning & 1M context' },
  //{ id: 'anthropic/claude-sonnet-4.6', name: 'Claude Sonnet 4.6', desc: 'Elite speed-to-intelligence ratio' },
  //{ id: 'openai/gpt-5.4', name: 'ChatGPT 5.4', desc: 'Master of agentic & professional tasks' },
  //{ id: 'openai/gpt-5-nano', name: 'ChatGPT 5 Nano', desc: 'Smart reasoning in a compact frame' },
  //{ id: 'google/gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro Preview', desc: 'Best for massive data & multimodal' },
  //{ id: 'google/gemini-3-flash-preview', name: 'Gemini 3 Flash Preview', desc: 'High-speed intelligence for rapid chat' },
  //{ id: 'google/gemini-3.1-flash-lite-preview', name: 'Gemini 3.1 Flash Lite Preview', desc: 'Instant responses for simple logic' },
];

export type ModelOption = typeof BASIC_MODELS[number];

export const AVAILABLE_MODELS = [
  ...BASIC_MODELS,
  ...PREMIUM_MODELS,
];

export const VERIFICATION_MODEL = [
/*   'gemma-3-27b-it', */
  'gemma-3-12b-it',
];