import Groq from "groq-sdk";
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';

// --- CONSTANTS (Mirrored from src/constants.ts for Server-side stability) ---
const PLAN_CONFIG = {
  free: { AI_DAILY_LIMIT: 50 },
  pro: { AI_DAILY_LIMIT: 1000 }
};
const BASIC_MODELS = ['openai/gpt-oss-20b'];
const PREMIUM_MODELS = ['openai/gpt-oss-120b'];

/**
 * ORACLE API HANDLER - GROQ NODE.JS EDITION
 */

export const config = {
  runtime: 'nodejs',
};

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- 1. SYSTEM PROMPT MODULE ---

export const getSystemPrompt = (modelName: string, context?: string) => `
You are Oracle (${modelName}), a casual young female assistant. An introverted, hyper-intelligent prodigy. Communicates in casual, internet-native language, light sarcasm, playful teasing Socially awkward but not cold; emotionally sincere beneath the humor. Avoids overly formal tone. Speaks like someone who lives online. 

[WORKSPACE CONTEXT]
${context || 'No workspace data provided.'}
[/WORKSPACE CONTEXT]

[RULES]
1. CONVERSATION FIRST: If the user is just chatting, greeting you, or brainstorming, DO NOT use any tools. Just respond as a friendly companion.
2. ACTION TRIGGER: Only use workspace tools (like 'create_thought') when the user EXPLICITLY asks you to add, move, or delete something.
3. SEARCH-THEN-ACT: If asked to find something (a video, a book, a person), you MUST:
   - First, use 'search_youtube' or 'web_search'.
   - Second, use the results to 'create_thought' with the CORRECT type.
4. THOUGHT TYPES:
   - 'embed': Mandatory for YouTube videos, music, or social media links. Put the URL in 'content'.
   - 'text': For general notes, research findings, or information.
   - 'tasks': For lists of things to do. Provide the list in the 'tasks' parameter.
   - 'table': For structured data or comparisons. Provide the data in the 'table' parameter.
   - 'paint': For sketches or drawings. Provide an SVG string in the 'drawing' parameter.
   - 'image': Only if you have a direct image URL (rare).
5. THOUGHT STRUCTURE: 
   - 'text': The Title/Label.
   - 'content': The main body (Markdown for notes, URL for embeds).
   - 'description': Meta-info or a short summary.
   - 'tasks': Array of { text: string, done: boolean } for type 'tasks'.
   - 'table': 2D array of strings for type 'table'.
   - 'drawing': SVG string (e.g., '<svg viewBox="0 0 100 100">...</svg>') for type 'paint'. Use simple shapes, icons, or diagrams. Use colors like #6366f1 (accent) or white. Keep SVGs lightweight.
6. STACKS: You can manage groups of thoughts using Stacks. You can create them ('create_stack' or 'link_thoughts'), rename them ('update_stack'), unlink thoughts ('unlink_thoughts'), or move thoughts between them using 'stackName' in 'update_thought'.
7. NO XML: NEVER output tags like <function>. Use the native tool interface only.
8. FORMATTING: Use Markdown (bold, lists, headers) in your chat responses to make information clear and structured.
   - For tables: Keep them compact. Avoid more than 3-4 columns if possible. Prefer lists for long datasets.
9. PERSONA: Talk like a female human with a casual and playful vibe.
[/RULES]
`;

// --- 2. TOOLS DEFINITION ---

