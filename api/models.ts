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
      { id: 'deepseek/deepseek-r1', name: 'DeepSeek: R1', desc: '' },
      { id: 'openai/gpt-5.4', name: 'OpenAI: GPT-5.4', desc: '' },
      { id: 'google/gemini-3.1-pro-preview', name: 'Google: Gemini 3.1 Pro Preview', desc: '' },
      { id: 'anthropic/claude-sonnet-4.6', name: 'Anthropic: Claude Sonnet 4.6', desc: '' },
      { id: 'anthropic/claude-opus-4.6', name: 'Anthropic: Claude Opus 4.6', desc: '' },
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
      { id: 'deepseek/deepseek-v3.2', name: 'DeepSeek: V3.2', desc: '' },
      { id: 'openai/gpt-5.4-mini', name: 'OpenAI: GPT-5.4 Mini', desc: '' },
      { id: 'openai/o4-mini', name: 'OpenAI: o4 Mini', desc: '' },
      { id: 'google/gemini-3-flash-preview', name: 'Google: Gemini 3 Flash Preview', desc: '' },
      { id: 'google/gemini-3.1-flash-lite-preview', name: 'Google: Gemini 3.1 Flash Lite Preview', desc: '' },
      { id: 'anthropic/claude-haiku-4.5', name: 'Anthropic: Claude Haiku 4.5', desc: '' },
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
      { id: 'openai/gpt-5-nano', name: 'OpenAI: GPT-5 Nano', desc: '' },
      { id: 'google/gemini-2.5-flash-lite', name: 'Google: Gemini 2.5 Flash Lite', desc: '' },
      { id: 'meta/llama-4-scout', name: 'Meta: Llama 4 Scout', desc: '' },
      { id: 'mistral/mistral-small-2603', name: 'Mistral: Small 4', desc: '' },
      { id: 'deepseek/deepseek-chat-v3.1', name: 'DeepSeek: V3.1', desc: '' },
    ]
  },
  free: {
    name: 'Free Tier',
    quota: null,         
    weeklyQuota: null,
    monthlyQuota: null,
    description: 'Free models with unlimited access',
    models: [
      { id: 'openrouter/free', name: 'Random Free Model', desc: '' },
      { id: 'minimax/minimax-m2.5:free', name: 'MiniMax M2.5', desc: '' },
      { id: 'arcee-ai/trinity-mini:free', name: 'Arcee AI: Trinity Mini', desc: '' },
      { id: 'nvidia/nemotron-3-super-120b-a12b:free', name: 'NVIDIA: Nemotron 3 Super', desc: '' },
      { id: 'stepfun/step-3.5-flash:free', name: 'StepFun: Step 3.5 Flash', desc: '' },
      { id: 'z-ai/glm-4.5-air:free', name: 'Z.ai: GLM 4.5 Air', desc: '' },

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
