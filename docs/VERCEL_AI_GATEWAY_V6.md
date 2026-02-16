# VERCEL_V5_AI_SDK_AI_GATEWAY.md

This documentation provides a comprehensive guide to using the **Vercel AI Gateway** provider with the **Vercel AI SDK** (v5/v6). The AI Gateway acts as a unified middleware layer that connects you to 20+ providers (OpenAI, Anthropic, Google, Meta, etc.) through a single interface, offering features like model fallbacks, observability, and zero-config authentication.

---

## 1. Setup

The AI Gateway provider is built directly into the core `ai` package (version `5.0.36` or later).

### Installation
```bash
pnpm add ai
# or
npm install ai
```

### Environment Variables
For manual authentication, use the `AI_GATEWAY_API_KEY`. If deployed on Vercel, the SDK can automatically use **OIDC** (OpenID Connect) tokens, removing the need for manual keys.
```bash
AI_GATEWAY_API_KEY=your_gateway_api_key_here
```

---

## 2. Provider Instance

You can use the built-in `gateway` instance or create a custom one with `createGateway`.

### Default Instance
The AI SDK automatically uses the gateway if you pass a model string in the `creator/model-name` format.
```typescript
import { generateText, gateway } from 'ai';

// Method A: String syntax (auto-uses gateway)
const { text } = await generateText({
  model: 'openai/gpt-4o',
  prompt: 'Hello!',
});

// Method B: Explicit gateway instance
const { text: text2 } = await generateText({
  model: gateway('anthropic/claude-3-5-sonnet'),
  prompt: 'Hello!',
});
```

### Custom Instance
Use `createGateway` to override the base URL, headers, or API key.
```typescript
import { createGateway } from 'ai';

const myGateway = createGateway({
  apiKey: process.env.AI_GATEWAY_API_KEY,
  baseURL: 'https://ai-gateway.vercel.sh/v3/ai', // Default
  headers: { 'X-Custom-Source': 'MyApp' },
});
```

---

## 3. Routing & Model Fallbacks

One of the AI Gateway's primary strengths is its ability to handle routing logic and fallbacks automatically.

### Configuring Fallbacks
You can specify primary and fallback models using `providerOptions`.
```typescript
import type { GatewayLanguageModelOptions } from '@ai-sdk/gateway';
import { generateText } from 'ai';

const { text } = await generateText({
  model: 'openai/gpt-4o', // Primary model
  providerOptions: {
    gateway: {
      // If gpt-4o fails, try these in order:
      models: ['openai/gpt-4-turbo', 'anthropic/claude-3-haiku'],
    } satisfies GatewayLanguageModelOptions,
  },
  prompt: 'Write a technical summary.',
});
```

### Provider Routing Control
- `order`: Specifies the sequence of providers to attempt.
- `only`: Restricts routing to specific providers.
```typescript
providerOptions: {
  gateway: {
    order: ['vertex', 'anthropic'], // Prefer Vertex AI, then fall back to Anthropic
    only: ['vertex', 'anthropic'],  // Do not use any other providers
  } satisfies GatewayLanguageModelOptions,
}
```

---

## 4. Discovery & Credits

The Gateway allows you to query available models and your remaining credit balance programmatically.

### Get Available Models
```typescript
import { gateway } from 'ai';

const { models } = await gateway.getAvailableModels();
models.forEach(m => console.log(`${m.id}: $${m.pricing?.input}/token`));
```

### Check Credit Balance
```typescript
const credits = await gateway.getCredits();
console.log(`Balance: ${credits.balance}, Total Used: ${credits.total_used}`);
```

---

## 5. Built-in Gateway Tools

The Gateway provides specialized tools that can be used with *any* model, even those that don't natively support web search.

### Perplexity Search
```typescript
import { gateway, generateText } from 'ai';

const result = await generateText({
  model: 'openai/gpt-4o-mini',
  prompt: 'What are the top AI news stories from this morning?',
  tools: {
    perplexity_search: gateway.tools.perplexitySearch({
      maxResults: 5,
      searchRecencyFilter: 'day',
    }),
  },
});
```

### Parallel Search
Optimized for "agentic" workflows, providing concise excerpts for multi-step reasoning.
```typescript
tools: {
  parallel_search: gateway.tools.parallelSearch({
    mode: 'agentic',
    sourcePolicy: { includeDomains: ['github.com'] },
  }),
}
```

---

## 6. Observability: User Tracking & Tags

Track usage and costs per end-user or per feature for analytics.
```typescript
const { text } = await generateText({
  model: 'anthropic/claude-3-5-sonnet',
  providerOptions: {
    gateway: {
      user: 'user_9921',               // ID for spend attribution
      tags: ['premium', 'chat-v2'],    // Categorize in Vercel Dashboard
    } satisfies GatewayLanguageModelOptions,
  },
  prompt: 'Hello!',
});
```

---

## 7. Zero Data Retention (ZDR)

Enforce that requests are only routed to providers with confirmed zero-data-retention policies.
```typescript
providerOptions: {
  gateway: {
    zeroDataRetention: true,
  } satisfies GatewayLanguageModelOptions,
}
```

---

## 8. Provider-Specific Options

When using the Gateway, you can still pass options to the underlying provider (e.g., Anthropic's `thinking` mode).
```typescript
import type { AnthropicLanguageModelOptions } from '@ai-sdk/anthropic';

const { text } = await generateText({
  model: 'anthropic/claude-3-7-sonnet',
  providerOptions: {
    // Gateway settings
    gateway: { order: ['anthropic'] },
    // Underling provider settings
    anthropic: {
      thinking: { type: 'enabled', budgetTokens: 12000 },
    } satisfies AnthropicLanguageModelOptions,
  },
  prompt: 'Solve this complex math problem.',
});
```

---

## 9. Bring Your Own Key (BYOK)

If you have private resources or existing accounts with specific providers, you can pass credentials per-request.
```typescript
providerOptions: {
  gateway: {
    byok: {
      'anthropic': [{ apiKey: 'sk-ant-...' }],
      'vertex': [{ project: 'my-project-id', googleCredentials: { ... } }],
    },
  } satisfies GatewayLanguageModelOptions,
}
```

---

## 10. Summary of Capabilities

| Feature | Description |
| :--- | :--- |
| **Model Fallbacks** | Automatically switch models on failure using the `models` option. |
| **Provider Routing** | Control order of preference between providers (e.g., Bedrock vs Vertex). |
| **Built-in Search** | `perplexitySearch` and `parallelSearch` tools available to all models. |
| **Usage Tracking** | Native support for `user` IDs and `tags` for Vercel analytics. |
| **Auto-Auth** | OIDC support on Vercel removes the need for `AI_GATEWAY_API_KEY`. |