import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';
import { randomUUID } from 'crypto';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method === 'POST') {
        return handlePublish(req, res);
    } else if (req.method === 'GET') {
        return handleFetchPublished(req, res);
    } else if (req.method === 'DELETE') {
        return handleUnpublish(req, res);
    } else if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        return res.status(200).end();
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

async function handlePublish(req: VercelRequest, res: VercelResponse) {
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
        const info = await tokenInfo.json() as any;
        const userId = info.sub || info.user_id;

        if (!userId) {
            return res.status(401).json({ error: 'User ID not found in token' });
        }

        const { space, thoughts, stacks, publishedId, creatorName } = req.body;
        if (!space || !thoughts) {
            return res.status(400).json({ error: 'Invalid data provided' });
        }

        let finalPublishedId = publishedId;

        if (finalPublishedId) {
            const existing = await kv.get(`published_space_${finalPublishedId}`) as any;
            if (existing && existing.creatorId !== userId) {
                return res.status(403).json({ error: 'Ownership mismatch' });
            }
        } else {
            finalPublishedId = randomUUID();
        }

        const snapshot = {
            id: finalPublishedId,
            creatorId: userId,
            creatorName: creatorName || 'Anonymous',
            lastUpdated: new Date().toISOString(),
            space,
            thoughts,
            stacks: stacks || []
        };

        const storageKey = `published_space_${finalPublishedId}`;

        if (JSON.stringify(snapshot).length > 15 * 1024 * 1024) {
            return res.status(413).json({ error: 'Snapshot too large' });
        }

        await kv.set(storageKey, snapshot, { ex: 2592000 }); // Expires in 30 days

        return res.status(200).json({
            success: true,
            publishedId: finalPublishedId,
            lastPublished: snapshot.lastUpdated
        });

    } catch (error) {
        console.error('Publish API Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

async function handleFetchPublished(req: VercelRequest, res: VercelResponse) {
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Missing ID parameter' });
    }

    try {
        const data = await kv.get(`published_space_${id}`);

        if (!data) {
            return res.status(404).json({ error: 'Space not found' });
        }

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=1800');

        return res.status(200).json(data);
    } catch (error) {
        console.error('Published API Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

async function handleUnpublish(req: VercelRequest, res: VercelResponse) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing authorization header' });
    }

    const token = authHeader.split(' ')[1];
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Missing ID parameter' });
    }

    try {
        const tokenInfo = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${token}`);
        if (!tokenInfo.ok) {
            return res.status(401).json({ error: 'Invalid token' });
        }
        const info = await tokenInfo.json() as any;
        const userId = info.sub || info.user_id;

        const storageKey = `published_space_${id}`;
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
