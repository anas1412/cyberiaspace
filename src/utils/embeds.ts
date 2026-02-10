/**
 * Unified Embed Detection & Metadata Utility
 * Supports YouTube, Spotify, Twitter, Reddit, and more.
 */

export type EmbedProvider = 'youtube' | 'spotify' | 'twitter' | 'reddit' | 'facebook' | 'instagram' | 'unknown';

export interface EmbedInfo {
  provider: EmbedProvider;
  id: string | null;
  url: string;
}

export interface EmbedMeta {
  title?: string;
  author_name?: string;
  author_url?: string;
  thumbnail_url?: string;
  video_url?: string;
  provider_name?: string;
  html?: string; // For oEmbed widgets
}

/**
 * Detects the provider and extracts the ID from a given URL.
 */
export const getEmbedInfo = (url: string): EmbedInfo => {
  if (!url) return { provider: 'unknown', id: null, url: '' };

  // YouTube
  const ytRegex = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const ytMatch = url.match(ytRegex);
  if (ytMatch && ytMatch[2].length === 11) {
    return { provider: 'youtube', id: ytMatch[2], url };
  }

  // Spotify
  // Matches: spotify:track:ID, https://open.spotify.com/track/ID, etc.
  const spotifyRegex = /(?:spotify:|(?:https?:\/\/(?:open|play)\.spotify\.com\/))(track|album|playlist|artist|episode|show)(?:[\/:])([a-zA-Z0-9]+)/;
  const spotifyMatch = url.match(spotifyRegex);
  if (spotifyMatch) {
    return { provider: 'spotify', id: `${spotifyMatch[1]}/${spotifyMatch[2]}`, url };
  }

  // Twitter / X
  const twitterRegex = /https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)\/status\/(\d+)/;
  const twitterMatch = url.match(twitterRegex);
  if (twitterMatch) {
    return { provider: 'twitter', id: twitterMatch[2], url };
  }

  // Reddit
  const redditRegex = /https?:\/\/(?:www\.)?reddit\.com\/r\/([a-zA-Z0-9_]+)\/comments\/([a-zA-Z0-9_]+)/;
  const redditMatch = url.match(redditRegex);
  if (redditMatch) {
    return { provider: 'reddit', id: redditMatch[2], url };
  }

  // Facebook
  const fbRegex = /https?:\/\/(?:www\.)?facebook\.com\/(?:[a-zA-Z0-9.]+\/posts\/|permalink\.php\?story_fbid=)(\d+)/;
  const fbMatch = url.match(fbRegex);
  if (fbMatch) {
    return { provider: 'facebook', id: fbMatch[1], url };
  }

  // Instagram
  const igRegex = /https?:\/\/(?:www\.)?instagram\.com\/(?:p|reels|tv)\/([a-zA-Z0-9_-]+)/;
  const igMatch = url.match(igRegex);
  if (igMatch) {
    return { provider: 'instagram', id: igMatch[1], url };
  }

  return { provider: 'unknown', id: null, url };
};

/**
 * Fetches metadata using a generic oEmbed approach with proxy support.
 */
export const fetchEmbedMeta = async (url: string): Promise<EmbedMeta> => {
  const { provider } = getEmbedInfo(url);
  
  let oEmbedUrl = '';
  if (provider === 'youtube') {
    oEmbedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
  } else if (provider === 'spotify') {
    oEmbedUrl = `https://embed.spotify.com/oembed/?url=${encodeURIComponent(url)}`;
  } else if (provider === 'twitter') {
    oEmbedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}`;
  } else if (provider === 'reddit') {
    oEmbedUrl = `https://www.reddit.com/oembed?url=${encodeURIComponent(url)}`;
  } else if (provider === 'instagram') {
    oEmbedUrl = `https://api.instagram.com/oembed?url=${encodeURIComponent(url)}`;
  } else if (provider === 'facebook') {
    oEmbedUrl = `https://www.facebook.com/plugins/post/oembed.json/?url=${encodeURIComponent(url)}`;
  }

  let data: EmbedMeta | null = null;

  if (oEmbedUrl) {
    // Try multiple proxies for high reliability
    const proxies = [
      (u: string) => u, // Direct
      (u: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`,
      (u: string) => `https://corsproxy.io/?${encodeURIComponent(u)}`
    ];

    for (const proxy of proxies) {
      try {
        const res = await fetch(proxy(oEmbedUrl));
        if (!res.ok) continue;
        
        let result = await res.json();
        if (result.contents) result = JSON.parse(result.contents); // For AllOrigins
        
        data = result;
        break;
      } catch (err) {
        console.warn(`[Embed Utils] Proxy failed:`, err);
      }
    }
  }

  // Fallback to Microlink API if oEmbed fails or is not available
  if (!data || !data.thumbnail_url) {
    try {
      const res = await fetch(`https://api.microlink.io?url=${encodeURIComponent(url)}`);
      if (res.ok) {
        const result = await res.json();
        if (result.status === 'success' && result.data) {
          const ml = result.data;
          data = {
            ...data,
            title: data?.title || ml.title || url,
            author_name: data?.author_name || ml.author || ml.publisher || "",
            thumbnail_url: ml.image?.url || ml.logo?.url || null,
            video_url: ml.video?.url || null,
            provider_name: data?.provider_name || ml.publisher || ""
          };
        }
      }
    } catch (err) {
      console.warn(`[Embed Utils] Microlink fallback failed:`, err);
    }
  }

  return data || { title: url };
};
