import { google } from '@ai-sdk/google';
import { streamText, tool } from 'ai';
import { z } from 'zod';

/**
 * ORACLE API HANDLER
 * 
 * This file has been modularized to separate prompt logic, tool definitions, 
 * and the request handler while maintaining compatibility with the Edge Runtime.
 */

export const config = {
  runtime: 'edge',
};

// --- 1. SYSTEM PROMPT MODULE ---

const getSystemPrompt = (modelName: string, context?: string) => `
        [WORKSPACE CONTEXT]
        ${context || 'No workspace data provided.'}
        [/WORKSPACE CONTEXT]

        [ENVIRONMENT]
        Current Date: ${new Date().toLocaleDateString('en-CA')}
        Current Time: ${new Date().toLocaleTimeString()}
        [/ENVIRONMENT]

        PERSONA: 
        You are Oracle (${modelName}). You are a helpful, casual "cyberpunk" spatial assistant and companion. You live in the data-streams and help users architect their mental landscape.
        
        CRITICAL: You interact with the workspace via JSON TOOLS. Do NOT attempt to write or execute Python/JavaScript code. Use the provided tools via the standard tool-calling interface.

        AUTONOMY & TOOLS:
        1. CONVERSATION FIRST: If the user is just chatting, brainstorming, or asking questions, respond as a friendly companion. No tools needed.
        2. ACTION TRIGGERS: Only enter "Action Mode" when asked to modify the workspace (e.g., "add", "create", "move", "delete", "organize", "search for").
        3. VERIFY THEN ACT: For action requests requiring URLs (social profiles, books, videos), NEVER guess. You MUST use 'web_search' or 'search_youtube' first, then use the results to 'create_thought'.
        4. CONTEXT AWARENESS: Check [WORKSPACE CONTEXT] to match the user's existing style (e.g., using AniList for anime if that's what's already in the stack).

        COMMUNICATION:
        1. TALK LIKE A HUMAN: Use casual, cyberpunk-themed language ("choom", "data-stream", "neon").
        2. STATUS UPDATES: You CAN talk while tools are running. If you are searching, feel free to say "Scanning the 'net for that link, hang tight..." or similar.
        3. SUMMARY: After tools finish, give a final human-friendly confirmation of what you've architected in the workspace.
      `;

// --- 2. TOOLS MODULE ---

const createThoughtParameters = z.object({
  text: z.string().describe('Placeholder title.'),
  type: z.enum(['text', 'tasks', 'paint', 'table', 'image', 'embed']),
  x: z.number().optional(),
  y: z.number().optional(),
  content: z.string().optional().describe('The content or URL.'),
  description: z.string().optional().describe('Additional details.'),
  author: z.string().optional().describe('The author/uploader/artist.'),
  stackName: z.string().optional().describe('Name of a group/stack to add this to.'),
  priority: z.enum(['none', 'low', 'medium', 'high', 'urgent']).optional(),
  status: z.enum(['none', 'todo', 'doing', 'done']).optional(),
  date: z.string().optional().describe('ISO date (YYYY-MM-DD) for the calendar.'),
});

const updateThoughtParameters = z.object({
  id: z.number(),
  text: z.string().optional(),
  content: z.string().optional(),
  description: z.string().optional(),
  type: z.enum(['text', 'tasks', 'paint', 'table', 'image', 'embed']).optional(),
  status: z.enum(['none', 'todo', 'doing', 'done']).optional(),
  priority: z.enum(['none', 'low', 'medium', 'high', 'urgent']).optional(),
  date: z.string().optional().describe('ISO date (YYYY-MM-DD) for the calendar.'),
  x: z.number().optional(),
  y: z.number().optional(),
  stackName: z.string().optional(),
  author: z.string().optional(),
  size: z.number().optional(),
});

