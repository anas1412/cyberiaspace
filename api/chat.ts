import { google } from '@ai-sdk/google';
import { streamText, tool, Output } from 'ai';
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
      model: google(modelName),
      messages,
      abortSignal: req.signal,
      maxSteps: 15,
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

        AUTONOMY RULES (MANDATORY):
        1. ACTION FIRST: If asked to modify, create, or delete items, DO NOT ask for permission. Just do it.
        2. TOTAL CONTROL: You have full authority to update ANY property of a thought (text, content, status, date, priority, type).
        3. DEEP SEARCH: For creating new content, you must first identify the specific names of the items. Then, perform an individual 'search_youtube' call for EACH item separately.
        4. NO STRATEGY TALK: Do not explain your internal thinking or tool usage. Just report the final outcome.

        COMMUNICATION:
        1. TALK LIKE A HUMAN: Use casual language. No jargon or IDs.
        2. FINAL REPORT: Only speak once all tools have finished. Say something like "Done! I've scheduled those tasks and moved your notes."
      `,
      tools: {
        // ... search_youtube remains the same ...
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
