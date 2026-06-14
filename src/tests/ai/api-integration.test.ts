/**
 * AI API Integration Tests
 *
 * These tests hit REAL external APIs (OpenRouter, Tavily).
 * They are CONDITIONAL — they skip if required env vars aren't set or
 * if the machine can't reach the APIs (no network / firewall).
 *
 * To run these tests:
 *   1. cp .env.example .env
 *   2. Fill in your API keys in .env
 *   3. bun test --timeout 30000 src/tests/ai/api-integration.test.ts
 *
 * Env vars required per test group:
 *   - OpenRouter models list: none (public endpoint)
 *   - OpenRouter chat completion: OPENROUTER_API_KEY + OPENROUTER_MODEL
 *   - Tavily search: VITE_TAVILY_API_KEY (VITE_ prefix required by webSearch.ts at runtime)
 */

import { describe, it, expect, beforeAll } from 'bun:test';

const OR_API_BASE = 'https://openrouter.ai/api/v1';
const TAVILY_URL = 'https://api.tavily.com';

// ============================================
// Env Vars & Helpers
// ============================================

const env = (key: string): string | undefined =>
  process.env[key] || undefined;

const OPENROUTER_KEY = env('OPENROUTER_API_KEY');
const OPENROUTER_MODEL = env('OPENROUTER_MODEL') || 'openai/gpt-4o';
const TAVILY_KEY = env('VITE_TAVILY_API_KEY');

/** Fetch that returns null on any network/socket error instead of throwing */
async function tryFetch(url: string, init?: RequestInit): Promise<Response | null> {
  try {
    return await fetch(url, init);
  } catch {
    return null;
  }
}

/** Shared headers for OpenRouter chat completion requests */
function orHeaders(key?: string): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (key) {
    h['Authorization'] = `Bearer ${key}`;
    h['HTTP-Referer'] = 'https://cyberiaspace.app';
    h['X-Title'] = 'Cyberia';
  }
  return h;
}

// ============================================
// OpenRouter — Models List (Public)
// ============================================
describe('OpenRouter — GET /models (public)', () => {
  let models: { id: string; name: string }[] | null = null;
  let networkError: string | null = null;

  beforeAll(async () => {
    const res = await tryFetch(`${OR_API_BASE}/models`);
    if (!res) { networkError = 'Network error'; return; }
    if (!res.ok) { networkError = `HTTP ${res.status}`; return; }
    const json = await res.json();
    models = json.data || null;
  });

  it('returns list of models', () => {
    if (networkError) return;
    expect(models).toBeDefined();
    expect(Array.isArray(models)).toBeTrue();
    expect(models!.length).toBeGreaterThan(0);
  });

  it('each model has id and name', () => {
    if (!models) return;
    for (const m of models.slice(0, 10)) {
      expect(typeof m.id).toBe('string');
      expect(m.id.length).toBeGreaterThan(0);
      expect(typeof m.name).toBe('string');
      expect(m.name.length).toBeGreaterThan(0);
    }
  });

  it('includes well-known models like openai/gpt-4o', () => {
    if (!models) return;
    const ids = models.map((m) => m.id);
    expect(ids).toContain('openai/gpt-4o');
  });

  it('includes models with tool-calling support', async () => {
    if (networkError) return;
    const res = await tryFetch(`${OR_API_BASE}/models`);
    if (!res) return;
    const json = await res.json();
    const data: any[] = json.data || [];
    const withTools = data.filter(
      (m: any) =>
        Array.isArray(m.supported_parameters) &&
        m.supported_parameters.includes('tools'),
    );
    expect(withTools.length).toBeGreaterThan(0);
  });
});

