import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { action } = req.query;

    if (action === 'profile') {
        return handleProfile(req, res);
    } else if (action === 'sync') {
        return handleSync(req, res);
    } else if (action === 'settings') {
        return handleUpdateSettings(req, res);
    }

    return res.status(400).json({ error: 'Invalid action' });
}

async function getUserIdFromToken(authHeader: string | undefined) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.split(' ')[1];
    try {
        const tokenInfo = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${token}`);
        if (!tokenInfo.ok) return null;
        const info = await tokenInfo.json() as any;
        return info.sub || info.user_id;
    } catch (e) {
        return null;
    }
}

async function getUnifiedProfile(userId: string, email?: string, name?: string, avatar?: string) {
    const profileKey = `user:profile:${userId}`;
    let profile = await kv.get<any>(profileKey);

    const today = new Date().toISOString().split('T')[0];

    if (!profile) {
        // Initialize new profile
        profile = {
            id: userId,
            email: email || '',
            name: name || '',
            avatar: avatar || '',
            plan: 'free',
            subscriptionStatus: 'none',
            expiryDate: null,
            usage: {
                ai_daily_count: 0,
                sync_thoughts: 0,
                last_ai_reset: today
            },
            settings: {
                theme: 'cyberia',
                autoSync: true,
                driveEnabled: false
            },
            lastSeen: new Date().toISOString()
        };
        await kv.set(profileKey, profile);
    } else {
        // Reset AI usage if it's a new day
        if (profile.usage.last_ai_reset !== today) {
            profile.usage.ai_daily_count = 0;
            profile.usage.last_ai_reset = today;
            await kv.set(profileKey, profile);
        }
    }

    return profile;
}

async function handleProfile(req: VercelRequest, res: VercelResponse) {
    const userId = await getUserIdFromToken(req.headers.authorization);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    // Client can pass identity info on first load to ensure profile is initialized correctly
    const { email, name, avatar } = req.query as any;
    const profile = await getUnifiedProfile(userId, email, name, avatar);

    return res.status(200).json({ user: profile });
}

async function handleSync(req: VercelRequest, res: VercelResponse) {
    const userId = await getUserIdFromToken(req.headers.authorization);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const storageKey = `cyberia_sync_${userId}`;
    const profileKey = `user:profile:${userId}`;

    if (req.method === 'POST') {
        const data = req.body;
        if (!data) return res.status(400).json({ error: 'No data provided' });

        const size = JSON.stringify(data).length;
        if (size > 10 * 1024 * 1024) {
            return res.status(413).json({ error: 'Payload too large' });
        }

        // Save sync data
        await kv.set(storageKey, data);

        // Update thought count in profile
        const thoughtCount = data.thoughts?.length || 0;
        const profile = await getUnifiedProfile(userId);
        profile.usage.sync_thoughts = thoughtCount;
        profile.lastSeen = new Date().toISOString();
        await kv.set(profileKey, profile);

        return res.status(200).json({ success: true, usage: profile.usage });
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
}

async function handleUpdateSettings(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const userId = await getUserIdFromToken(req.headers.authorization);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { settings } = req.body;
    if (!settings) return res.status(400).json({ error: 'No settings provided' });

    const profileKey = `user:profile:${userId}`;
    const profile = await getUnifiedProfile(userId);

    profile.settings = { ...profile.settings, ...settings };
    profile.lastSeen = new Date().toISOString();
    await kv.set(profileKey, profile);

    return res.status(200).json({ success: true, settings: profile.settings });
}
