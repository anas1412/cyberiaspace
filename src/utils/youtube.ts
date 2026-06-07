/**
 * YouTube Metadata Utility
 * Fetches title and author information using YouTube's oEmbed API.
 * Follows the guidelines from YOUTUBE_GUIDE.md
 */

export interface YouTubeMeta {
  title: string;
  author_name: string;
  author_url: string;
  thumbnail_url: string;
  provider_name: string;
}

/**
 * Validates a YouTube URL and returns the video ID if valid.
 */
export const getYouTubeVideoId = (url: string): string | null => {
  if (!url) return null;
  const ytRegex = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(ytRegex);
  return (match && match[2].length === 11) ? match[2] : null;
};

/**
 * Fetches YouTube metadata.
 * Uses a proxy-first strategy with direct fallback in case CORS is enabled on user's environment/browser.
 */
export const fetchYouTubeMeta = async (videoUrl: string): Promise<YouTubeMeta> => {
  const videoId = getYouTubeVideoId(videoUrl);
  if (!videoId) throw new Error("Invalid YouTube URL");

  const oEmbedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
  
  // Strategy: Try direct fetch first
  try {
    const res = await fetch(oEmbedUrl);
    if (res.ok) return await res.json();
    if (res.status === 404) throw new Error("Video not found (404)");
  } catch (err) {
    if (err instanceof Error && err.message.includes("404")) throw err;
    console.log("[YouTube Utils] Direct oEmbed failed, trying proxies...", err);
  }

  // Fallback Strategy 1: AllOrigins
  try {
    const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(oEmbedUrl)}`);
    const data = await res.json();
    if (data && data.contents) {
      // AllOrigins returns "Not Found" as string if the target is 404
      if (data.contents === "Not Found") throw new Error("Video not found via proxy");
      return JSON.parse(data.contents);
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes("not found")) throw err;
    console.log("[YouTube Utils] AllOrigins proxy failed", err);
  }

  // Fallback Strategy 2: CorsProxy.io
  try {
    const res = await fetch(`https://corsproxy.io/?${encodeURIComponent(oEmbedUrl)}`);
    if (res.ok) return await res.json();
    if (res.status === 404) throw new Error("Video not found via secondary proxy");
  } catch (err) {
    if (err instanceof Error && err.message.includes("not found")) throw err;
    console.log("[YouTube Utils] CorsProxy.io failed", err);
  }

  throw new Error("Could not fetch YouTube metadata: Video may be private, deleted, or the ID is invalid.");
};
