# Google Gemini & Vercel AI SDK Cheatsheet

This detailed guide covers how to use the Google Gemini models using the **Vercel AI SDK**. It includes snippets for setup, text generation, streaming, multimodal inputs, and advanced features like "Thinking" models and Google Search grounding.

---

## 1. Setup

### Installation
Install the core AI SDK and the Google Generative AI provider:

```bash
# npm
npm install ai @ai-sdk/google

# pnpm
pnpm add ai @ai-sdk/google

# yarn
yarn add ai @ai-sdk/google
```

### Authentication
Set your API key as an environment variable. Obtain a free key from [Google AI Studio](https://aistudio.google.com/).

**MacOS/Linux:**
```bash
export GOOGLE_GENERATIVE_AI_API_KEY="YOUR_API_KEY_HERE"
```

**Windows (Powershell):**
```powershell
setx GOOGLE_GENERATIVE_AI_API_KEY "YOUR_API_KEY_HERE"
```

---

## 2. Getting Started (Text Generation)

Generate a simple text response using `generateText`.

```typescript
import { generateText } from 'ai';
import { google } from '@ai-sdk/google';

const model = google('gemini-2.0-flash');

const { text } = await generateText({
  model: model,
  prompt: 'Why is the sky blue?',
  // Optional parameters:
  // system: 'You are a friendly assistant!',
  // temperature: 0.7,
});

console.log(text);
```

---

## 3. Streaming

Stream the response in real-time for better user experience in chat interfaces.

```typescript
import { streamText } from 'ai';
import { google } from '@ai-sdk/google';

const model = google('gemini-2.0-flash');

const { textStream } = streamText({
  model: model,
  prompt: 'Tell me a long story about a space traveler.',
});

for await (const textPart of textStream) {
  process.stdout.write(textPart);
}
```

---

## 4. Thinking Models

Support for Gemini models that include reasoning capabilities. You can configure a "thinking budget" and retrieve thought summaries.

```typescript
import { generateText } from 'ai';
import { google, GoogleGenerativeAIProviderOptions } from '@ai-sdk/google';

const model = google('gemini-2.0-flash-thinking-preview-01-21'); // Or latest thinking model

const response = await generateText({
  model: model,
  prompt: 'What is the sum of the first 10 prime numbers?',
  providerOptions: {
    google: {
      thinkingConfig: {
        thinkingBudget: 2048, // Range [0, 24576], 0 to disable
        includeThoughts: true 
      },
    } satisfies GoogleGenerativeAIProviderOptions,
  },
});

console.log("Response:", response.text);
console.log("Reasoning/Thoughts:", response.reasoning);
```

---

## 5. Grounding with Google Search

Connect the model to live Google Search results for up-to-date information.

```typescript
import { generateText } from 'ai';
import { google } from '@ai-sdk/google';

// Enable search grounding in the model configuration
const model = google('gemini-2.0-flash', { useSearchGrounding: true });

const { text, sources, providerMetadata } = await generateText({
  model: model,
  prompt: 'Who won the Super Bowl in 2025?',
});

console.log(text);
console.log("Sources:", sources);
console.log("Grounding Metadata:", providerMetadata?.google.groundingMetadata);
```

---

## 6. Tools and Function Calling

Define tools that the model can call to interact with external systems or run code.

```typescript
import { z } from 'zod';
import { generateText, tool } from 'ai';
import { google } from '@ai-sdk/google';

const model = google('gemini-2.0-flash');

const result = await generateText({
  model: model,
  prompt: 'What is the weather in San Francisco?',
  tools: {
    weather: tool({
      description: 'Get the weather in a location',
      parameters: z.object({
        location: z.string().describe('The location to get the weather for'),
      }),
      execute: async ({ location }) => ({
        location,
        temperature: 72 + Math.floor(Math.random() * 10),
      }),
    }),
  },
  maxSteps: 5, // Automatically call the tool and use the result in a second LLM pass
});

console.log(result.text);
```

---

## 7. Multimodal: Documents & Images

Gemini models can process multiple types of media (PDFs, Images, Video) natively.

### Document / PDF Understanding
```typescript
import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { readFile } from 'fs/promises';

const model = google('gemini-2.0-flash');

const { text } = await generateText({
  model: model,
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Extract the date and price from the invoice' },
        { 
          type: 'file', 
          data: await readFile('./invoice.pdf'), 
          mimeType: 'application/pdf' 
        },
      ],
    },
  ],
});
```

### Image Understanding
```typescript
import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { readFile } from 'fs/promises';

const model = google('gemini-2.0-flash');

const { text } = await generateText({
  model: model,
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: 'List all items from the picture' },
        { 
          type: 'image', 
          image: await readFile('./veggies.jpeg'), 
          mimeType: 'image/jpeg' 
        },
      ],
    },
  ],
});
```

---

## 8. Structured Output

Use `generateObject` to force the model to respond with valid JSON following a Zod schema.

```typescript
import { generateObject } from 'ai';
import { z } from 'zod';
import { google } from '@ai-sdk/google';
import { readFile } from 'fs/promises';

const model = google('gemini-2.0-flash');

const { object } = await generateObject({
  model: model,
  schema: z.object({
    date: z.string(),
    total_gross_worth: z.number(),
    invoice_number: z.string()
  }),
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Extract structured data from this PDF' },
        { 
          type: 'file', 
          data: await readFile('./invoice.pdf'), 
          mimeType: 'application/pdf' 
        },
      ],
    },
  ],
});

console.log(object.invoice_number);
```

---

For more information, visit the [AI SDK Documentation](https://sdk.vercel.ai/docs) and the [Google Gemini API Docs](https://ai.google.dev/docs).