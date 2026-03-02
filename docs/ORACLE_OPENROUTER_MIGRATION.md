# Oracle OpenRouter Migration Plan

## Overview

This document outlines the migration of Oracle AI from Groq to OpenRouter, implementing tiered access with:
- **Free users**: OpenRouter free models (no cost)
- **Pro users**: Gemini 2.5 Flash (premium reasoning + vision)

---

## Current State

### Provider
- **Groq** (groq-sdk v0.37.0)

### Models
| Tier | Model | Context |
|------|-------|---------|
| Free | openai/gpt-oss-20b | 20B parameters |
| Pro | openai/gpt-oss-120b | 120B parameters |

### Tool Access
- All users have full tool access (create, update, delete, search)

### File Handling
- read_file_content tool exists but returns limited data:
  - PDF: Returns pending implementation message
  - Images: Returns not readable as text
  - Only plain text files (.txt, .md, .json) are readable

---

## Target State

### Provider
- **OpenRouter** (openrouter-sdk)

### Models
| Tier | Model | Capabilities |
|------|-------|--------------|
| Free | openrouter/free | Vision, PDF reading, 1M context |
| Pro | google/gemini-2.5-flash | Advanced reasoning, vision, tools, 1M context |

### Tool Access (Tiered)
| Tool | Free Users | Pro Users |
|------|------------|-----------|
| get_thought_details | Read | Read/Write |
| read_file_content | Read | Read/Write |
| read_files_content | Read | Read/Write |
| create_thought | No | Yes |
| create_thoughts | No | Yes |
| update_thought | No | Yes |
| update_thoughts | No | Yes |
| delete_thoughts | No | Yes |
| create_stack | No | Yes |
| link_thoughts | No | Yes |
| unlink_thoughts | No | Yes |
| update_stack | No | Yes |
| delete_stack | No | Yes |
| web_search | No | Yes |
| search_youtube | No | Yes |

### File Handling (Enhanced)
- PDF: Return signed URL for OpenRouter to process with pdf-text
- Images: Return signed URL for vision model to analyze
- Plain text: Return content directly (existing behavior)

---

## Architecture



---

## Data Flow

### For Free Users (Read-Only)

1. User asks: Summarize my meeting notes from thought #5
2. ChatOverlay sends message + context (skeleton)
3. api/chat.ts detects FREE tier
4. Filters tools to READ_ONLY list
5. Sends to OpenRouter with free model
6. AI decides: need to read the file
7. AI calls read_file_content(id=5)
8. executor.ts fetches blob from IndexedDB/Supabase
9. Returns { success: true, url: signedUrl, type: application/pdf }
10. AI analyzes via vision model
11. AI responds with summary

### For Pro Users (Full Access)

1. User asks: Search for AI news and create a thought
2. ChatOverlay sends message + context
3. api/chat.ts detects PRO tier
4. Allows ALL tools
5. Sends to OpenRouter with Gemini 2.5 Flash
6. AI calls web_search(query=AI news)
7. Server executes search via Tavily API
8. Returns results to AI
9. AI calls create_thought({text, type, content})
10. Client executes via executor.ts
11. Thought created in IndexedDB
12. Syncs to Supabase
13. AI confirms creation

---

## Implementation Phases

### Phase 1: Backend Changes (api/chat.ts)

#### 1.1 Install OpenRouter SDK
npm install @openrouter/sdk

#### 1.2 Environment Variables
Add to .env:
OPENROUTER_API_KEY=sk-or-v1-xxx

#### 1.3 Replace Groq Client
- Remove: import Groq from groq-sdk
- Add: import OpenRouter from @openrouter/sdk
- Replace client initialization
- Update model names in chat.completions.create

#### 1.4 Add Tier-Based Tool Filtering
Define READ_ONLY_TOOLS and PRO_TOOLS arrays
Filter available tools based on user plan

#### 1.5 Handle Free User Write Attempts
- Update system prompt to instruct free users can only read
- Optionally: server-side rejection of write tool calls

#### 1.6 Update System Prompt
Add tier restrictions to system prompt

#### 1.7 Model Selection
- free: from @constants.ts file
- pro: from @constants.ts file

---

### Phase 2: Frontend Tool Changes (executor.ts)

#### 2.1 Update read_file_content Tool
- For PDF: Return signed URL instead of pending message
- For Images: Return signed URL for vision model
- Keep plain text behavior (existing)

---

### Phase 3: Frontend UI Changes (ChatOverlay.tsx)

#### 3.1 Update Model Display
- Change activeModel to use new namings

#### 3.2 Update Display Labels
- FREE MODELS / PAID MODELS

#### 3.3 Add Upgrade Prompt (Optional)
- Show upgrade message when free user tries to create

---

### Phase 4: Cleanup

#### 4.1 Remove Groq Dependency
npm uninstall groq-sdk

#### 4.2 Update Environment
- Remove GROQ_API_KEY from Vercel
- Add OPENROUTER_API_KEY to Vercel

#### 4.3 Update Documentation
- Update docs/oracle-ai.md
- Update README.md and AGENTS.md if needed

---

## Cost Analysis



### Estimated Costs

Per 1000 Pro users, avg 50 messages/day:
- 50,000 messages x 500 tokens input = 25M tokens
- 50,000 messages x 300 tokens output = 15M tokens
- Monthly cost: ~5,000 (if all use heavily)

### Mitigation
- Keep daily limits (already implemented)
- Limit max tokens
- Consider caching frequent queries
- Monitor usage patterns


---
s
## Testing Checklist

- Free user cannot create thoughts
- Free user cannot search web
- Free user CAN read file content
- Free user CAN analyze images
- Free user CAN analyze PDFs
- Pro user has full access
- Streaming works correctly
- Tool calls execute properly
- Usage tracking accurate
- Error handling works

---

## Files to Modify

| File | Changes |
|------|---------|
| package.json | Add @openrouter/sdk, remove groq-sdk |
| api/chat.ts | Full rewrite (client, tools, filtering) |
| src/services/oracle/executor.ts | Update read_file_content |
| src/components/ChatOverlay.tsx | Update model names |
| .env | Add OPENROUTER_API_KEY |

---

## References

- OpenRouter Docs: https://openrouter.ai/docs
- Openrouter free models: https://openrouter.ai/openrouter/free
- Gemini 2.5 Flash: https://openrouter.ai/models/google/gemini-2.5-flash
- Multimodal Input: https://openrouter.ai/docs/features/multimodal
- PDF Processing: https://openrouter.ai/docs/features/images-and-pdfs
