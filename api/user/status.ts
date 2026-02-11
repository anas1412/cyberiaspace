import { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';

export default async function handler(req: VercelRequest, res: VercelResponse) {
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

        const info = await tokenInfo.json();
        const userId = info.sub || info.user_id;

        if (!userId) {
            return res.status(401).json({ error: 'User ID not found' });
        }

        const metaKey = `cyberia_user_meta_${userId}`;
        const status = await kv.get<{ plan: string; expiryDate: string }>(metaKey);

        if (!status) {
            return res.status(200).json({ plan: 'free' });
        }

        // Check if subscription has expired
        const isExpired = new Date() > new Date(status.expiryDate);
        if (isExpired && status.plan !== 'free') {
            // Optional: Clean up KV? Or just return free
            return res.status(200).json({ plan: 'free', status: 'expired' });
        }

        return res.status(200).json(status);

    } catch (error) {
        console.error('User Status API Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