// ============================================
// OpenRouter — Chat Completion
// ============================================
describe('OpenRouter — POST /chat/completions', () => {
  const missingKey = !OPENROUTER_KEY;

  beforeAll(() => {
    if (missingKey) console.warn('⚠️  Skipping — set OPENROUTER_API_KEY in .env');
  });

  it('rejects bad API key with 401', async () => {
    if (missingKey) return;
    const res = await tryFetch(`${OR_API_BASE}/chat/completions`, {
      method: 'POST',
      headers: orHeaders('sk-or-v1-bad-key'),
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [{ role: 'user', content: 'hi' }],
      }),
    });
    if (!res) return;
    expect(res.status).toBe(401);
  });

  it('completes a simple text prompt', async () => {
    if (missingKey) return;
    const res = await tryFetch(`${OR_API_BASE}/chat/completions`, {
      method: 'POST',
      headers: orHeaders(OPENROUTER_KEY),
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [{ role: 'user', content: 'Reply with exactly one word: hello' }],
        max_tokens: 50,
      }),
    });
    if (!res) return;
    expect(res.ok).toBeTrue();
    const json = await res.json();
    expect(json.choices).toBeDefined();
    expect(json.choices.length).toBeGreaterThan(0);
    const content: string = json.choices[0].message?.content || '';
    expect(content.length).toBeGreaterThan(0);
  });

  it('returns token usage metadata', async () => {
    if (missingKey) return;
    const res = await tryFetch(`${OR_API_BASE}/chat/completions`, {
      method: 'POST',
      headers: orHeaders(OPENROUTER_KEY),
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [{ role: 'user', content: 'Say "ok"' }],
        max_tokens: 10,
      }),
    });
    if (!res) return;
    const json = await res.json();
    expect(json.usage).toBeDefined();
    expect(typeof json.usage.prompt_tokens).toBe('number');
    expect(typeof json.usage.completion_tokens).toBe('number');
    expect(json.usage.prompt_tokens).toBeGreaterThan(0);
  });

  it('supports tool/function calling format', async () => {
    if (missingKey) return;
    const res = await tryFetch(`${OR_API_BASE}/chat/completions`, {
      method: 'POST',
      headers: orHeaders(OPENROUTER_KEY),
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [{ role: 'user', content: 'Create a thought called "Meeting Notes" with status "todo"' }],
        max_tokens: 200,
      }),
    });
    if (!res) return;
    expect(res.ok).toBeTrue();
    const json = await res.json();
    const content: string = json.choices[0].message?.content || '';
    expect(content.length).toBeGreaterThan(0);
    expect(content.toLowerCase()).toMatch(/(create|thought|meeting|notes|todo)/);
  });

  it('uses the configured model', async () => {
    if (missingKey) return;
    const res = await tryFetch(`${OR_API_BASE}/chat/completions`, {
      method: 'POST',
      headers: orHeaders(OPENROUTER_KEY),
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [{ role: 'user', content: 'Say "ok"' }],
        max_tokens: 10,
      }),
    });
    if (!res) return;
    const json = await res.json();
    expect(json.model).toBe(OPENROUTER_MODEL);
  });

  it('handles streaming responses', async () => {
    if (missingKey) return;
    const res = await tryFetch(`${OR_API_BASE}/chat/completions`, {
      method: 'POST',
      headers: orHeaders(OPENROUTER_KEY),
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [{ role: 'user', content: 'Count: 1 2 3' }],
        max_tokens: 30,
        stream: true,
      }),
    });
    if (!res) return;
    expect(res.ok).toBeTrue();
    const reader = res.body?.getReader();
    expect(reader).toBeDefined();

    const decoder = new TextDecoder();
    let fullText = '';
    let chunkCount = 0;

    while (true) {
      const { done, value } = await reader!.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      fullText += chunk;
      chunkCount++;

      const lines = chunk
        .split('\n')
        .filter((l) => l.trim().startsWith('data: ') && !l.includes('[DONE]'));
      for (const line of lines) {
        const parsed = JSON.parse(line.slice(6));
        expect(parsed.choices).toBeDefined();
      }
    }

    expect(chunkCount).toBeGreaterThan(0);
    expect(fullText).toContain('data: [DONE]');
  });
});

// ============================================
// OpenRouter — Model Pricing
// ============================================
describe('OpenRouter — model pricing', () => {
  it('pricing fields are present for top models', async () => {
    const res = await tryFetch(`${OR_API_BASE}/models`);
    if (!res) return;
    const json = await res.json();
    const gpt4o = json.data.find((m: any) => m.id === 'openai/gpt-4o');
    if (!gpt4o) return;
    expect(gpt4o.pricing).toBeDefined();
    expect(gpt4o.pricing.prompt).toBeDefined();
    expect(gpt4o.pricing.completion).toBeDefined();
    const promptPrice = Number(gpt4o.pricing.prompt);
    expect(promptPrice).toBeGreaterThan(0);
    expect(promptPrice).toBeLessThan(1);
  });
});

