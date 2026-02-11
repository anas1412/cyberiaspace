import { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing authorization header' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const tokenInfo = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${token}`);
        if (!tokenInfo.ok) {
            return res.status(401).json({ error: 'Invalid token' });
        }
        const info = await tokenInfo.json();
        const userId = info.sub || info.user_id;

        const { publishedId } = req.body;
        if (!publishedId) {
            return res.status(400).json({ error: 'Missing publishedId' });
        }

        const storageKey = `published_space_${publishedId}`;
        const existing = await kv.get(storageKey) as any;

        if (!existing) {
            return res.status(404).json({ error: 'Space not found' });
        }

        if (existing.creatorId !== userId) {
            return res.status(403).json({ error: 'Ownership mismatch' });
        }

        await kv.del(storageKey);

        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('Unpublish API Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
