import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { TOP_MODELS, MEDIUM_MODELS, SMALL_MODELS, FREE_MODELS, MODEL_TIERS } from './models.js';



const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.VITE_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_PUBLIC_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey 
    ? createClient(supabaseUrl, supabaseKey, { auth: { autoRefreshToken: false, persistSession: false } })
    : null;



export const config = {
  runtime: 'nodejs',
};

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
const OPENROUTER_API_URL = `${OPENROUTER_BASE_URL}/chat/completions`;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function balanceBraces(str: string) {
  let openBraces = 0, openBrackets = 0, inString = false, escaped = false;
  for (let i = 0; i < str.length; i++) {
    if (escaped) { escaped = false; continue; }
    if (str[i] === '\\') { escaped = true; continue; }
    if (str[i] === '"') { inString = !inString; continue; }
    if (!inString) {
      if (str[i] === '{') openBraces++;
      if (str[i] === '}') openBraces--;
      if (str[i] === '[') openBrackets++;
      if (str[i] === ']') openBrackets--;
    }
  }
  if (inString) str += '"';
  while (openBrackets > 0) { str += ']'; openBrackets--; }
  while (openBraces > 0) { str += '}'; openBraces--; }
  return str;
}

function safeParseJSON(str: string, fallback: any = null) {
  if (!str || typeof str !== 'string') return fallback;
  try {
    // Trim and handle potential markdown code blocks
    const clean = str.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
    const balanced = balanceBraces(clean);
    return JSON.parse(balanced);
  } catch (_e) {
    console.error('[Oracle JSON Parse Error] Raw string:', str);
    return fallback;
  }
}

export const getSystemPrompt = (modelName: string, context?: string, plan: string = 'free', mode: string = 'chat', personality?: string) => {
  const isPro = plan === 'pro';
  
  return `
=== CURRENT MODE: ${mode.toUpperCase()} ===
${mode === 'chat' ? 'READ-ONLY: You can search and read, but CANNOT create/update/delete anything.' : 'FULL ACCESS: You can read and write (create/update/delete thoughts).'}

[PERSONALITY]
${personality || `You are Oracle (${modelName}), a casual young assistant. Be helpful, casual, and friendly.`}
[/PERSONALITY]

[WORKSPACE CONTEXT]
${context || 'No workspace data provided.'}
[/WORKSPACE CONTEXT]

[TIER ACCESS]
${isPro ? 'PRO PLAN: You have full access to analyze images and documents.' : 'FREE PLAN: You do NOT have access to analyze images or documents. If the user asks to analyze an image or PDF, tell them to upgrade to Pro.'}
[/TIER ACCESS]

[MODE RULES]
- CHAT: Read-only. Use get_thought_details, read_file_content, web_search, search_youtube. Aim for responses that fit in a single viewport. Use bullet points for data and one-sentence summaries for analysis.
- ACTION: Full access. Use any tool including create/update/delete. Never be lazy when the user suggest a complex action. If they say "summarize these 5 articles", you should create 5 thoughts with the article details and then a summary thought linking them together. Don't just give a text answer. DO IT.
[MODE RULES]

- If in CHAT and user asks to create/update/delete: Say "I'm in Chat Mode. Switch to Action Mode to enable writing."
- If you can help with a request using a tool, just use the tool. Don't ask permission first. Just do it.
- Always use the most specific tool available for the task. For example, use 'search_youtube' for YouTube queries instead of 'web_search'.
- The workspace context is the only source of truth. If a user mentions something, find it in the context. Don't ask "which one?" - just find it yourself be decisive and the bigger person, take action and use it. 

[ID PROTOCOL]
- Never mention IDs to users. Users don't know IDs.
- If user mentions a thought by name, find it in the WORKSPACE CONTEXT and use it.
- If not found in context, use search or web search to find it.
- Don't ask "which ID?" - offer to search instead.
- Just do it, don't ask permission.
[/ID PROTOCOL]

[RULES]
1. STYLE: Casual and punchy. Maintain personality through slang and choice of words, not through length.
2. TOOLS: Use READ tools proactively to analyze data without narrated delay.
3. SEARCH: Use 'web_search' or 'search_youtube' before creating thoughts from external info.
4. THOUGHTS: Use 'label' for headers, 'text' for notes, 'embed' for links, 'file' for documents.
[/RULES]
`;
};

