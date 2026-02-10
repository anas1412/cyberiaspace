import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as cheerio from 'cheerio';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { url } = req.query;

    if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'Missing URL parameter' });
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=1800');

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Referer': 'https://www.google.com/',
            },
            signal: AbortSignal.timeout(6000),
        });

        if (!response.ok) {
            return res.status(200).json({ title: null, url });
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        const getMeta = (names: string[]) => {
            for (const name of names) {
                const content = $(`meta[property="${name}"], meta[name="${name}"]`).attr('content');
                if (content) return content;
            }
            return null;
        };

        const metadata = {
            title: getMeta(['og:title', 'twitter:title', 'title']) || $('title').text() || url,
            description: getMeta(['og:description', 'twitter:description', 'description']),
            image: getMeta(['og:image', 'twitter:image:src', 'twitter:image']),
            author: getMeta(['article:author', 'og:author', 'twitter:creator', 'author']),
            publisher: getMeta(['og:site_name', 'twitter:site']),
            url: getMeta(['og:url']) || url,
        };

        return res.status(200).json(metadata);
    } catch (error: any) {
        console.warn(`[Scraper Warning] Fetch failed for ${url}:`, error.message);
        return res.status(200).json({ title: null, url });
    }
}
