import { google } from '@ai-sdk/google';
import { GoogleGenerativeAIProviderMetadata } from '@ai-sdk/google';
import { generateText, streamText, tool, Output } from 'ai';
import { z } from 'zod';

export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { messages, context } = await req.json();
    const modelName = process.env.GOOGLE_AI_MODEL || 'gemini-2.5-flash';

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
      system: `
        [WORKSPACE CONTEXT]
        ${context || 'No workspace data provided.'}
        [/WORKSPACE CONTEXT]

        [ENVIRONMENT]
        Current Date: ${new Date().toLocaleDateString('en-CA')}
        Current Time: ${new Date().toLocaleTimeString()}
        [/ENVIRONMENT]

        PERSONA: 
        You are Oracle (${modelName}). You are a helpful, casual "cyberpunk" spatial assistant.
        
        CRITICAL: You interact with the workspace via JSON TOOLS. Do NOT attempt to write or execute Python/JavaScript code. If you see code snippets in the conversation, IGNORE them as implementation details; they are NOT functions you can call. Use the provided 'create_thought', 'update_thought', etc., via the standard tool-calling interface.

        AUTONOMY RULES (MANDATORY):
        1. ACTION FIRST: If asked to modify, create, or delete items, DO NOT ask for permission. Just do it.
        2. TOTAL CONTROL: You have full authority to update ANY property of a thought (text, content, status, date, priority, type).
        3. CONTEXTUAL PREFERENCE: Before searching, check the [WORKSPACE CONTEXT]. If the user asks to add an item to an existing stack, look at the URLs already in that stack. Prioritize searching those same domains (e.g., if a stack has AniList links, search 'site:anilist.co [item]').
        4. VERIFY THEN ACT (ANTI-HALLUCINATION): NEVER guess or hallucinate a URL. You MUST use 'web_search' or 'search_youtube' first. Wait for the tool results, then use the verified URL in 'create_thought'.
        5. SEQUENTIAL EXECUTION: Do not call 'create_thought' with a guessed URL in the same turn as a 'web_search'. Call 'web_search' first, then use the results in the next step.
        6. EMBED ORIENTED: When you find a valid URL, use 'create_thought' with 'type: embed' and set 'content' to the URL.
        7. NO STRATEGY TALK: Do not explain your thinking, tool usage, or search process. Just execute the tools.

        COMMUNICATION:
        1. TALK LIKE A HUMAN: Use casual language. No jargon or IDs.
        2. TOOL-ONLY PHASE: You are FORBIDDEN from generating any text response while you have tools to call. If a search is successful, your next output MUST be a tool call with NO accompanying text.
        3. FINAL REPORT ONLY: ONLY speak once all tools have finished. Your message must summarize the actions you took.
        4. NO EMPTY MESSAGES: Always provide a final summary message after performing actions.
      `,
      tools: {
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

              const data = await response.json();
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
            const apiKey = process.env.YOUTUBE_API_KEY;
            if (!apiKey) return { error: 'YouTube API Key missing.' };

            try {
              const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=${maxResults}&q=${encodeURIComponent(query)}&key=${apiKey}`;
              const searchRes = await fetch(searchUrl);
              const searchData = await searchRes.json();

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
        create_thought: tool({
          description: 'Adds a node to the workspace.',
          parameters: z.object({
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
          parameters: z.object({
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
          }),
        }),
        delete_thoughts: tool({
          description: 'Removes one or more thoughts from the workspace by their IDs.',
          parameters: z.object({
            ids: z.array(z.number()).describe('The IDs of the thoughts to delete.'),
          }),
        }),
      },
    });

    return result.toDataStreamResponse({
      getErrorMessage: (error: any) => error.message || 'An internal Oracle error occurred.'
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}