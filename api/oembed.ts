import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { url } = req.query;

    if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'Missing URL parameter' });
    }

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': 'https://www.google.com/'
            }
        });

        if (!response.ok) {
            const text = await response.text();
            console.error(`[oEmbed Error] Status: ${response.status}, Body: ${text.substring(0, 100)}`);
            throw new Error(`Failed to fetch from provider: ${response.statusText}`);
        }

        const data = await response.json();

        // Standard CORS and Cache headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=1800');

        return res.status(200).json(data);
    } catch (error: any) {
        console.error('[oEmbed Proxy Exception]:', error);
        return res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
}
