/**
 * Unified Embed Detection & Metadata Utility
 * Supports YouTube, Spotify, Twitter, Reddit, and more.
 */

export type EmbedProvider = 'youtube' | 'spotify' | 'twitter' | 'reddit' | 'facebook' | 'instagram' | 'tiktok' | 'unknown';

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
  description?: string; // New field
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
  const redditRegex = /https?:\/\/(?:www\.)?(?:reddit\.com\/r\/[a-zA-Z0-9_]+\/comments\/|v\.redd\.it\/)([a-zA-Z0-9_]+)/;
  const redditMatch = url.match(redditRegex);
  if (redditMatch) {
    return { provider: 'reddit', id: redditMatch[1], url };
  }

  // TikTok
  const tiktokRegex = /https?:\/\/(?:www\.)?(?:tiktok\.com\/.*\/video\/|vm\.tiktok\.com\/|vt\.tiktok\.com\/)([a-zA-Z0-9]+)/;
  const tiktokMatch = url.match(tiktokRegex);
  if (tiktokMatch) {
    return { provider: 'tiktok', id: tiktokMatch[1], url };
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
  const { provider, id: videoId } = getEmbedInfo(url);

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
  } else if (provider === 'tiktok') {
    oEmbedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
  }

  // 1. Fetch oEmbed data
  const fetchOEmbed = async (): Promise<EmbedMeta | null> => {
    if (!oEmbedUrl) return null;
    const proxies = [
      (u: string) => `/api/oembed?url=${encodeURIComponent(u)}`,
      (u: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`,
      (u: string) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
      (u: string) => u,
    ];

    for (const proxy of proxies) {
      try {
        const res = await fetch(proxy(oEmbedUrl));
        if (!res.ok) continue;
        let result = await res.json();
        if (result.contents) result = JSON.parse(result.contents);
        return result;
      } catch (err) {
        console.warn(`[Embed Utils] oEmbed proxy failed:`, err);
      }
    }
    return null;
  };

  // 2. Fetch rich metadata using our internal scraper (no rate limits)
  const fetchInternalMetadata = async (): Promise<EmbedMeta | null> => {
    try {
      const res = await fetch(`/api/metadata?url=${encodeURIComponent(url)}`);
      if (res.ok) {
        const data = await res.json();
        return {
          title: data.title || "",
          author_name: data.author || data.publisher || "",
          thumbnail_url: data.image || null,
          provider_name: data.publisher || "",
          description: data.description || ""
        };
      }
    } catch (err) {
      console.warn(`[Embed Utils] Internal metadata fetch failed:`, err);
    }
    return null;
  };

  // 3. Twitter-specific high-fidelity extraction (bypasses bot protection)
  const fetchTwitterMeta = async (): Promise<Partial<EmbedMeta> | null> => {
    if (provider !== 'twitter') return null;
    try {
      const vxUrl = url.replace(/(twitter\.com|x\.com)/, 'api.vxtwitter.com');
      const res = await fetch(vxUrl);
      if (res.ok) {
        const data = await res.json();
        // Hierarchy: 1. Image 2. Video Thumbnail 3. User Profile
        let mediaUrl = null;
        if (data.media_extended?.[0]) {
          const firstMedia = data.media_extended[0];
          mediaUrl = firstMedia.thumbnail_url || firstMedia.url;
        } else if (data.media_urls?.[0]) {
          mediaUrl = data.media_urls[0];
        }

        return {
          title: data.text ? (data.text.length > 60 ? data.text.substring(0, 60) + '...' : data.text) : "",
          author_name: `${data.user_name} (@${data.user_screen_name})`,
          thumbnail_url: mediaUrl || data.user_profile_image_url || null,
          description: data.text || ""
        };
      }
    } catch (err) {
      console.warn(`[Embed Utils] Twitter VX fetch failed:`, err);
    }
    return null;
  };

  // 4. YouTube-specific Search/Data fallback (for Description)
  const fetchYouTubeSearch = async (): Promise<Partial<EmbedMeta> | null> => {
    if (provider !== 'youtube' || !videoId) return null;
    try {
      const res = await fetch(`/api/youtube-search?q=${videoId}`);
      if (res.ok) {
        const data = await res.json();
        const bestResult = data.results?.[0];
        if (bestResult) {
          return {
            author_name: bestResult.author,
            description: bestResult.description
          };
        }
      }
    } catch (err) {
      console.warn(`[Embed Utils] YouTube Search fallback failed:`, err);
    }
    return null;
  };

  // Run in parallel for speed
  const [oData, mlData, ytSearchData, twData] = await Promise.all([
    fetchOEmbed(),
    fetchInternalMetadata(),
    fetchYouTubeSearch(),
    fetchTwitterMeta()
  ]);

  // Refined author selection
  const genericNames = ['spotify', 'youtube', 'twitter', 'x', 'instagram', 'facebook', 'tiktok', 'reddit'];

  const getCleanAuthor = (name?: string) => {
    if (!name) return "";
    const clean = name.trim();
    if (genericNames.includes(clean.toLowerCase())) return "";
    return clean;
  };

  // Prioritize non-generic author names from all available sources
  let authorName = "";
  if (provider === 'spotify') {
    authorName = oData?.author_name || "";
  } else {
    authorName = getCleanAuthor(twData?.author_name) ||
      getCleanAuthor(oData?.author_name) ||
      getCleanAuthor(ytSearchData?.author_name) ||
      getCleanAuthor(mlData?.author_name) ||
      "";
  }

  let description = twData?.description || oData?.description || ytSearchData?.description || mlData?.description || "";
  let title = twData?.title || oData?.title || mlData?.title || "";

  // Twitter/X Specific: If title is missing, try to construct from handle
  if (provider === 'twitter' && !title) {
    const handleMatch = url.match(/(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)/);
    if (handleMatch) title = `@${handleMatch[1]} on X`;
  }

  // Final fallback for title
  if (!title) title = url;

  // Deep merged result
  const finalData: EmbedMeta = {
    ...oData,
    title,
    author_name: authorName,
    thumbnail_url: twData?.thumbnail_url || oData?.thumbnail_url || mlData?.thumbnail_url || undefined,
    // Fix: Include 'twitter' in video-capable providers
    video_url: (oData?.video_url || (['youtube', 'tiktok', 'twitter'].includes(provider) ? mlData?.video_url : undefined)) || undefined,
    provider_name: oData?.provider_name || mlData?.provider_name || "",
    description: description,
    html: oData?.html || undefined
  };

  return finalData;
};