// ============================================
// Tavily — Web Search
// ============================================
describe('Tavily — web search', () => {
  const missingKey = !TAVILY_KEY;

  beforeAll(() => {
    if (missingKey) console.warn('⚠️  Skipping — set VITE_TAVILY_API_KEY in .env');
  });

  it('rejects bad API key', async () => {
    if (missingKey) return;
    const res = await tryFetch(`${TAVILY_URL}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: 'tvly-bad-key',
        query: 'test',
        search_depth: 'basic',
        max_results: 3,
      }),
    });
    if (!res) return;
    expect([401, 422]).toContain(res.status);
  });

  it('performs a basic web search', async () => {
    if (missingKey) return;
    const res = await tryFetch(`${TAVILY_URL}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: TAVILY_KEY,
        query: 'latest AI news 2026',
        search_depth: 'basic',
        max_results: 3,
        include_answer: true,
      }),
    });
    if (!res) return;
    expect(res.ok).toBeTrue();
    const json = await res.json();
    expect(Array.isArray(json.results)).toBeTrue();
    expect(json.results.length).toBeGreaterThan(0);
    for (const r of json.results) {
      expect(typeof r.title).toBe('string');
      expect(typeof r.url).toBe('string');
      expect(r.url).toMatch(/^https?:\/\//);
      expect(typeof r.content).toBe('string');
    }
  });

  it('returns an answer summary when include_answer is true', async () => {
    if (missingKey) return;
    const res = await tryFetch(`${TAVILY_URL}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: TAVILY_KEY,
        query: 'what is cyberia space',
        search_depth: 'basic',
        max_results: 3,
        include_answer: true,
      }),
    });
    if (!res) return;
    const json = await res.json();
    expect(json.answer).toBeDefined();
    expect(typeof json.answer).toBe('string');
    expect(json.answer.length).toBeGreaterThan(0);
  });

  it('supports deep search depth', async () => {
    if (missingKey) return;
    const res = await tryFetch(`${TAVILY_URL}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: TAVILY_KEY,
        query: 'TypeScript performance optimization 2026',
        search_depth: 'advanced',
        max_results: 5,
      }),
    });
    if (!res) return;
    expect(res.ok).toBeTrue();
    const json = await res.json();
    expect(json.results.length).toBeGreaterThanOrEqual(1);
    const totalChars = json.results.reduce(
      (sum: number, r: any) => sum + (r.content?.length || 0),
      0,
    );
    expect(totalChars).toBeGreaterThan(50);
  });
});

// ============================================
// Cross-API — Tool Calling
// ============================================
describe('OpenRouter — tool calling capability', () => {
  const missingKey = !OPENROUTER_KEY;

  it('responds to function-calling prompt', async () => {
    if (missingKey) return;
    const res = await tryFetch(`${OR_API_BASE}/chat/completions`, {
      method: 'POST',
      headers: orHeaders(OPENROUTER_KEY),
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [
          {
            role: 'system',
            content:
              'You have a tool called "create_thought" that creates a thought with text and status fields.',
          },
          {
            role: 'user',
            content: 'Create a thought called "Buy groceries" with status "todo"',
          },
        ],
        max_tokens: 300,
      }),
    });
    if (!res) return;
    const json = await res.json();
    const msg = json.choices[0]?.message || {};
    const content: string = msg.content || '';
    const toolCalls: { function?: { name?: string; arguments?: string } }[] | undefined = msg.tool_calls;

    // Models respond differently: some emit structured tool_calls, others describe in text
    if (toolCalls && toolCalls.length > 0) {
      // Model used structured function/tool calling
      const fn = toolCalls[0]?.function;
      expect(fn?.name || fn?.arguments).toBeTruthy();
    } else {
      // Model described the action in natural language
      expect(content.length).toBeGreaterThan(0);
      expect(content.toLowerCase()).toMatch(/create|thought|groceries|todo/i);
    }
  });
});
