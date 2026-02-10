import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    let { url } = req.query;

    if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'Missing URL parameter' });
    }

    // Workaround for Meta (Instagram/Facebook) oEmbed
    // Requires App ID and Client Token
    const appId = process.env.FB_APP_ID;
    const clientToken = process.env.FB_CLIENT_TOKEN;
    const accessToken = (appId && clientToken) ? `${appId}|${clientToken}` : null;

    let targetUrl = url;

    if (accessToken && (url.includes('instagram.com') || url.includes('facebook.com') || url.includes('fb.watch'))) {
        // Extract original post URL if we were passed an oEmbed endpoint URL
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

        // Standard CORS and Cache headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=1800');

        return res.status(response.status).json(data);
    } catch (error: any) {
        console.error('[oEmbed Proxy Exception]:', error);
        return res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
}
