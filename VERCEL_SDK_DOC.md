Here is a detailed Markdown file documenting how to generate structured data using the AI SDK Core, formatted for feeding into the Gemini CLI.

***

# AI SDK Core: Generating Structured Data

This guide details how to generate structured data (JSON) using the AI SDK Core. While language models natively generate text, you often need structured outputs for tasks like data extraction, classification, or synthetic data generation. The AI SDK standardizes this across providers using Zod, Valibot, or JSON schemas.

## Overview

The standard way to generate structured data in AI SDK Core is by using the `output` property within `generateText` and `streamText` functions. This replaces the legacy `generateObject` and `streamObject` functions.

**Key Features:**
*   **Validation:** Automatically validates generated data against your schema.
*   **Standardization:** Works consistently across different model providers.
*   **Tool Integration:** Can be combined with tool calling in the same request.

---

## 1. Generating Structured Outputs (`generateText`)

Use `generateText` with `Output.object()` to generate a structured object from a prompt. The operation waits for the entire generation to complete before returning the result.

### Basic Usage

```typescript
import { generateText, Output } from 'ai';
import { z } from 'zod';

const { output } = await generateText({
  model: "anthropic/claude-sonnet-4.5", // Or any supported provider
  output: Output.object({
    schema: z.object({
      recipe: z.object({
        name: z.string(),
        ingredients: z.array(
          z.object({ name: z.string(), amount: z.string() }),
        ),
        steps: z.array(z.string()),
      }),
    }),
  }),
  prompt: 'Generate a lasagna recipe.',
});

// 'output' is strictly typed to your Zod schema
console.log(output.recipe.name);
```

### Accessing Response Headers & Body
If you need provider-specific metadata (headers, raw body), access the `response` property:

```typescript
const result = await generateText({
  // ... configuration ...
  output: Output.object({ schema }),
});

console.log(result.response.headers);
console.log(result.response.body);
```

---

## 2. Stream Structured Outputs (`streamText`)

For interactive use cases where latency matters, use `streamText` to stream the structure as it is being generated.

### Basic Streaming Usage

```typescript
import { streamText, Output } from 'ai';
import { z } from 'zod';

const { partialOutputStream } = streamText({
  model: "anthropic/claude-sonnet-4.5",
  output: Output.object({
    schema: z.object({
      // ... your Zod schema ...
    }),
  }),
  prompt: 'Generate a lasagna recipe.',
});

// Iterate over the stream as it arrives
for await (const partialObject of partialOutputStream) {
  console.log(partialObject); // Logs partial JSON objects
}
```

> **Note:** `partialOutputStream` emits partial objects. These may not yet strictly conform to your schema until the stream finishes.

### Error Handling in Streams
Errors during streaming (e.g., network issues) are not thrown immediately to avoid crashing the stream. Handle them via the `onError` callback:

```typescript
streamText({
  // ...
  onError({ error }) {
    console.error("Streaming error:", error);
  },
});
```

---

## 3. Output Types

The `output` property supports several strategies depending on your needs.

### `Output.object({ schema })`
Generates a single typed object matching the provided schema.
*   **Validation:** Strict.
*   **Use case:** Extracting specific entities or generating complex forms.

### `Output.array({ element })`
Generates an array where each item matches the `element` schema.
*   **Streaming:** Use `elementStream` instead of `partialOutputStream` to receive fully validated items one by one as they complete.

```typescript
const { elementStream } = streamText({
  model: "openai/gpt-4-turbo",
  output: Output.array({
    element: z.object({
      city: z.string(),
      temperature: z.number(),
    }),
  }),
  prompt: 'List weather for 3 major cities.',
});

for await (const weatherItem of elementStream) {
  // 'weatherItem' is a complete, validated object
  console.log(weatherItem); 
}
```

### `Output.choice({ options })`
Forces the model to select one string from a predefined list.
*   **Use case:** Classification, sentiment analysis.

```typescript
const { output } = await generateText({
  // ...
  output: Output.choice({
    options: ['positive', 'neutral', 'negative'],
  }),
  prompt: 'Analyze sentiment: "I love this product!"',
});
// output will be "positive"
```

### `Output.json()`
Generates unstructured JSON. The SDK ensures it is valid JSON but does not validate the shape/contents against a specific schema.
*   **Use case:** Flexible structures, arbitrary data objects.

### `Output.text()`
The default behavior. Generates plain text strings.

---

## 4. Advanced Features

### Combining with Tools
You can generate structured output *and* call tools in the same request.

```typescript
import { generateText, Output, tool, stepCountIs } from 'ai';
import { z } from 'zod';

const { output } = await generateText({
  model: "anthropic/claude-sonnet-4.5",
  tools: {
    weather: tool({
      description: 'Get weather',
      inputSchema: z.object({ location: z.string() }),
      execute: async ({ location }) => ({ temp: 72 }),
    }),
  },
  output: Output.object({
    schema: z.object({
      summary: z.string(),
      recommendation: z.string(),
    }),
  }),
  // Ensure enough steps for tool execution + final output
  stopWhen: stepCountIs(5), 
  prompt: 'What should I wear in San Francisco?',
});
```

### Schema Hints (`.describe`)
Use `.describe()` in Zod to improve model accuracy by providing context for fields.

```typescript
z.object({
  name: z.string().describe('The official name of the recipe'),
  amount: z.string().describe('Quantity in grams or ml'),
})
```

### Accessing Reasoning
If using a reasoning model (like standard "thinking" models), access the thought process via `reasoningText`.

```typescript
const result = await generateText({
  // ... model config ...
  output: Output.object({ schema }),
});

console.log(result.reasoningText); // String containing the model's thoughts
```

### Error Handling (`NoObjectGeneratedError`)
If the model fails to generate a valid object (e.g., valid JSON but wrong schema, or invalid JSON), a `NoObjectGeneratedError` is thrown.

```typescript
import { generateText, NoObjectGeneratedError } from 'ai';

try {
  await generateText({ ... });
} catch (error) {
  if (NoObjectGeneratedError.isInstance(error)) {
    console.log('Cause:', error.cause);
    console.log('Generated Text:', error.text); // See what the model actually wrote
    console.log('Usage:', error.usage);
  }
}
```

---

## 5. Legacy Functions (Deprecated)

**`generateObject`** and **`streamObject`** are deprecated.
*   They function similarly to `generateText` with `Output.object`.
*   Migrate to `generateText` and `streamText` with the `output` property for long-term support and access to newer features (like `Output.choice`).