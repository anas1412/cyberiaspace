Below is a detailed `.md` (Markdown) file based on the official documentation for the **Google Generative AI Provider** in the Vercel AI SDK. This file is structured for easy reference via a CLI or for use as a local documentation source for LLMs.

---

# Google Generative AI Provider (Vercel AI SDK)

The `@ai-sdk/google` module provides language and embedding model support for Google’s Generative AI APIs (Gemini).

## 1. Setup

### Installation
Install the package using your preferred package manager:

```bash
pnpm add @ai-sdk/google
# or
npm install @ai-sdk/google
# or
yarn add @ai-sdk/google
```

### API Key Configuration
The provider requires a Google AI API Key. Obtain one from the [Google AI Studio](https://aistudio.google.com/).
By default, the SDK looks for the `GOOGLE_GENERATIVE_AI_API_KEY` environment variable.

---

## 2. Provider Instance

### Default Instance
Use the default `google` object for standard configurations:

```typescript
import { google } from '@ai-sdk/google';
```

### Customized Instance
Use `createGoogleGenerativeAI` to customize settings like base URL or headers:

```typescript
import { createGoogleGenerativeAI } from '@ai-sdk/google';

const google = createGoogleGenerativeAI({
  apiKey: 'YOUR_API_KEY', // Defaults to process.env.GOOGLE_GENERATIVE_AI_API_KEY
  baseURL: 'https://generativelanguage.googleapis.com/v1beta',
  headers: { 'Custom-Header': 'value' },
  fetch: globalThis.fetch, // Custom fetch implementation
});
```

---

## 3. Language Models

### Basic Usage
Initialize a model using its ID (e.g., `gemini-2.0-flash`):

```typescript
import { google } from '@ai-sdk/google';
import { generateText } from 'ai';

const { text } = await generateText({
  model: google('gemini-2.0-flash'),
  prompt: 'Write a vegetarian lasagna recipe.',
});
```

### Model Specific Settings
Pass provider-specific options such as **Safety Settings** or **Structured Outputs**:

```typescript
await generateText({
  model: google('gemini-2.0-flash'),
  providerOptions: {
    google: {
      safetySettings: [
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_LOW_AND_ABOVE' }
      ],
      structuredOutputs: true, // Enabled by default
    },
  },
});
```

---

## 4. Advanced "Thinking" Models
Gemini 2.5 and 3 models support an internal reasoning process.

### Gemini 3 (Thinking Level)
Controls the depth of reasoning (minimal, low, medium, high).
```typescript
const { text, reasoning } = await generateText({
  model: google('gemini-3-pro-preview'),
  providerOptions: {
    google: {
      thinkingConfig: { thinkingLevel: 'high', includeThoughts: true },
    },
  },
});
```

### Gemini 2.5 (Thinking Budget)
Controls the number of thinking tokens used.
```typescript
providerOptions: {
  google: {
    thinkingConfig: { thinkingBudget: 8192, includeThoughts: true },
  },
}
```

---

## 5. Multi-modal & File Inputs
The provider supports PDFs, images, and YouTube URLs.

### Local Files & YouTube
```typescript
const result = await generateText({
  model: google('gemini-2.5-flash'),
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Summarize this video and PDF.' },
        { type: 'file', data: fs.readFileSync('./data/doc.pdf'), mediaType: 'application/pdf' },
        { type: 'file', data: 'https://www.youtube.com/watch?v=...', mediaType: 'video/mp4' },
      ],
    },
  ],
});
```

---

## 6. Grounding (Search, Maps, RAG)

### Google Search Grounding
Access live web information with sources:
```typescript
const { text, sources } = await generateText({
  model: google('gemini-2.0-flash'),
  tools: {
    google_search: google.tools.googleSearch({
      mode: 'MODE_DYNAMIC', // Optional: trigger only when necessary
    }),
  },
  prompt: 'Latest news on AI SDK V6.',
});
```

### Google Maps Grounding
Location-aware responses with place data:
```typescript
tools: { google_maps: google.tools.googleMaps({}) },
providerOptions: {
  google: {
    retrievalConfig: { latLng: { latitude: 34.05, longitude: -118.24 } },
  },
}
```

### URL Context
Analyze specific URLs (up to 20):
```typescript
tools: { url_context: google.tools.urlContext({}) },
prompt: 'Analyze this docs page: https://ai-sdk.dev/...',
```

---

## 7. Caching
### Implicit Caching
Gemini 2.5 models automatically provide a 75% token discount if requests share common prefixes (min 1024-2048 tokens).

### Explicit Caching
For guaranteed persistence (requires `@google/genai` to create the cache):
```typescript
providerOptions: {
  google: { cachedContent: 'cachedContents/my-cache-id' },
}
```

---

## 8. Embedding & Image Models

### Embedding Models
```typescript
const model = google.embedding('text-embedding-004');
const { embedding } = await embed({
  model,
  value: 'sunny day',
  providerOptions: { google: { taskType: 'RETRIEVAL_QUERY' } },
});
```

### Image Models (Imagen)
```typescript
const { image } = await generateImage({
  model: google.image('imagen-4.0-generate-001'),
  prompt: 'A futuristic city',
  aspectRatio: '16:9',
});
```

---

## 9. Model Capability Matrix

| Model ID | Image Input | Tool Usage | Search Grounding | Thinking |
| :--- | :---: | :---: | :---: | :---: |
| `gemini-3-pro-preview` | ✅ | ✅ | ✅ | ✅ (Level) |
| `gemini-2.5-flash` | ✅ | ✅ | ✅ | ✅ (Budget) |
| `gemini-2.0-flash` | ✅ | ✅ | ✅ | ❌ |
| `gemini-1.5-pro` | ✅ | ✅ | ❌ | ❌ |

---

## 10. Troubleshooting & Limitations

- **Schema Unions**: Google Generative AI does not support `z.union` or `z.record` in structured outputs.
- **Workaround**: Disable structured outputs if using complex schemas:
  ```typescript
  providerOptions: { google: { structuredOutputs: false } }
  ```
- **Gemma Support**: Gemma models are supported but don't natively handle `systemInstruction`. The provider automatically prepends the system prompt to the first user message.