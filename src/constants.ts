export const LIMITS = {
  MAX_SPACES: 6,
  MIN_SPACES: 1,
  MAX_THOUGHTS_PER_SPACE: 40,
  MAX_CLOUD_THOUGHTS: 240, // 6 spaces * 40 thoughts
};

export const DEFAULT_MODEL = 'gemini-2.0-flash-lite';

export const AVAILABLE_MODELS = [
/*   'gemini-3-pro-preview',
  'gemini-3-flash-preview',
  'gemini-2.5-pro',
  'gemini-2.5-flash', 
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',  */
  'gemini-2.0-flash-lite',
];

export const VERIFICATION_MODEL = [
  'gemma-3-27b-it'
];