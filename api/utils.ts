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
    const { url } = req.query;
    if (!url || typeof url !== 'string') return res.status(400).json({ error: 'Missing URL parameter' });

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=1800');

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Referer': 'https://www.google.com/',
            },
            signal: AbortSignal.timeout(6000),
        });

        if (!response.ok) return res.status(200).json({ title: null, url });

        const html = await response.text();
        const $ = cheerio.load(html);

        const getMeta = (names: string[]) => {
            for (const name of names) {
                const content = $(`meta[property="${name}"], meta[name="${name}"], meta[itemprop="${name}"]`).attr('content');
                if (content) return content;
            }
            return null;
        };

        const metadata = {
            title: getMeta(['og:title', 'twitter:title', 'title', 'h1']) || $('title').text() || $('h1').first().text() || url,
            description: getMeta(['og:description', 'twitter:description', 'description', 'abstract']),
            image: getMeta(['og:image', 'twitter:image:src', 'twitter:image', 'image', 'thumbnailUrl']),
            author: getMeta(['article:author', 'og:author', 'twitter:creator', 'author', 'book:author']),
            publisher: getMeta(['og:site_name', 'twitter:site', 'publisher', 'p:domain_verify']),
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
        const data = await response.json();

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
