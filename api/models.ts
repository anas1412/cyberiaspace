import type { VercelRequest, VercelResponse } from '@vercel/node';

// Single source of truth for AI model configuration
// Used by both backend API and frontend dropdown

export const config = {
  runtime: 'nodejs',
};

// Model tiers with quotas - THE ONLY PLACE for model config
export const MODEL_TIERS = {
  // Est. Monthly Cost: ~$3-6 | Est. Margin: ~$4-7
  top: {
    name: 'Premium',
    quota: 10,           // Pro users get 10 requests/day
    weeklyQuota: 70,     // 10 * 7
    monthlyQuota: 200,   // 10 * 20
    description: 'Premium models for complex reasoning',
    models: [
      
      { id: 'minimax/minimax-m2.5:free', name: 'MiniMax 2.5', desc: 'Optimized for high-speed chat' },
    ]
  },
  // Est. Monthly Cost: ~$1.50 | Est. Margin: ~$8.50
  medium: {
    name: 'Normal',
    quota: 40,           // Pro users get 40 requests/day
    weeklyQuota: 280,    // 40 * 7
    monthlyQuota: 800,   // 40 * 20
    description: 'Balanced models for everyday tasks',
    models: [
      { id: 'stepfun/step-3.5-flash:free', name: 'Step 3.5 Flash', desc: 'Ultra-low latency processing' },
    ]
  },
  // Est. Monthly Cost: ~$2.00 | Est. Margin: ~$8.00
  small: {
    name: 'Small',
    quota: 200,          // 200 requests/day
    weeklyQuota: 1400,   // 200 * 7
    monthlyQuota: 6000,  // 200 * 30
    description: 'Ultra-fast budget AI for everyday tasks',
    models: [
      { id: 'nvidia/nemotron-3-super-120b-a12b:free', name: 'Nemotron 3 Super', desc: 'High-parameter reasoning power' },
    ]
  },
  free: {
    name: 'Free Tier',
    quota: null,         
    weeklyQuota: null,
    monthlyQuota: null,
    description: 'Free models with unlimited access',
    models: [
      { id: 'openrouter/free', name: 'Random Free Model', desc: 'Versatile & balanced performance' },

    ]
  }
};

// Helper to get all models as flat arrays (for backend logic)
export const TOP_MODELS = MODEL_TIERS.top.models.map(m => m.id);
export const MEDIUM_MODELS = MODEL_TIERS.medium.models.map(m => m.id);
export const SMALL_MODELS = MODEL_TIERS.small.models.map(m => m.id);
export const FREE_MODELS = MODEL_TIERS.free.models.map(m => m.id);

// Free tier limit for non-pro users
export const FREE_DAILY_LIMIT = 15;

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  // Return model configuration
  res.status(200).json({
    tiers: MODEL_TIERS,
    config: {
      free: {
        AI_DAILY_LIMIT: FREE_DAILY_LIMIT,
        AI_TOP_LIMIT: 0,
        AI_MEDIUM_LIMIT: 0,
        AI_SMALL_LIMIT: 0,
        AI_TOP_WEEKLY: 0,
        AI_MEDIUM_WEEKLY: 0,
        AI_SMALL_WEEKLY: 0,
        AI_TOP_MONTHLY: 0,
        AI_MEDIUM_MONTHLY: 0,
        AI_SMALL_MONTHLY: 0,
      },
      pro: {
        AI_DAILY_LIMIT: 10000, // essentially unlimited
        AI_TOP_LIMIT: MODEL_TIERS.top.quota,
        AI_MEDIUM_LIMIT: MODEL_TIERS.medium.quota,
        AI_SMALL_LIMIT: MODEL_TIERS.small.quota,
        AI_TOP_WEEKLY: MODEL_TIERS.top.weeklyQuota,
        AI_MEDIUM_WEEKLY: MODEL_TIERS.medium.weeklyQuota,
        AI_SMALL_WEEKLY: MODEL_TIERS.small.weeklyQuota,
        AI_TOP_MONTHLY: MODEL_TIERS.top.monthlyQuota,
        AI_MEDIUM_MONTHLY: MODEL_TIERS.medium.monthlyQuota,
        AI_SMALL_MONTHLY: MODEL_TIERS.small.monthlyQuota,
      }
    },
    // Flattened lists for easy access
    topModels: TOP_MODELS,
    mediumModels: MEDIUM_MODELS,
    smallModels: SMALL_MODELS,
    freeModels: FREE_MODELS,
  });
}
