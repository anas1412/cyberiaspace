# VERCEL_V5_AI_SDK_FOR_GROQ.md

This documentation provides a comprehensive guide to integrating **Groq** with the **Vercel AI SDK** (v5/v6). Groq is a specialized provider known for its high-performance LPU (Language Processing Unit) inference, offering exceptionally low latency for popular open-source models like Llama, Mixtral, and Gemma.

---

## 1. Setup

To use the Groq provider, install the `@ai-sdk/groq` package along with the core `ai` SDK.

### Installation
```bash
pnpm add @ai-sdk/groq ai
# or
npm install @ai-sdk/groq ai
# or
yarn add @ai-sdk/groq ai
```

### Environment Variables
The provider requires a Groq API key. By default, it looks for the `GROQ_API_KEY` environment variable.
```bash
GROQ_API_KEY=your_groq_api_key_here
```

---

## 2. Provider Instance

You can use the default `groq` instance or create a customized one using `createGroq`.

### Default Instance
```typescript
import { groq } from '@ai-sdk/groq';

const model = groq('llama-3.3-70b-versatile');
```

### Customized Instance
Use `createGroq` to specify custom headers, a different base URL (for proxies), or a custom fetch implementation.
```typescript
import { createGroq } from '@ai-sdk/groq';

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1', // Optional
  headers: { 'X-Custom-Header': 'value' },
  fetch: globalThis.fetch, // Optional custom fetch
});
```

---

## 3. Language Models

Groq supports a variety of open-source models. Popular model IDs include:
- `llama-3.3-70b-versatile`
- `llama-3.1-8b-instant`
- `gemma2-9b-it`
- `mixtral-8x7b-32768`

### Text Generation
```typescript
import { groq } from '@ai-sdk/groq';
import { generateText } from 'ai';

const { text } = await generateText({
  model: groq('llama-3.3-70b-versatile'),
  prompt: 'Explain quantum entanglement in one sentence.',
});
```

### Streaming Text
```typescript
import { groq } from '@ai-sdk/groq';
import { streamText } from 'ai';

const result = streamText({
  model: groq('llama-3.3-70b-versatile'),
  prompt: 'Write a long-form essay on the history of AI.',
});

for await (const delta of result.textStream) {
  process.stdout.write(delta);
}
```

---

## 4. Reasoning Models (DeepSeek & Qwen)

Groq supports reasoning models like `deepseek-r1-distill-llama-70b` and `qwen-qwq-32b`. These models provide a "chain of thought" or reasoning process.

### Configuring Reasoning
You can control how the reasoning tokens are handled via `reasoningFormat`.

```typescript
import { groq, type GroqLanguageModelOptions } from '@ai-sdk/groq';
import { generateText } from 'ai';

const result = await generateText({
  model: groq('deepseek-r1-distill-llama-70b'),
  providerOptions: {
    groq: {
      reasoningFormat: 'parsed', // Options: 'parsed' | 'raw' | 'hidden'
      reasoningEffort: 'medium', // Options: 'low' | 'medium' | 'high'
    } satisfies GroqLanguageModelOptions,
  },
  prompt: 'How many "r"s are in the word "strawberry"?',
});

// If using 'parsed', the SDK handles reasoning separately from the final answer
```

---

## 5. Structured Outputs (Object Generation)

Groq supports structured output generation using Zod schemas. Newer models use `json_schema` (strict) while older ones use `json_object`.

```typescript
import { groq } from '@ai-sdk/groq';
import { generateObject } from 'ai';
import { z } from 'zod';

const result = await generateObject({
  model: groq('llama-3.3-70b-versatile'),
  schema: z.object({
    recipe: z.object({
      name: z.string(),
      ingredients: z.array(z.string()),
      steps: z.array(z.string()),
    }),
  }),
  prompt: 'Generate a quick pasta recipe.',
});

console.log(result.object.recipe.name);
```

> **Note**: For models that do not support structured outputs natively, you can set `structuredOutputs: false` in `providerOptions`. In this case, ensure your prompt includes the word "JSON".

---

## 6. Image Input (Multi-modal)

Use models like `meta-llama/llama-4-scout-17b-16e-instruct` (or latest Llama Vision models) for vision tasks.

```typescript
import { groq } from '@ai-sdk/groq';
import { generateText } from 'ai';

const { text } = await generateText({
  model: groq('meta-llama/llama-4-scout-17b-16e-instruct'),
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: 'What do you see in this image?' },
        { type: 'image', image: 'https://example.com/sample.jpg' },
      ],
    },
  ],
});
```

---

## 7. Tool Usage & Browser Search

Groq supports parallel tool calling and a specialized **Browser Search Tool** (exclusive to specific models like `openai/gpt-oss-120b`).

### Basic Tool Usage
```typescript
import { groq } from '@ai-sdk/groq';
import { generateText, tool } from 'ai';
import { z } from 'zod';

const result = await generateText({
  model: groq('llama-3.3-70b-versatile'),
  tools: {
    getWeather: tool({
      description: 'Get weather for a city',
      parameters: z.object({ city: z.string() }),
      execute: async ({ city }) => ({ temperature: 72, unit: 'F' }),
    }),
  },
  prompt: 'What is the weather in San Francisco?',
});
```

### Groq Browser Search
```typescript
const result = await generateText({
  model: groq('openai/gpt-oss-120b'),
  tools: {
    browser_search: groq.tools.browserSearch({}),
  },
  toolChoice: 'required',
  prompt: 'Find the latest news about the JS AI SDK release.',
});
```

---

## 8. Transcription (Whisper)

You can use Groq’s high-speed Whisper implementation for audio transcription.

```typescript
import { experimental_transcribe as transcribe } from 'ai';
import { groq } from '@ai-sdk/groq';
import { readFile } from 'fs/promises';

const result = await transcribe({
  model: groq.transcription('whisper-large-v3'),
  audio: await readFile('meeting.mp3'),
  providerOptions: {
    groq: {
      language: 'en',
      responseFormat: 'verbose_json',
      timestampGranularities: ['word', 'segment'],
    },
  },
});

console.log(result.text);
```

---

## 9. Model Capabilities Summary

| Model ID | Image Input | Object Generation | Tool Usage |
| :--- | :---: | :---: | :---: |
| `llama-3.3-70b-versatile` | No | Yes | Yes |
| `llama-3.1-8b-instant` | No | Yes | Yes |
| `gemma2-9b-it` | No | Yes (JSON mode) | Yes |
| `llama-4-scout-17b-16e-instruct` | Yes | Yes | Yes |
| `whisper-large-v3` | Audio Only | N/A | N/A |

---

## 10. Advanced Provider Options

Within `providerOptions.groq`, you can configure:

- `parallelToolCalls`: (boolean) Enable/disable parallel tool execution (default: true).
- `serviceTier`: `'on_demand' | 'flex' | 'auto'` (Use 'flex' for higher throughput).
- `user`: (string) Unique ID for end-user monitoring.
- `strictJsonSchema`: (boolean) Guarantees schema compliance (default: true).