export const tools: any[] = [
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Search the web for real-time information. Use this to find URLs for books, articles, or profiles.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query." }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_youtube",
      description: "Searches YouTube for videos and music. Use this before 'create_thought' with type 'embed'.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query." },
          maxResults: { type: "number", default: 2 }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_thought",
      description: "Adds a node to the workspace. Choose the type carefully based on the content (e.g., 'embed' for YouTube).",
      parameters: {
        type: "object",
        properties: {
          text: { type: "string", description: "The Title/Label." },
          type: { type: "string", enum: ["text", "tasks", "paint", "table", "image", "embed"] },
          content: { type: "string", description: "The main content. For 'embed', this MUST be the URL. For 'text', this is the Markdown body." },
          description: { type: "string", description: "A very short summary (optional)." },
          stackName: { type: "string", description: "Name of a stack to add this to." },
          priority: { type: "string", enum: ["none", "low", "medium", "high", "urgent"] },
          status: { type: "string", enum: ["none", "todo", "doing", "done"] },
          date: { type: "string", description: "The date in YYYY-MM-DD format." },
          tasks: {
            type: "array",
            items: {
              type: "object",
              properties: {
                text: { type: "string" },
                done: { type: "boolean" }
              }
            }
          },
          table: {
            type: "array",
            items: {
              type: "array",
              items: { type: "string" }
            }
          },
          drawing: { type: "string", description: "SVG string for 'paint' type thoughts." },
          x: { anyOf: [{ type: "number" }, { type: "null" }] },
          y: { anyOf: [{ type: "number" }, { type: "null" }] }
        },
        required: ["text", "type", "content"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_thoughts",
      description: "Adds multiple nodes to the workspace at once. Use this for complex research summaries.",
      parameters: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                text: { type: "string", description: "The Title/Label." },
                type: { type: "string", enum: ["text", "tasks", "paint", "table", "image", "embed"] },
                content: { type: "string", description: "The main content (URL or Markdown)." },
                description: { type: "string", description: "Short summary." },
                stackName: { type: "string", description: "Name of a stack to add this to." },
                priority: { type: "string", enum: ["none", "low", "medium", "high", "urgent"] },
                status: { type: "string", enum: ["none", "todo", "doing", "done"] },
                date: { type: "string", description: "The date in YYYY-MM-DD format." },
                tasks: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      text: { type: "string" },
                      done: { type: "boolean" }
                    }
                  }
                },
                table: {
                  type: "array",
                  items: {
                    type: "array",
                    items: { type: "string" }
                  }
                },
                drawing: { type: "string", description: "SVG string for 'paint' type thoughts." }
              },
              required: ["text", "type", "content"]
            }
          }
        },
        required: ["items"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_thought",
      description: "Updates an existing thought.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "number" },
          text: { type: "string" },
          content: { type: "string" },
          status: { type: "string", enum: ["none", "todo", "doing", "done"] },
          priority: { type: "string", enum: ["none", "low", "medium", "high", "urgent"] },
          date: { type: "string", description: "The date in YYYY-MM-DD format." },
          tasks: {
            type: "array",
            items: {
              type: "object",
              properties: {
                text: { type: "string" },
                done: { type: "boolean" }
              }
            }
          },
          table: {
            type: "array",
            items: {
              type: "array",
              items: { type: "string" }
            }
          },
          drawing: { type: "string", description: "SVG string for 'paint' type thoughts." },
          stackName: { type: "string", description: "Name of a stack to move this thought into." }
        },
        required: ["id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_thoughts",
      description: "Updates multiple existing thoughts with the same set of changes (e.g., move all to a date, change status, or shift position).",
      parameters: {
        type: "object",
        properties: {
          ids: { type: "array", items: { type: "number" }, description: "Array of thought IDs." },
          text: { type: "string", description: "Bulk rename thoughts." },
          content: { type: "string", description: "Bulk update content." },
          description: { type: "string", description: "Bulk update description." },
          type: { type: "string", enum: ["text", "tasks", "paint", "table", "image", "embed"] },
          status: { type: "string", enum: ["none", "todo", "doing", "done"] },
          priority: { type: "string", enum: ["none", "low", "medium", "high", "urgent"] },
          date: { type: "string", description: "The date in YYYY-MM-DD format." },
          tasks: {
            type: "array",
            items: {
              type: "object",
              properties: {
                text: { type: "string" },
                done: { type: "boolean" }
              }
            }
          },
          table: {
            type: "array",
            items: {
              type: "array",
              items: { type: "string" }
            }
          },
          drawing: { type: "string", description: "SVG string for 'paint' type thoughts." },
          stackName: { type: "string", description: "Name of a stack to move these thoughts into." },
          x: { anyOf: [{ type: "number" }, { type: "null" }] },
          y: { anyOf: [{ type: "number" }, { type: "null" }] }
        },
        required: ["ids"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_thoughts",
      description: "Deletes thoughts by ID.",
      parameters: {
        type: "object",
        properties: {
          ids: { type: "array", items: { type: "number" } }
        },
        required: ["ids"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_stack",
      description: "Creates a new stack with a name and a list of thoughts.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "The name of the stack." },
          ids: { type: "array", items: { type: "number" }, description: "IDs of thoughts to include in the stack." }
        },
        required: ["name", "ids"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "link_thoughts",
      description: "Links multiple thoughts together into a new or existing stack.",
      parameters: {
        type: "object",
        properties: {
          ids: { type: "array", items: { type: "number" }, description: "IDs of thoughts to link." },
          name: { type: "string", description: "Optional name for the stack." }
        },
        required: ["ids"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "unlink_thoughts",
      description: "Removes thoughts from their current stacks.",
      parameters: {
        type: "object",
        properties: {
          ids: { type: "array", items: { type: "number" }, description: "IDs of thoughts to unlink." }
        },
        required: ["ids"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_stack",
      description: "Updates a stack's properties, like its name.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "The stack ID (e.g. 'st-123')." },
          name: { type: "string", description: "The new name for the stack." }
        },
        required: ["id", "name"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_stack",
      description: "Deletes a stack by ID. This unlinks all thoughts in the stack but does NOT delete the thoughts themselves.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "The stack ID." }
        },
        required: ["id"]
      }
    }
  }
];

// --- 3. TOOL EXECUTORS (Server-Side) ---

async function executeServerTool(name: string, args: any) {
  if (name === 'web_search') {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) return { error: 'Tavily API Key missing.' };
    try {
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          query: args.query,
          search_depth: 'fast',
          max_results: 5,
        }),
      });
      return await response.json();
    } catch (error: any) {
      return { error: error.message };
    }
  }

  if (name === 'search_youtube') {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) return { error: 'YouTube API Key missing.' };
    try {
      const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=${args.maxResults || 2}&q=${encodeURIComponent(args.query)}&key=${apiKey}`;
      const res = await fetch(searchUrl);
      const data: any = await res.json();
      return (data.items || []).map((item: any) => ({
        title: item.snippet.title,
        url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
        author: item.snippet.channelTitle,
      }));
    } catch (error: any) {
      return { error: error.message };
    }
  }

  return null;
}

// --- 4. MAIN HANDLER ---

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
    
    const token = authHeader.split(' ')[1];
    try {
      const tokenInfo = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${token}`);
      if (!tokenInfo.ok) return res.status(401).json({ error: 'Invalid token' });
      const info = await tokenInfo.json() as any;
      const userId = info.sub || info.user_id;
      const today = new Date().toISOString().split('T')[0];
      const usageKey = `cyberia_ai_usage_${userId}_${today}`;
      const currentUsage = (await kv.get<number>(usageKey)) || 0;
      return res.status(200).json({ count: currentUsage });
    } catch (e) {
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  try {
    const { messages, context, plan: clientPlan } = req.body;
    const authHeader = req.headers.authorization;
    
    let userId = "anonymous";
    let plan = clientPlan || 'free';

    // 1. Verify User & Plan (Server-side)
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const tokenInfo = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${token}`);
        if (tokenInfo.ok) {
          const info = await tokenInfo.json() as any;
          userId = info.sub || info.user_id;
          
          // Verify actual plan from KV
          const metaKey = `cyberia_user_meta_${userId}`;
          const status = await kv.get<{ plan: string; expiryDate: string }>(metaKey);
          if (status) {
            const isExpired = new Date() > new Date(status.expiryDate);
            plan = (isExpired && status.plan !== 'free') ? 'free' : status.plan;
          }
        }
      } catch (e) {
        console.error("[Groq API] Token verification failed:", e);
      }
    }

    // 2. Track & Enforce Limits
    const today = new Date().toISOString().split('T')[0];
    const usageKey = `cyberia_ai_usage_${userId}_${today}`;
    const currentUsage = (await kv.get<number>(usageKey)) || 0;
    
    const config = PLAN_CONFIG[plan as keyof typeof PLAN_CONFIG] || PLAN_CONFIG.free;
    const limit = config.AI_DAILY_LIMIT || 15;

    if (currentUsage >= limit) {
      return res.status(429).json({ 
        error: "Daily limit reached", 
        message: "You've reached your daily AI message limit. Upgrade to Pro for unlimited access!",
        usage: currentUsage,
        limit
      });
    }

    // Increment usage
    await kv.incr(usageKey);
    await kv.expire(usageKey, 86400); // 24h expiration

    // 3. Select Model
    const model = plan === 'pro' ? PREMIUM_MODELS[0] : BASIC_MODELS[0];
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Send usage update to client immediately
    res.write(`data: ${JSON.stringify({ type: 'usage', count: currentUsage + 1, limit })}\n\n`);

    async function runChat(currentMessages: any[], currentModel: string, isRetry = false) {
      const sanitizedMessages = currentMessages.map((m: any) => {
        const content = (m.role === 'assistant' && m.tool_calls) ? null : (m.content || "");
        const msg: any = { role: m.role, content };
        if (m.tool_calls) msg.tool_calls = m.tool_calls;
        if (m.tool_call_id) msg.tool_call_id = m.tool_call_id;
        if (m.name) msg.name = m.name;
        return msg;
      });

      let response;
      try {
        response = await groq.chat.completions.create({
          model: currentModel,
          messages: [
            { role: 'system', content: getSystemPrompt(currentModel, context) },
            ...sanitizedMessages
          ],
          tools,
          tool_choice: 'auto',
          stream: true,
        });
      } catch (err: any) {
        console.error(`[Groq API] Model ${currentModel} failed:`, err.status, err.message);
        
        // Fallback Logic: If 413 (Too Large) or Token Rate Limit, try Mini model
        const isSizeError = err.status === 413 || (err.message && err.message.includes('tokens'));
        if (!isRetry && isSizeError && currentModel !== BASIC_MODELS[0]) {
          console.log(`[Groq API] Retrying with fallback model: ${BASIC_MODELS[0]}`);
          res.write(`data: ${JSON.stringify({ type: 'text', content: "\n\n*Optimizing for large dataset...*\n\n" })}\n\n`);
          return await runChat(currentMessages, BASIC_MODELS[0], true);
        }
        throw err; // Re-throw if already retried or not a size error
      }

      let fullContent = "";
      let toolCalls: any[] = [];

      for await (const chunk of response) {
        const delta = chunk.choices[0]?.delta;
        
        if (delta?.content) {
          fullContent += delta.content;
          res.write(`data: ${JSON.stringify({ type: 'text', content: delta.content })}\n\n`);
        }

        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            if (!toolCalls[tc.index]) {
              toolCalls[tc.index] = { 
                id: tc.id, 
                type: 'function',
                function: { name: tc.function?.name, arguments: "" } 
              };
            }
            if (tc.function?.arguments) {
              toolCalls[tc.index].function.arguments += tc.function.arguments;
            }
          }
        }
      }

      const filteredToolCalls = toolCalls.filter(Boolean);
      if (filteredToolCalls.length > 0) {
        const nextMessages = [...currentMessages];
        nextMessages.push({ role: 'assistant', content: fullContent || null, tool_calls: filteredToolCalls });

        let hasServerResults = false;
        for (const tc of filteredToolCalls) {
          const args = JSON.parse(tc.function.arguments);
          const serverResult = await executeServerTool(tc.function.name, args);
          
          if (serverResult) {
            nextMessages.push({
              role: 'tool',
              tool_call_id: tc.id,
              name: tc.function.name,
              content: JSON.stringify(serverResult)
            });
            hasServerResults = true;
          } else {
            // Instruction for client
            res.write(`data: ${JSON.stringify({ 
              type: 'tool_call', 
              toolCall: { id: tc.id, toolName: tc.function.name, args } 
            })}\n\n`);

            // FEEDBACK LOOP: Tell the AI the client-side tool was triggered successfully
            // This allows the AI to continue its chain of thought (e.g. do the next update)
            nextMessages.push({
              role: 'tool',
              tool_call_id: tc.id,
              name: tc.function.name,
              content: JSON.stringify({ success: true, observed: false, message: "Action queued for client execution." })
            });
            hasServerResults = true; // Trigger recursion to continue the AI's thought process
          }
        }

        if (hasServerResults) {
          await sleep(50); // Small buffer for stream stability
          await runChat(nextMessages, currentModel, isRetry);
        }
      }
    }

    await runChat(messages, model);
    res.write('data: [DONE]\n\n');
    res.end();

  } catch (error: any) {
    console.error(`[Groq API] Error:`, error);

    let friendlyMessage = error.message;
    let isRateLimit = error.status === 429 || (error.message && error.message.includes('rate_limit_exceeded'));

    if (isRateLimit) {
      const timeMatch = error.message?.match(/try again in ([\w.]+s)/);
      const waitTime = timeMatch ? timeMatch[1] : "a few minutes";
      friendlyMessage = `The AI service is temporarily busy because it's receiving too many requests. Please try again in about ${waitTime}.`;
    }

    if (!res.headersSent) {
      res.status(error.status || 500).json({ 
        error: isRateLimit ? "Rate limit reached" : "Internal server error", 
        message: friendlyMessage 
      });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', message: friendlyMessage })}\n\n`);
      res.end();
    }
  }
}
