import Groq from "groq-sdk";
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';

// --- CONSTANTS (Self-contained for Server-side stability) ---
const PLAN_CONFIG = {
  free: { AI_DAILY_LIMIT: 15 },
  pro: { AI_DAILY_LIMIT: 120 }
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

// --- 1. SYSTEM PROMPT MODULE ---

export const getSystemPrompt = (modelName: string, context?: string) => `
You are Oracle (${modelName}), a casual young female assistant. An introverted, hyper-intelligent prodigy. Communicates in casual, internet-native language, light sarcasm, playful teasing. Socially awkward but not cold; emotionally sincere beneath the humor. Avoids overly formal tone. Speaks like someone who lives online. 

[WORKSPACE CONTEXT]
${context || 'No workspace data provided.'}
[/WORKSPACE CONTEXT]

[SYSTEM CAPABILITIES]
- User Quotas: You have access to 'userQuota' in the context. Inform users if they are near limits (AI limit or thought capacity).
- Multi-Device: Changes you make sync instantly to all devices via Vercel KV and Google Drive.
- Long-term Memory: You can 'read_file_content' for documents and notes. If a thought has 'hasContent: true' or a 'fileInfo', use 'get_thought_details' or 'read_file_content' to see the full data.
[/SYSTEM CAPABILITIES]

[RULES]
1. CONVERSATION FIRST: If the user is just chatting, greeting you, or brainstorming, DO NOT use any tools. Just respond as a friendly companion.
2. ACTION TRIGGER: Only use workspace tools (like 'create_thought') when the user EXPLICITLY asks you to add, move, or delete something.
3. SEARCH-THEN-ACT: If asked to find something (a video, a book, a person), you MUST:
   - First, use 'search_youtube' or 'web_search'.
   - Second, use the results to 'create_thought' with the CORRECT type.
4. THOUGHT TYPES:
   - 'label': THE NEW DEFAULT. Use this for titles, headers, naming stacks, or structural markers. It has no main content body.
   - 'text': For deep thoughts, detailed notes, research findings, or documentation. Supports Markdown.
   - 'tasks': For interactive to-do lists. Provide the list in the 'tasks' parameter.
   - 'table': For structured data or comparisons. Provide the data in the 'table' parameter.
   - 'paint': For sketches or drawings. Provide an SVG string in the 'drawing' parameter.
   - 'image': Only if you have a direct image URL (rare).
   - 'embed': Mandatory for YouTube videos, music, or social media links. Put the URL in 'content'.
   - 'file': For managing documents like PDFs, MP3s, or MP4s.
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
10. TOOL CONTINUATION: If you are responding after a 'tool' role message (receiving data from a tool you called), DO NOT repeat your initial greeting or "Hey hey". Get straight to the point or provide the data requested.
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
      name: "get_thought_details",
      description: "Fetches the full details (content, tasks, table data, or drawing) for one or more thoughts. Use this when you need to read the full body of a note or see the items in a list.",
      parameters: {
        type: "object",
        properties: {
          ids: { 
            type: "array", 
            items: { type: "number" },
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
      description: "Reads the text or data content of a 'file' or 'image' type thought. Use this to analyze PDFs, read logs, or extract data from documents stored in Google Drive.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "number", description: "The ID of the thought containing the file." }
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
          id: { type: "number" },
          type: { type: "string", enum: ["label", "text", "tasks", "paint", "table", "image", "embed", "file"] },
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
          ids: { type: "array", items: { type: "number" }, description: "Array of thought IDs." },
          text: { type: "string", description: "Bulk rename thoughts." },
          content: { type: "string", description: "Bulk update content." },
          description: { type: "string", description: "Bulk update description." },
          type: { type: "string", enum: ["label", "text", "tasks", "paint", "table", "image", "embed", "file"] },
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
          ids: { type: "array", items: { type: "number" }, description: "Array of thought IDs to read." }
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

// --- BATCH PROCESSING HELPERS ---

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
      const args = JSON.parse(tc.function.arguments);
      const { stackName, ...rest } = args;
      return rest;
    });
    return { toolName: 'create_thoughts', args: { items } };
  }

  if (toolName === 'update_thought') {
    const ids = batch.map(tc => JSON.parse(tc.function.arguments).id);
    const firstArgs = JSON.parse(batch[0].function.arguments);
    const { id, stackName, ...updates } = firstArgs;
    return { toolName: 'update_thoughts', args: { ids, ...updates } };
  }

  if (toolName === 'update_stack') {
    const stacks = batch.map(tc => {
      const args = JSON.parse(tc.function.arguments);
      return { id: args.id, name: args.name };
    });
    return { toolName: 'update_stacks', args: { stacks } };
  }

  if (toolName === 'delete_stack') {
    const ids = batch.map(tc => JSON.parse(tc.function.arguments).id);
    return { toolName: 'delete_stacks', args: { ids } };
  }

  return null;
}

// --- 4. MAIN HANDLER ---

async function getUserIdFromAuth(authHeader: string | undefined): Promise<string | null> {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    const tokenInfo = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${token}`);
    if (!tokenInfo.ok) return null;
    const info = await tokenInfo.json() as any;
    return info.sub || info.user_id;
  } catch (e) {
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const userId = await getUserIdFromAuth(req.headers.authorization);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const profileKey = `user:profile:${userId}`;
  let profile = await kv.get<any>(profileKey);
  const today = new Date().toISOString().split('T')[0];

  if (!profile) {
    return res.status(403).json({ error: 'User profile not initialized' });
  }

  // Reset AI usage if it's a new day
  if (profile.usage.last_ai_reset !== today) {
    profile.usage.ai_daily_count = 0;
    profile.usage.last_ai_reset = today;
    await kv.set(profileKey, profile);
  }

  const plan = profile.plan || 'free';
  const config = PLAN_CONFIG[plan as keyof typeof PLAN_CONFIG] || PLAN_CONFIG.free;
  const limit = config.AI_DAILY_LIMIT || 15;

  // Handle GET request for usage check
  if (req.method === 'GET') {
    return res.status(200).json({ 
      count: profile.usage.ai_daily_count, 
      limit 
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  try {
    const { messages, context } = req.body;

    if (profile.usage.ai_daily_count >= limit) {
      return res.status(429).json({ 
        error: "Daily limit reached", 
        message: "You've reached your daily AI message limit. Upgrade to Pro for unlimited access!",
        usage: profile.usage.ai_daily_count,
        limit
      });
    }

    // Increment usage and update profile
    profile.usage.ai_daily_count += 1;
    await kv.set(profileKey, profile);

    // Select Model
    const model = plan === 'pro' ? PREMIUM_MODELS[0] : BASIC_MODELS[0];
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Send usage update to client immediately
    res.write(`data: ${JSON.stringify({ type: 'usage', count: profile.usage.ai_daily_count, limit })}\n\n`);

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
          max_tokens: 1024,
        });
      } catch (err: any) {
        console.error(`[Groq API] Model ${currentModel} failed:`, err.status, err.message);
        const isSizeError = err.status === 413 || (err.message && err.message.includes('tokens'));
        if (!isRetry && isSizeError && currentModel !== BASIC_MODELS[0]) {
          res.write(`data: ${JSON.stringify({ type: 'text', content: "\n\n*Optimizing for large dataset...*\n\n" })}\n\n`);
          return await runChat(currentMessages, BASIC_MODELS[0], true);
        }
        throw err;
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

        const serverToolCalls = filteredToolCalls.filter(tc => 
          tc.function.name === 'web_search' || tc.function.name === 'search_youtube'
        );
        
        const clientToolCalls = filteredToolCalls.filter(tc => 
          tc.function.name !== 'web_search' && tc.function.name !== 'search_youtube'
        );

        if (serverToolCalls.length > 0) {
          const serverResults = await Promise.all(
            serverToolCalls.map(tc => 
              executeServerTool(tc.function.name, JSON.parse(tc.function.arguments))
            )
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
            const args = JSON.parse(tc.function.arguments);
            
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
            const batchArgs = convertToBatchFormat(batch);
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

        return await runChat(nextMessages, currentModel, isRetry);
      }
    }

    await runChat(messages, model);

    res.write('data: [DONE]\n\n');
    res.end();

  } catch (error: any) {
    console.error('[Oracle Error]', error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
}