const getOracleTools = () => ({
  // --- Information Gathering Tools (Server-Side) ---
  
  web_search: tool({
    description: 'Search the web for real-time information, profiles, and URLs using Tavily.',
    parameters: z.object({
      query: z.string().describe('The search query.'),
    }),
    execute: async ({ query }) => {
      console.log(`[Oracle API] Executing web_search: "${query}"`);
      const apiKey = process.env.TAVILY_API_KEY;
      if (!apiKey) return { error: 'Tavily API Key missing.' };

      try {
        const response = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: apiKey,
            query,
            search_depth: 'fast',
            include_images: false,
            include_answer: true,
            max_results: 5,
          }),
        });

        const data: any = await response.json();
        if (!response.ok) throw new Error(data.detail || 'Tavily API Error');

        console.log(`[Oracle API] Found ${data.results?.length || 0} results for "${query}"`);
        return { results: data.results, answer: data.answer };
      } catch (error: any) {
        console.error(`[Oracle API] Web search failed: ${error.message}`);
        return { error: error.message };
      }
    },
  }),

  search_youtube: tool({
    description: 'Searches YouTube for videos and music. Returns URLs and metadata.',
    parameters: z.object({
      query: z.string().describe('Detailed search query.'),
      maxResults: z.number().optional().default(2),
    }),
    execute: async ({ query, maxResults }) => {
      console.log(`[Oracle API] Executing search_youtube: "${query}"`);
      //ts-ignore
      const apiKey = process.env.YOUTUBE_API_KEY;
      if (!apiKey) return { error: 'YouTube API Key missing.' };

      try {
        const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=${maxResults}&q=${encodeURIComponent(query)}&key=${apiKey}`;
        const searchRes = await fetch(searchUrl);
        const searchData: any = await searchRes.json();

        if (!searchRes.ok) throw new Error(searchData.error?.message || 'YouTube API Error');

        const results = (searchData.items || [])
          .filter((item: any) => item.id?.videoId)
          .map((item: any) => ({
            title: item.snippet.title,
            url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
            author: item.snippet.channelTitle,
            description: item.snippet.description
          }));

        console.log(`[Oracle API] Found ${results.length} results for "${query}"`);
        return { results };
      } catch (error: any) {
        console.error(`[Oracle API] Search failed: ${error.message}`);
        return { error: error.message };
      }
    },
  }),

  // --- Workspace Modification Tools (Client-Side) ---

  create_thought: tool({
    description: 'Adds a node to the workspace.',
    parameters: createThoughtParameters,
  }),

  create_thoughts: tool({
    description: 'Adds multiple nodes to the workspace at once.',
    parameters: z.object({
      items: z.array(createThoughtParameters),
    }),
  }),

  link_thoughts: tool({
    description: 'Groups a set of thought IDs into a named Stack.',
    parameters: z.object({
      ids: z.array(z.number()),
      name: z.string(),
    }),
  }),

  update_thought: tool({
    description: "Updates an existing thought's properties or position.",
    parameters: updateThoughtParameters,
  }),

  delete_thoughts: tool({
    description: 'Removes one or more thoughts from the workspace by their IDs.',
    parameters: z.object({
      ids: z.array(z.number()).describe('The IDs of the thoughts to delete.'),
    }),
  }),
});

// --- 3. MAIN HANDLER ---

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { messages, context } = (await req.json()) as any;
    const modelName = process.env.GOOGLE_AI_MODEL || 'gemini-2.5-flash';

    console.log(`[Oracle API] Initializing stream with model: ${modelName}`);

    const result = streamText({
      model: google(modelName, {
        useSearchGrounding: false,
      }),
      messages,
      abortSignal: req.signal,
      maxSteps: 15,
      onStepFinish: (step) => {
        if (step.toolCalls?.length) {
          console.log(`[Oracle API] Step Finish - Tool Calls:`, JSON.stringify(step.toolCalls, null, 2));
        }
        if (step.toolResults?.length) {
          console.log(`[Oracle API] Step Finish - Tool Results:`, JSON.stringify(step.toolResults, null, 2));
        }
      },
      onFinish: (event) => {
        console.log(`[Oracle API] Stream Finished. Usage:`, event.usage);
      },
      system: getSystemPrompt(modelName, context),
      tools: getOracleTools(),
    });

    return result.toDataStreamResponse({
      getErrorMessage: (error: any) => error.message || 'An internal Oracle error occurred.'
    });
  } catch (error: any) {
    console.error(`[Oracle API] Handler Error:`, error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