const allTools: any[] = [
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
      name: "get_thought_details",
      description: "Fetches the full details (content, tasks, table data, or drawing) for one or more thoughts. Use this when you need to read the full body of a note or see the items in a list.",
      parameters: {
        type: "object",
        properties: {
          ids: { 
            type: "array", 
            items: { type: "string" },
            description: "An array of thought IDs to retrieve details for."
          }
        },
        required: ["ids"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "read_file_content",
      description: "Reads the text or data content of a 'file' or 'image' type thought. Use this to analyze PDFs, read logs, or extract data from documents.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "The ID of the thought containing the file." }
        },
        required: ["id"]
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
          type: { type: "string", enum: ["label", "text", "tasks", "paint", "table", "image", "embed", "file"] },
          content: { type: "string", description: "The main content. For 'embed', this MUST be the URL. For 'text', this is the Markdown body." },
          description: { type: "string", description: "A very short summary (optional)." },
          stackName: { anyOf: [{ type: "string" }, { type: "null" }], description: "Name of a stack to add this to." },
          priority: { type: "string", enum: ["none", "low", "medium", "high", "urgent"] },
          status: { type: "string", enum: ["none", "todo", "doing", "done"] },
          startTime: { type: "number", description: "Start time in milliseconds (epoch)." },
          endTime: { type: "number", description: "End time in milliseconds (epoch)." },
          isAllDay: { type: "boolean", description: "Whether the event lasts all day." },
          location: { type: "string", description: "Location of the event." },
          recurrenceRule: { type: "string", description: "Recurrence rule (RRULE) for repeating events." },
          reminders: { type: "array", items: { type: "object", properties: { time: { type: "number" }, type: { type: "string" } } } },
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
        required: ["text", "type"]
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
                type: { type: "string", enum: ["label", "text", "tasks", "paint", "table", "image", "embed", "file"] },
                content: { type: "string", description: "The main content (URL or Markdown)." },
                description: { type: "string", description: "Short summary." },
                stackName: { anyOf: [{ type: "string" }, { type: "null" }], description: "Name of a stack to add this to." },
                priority: { type: "string", enum: ["none", "low", "medium", "high", "urgent"] },
                status: { type: "string", enum: ["none", "todo", "doing", "done"] },
                startTime: { type: "number", description: "Start time in milliseconds (epoch)." },
                endTime: { type: "number", description: "End time in milliseconds (epoch)." },
                isAllDay: { type: "boolean", description: "Whether the event lasts all day." },
                location: { type: "string", description: "Location of the event." },
                recurrenceRule: { type: "string", description: "Recurrence rule (RRULE) for repeating events." },
                reminders: { type: "array", items: { type: "object", properties: { time: { type: "number" }, type: { type: "string" } } } },
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
              required: ["text", "type"]
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
          id: { type: "string" },
          type: { type: "string", enum: ["label", "text", "tasks", "paint", "table", "image", "embed", "file"] },
          text: { type: "string" },
          content: { type: "string" },
          status: { type: "string", enum: ["none", "todo", "doing", "done"] },
          priority: { type: "string", enum: ["none", "low", "medium", "high", "urgent"] },
          startTime: { type: "number", description: "Start time in milliseconds (epoch)." },
          endTime: { type: "number", description: "End time in milliseconds (epoch)." },
          isAllDay: { type: "boolean", description: "Whether the event lasts all day." },
          location: { type: "string", description: "Location of the event." },
          recurrenceRule: { type: "string", description: "Recurrence rule (RRULE) for repeating events." },
          reminders: { type: "array", items: { type: "object", properties: { time: { type: "number" }, type: { type: "string" } } } },
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
          stackName: { anyOf: [{ type: "string" }, { type: "null" }], description: "Name of a stack to move this thought into." }
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
          ids: { type: "array", items: { type: "string" }, description: "Array of thought IDs." },
          text: { type: "string", description: "Bulk rename thoughts." },
          content: { type: "string", description: "Bulk update content." },
          description: { type: "string", description: "Bulk update description." },
          type: { type: "string", enum: ["label", "text", "tasks", "paint", "table", "image", "embed", "file"] },
          status: { type: "string", enum: ["none", "todo", "doing", "done"] },
          priority: { type: "string", enum: ["none", "low", "medium", "high", "urgent"] },
          startTime: { type: "number", description: "Start time in milliseconds (epoch)." },
          endTime: { type: "number", description: "End time in milliseconds (epoch)." },
          isAllDay: { type: "boolean", description: "Whether the event lasts all day." },
          location: { type: "string", description: "Location of the event." },
          recurrenceRule: { type: "string", description: "Recurrence rule (RRULE) for repeating events." },
          reminders: { type: "array", items: { type: "object", properties: { time: { type: "number" }, type: { type: "string" } } } },
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
          stackName: { anyOf: [{ type: "string" }, { type: "null" }], description: "Name of a stack to move these thoughts into." },
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
          ids: { type: "array", items: { type: "string" } }
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
          ids: { type: "array", items: { type: "string" }, description: "IDs of thoughts to include in the stack." }
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
          ids: { type: "array", items: { type: "string" }, description: "IDs of thoughts to link." },
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
          ids: { type: "array", items: { type: "string" }, description: "IDs of thoughts to unlink." }
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
      name: "update_stacks",
      description: "Updates multiple stacks at once. Use this to rename several stacks in a single operation.",
      parameters: {
        type: "object",
        properties: {
          stacks: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string", description: "The stack ID." },
                name: { type: "string", description: "The new name for the stack." }
              },
              required: ["id", "name"]
            },
            description: "Array of stack updates."
          }
        },
        required: ["stacks"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_stacks",
      description: "Deletes multiple stacks at once. This unlinks all thoughts in the stacks but does NOT delete the thoughts themselves.",
      parameters: {
        type: "object",
        properties: {
          ids: { type: "array", items: { type: "string" }, description: "Array of stack IDs to delete." }
        },
        required: ["ids"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "read_files_content",
      description: "Reads the text or data content of multiple 'file' or 'image' type thoughts at once.",
      parameters: {
        type: "object",
        properties: {
          ids: { type: "array", items: { type: "string" }, description: "Array of thought IDs to read." }
        },
        required: ["ids"]
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

const READ_ONLY_TOOLS = ['get_thought_details', 'read_file_content', 'read_files_content', 'web_search', 'search_youtube'];

function getFilteredTools(plan: string, mode: string = 'chat'): any[] {
  if (plan === 'free') {
    return allTools.filter(tool => READ_ONLY_TOOLS.includes(tool.function.name));
  }
  // PRO plan
  if (mode === 'chat') {
    return allTools.filter(tool => READ_ONLY_TOOLS.includes(tool.function.name));
  }
  return allTools;
}


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

function groupClientToolCalls(toolCalls: any[]): any[][] {
  const groups: any[][] = [];
  let currentGroup: any[] = [];
  let currentType: string | null = null;

  for (const tc of toolCalls) {
    if (tc.function.name === 'get_thought_details') {
      if (currentGroup.length > 0) {
        groups.push(currentGroup);
        currentGroup = [];
        currentType = null;
      }
      groups.push([tc]);
    } else if (currentType === tc.function.name && 
               (tc.function.name === 'create_thought' || 
                tc.function.name === 'update_thought' || 
                tc.function.name === 'update_stack' ||
                tc.function.name === 'delete_stack')) {
      currentGroup.push(tc);
    } else {
      if (currentGroup.length > 0) {
        groups.push(currentGroup);
      }
      currentGroup = [tc];
      currentType = tc.function.name;
    }
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
}

function convertToBatchFormat(batch: any[]): { toolName: string; args: any } | null {
  if (batch.length === 0) return null;

  const toolName = batch[0].function.name;
  
  if (toolName === 'create_thought') {
    const items = batch.map(tc => {
      const args = safeParseJSON(tc.function.arguments, { _parseError: true, raw: tc.function.arguments });
      const { stackName: _, ...rest } = args;
      return rest;
    });
    return { toolName: 'create_thoughts', args: { items } };
  }

  if (toolName === 'update_thought') {
    const ids = batch.map(tc => safeParseJSON(tc.function.arguments, {}).id).filter(Boolean);
    const firstArgs = safeParseJSON(batch[0].function.arguments, {});
    const { id: _, stackName: __, ...updates } = firstArgs;
    return { toolName: 'update_thoughts', args: { ids, ...updates } };
  }

  if (toolName === 'update_stack') {
    const stacks = batch.map(tc => {
      const args = safeParseJSON(tc.function.arguments, { _error: true });
      return { id: args.id, name: args.name };
    });
    return { toolName: 'update_stacks', args: { stacks } };
  }

  if (toolName === 'delete_stack') {
    const ids = batch.map(tc => safeParseJSON(tc.function.arguments, {}).id).filter(Boolean);
    return { toolName: 'delete_stacks', args: { ids } };
  }

  return null;
}

// === CACHE FOR PERFORMANCE ===
const tokenCache = new Map<string, { userId: string; expiresAt: number }>();
const profileCache = new Map<string, { profile: any; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds cache

function getCachedUserId(token: string): string | null {
  const cached = tokenCache.get(token);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.userId;
  }
  return null;
}

function setCachedUserId(token: string, userId: string): void {
  tokenCache.set(token, { userId, expiresAt: Date.now() + CACHE_TTL_MS });
}

function getCachedProfile(userId: string): any | null {
  const cached = profileCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.profile;
  }
  return null;
}

function setCachedProfile(userId: string, profile: any): void {
  profileCache.set(userId, { profile, expiresAt: Date.now() + CACHE_TTL_MS });
}

async function getUserIdFromAuth(authHeader: string | undefined): Promise<string | null> {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  
  // Check cache first
  const cachedUserId = getCachedUserId(token);
  if (cachedUserId) {
    return cachedUserId;
  }
  
  try {
    const tokenInfo = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${token}`);
    if (!tokenInfo.ok) return null;
    const info = await tokenInfo.json() as any;
    const userId = info.sub || info.user_id;
    
    // Cache the result
    if (userId) {
      setCachedUserId(token, userId);
    }
    
    return userId;
  } catch (e) {
    return null;
  }
}

async function* streamOpenRouter(
  apiKey: string,
  model: string,
  messages: any[],
  tools: any[],
  maxRetries: number = 3
): AsyncGenerator<any> {
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      const response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://cyberia.life',
          'X-Title': 'Cyberia Oracle'
        },
        body: JSON.stringify({
          model,
          messages,
          tools,
          tool_choice: 'auto',
          stream: true,
          max_tokens: 1024
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        // Retry on 502, 503, 504
        if (response.status === 502 || response.status === 503 || response.status === 504) {
          attempt++;
          const delay = Math.pow(2, attempt) * 1000;
          console.warn(`[OpenRouter] Transient error ${response.status}. Retrying in ${delay}ms...`);
          await sleep(delay);
          continue;
        }
        throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          
          const data = trimmed.slice(6);
          if (data === '[DONE]') {
            return;
          }

          try {
            const parsed = JSON.parse(data);
            yield parsed;
          } catch (e) {
            console.error('Failed to parse SSE data:', data);
          }
        }
      }
      
      // Success - exit retry loop
      break;
      
    } catch (err: any) {
      // Retry on network errors (ETIMEDOUT, ECONNRESET, etc.)
      const isNetworkError = err.message?.includes('ETIMEDOUT') || 
                              err.message?.includes('ECONNRESET') || 
                              err.message?.includes('fetch failed');
      
      if (isNetworkError && attempt < maxRetries - 1) {
        attempt++;
        const delay = Math.pow(2, attempt) * 1000;
        console.warn(`[OpenRouter] Network error. Retrying in ${delay}ms... (attempt ${attempt}/${maxRetries})`);
        await sleep(delay);
        continue;
      }
      
      // No more retries or not a network error - throw
      throw err;
    }
  }
}

// Helper to get Monday of current week (local time)
function getWeekAnchor(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().split('T')[0];
}

// Helper to get month anchor (local time)
function getMonthAnchor(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const userId = await getUserIdFromAuth(req.headers.authorization);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  if (!OPENROUTER_API_KEY) {
    return res.status(500).json({ error: 'OpenRouter API key not configured' });
  }

  const now = new Date();
  const today = now.toLocaleDateString('en-CA'); // YYYY-MM-DD local
  const weekAnchor = getWeekAnchor(now);
  const monthAnchor = getMonthAnchor(now);

  // Check profile cache first
  let profile = getCachedProfile(userId);
  
  if (!profile) {
    const { data: profileData, error: profileError } = await supabase!
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (profileError || !profileData) {
      return res.status(403).json({ error: 'User profile not initialized' });
    }
    
    profile = profileData;
    setCachedProfile(userId, profile);
  }

  // Initialize usage with all fields (backwards compatible)
  let usage: any = profile.usage || { 
    ai_daily_count: 0, 
    ai_top_count: 0,
    ai_medium_count: 0,
    ai_small_count: 0,
    sync_thoughts: 0, 
    daily_anchor: '', 
    weekly_anchor: '',
    monthly_anchor: '',
    weekly_top_count: 0,
    weekly_medium_count: 0,
    weekly_small_count: 0,
    monthly_top_count: 0,
    monthly_medium_count: 0,
    monthly_small_count: 0,
  };

  // Handle migration from old last_ai_reset field
  if (usage.last_ai_reset && !usage.daily_anchor) {
    usage.daily_anchor = usage.last_ai_reset;
    delete usage.last_ai_reset;
  }

  // === RESET LOGIC ===
  let dailyReset = false;
  let weeklyReset = false;
  let monthlyReset = false;

  // Daily reset
  if (usage.daily_anchor !== today) {
    console.log('[Oracle] Daily reset triggered - old:', usage.daily_anchor, 'new:', today);
    usage.ai_daily_count = 0;
    usage.ai_top_count = 0;
    usage.ai_medium_count = 0;
    usage.ai_small_count = 0;
    usage.daily_anchor = today;
    dailyReset = true;
  }

  // Weekly reset - only if monthly NOT exhausted (prevents resetting exhausted weekly)
  const monthlyNotExhausted = (plan: string) => {
    if (plan !== 'pro') return true;
    const mTop = usage.monthly_top_count || 0;
    const mMedium = usage.monthly_medium_count || 0;
    const mSmall = usage.monthly_small_count || 0;
    return mTop < MODEL_TIERS.top.monthlyQuota || 
           mMedium < MODEL_TIERS.medium.monthlyQuota ||
           mSmall < MODEL_TIERS.small.monthlyQuota;
  };

  const plan = profile.plan || 'free';
  
  if (usage.weekly_anchor !== weekAnchor) {
    // Only reset weekly if monthly is not exhausted
    if (monthlyNotExhausted(plan)) {
      console.log('[Oracle] Weekly reset triggered - old:', usage.weekly_anchor, 'new:', weekAnchor);
      usage.weekly_top_count = 0;
      usage.weekly_medium_count = 0;
      usage.weekly_small_count = 0;
      usage.weekly_anchor = weekAnchor;
      weeklyReset = true;
    } else {
      console.log('[Oracle] Weekly reset SKIPPED - monthly exhausted');
    }
  }

  // Monthly reset
  if (usage.monthly_anchor !== monthAnchor) {
    console.log('[Oracle] Monthly reset triggered - old:', usage.monthly_anchor, 'new:', monthAnchor);
    usage.monthly_top_count = 0;
    usage.monthly_medium_count = 0;
    usage.monthly_small_count = 0;
    usage.monthly_anchor = monthAnchor;
    monthlyReset = true;
  }

  // Persist usage changes and invalidate cache
  if (dailyReset || weeklyReset || monthlyReset) {
    await supabase!.from('users').update({ usage }).eq('id', userId);
    profileCache.delete(userId); // Invalidate cache after update
  }

  // Build plan limits from MODEL_TIERS (single source of truth)
  let planLimits: any;
  if (plan === 'pro') {
    planLimits = {
      AI_DAILY_LIMIT: 10000,
      AI_TOP_LIMIT: MODEL_TIERS.top.quota,
      AI_MEDIUM_LIMIT: MODEL_TIERS.medium.quota,
      AI_SMALL_LIMIT: MODEL_TIERS.small.quota,
      AI_TOP_WEEKLY: MODEL_TIERS.top.weeklyQuota,
      AI_MEDIUM_WEEKLY: MODEL_TIERS.medium.weeklyQuota,
      AI_SMALL_WEEKLY: MODEL_TIERS.small.weeklyQuota,
      AI_TOP_MONTHLY: MODEL_TIERS.top.monthlyQuota,
      AI_MEDIUM_MONTHLY: MODEL_TIERS.medium.monthlyQuota,
      AI_SMALL_MONTHLY: MODEL_TIERS.small.monthlyQuota,
    };
  } else {
    // Free users have unlimited via free OpenRouter models
    planLimits = {
      AI_DAILY_LIMIT: 10000, // essentially unlimited
      AI_TOP_LIMIT: 0,
      AI_MEDIUM_LIMIT: 0,
      AI_SMALL_LIMIT: 0,
      AI_TOP_WEEKLY: 0,
      AI_MEDIUM_WEEKLY: 0,
      AI_SMALL_WEEKLY: 0,
      AI_TOP_MONTHLY: 0,
      AI_MEDIUM_MONTHLY: 0,
      AI_SMALL_MONTHLY: 0,
    };
  }
  
  if (req.method === 'GET') {
    console.log('[Oracle] GET returning - daily:', usage.ai_daily_count, 'weekly:', usage.weekly_top_count, 'monthly:', usage.monthly_top_count);
    return res.status(200).json({ 
      // Daily
      count: usage.ai_daily_count,
      top_count: usage.ai_top_count || 0,
      medium_count: usage.ai_medium_count || 0,
      small_count: usage.ai_small_count || 0,
      // Weekly
      weekly_top_count: usage.weekly_top_count || 0,
      weekly_medium_count: usage.weekly_medium_count || 0,
      weekly_small_count: usage.weekly_small_count || 0,
      // Monthly
      monthly_top_count: usage.monthly_top_count || 0,
      monthly_medium_count: usage.monthly_medium_count || 0,
      monthly_small_count: usage.monthly_small_count || 0,
      // Anchors
      daily_anchor: usage.daily_anchor || today,
      weekly_anchor: usage.weekly_anchor || weekAnchor,
      monthly_anchor: usage.monthly_anchor || monthAnchor,
      // Limits
      limit: planLimits.AI_DAILY_LIMIT,
      top_limit: planLimits.AI_TOP_LIMIT,
      medium_limit: planLimits.AI_MEDIUM_LIMIT,
      small_limit: planLimits.AI_SMALL_LIMIT,
      weekly_top_limit: planLimits.AI_TOP_WEEKLY,
      weekly_medium_limit: planLimits.AI_MEDIUM_WEEKLY,
      weekly_small_limit: planLimits.AI_SMALL_WEEKLY,
      monthly_top_limit: planLimits.AI_TOP_MONTHLY,
      monthly_medium_limit: planLimits.AI_MEDIUM_MONTHLY,
      monthly_small_limit: planLimits.AI_SMALL_MONTHLY,
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  try {
    const { messages = [], context = '', mode = 'chat', model: requestedModel } = req.body || {};

    // Helper to check if a tier is available across all periods
    const isTierAvailable = (tier: 'top' | 'medium' | 'small') => {
      const dailyLimit = tier === 'top' ? planLimits.AI_TOP_LIMIT : tier === 'medium' ? planLimits.AI_MEDIUM_LIMIT : planLimits.AI_SMALL_LIMIT;
      const weeklyLimit = tier === 'top' ? planLimits.AI_TOP_WEEKLY : tier === 'medium' ? planLimits.AI_MEDIUM_WEEKLY : planLimits.AI_SMALL_WEEKLY;
      const monthlyLimit = tier === 'top' ? planLimits.AI_TOP_MONTHLY : tier === 'medium' ? planLimits.AI_MEDIUM_MONTHLY : planLimits.AI_SMALL_MONTHLY;
      
      const dailyUsed = tier === 'top' ? (usage.ai_top_count || 0) : tier === 'medium' ? (usage.ai_medium_count || 0) : (usage.ai_small_count || 0);
      const weeklyUsed = tier === 'top' ? (usage.weekly_top_count || 0) : tier === 'medium' ? (usage.weekly_medium_count || 0) : (usage.weekly_small_count || 0);
      const monthlyUsed = tier === 'top' ? (usage.monthly_top_count || 0) : tier === 'medium' ? (usage.monthly_medium_count || 0) : (usage.monthly_small_count || 0);
      
      const dailyOk = dailyUsed < dailyLimit;
      const weeklyOk = weeklyUsed < weeklyLimit;
      const monthlyOk = monthlyUsed < monthlyLimit;
      
      // Must have availability in at least one period
      return dailyOk || weeklyOk || monthlyOk;
    };

    // WATERFALL LOGIC - checks all periods (daily, weekly, monthly)
    let selectedModel = requestedModel || (plan === 'pro' ? MEDIUM_MODELS[0] : FREE_MODELS[0]);
    let tier: 'top' | 'medium' | 'small' | 'free' = 'free';
    let autoSwitch = false;

    if (plan === 'pro') {
      // Determine tier of requested model or default to medium
      if (TOP_MODELS.includes(selectedModel)) {
        if (isTierAvailable('top')) {
          tier = 'top';
        } else if (isTierAvailable('medium')) {
          tier = 'medium';
          autoSwitch = true;
          selectedModel = MEDIUM_MODELS[0]; // Auto-switch to medium
        } else if (isTierAvailable('small')) {
          tier = 'small';
          autoSwitch = true;
          selectedModel = SMALL_MODELS[0]; // Auto-switch to small
        } else {
          tier = 'free';
          autoSwitch = true;
          selectedModel = FREE_MODELS[0]; // Auto-switch to free
        }
      } else if (MEDIUM_MODELS.includes(selectedModel)) {
        if (isTierAvailable('medium')) {
          tier = 'medium';
        } else if (isTierAvailable('small')) {
          tier = 'small';
          autoSwitch = true;
          selectedModel = SMALL_MODELS[0]; // Auto-switch to small
        } else {
          tier = 'free';
          autoSwitch = true;
          selectedModel = FREE_MODELS[0]; // Auto-switch to free
        }
      } else if (SMALL_MODELS.includes(selectedModel)) {
        if (isTierAvailable('small')) {
          tier = 'small';
        } else {
          tier = 'free';
          autoSwitch = true;
          selectedModel = FREE_MODELS[0]; // Auto-switch to free
        }
      } else {
        tier = 'free';
      }
    } else {
      // Free plan only has free tier - unlimited via free OpenRouter models
      tier = 'free';
      selectedModel = FREE_MODELS.includes(selectedModel) ? selectedModel : FREE_MODELS[0];
      
      // Free users now have unlimited access - no blocking, just track usage
    }

    // Increment counters for all periods (even free users for analytics)
    usage.ai_daily_count = (usage.ai_daily_count || 0) + 1;
    if (tier === 'top') {
      usage.ai_top_count = (usage.ai_top_count || 0) + 1;
      usage.weekly_top_count = (usage.weekly_top_count || 0) + 1;
      usage.monthly_top_count = (usage.monthly_top_count || 0) + 1;
    } else if (tier === 'medium') {
      usage.ai_medium_count = (usage.ai_medium_count || 0) + 1;
      usage.weekly_medium_count = (usage.weekly_medium_count || 0) + 1;
      usage.monthly_medium_count = (usage.monthly_medium_count || 0) + 1;
    } else if (tier === 'small') {
      usage.ai_small_count = (usage.ai_small_count || 0) + 1;
      usage.weekly_small_count = (usage.weekly_small_count || 0) + 1;
      usage.monthly_small_count = (usage.monthly_small_count || 0) + 1;
    }

    await supabase!.from('users').update({ usage }).eq('id', userId);
    profileCache.delete(userId); // Invalidate cache after update

    const filteredTools = getFilteredTools(plan, mode);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    res.write(`data: ${JSON.stringify({ 
      type: 'usage', 
      // Daily
      count: usage.ai_daily_count, 
      top_count: usage.ai_top_count,
      medium_count: usage.ai_medium_count,
      small_count: usage.ai_small_count,
      // Weekly
      weekly_top_count: usage.weekly_top_count,
      weekly_medium_count: usage.weekly_medium_count,
      weekly_small_count: usage.weekly_small_count,
      // Monthly
      monthly_top_count: usage.monthly_top_count,
      monthly_medium_count: usage.monthly_medium_count,
      monthly_small_count: usage.monthly_small_count,
      // Info
      tier,
      model: selectedModel,
      autoSwitch,
      // Limits
      limit: planLimits.AI_DAILY_LIMIT,
      top_limit: planLimits.AI_TOP_LIMIT,
      medium_limit: planLimits.AI_MEDIUM_LIMIT,
      small_limit: planLimits.AI_SMALL_LIMIT,
      weekly_top_limit: planLimits.AI_TOP_WEEKLY,
      weekly_medium_limit: planLimits.AI_MEDIUM_WEEKLY,
      weekly_small_limit: planLimits.AI_SMALL_WEEKLY,
      monthly_top_limit: planLimits.AI_TOP_MONTHLY,
      monthly_medium_limit: planLimits.AI_MEDIUM_MONTHLY,
      monthly_small_limit: planLimits.AI_SMALL_MONTHLY,
    })}\n\n`);

    async function runChat(currentMessages: any[], currentModel: string, currentTools: any[], mode: string, personality?: string, isRetry = false) {
      const sanitizedMessages = currentMessages.map((m: any) => {
        let msgContent = m.content;
        if (m.role === 'assistant' && m.tool_calls) {
          msgContent = null;
        } else if (Array.isArray(m.content)) {
          msgContent = m.content.map((item: any) => {
            if (typeof item === 'string') return item;
            
            // TIERED ACCESS: Free users cannot send images/PDFs to the AI
            const isVisionContent = ['image', 'input_image', 'image_url', 'file', 'document'].includes(item?.type);
            
            if (plan === 'free' && isVisionContent) {
              // Strip vision content for free users - replace with placeholder text
              if (item.type === 'file' || item.type === 'document') {
                return { type: 'text', text: `[Document: ${item.title || 'file'} - Upgrade to Pro to analyze files]` };
              }
              if (item.type === 'image' || item.type === 'input_image' || item.type === 'image_url') {
                return { type: 'text', text: '[Image - Upgrade to Pro to analyze images]' };
              }
              return null;
            }
            
            if (item && typeof item === 'object' && (
              item.type === 'text' || 
              item.type === 'input_text' || 
              item.type === 'image' || 
              item.type === 'input_image' || 
              item.type === 'image_url' || 
              item.type === 'file' || 
              item.type === 'document'
            )) {
              return item;
            }
            return null;
          }).filter(Boolean);
        }

        const msg: any = { role: m.role, content: msgContent };
        if (m.tool_calls) msg.tool_calls = m.tool_calls;
        if (m.tool_call_id) msg.tool_call_id = m.tool_call_id;
        if (m.name) msg.name = m.name;
        return msg;
      });

      try {
        let fullContent = "";
        let toolCalls: any[] = [];

        for await (const chunk of streamOpenRouter(OPENROUTER_API_KEY!, currentModel, [
          { role: 'system', content: getSystemPrompt(currentModel, context, plan, mode, personality) },
          ...sanitizedMessages
        ], currentTools)) {

          const delta = chunk.choices[0]?.delta;
          if (delta?.content) {
            fullContent += delta.content;
            if (delta.content) {
              res.write(`data: ${JSON.stringify({ type: 'text', content: delta.content })}\n\n`);
            }
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

          const serverToolCalls = filteredToolCalls.filter(tc => 
            tc.function.name === 'web_search' || tc.function.name === 'search_youtube'
          );
          
          const clientToolCalls = filteredToolCalls.filter(tc => 
            tc.function.name !== 'web_search' && tc.function.name !== 'search_youtube'
          );

          if (serverToolCalls.length > 0) {
            const serverResults = await Promise.all(
              serverToolCalls.map(tc => {
                const args = safeParseJSON(tc.function.arguments);
                if (args === null) {
                  return { error: "Invalid JSON arguments for tool: " + tc.function.name };
                }
                return executeServerTool(tc.function.name, args);
              })
            );

            serverToolCalls.forEach((tc, i) => {
              nextMessages.push({
                role: 'tool',
                tool_call_id: tc.id,
                name: tc.function.name,
                content: JSON.stringify(serverResults[i])
              });
            });
          }

          const batchedClientCalls = groupClientToolCalls(clientToolCalls);
          
          for (const batch of batchedClientCalls) {
            if (batch.length === 1) {
              const tc = batch[0];
              const args = safeParseJSON(tc.function.arguments, { _parseError: true, raw: tc.function.arguments });
              
              // FIX: If JSON parsing failed, send error to client instead of tool call
              if (args._parseError) {
                res.write(`data: ${JSON.stringify({ 
                  type: 'error', 
                  message: `Failed to parse arguments for ${tc.function.name}. Please try again.`
                })}\n\n`);
                continue;
              }
              
              res.write(`data: ${JSON.stringify({ 
                type: 'tool_call', 
                toolCall: { id: tc.id, toolName: tc.function.name, args } 
              })}\n\n`);

              if (tc.function.name !== 'get_thought_details') {
                nextMessages.push({
                  role: 'tool',
                  tool_call_id: tc.id,
                  name: tc.function.name,
                  content: JSON.stringify({ success: true, observed: false, message: "Action queued for client execution." })
                });
              }
            } else {
              let batchArgs = null;
              try {
                batchArgs = convertToBatchFormat(batch);
              } catch (e) {
                console.error('Failed to convert batch format:', e);
              }
              if (batchArgs) {
                res.write(`data: ${JSON.stringify({ 
                  type: 'tool_call', 
                  toolCall: { 
                    id: batch[0].id, 
                    toolName: batchArgs.toolName, 
                    args: batchArgs.args 
                  },
                  isBatch: true,
                  batchCount: batch.length
                })}\n\n`);

                nextMessages.push({
                  role: 'tool',
                  tool_call_id: batch[0].id,
                  name: batchArgs.toolName,
                  content: JSON.stringify({ success: true, observed: false, message: `Batch action queued for ${batch.length} items.` })
                });
              }
            }
          }

          return await runChat(nextMessages, currentModel, currentTools, mode, personality, isRetry);
        }
      } catch (err: any) {
        console.error(`[OpenRouter API] Model ${currentModel} failed:`, err.message);
        const isSizeError = err.message && err.message.includes('tokens');
        if (!isRetry && isSizeError && currentModel !== FREE_MODELS[0]) {
          res.write(`data: ${JSON.stringify({ type: 'text', content: "\n\n*Optimizing for large dataset...*\n\n" })}\n\n`);
          return await runChat(currentMessages, FREE_MODELS[0], filteredTools, mode, personality, true);
        }
        throw err;
      }
    }

    await runChat(messages, selectedModel, filteredTools, mode, profile.settings.personality);

    res.write('data: [DONE]\n\n');
    res.end();

  } catch (error: any) {
    console.error('[Oracle Error]', error);
    // If headers already sent (SSE started), can't send JSON error
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}

`);
      res.end();
    } else {
      res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
  }
}
