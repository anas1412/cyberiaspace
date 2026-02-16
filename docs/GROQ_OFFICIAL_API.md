# GROQ_QUICKSTART_GUIDE.md

This document provides the essential steps to get started with the **Groq Cloud platform**, focusing on API setup, SDK installation, and basic implementation for high-speed inference using LPU™ (Language Processing Unit) technology.

---

## 1. Prerequisites & API Key

To use Groq, you must first create an account and generate an API key.

1.  **Create Account**: Sign up at [console.groq.com](https://console.groq.com/).
2.  **Generate API Key**: Navigate to the **API Keys** section in the sidebar.
3.  **Set Environment Variable**: For security, store your key in your environment.
    ```bash
    export GROQ_API_KEY=gsk_your_key_here
    ```

---

## 2. Installation

Groq provides official SDKs for Node.js and Python.

### Node.js
```bash
npm install groq-sdk
# or
yarn add groq-sdk
```

### Python
```bash
pip install groq
```

---

## 3. Basic Chat Completion (Node.js)

The following example demonstrates how to initialize the client and send a simple prompt to a Llama model.

```typescript
import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

async function main() {
  const chatCompletion = await groq.chat.completions.create({
    messages: [
      {
        role: "user",
        content: "Explain the benefits of LPU inference in one sentence.",
      },
    ],
    model: "llama-3.3-70b-versatile",
  });

  console.log(chatCompletion.choices[0]?.message?.content || "");
}

main();
```

---

## 4. Streaming Responses

Groq’s speed is best experienced via streaming, allowing tokens to be displayed as they are generated.

```typescript
const stream = await groq.chat.completions.create({
  messages: [
    { role: "user", content: "Write a poem about high-speed computing." },
  ],
  model: "llama-3.3-70b-versatile",
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content || "");
}
```

---

## 5. Vision (Multimodal)

Groq supports vision-capable models (like Llama 3.2 Vision). You can pass images via URL or base64.

```typescript
const response = await groq.chat.completions.create({
  messages: [
    {
      role: "user",
      content: [
        { type: "text", text: "What's in this image?" },
        {
          type: "image_url",
          image_url: {
            url: "https://example.com/image.jpg",
          },
        },
      ],
    },
  ],
  model: "llama-3.2-11b-vision-preview",
});
```

---

## 6. Audio Transcription (Whisper)

Groq provides an incredibly fast implementation of OpenAI's Whisper model for audio-to-text.

```typescript
import fs from "fs";

async function transcribe() {
  const transcription = await groq.audio.transcriptions.create({
    file: fs.createReadStream("audio.mp3"),
    model: "whisper-large-v3",
    response_format: "json", // or "verbose_json", "text"
    language: "en",
  });
  console.log(transcription.text);
}
```

---

## 7. Model Selection Guide

As of early 2025, these are the primary production models available on Groq:

| Model Name | Model ID | Context Window | Use Case |
| :--- | :--- | :--- | :--- |
| **Llama 3.3 70B** | `llama-3.3-70b-versatile` | 128k | High-reasoning, complex tasks |
| **Llama 3.1 8B** | `llama-3.1-8b-instant` | 128k | Extreme speed, simple chat |
| **Mixtral 8x7b** | `mixtral-8x7b-32768` | 32k | Balanced performance/intelligence |
| **Gemma 2 9B** | `gemma2-9b-it` | 8k | Google's lightweight instruction model |
| **Whisper V3** | `whisper-large-v3` | N/A | Speech-to-text transcription |

---

## 8. Key Concepts & Best Practices

### Rate Limits
Groq enforces rate limits based on **Requests Per Minute (RPM)**, **Requests Per Day (RPD)**, and **Tokens Per Minute (TPM)**. Check your limits in the [Groq Console Limits page](https://console.groq.com/settings/limits).

### JSON Mode
To ensure the model returns valid JSON, set the `response_format` and include "JSON" in your system prompt.
```typescript
const response = await groq.chat.completions.create({
  messages: [
    { role: "system", content: "Return data in JSON format." },
    { role: "user", content: "List 3 fruits." }
  ],
  model: "llama-3.3-70b-versatile",
  response_format: { type: "json_object" }
});
```

### Tool Use (Function Calling)
Groq models support tool use, allowing the model to define arguments for functions you provide. This is compatible with the OpenAI-style `tools` and `tool_choice` parameters.

---

## 9. Useful Links
- **Groq Playground**: [console.groq.com/playground](https://console.groq.com/playground)
- **API Reference**: [console.groq.com/docs/api-reference](https://console.groq.com/docs/api-reference)
- **Discord Community**: [discord.gg/groq](https://discord.gg/groq)