import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as cheerio from 'cheerio';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { action } = req.query;

    switch (action) {
        case 'metadata':
            return handleMetadata(req, res);
        case 'oembed':
            return handleOembed(req, res);
        case 'proxy-video':
            return handleProxyVideo(req, res);
        case 'youtube-search':
            return handleYoutubeSearch(req, res);
        default:
            return res.status(400).json({ error: 'Invalid action' });
    }
}

async function handleMetadata(req: VercelRequest, res: VercelResponse) {
    let { url } = req.query;
    if (!url || typeof url !== 'string') return res.status(400).json({ error: 'Missing URL parameter' });

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=1800');

    // Special Case: Pinterest oEmbed (much more reliable than scraping)
    if (url.includes('pinterest.com/pin/')) {
        try {
            const pinId = url.split('/pin/')[1]?.split('/')[0];
            if (pinId) {
                const oembedRes = await fetch(`https://www.pinterest.com/oembed.json?url=${encodeURIComponent(url)}`);
                if (oembedRes.ok) {
                    const oData = await oembedRes.json() as any;
                    return res.status(200).json({
                        title: oData.author_name ? `Pinned by ${oData.author_name}` : (oData.title || "Pinterest Pin"),
                        description: oData.title || "",
                        image: oData.thumbnail_url,
                        author: oData.author_name || "Pinterest",
                        publisher: "Pinterest",
                        url: url
                    });
                }
            }
        } catch (e) {
            console.warn('[Pinterest oEmbed Fallback] Failed:', e);
        }
    }

    // Special Case: Reddit oEmbed (works without tokens)
    if (url.includes('reddit.com')) {
        try {
            const redditOembed = `https://www.reddit.com/oembed?url=${encodeURIComponent(url)}`;
            const redditRes = await fetch(redditOembed);
            if (redditRes.ok) {
                const rData = await redditRes.json() as any;
                const author = rData.author_name || "Reddit User";
                return res.status(200).json({
                    title: `Posted by ${author}`,
                    description: rData.title || "",
                    image: rData.thumbnail_url,
                    author: author,
                    publisher: rData.provider_name || "Reddit",
                    url: url
                });
            }
        } catch (e) {}
    }

    // Special Case: Facebook Public Plugin oEmbed (Bypasses token for public content)
    if (url.includes('facebook.com') || url.includes('fb.watch')) {
        try {
            const fbOembed = `https://www.facebook.com/plugins/post/oembed.json/?url=${encodeURIComponent(url)}`;
            const fbRes = await fetch(fbOembed, { headers: { 'User-Agent': 'facebookexternalhit/1.1' } });
            if (fbRes.ok) {
                const fData = await fbRes.json() as any;
                let author = fData.author_name;
                // Fix: Filter out generic @facebookapp or "Facebook" names
                if (!author || author.toLowerCase().includes('facebook')) {
                    // Try to extract from author_url if available
                    if (fData.author_url) {
                        const parts = new URL(fData.author_url).pathname.split('/').filter(Boolean);
                        if (parts[0]) author = parts[0];
                    }
                }
                author = author || "Facebook User";

                return res.status(200).json({
                    title: `Post by ${author}`,
                    description: fData.title || "",
                    image: fData.thumbnail_url,
                    author: author,
                    publisher: "Facebook",
                    url: url
                });
            }
        } catch (e) {}
    }

    // Special Case: TikTok oEmbed
    if (url.includes('tiktok.com')) {
        try {
            const ttRes = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`);
            if (ttRes.ok) {
                const data = await ttRes.json() as any;
                const author = data.author_name || "TikTok Creator";
                return res.status(200).json({
                    title: `Video by ${author}`,
                    description: data.title || "",
                    image: data.thumbnail_url,
                    author: author,
                    publisher: "TikTok",
                    url: url
                });
            }
        } catch (e) {}
    }

    // Special Case: Vimeo oEmbed
    if (url.includes('vimeo.com')) {
        try {
            const viRes = await fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`);
            if (viRes.ok) {
                const data = await viRes.json() as any;
                const author = data.author_name || "Vimeo Creator";
                return res.status(200).json({
                    title: `Video by ${author}`,
                    description: data.title || data.description || "",
                    image: data.thumbnail_url,
                    author: author,
                    publisher: "Vimeo",
                    url: url
                });
            }
        } catch (e) {}
    }

    // Special Case: SoundCloud oEmbed
    if (url.includes('soundcloud.com')) {
        try {
            const scRes = await fetch(`https://soundcloud.com/oembed?url=${encodeURIComponent(url)}&format=json`);
            if (scRes.ok) {
                const data = await scRes.json() as any;
                const author = data.author_name || "SoundCloud Artist";
                return res.status(200).json({
                    title: `Track by ${author}`,
                    description: data.title || data.description || "",
                    image: data.thumbnail_url,
                    author: author,
                    publisher: "SoundCloud",
                    url: url
                });
            }
        } catch (e) {}
    }

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Referer': 'https://www.google.com/',
            },
        });

        if (!response.ok) return res.status(200).json({ title: null, url });

        const html = await response.text();
        const $ = cheerio.load(html);

        const prettifyUrl = (u: string) => {
            try {
                const parsed = new URL(u);
                let host = parsed.hostname.replace('www.', '');
                return host.charAt(0).toUpperCase() + host.slice(1);
            } catch (e) {
                return u;
            }
        };

        const getMeta = (names: string[]) => {
            for (const name of names) {
                const content = $(`meta[property="${name}"], meta[name="${name}"], meta[itemprop="${name}"]`).attr('content');
                if (content) return content;
            }
            return null;
        };

        const author = getMeta(['article:author', 'og:author', 'twitter:creator', 'author', 'book:author']);
        const publisher = getMeta(['og:site_name', 'twitter:site', 'publisher', 'p:domain_verify']);

        // Clean up author if it's just the site name
        const cleanAuthor = (a: string | null, p: string | null) => {
            if (!a) return null;
            if (p && a.toLowerCase() === p.toLowerCase()) return null;
            const generic = ['facebook', 'twitter', 'x', 'instagram', 'pinterest', 'reddit', 'youtube', 'google', 'vimeo', 'soundcloud'];
            if (generic.includes(a.toLowerCase())) return null;
            return a;
        };

        const finalAuthor = cleanAuthor(author, publisher);
        const rawTitle = getMeta(['og:title', 'twitter:title', 'title', 'h1']) || $('title').text() || $('h1').first().text() || prettifyUrl(url);
        const rawDescription = getMeta(['og:description', 'twitter:description', 'description', 'abstract']) || $('meta[name="description"]').attr('content');

        // Swap for Social Media sites (Facebook, Twitter, etc. that fall through to scraper)
        const socialPublishers = ['facebook', 'twitter', 'x', 'instagram', 'pinterest', 'reddit', 'youtube', 'vimeo', 'soundcloud'];
        const isSocial = publisher && socialPublishers.some(s => publisher.toLowerCase().includes(s));
        
        const displayTitle = (isSocial && finalAuthor) ? `${prettifyUrl(url)} by ${finalAuthor}` : rawTitle;
        const displayDescription = (isSocial && finalAuthor) ? rawTitle : rawDescription;

        const metadata = {
            title: displayTitle,
            description: displayDescription,
            image: getMeta(['og:image', 'twitter:image:src', 'twitter:image', 'image', 'thumbnailUrl']),
            author: finalAuthor || publisher || prettifyUrl(url),
            publisher: publisher,
            url: getMeta(['og:url', 'canonical']) || url,
        };

        return res.status(200).json(metadata);
    } catch (error: any) {
        console.warn(`[Scraper Warning] Fetch failed for ${url}:`, error.message);
        return res.status(200).json({ title: null, url });
    }
}

