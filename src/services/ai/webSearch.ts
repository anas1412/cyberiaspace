/**
 * Web Search Service (Tavily)
 *
 * Searches the web via Tavily API. Requires VITE_TAVILY_API_KEY env var.
 * Returns formatted search results with title, URL, and content snippets.
 */

import { TAVILY_CONFIG } from '../../constants';

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score?: number;
}

interface TavilyResponse {
  query: string;
  results: TavilyResult[];
  answer?: string;
}

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

function getApiKey(): string | null {
  try {
    // @ts-ignore - import.meta.env is Vite-specific
    const key = import.meta.env.VITE_TAVILY_API_KEY as string | undefined;
    return key || null;
  } catch {
    return null;
  }
}

export async function webSearch(query: string): Promise<{
  success: boolean;
  results?: WebSearchResult[];
  error?: string;
}> {
  const apiKey = getApiKey();

  if (!apiKey) {
    return {
      success: false,
      error: 'Tavily API key not configured. Set VITE_TAVILY_API_KEY in your environment.',
    };
  }

  try {
    const response = await fetch(TAVILY_CONFIG.API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: TAVILY_CONFIG.SEARCH_DEPTH,
        max_results: TAVILY_CONFIG.MAX_RESULTS,
        include_answer: TAVILY_CONFIG.INCLUDE_ANSWER,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        success: false,
        error: `Tavily API error (${response.status}): ${text}`,
      };
    }

    const data: TavilyResponse = await response.json();

    const results: WebSearchResult[] = data.results.map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.content,
    }));

    return { success: true, results };
  } catch (err: any) {
    return {
      success: false,
      error: `Web search failed: ${err.message || 'Unknown error'}`,
    };
  }
}
