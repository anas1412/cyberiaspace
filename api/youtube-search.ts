import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * api/youtube-search.ts
 * 
 * This route fetches real video data from the YouTube Data API v3.
 * It is optimized for the Gemini 3 "Cyberia Oracle" logic.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const query = req.query.q as string;
  const maxResults = parseInt(req.query.maxResults as string) || 5;

  // 1. Validate Input
  if (!query) {
    return res.status(400).json({ error: "Missing query parameter 'q'" });
  }

  try {
    const apiKey = process.env.YOUTUBE_API_KEY;

    // 2. Validate API Key
    if (!apiKey) {
      console.error("YOUTUBE_API_KEY is not defined in your environment variables.");
      return res.status(500).json({ 
        error: "Server configuration error", 
        message: "Missing YouTube API Key on server." 
      });
    }

    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=${maxResults}&q=${encodeURIComponent(query)}&key=${apiKey}`;

    // 3. Fetch from Google
    const response = await fetch(url);
    const data = await response.json();

    // 4. Handle Google API Errors (like 403 Forbidden or 429 Over Quota)
    if (!response.ok) {
      console.error("YouTube API returned an error:", data);
      return res.status(response.status).json({ 
        error: "YouTube API Error", 
        message: data.error?.message || "Forbidden",
        reason: data.error?.errors?.[0]?.reason || "unknown"
      });
    }

    // 5. Clean and Filter Data
    // We only want 'youtube#video' items to ensure we have a valid videoId
    const items = data.items || [];
    const cleanedResults = items
      .filter((item: any) => item.id && item.id.videoId) // Safety check: must have videoId
      .map((item: any) => ({
        title: item.snippet.title,
        url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
        description: item.snippet.description 
          ? item.snippet.description.substring(0, 120) + "..." 
          : "No description available."
      }));

    // 6. Return Success
    // We wrap it in a 'results' object to match the executeTool logic in ai.ts
    return res.status(200).json({ 
      results: cleanedResults,
      count: cleanedResults.length 
    });

  } catch (err: any) {
    // 7. Prevent Local Node Crash
    // Catching the error here prevents the Windows "Assertion failed" error
    console.error("Internal Script Error in youtube-search.ts:", err);
    return res.status(500).json({ 
      error: "Internal Server Error", 
      message: err.message || "An unexpected error occurred." 
    });
  }
}