import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { action } = req.query;

    if (action === 'status') {
        return handleStatus(req, res);
    } else if (action === 'sync') {
        return handleSync(req, res);
    }

    return res.status(400).json({ error: 'Invalid action' });
}

async function handleStatus(req: VercelRequest, res: VercelResponse) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing authorization' });
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
            return res.status(401).json({ error: 'User ID not found' });
        }

        const metaKey = `cyberia_user_meta_${userId}`;
        const status = await kv.get<{ plan: string; expiryDate: string }>(metaKey);

        if (!status) {
            return res.status(200).json({ plan: 'free' });
        }

        const isExpired = new Date() > new Date(status.expiryDate);
        if (isExpired && status.plan !== 'free') {
            return res.status(200).json({ plan: 'free', status: 'expired' });
        }

        return res.status(200).json(status);

    } catch (error) {
        console.error('User Status API Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

async function handleSync(req: VercelRequest, res: VercelResponse) {
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

        const storageKey = `cyberia_sync_${userId}`;

        if (req.method === 'POST') {
            const data = req.body;
            if (!data) return res.status(400).json({ error: 'No data provided' });

            const size = JSON.stringify(data).length;
            if (size > 10 * 1024 * 1024) {
                return res.status(413).json({ error: 'Payload too large' });
            }

            await kv.set(storageKey, data);
            return res.status(200).json({ success: true });
        }

        if (req.method === 'GET') {
            const data = await kv.get(storageKey);
            return res.status(200).json({ data });
        }

        if (req.method === 'DELETE') {
            await kv.del(storageKey);
            return res.status(200).json({ success: true });
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (error) {
        console.error('Sync API Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
