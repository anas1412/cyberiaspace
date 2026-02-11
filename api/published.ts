import { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { id } = req.query;

    if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Missing ID parameter' });
    }

    try {
        const data = await kv.get(`published_space_${id}`);

        if (!data) {
            return res.status(404).json({ error: 'Space not found' });
        }

        // Standard CORS and Cache headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=1800');

        return res.status(200).json(data);
    } catch (error) {
        console.error('Published API Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
