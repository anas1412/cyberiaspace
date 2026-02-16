# Groq Provider - AI SDK Documentation

The Groq provider for the [AI SDK](https://sdk.vercel.ai/docs) contains language model support for the Groq API, known for its high-speed inference using LPU (Language Processing Unit) technology.

## Installation

The Groq provider is available via the `@ai-sdk/groq` module.

```bash
pnpm add @ai-sdk/groq
# or
npm install @ai-sdk/groq
# or
yarn add @ai-sdk/groq
```

## Setup

### API Key
By default, the provider uses the `GROQ_API_KEY` environment variable.

### Provider Instance
You can use the default `groq` instance or create a customized one using `createGroq`.

```typescript
import { groq } from '@ai-sdk/groq';

// Or with custom settings
import { createGroq } from '@ai-sdk/groq';

const groqCustom = createGroq({
  apiKey: 'your-api-key', // Optional: defaults to process.env.GROQ_API_KEY
  baseURL: 'https://api.groq.com/openai/v1', // Optional custom base URL
  headers: { 'Custom-Header': 'value' },
});
```

## Language Models

You can create Groq models by passing the model ID as the first argument.

```typescript
const model = groq('llama-3.3-70b-versatile');
```

### Popular Model IDs
- `llama-3.3-70b-versatile`
- `llama-3.1-8b-instant`
- `gemma2-9b-it`
- `mixtral-8x7b-32768`
- `deepseek-r1-distill-llama-70b` (Reasoning)
- `qwen-qwq-32b` (Reasoning)

## Reasoning Models

Groq supports advanced reasoning models. You can configure how the "Chain of Thought" reasoning is handled using `reasoningFormat`.

```typescript
import { groq, type GroqLanguageModelOptions } from '@ai-sdk/groq';
import { generateText } from 'ai';

const result = await generateText({
  model: groq('deepseek-r1-distill-llama-70b'),
  providerOptions: {
    groq: {
      reasoningFormat: 'parsed', // Options: 'parsed' | 'raw' | 'hidden'
      reasoningEffort: 'medium', // Options: 'low' | 'medium' | 'high' | 'default'
    } satisfies GroqLanguageModelOptions,
  },
  prompt: 'Solve for x: 2x + 5 = 15',
});
```

## Structured Outputs

Structured outputs are enabled by default for Groq models using `json_schema`.

### Standard Usage
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
    }),
  }),
  prompt: 'Generate a lasagna recipe.',
});
```

### Disabling Structured Outputs
For older models that do not support strict schema compliance, you can disable this feature to fallback to standard `json_object` mode:
```typescript
providerOptions: {
  groq: {
    structuredOutputs: false,
  }
}
```

## Multi-modal (Image Input)

Groq's vision-capable models (like `llama-3.2-11b-vision-preview`) allow image inputs via URLs or Base64.

```typescript
const { text } = await generateText({
  model: groq('llama-3.2-11b-vision-preview'),
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: 'What is in this image?' },
        { type: 'image', image: 'https://example.com/photo.jpg' },
      ],
    },
  ],
});
```

## Browser Search Tool

Groq provides a unique **Browser Search Tool** that allows models to interactively navigate the web. This is currently supported by specific models like `openai/gpt-oss-120b`.

```typescript
const result = await generateText({
  model: groq('openai/gpt-oss-120b'),
  prompt: 'What are the latest developments in AI today?',
  tools: {
    browser_search: groq.tools.browserSearch({}),
  },
  toolChoice: 'required',
});
```

## Transcription Models

Groq offers high-speed speech-to-text via Whisper models.

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
      responseFormat: 'verbose_json' 
    },
  },
});
```

## Model Capabilities Table

| Model ID | Image Input | Object Gen | Tool Usage | Tool Streaming |
| :--- | :---: | :---: | :---: | :---: |
| `llama-3.3-70b-versatile` | ❌ | ✅ | ✅ | ✅ |
| `llama-3.2-11b-vision-preview` | ✅ | ✅ | ✅ | ✅ |
| `gemma2-9b-it` | ❌ | ✅ | ✅ | ✅ |
| `qwen-qwq-32b` | ❌ | ✅ | ✅ | ✅ |

## Provider Settings

When creating a provider instance with `createGroq`, the following options are available:

- `baseURL`: (Optional) The API endpoint. Default: `https://api.groq.com/openai/v1`.
- `apiKey`: (Optional) Your Groq API key.
- `headers`: (Optional) Custom headers for requests.
- `fetch`: (Optional) Custom fetch implementation for proxying or testing.