async function handleOembed(req: VercelRequest, res: VercelResponse) {
    let { url } = req.query;
    if (!url || typeof url !== 'string') return res.status(400).json({ error: 'Missing URL parameter' });

    const appId = process.env.FB_APP_ID;
    const clientToken = process.env.FB_CLIENT_TOKEN;
    const accessToken = (appId && clientToken) ? `${appId}|${clientToken}` : null;

    let targetUrl = url;

    if (accessToken && (url.includes('instagram.com') || url.includes('facebook.com') || url.includes('fb.watch'))) {
        let postUrl = url;
        try {
            const parsed = new URL(url);
            if (parsed.searchParams.has('url')) {
                postUrl = parsed.searchParams.get('url')!;
            }
        } catch (e) { }

        if (url.includes('instagram.com')) {
            targetUrl = `https://graph.facebook.com/v19.0/instagram_oembed?url=${encodeURIComponent(postUrl)}&access_token=${accessToken}&theme=dark`;
        } else {
            targetUrl = `https://graph.facebook.com/v19.0/oembed_post?url=${encodeURIComponent(postUrl)}&access_token=${accessToken}`;
        }
    }

    try {
        const response = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9',
            }
        });

        const data = await response.json();

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=1800');

        return res.status(response.status).json(data);
    } catch (error: any) {
        console.error('[oEmbed Proxy Exception]:', error);
        return res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
}

async function handleProxyVideo(req: VercelRequest, res: VercelResponse) {
    const { url } = req.query;
    if (!url || typeof url !== 'string') return res.status(400).json({ error: 'Missing URL parameter' });

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': new URL(url).origin
            }
        });

        if (!response.ok) throw new Error(`Failed to fetch video: ${response.statusText}`);

        const contentType = response.headers.get('content-type');
        const contentLength = response.headers.get('content-length');

        if (contentType) res.setHeader('Content-Type', contentType);
        if (contentLength) res.setHeader('Content-Length', contentLength);

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Cache-Control', 'public, max-age=86400');

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
        }

        res.end();
    } catch (error: any) {
        console.error('[Video Proxy Error]:', error);
        return res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
}

async function handleYoutubeSearch(req: VercelRequest, res: VercelResponse) {
    const query = req.query.q as string;
    const maxResults = parseInt(req.query.maxResults as string) || 5;

    if (!query) return res.status(400).json({ error: "Missing query parameter 'q'" });

    try {
        const apiKey = process.env.YOUTUBE_API_KEY;
        if (!apiKey) {
            console.error("YOUTUBE_API_KEY is not defined");
            return res.status(500).json({ error: "Server configuration error", message: "Missing YouTube API Key on server." });
        }

        const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=${maxResults}&q=${encodeURIComponent(query)}&key=${apiKey}`;
        const response = await fetch(url);
        const data = await response.json() as any;

        if (!response.ok) {
            console.error("YouTube API returned an error:", data);
            return res.status(response.status).json({
                error: "YouTube API Error",
                message: data.error?.message || "Forbidden",
                reason: data.error?.errors?.[0]?.reason || "unknown"
            });
        }

        const items = data.items || [];
        const cleanedResults = items
            .filter((item: any) => item.id && item.id.videoId)
            .map((item: any) => ({
                title: item.snippet.title,
                url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
                author: item.snippet.channelTitle,
                description: item.snippet.description
                    ? item.snippet.description.substring(0, 160) + "..."
                    : "No description available."
            }));

        return res.status(200).json({ results: cleanedResults, count: cleanedResults.length });

    } catch (err: any) {
        console.error("Internal Script Error in youtube-search.ts:", err);
        return res.status(500).json({ error: "Internal Server Error", message: err.message || "An unexpected error occurred." });
    }
}
