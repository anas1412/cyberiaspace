import { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';
import { randomUUID } from 'crypto';

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
        // 1. Verify User (Optional but safer)
        const tokenInfo = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${token}`);
        if (!tokenInfo.ok) {
            return res.status(401).json({ error: 'Invalid token' });
        }
        const info = await tokenInfo.json();
        const userId = info.sub || info.user_id;

        if (!userId) {
            return res.status(401).json({ error: 'User ID not found in token' });
        }

        const { space, thoughts, stacks, publishedId, creatorName } = req.body;
        if (!space || !thoughts) {
            return res.status(400).json({ error: 'Invalid data provided' });
        }

        // 2. Determine Publication ID
        let finalPublishedId = publishedId;

        if (finalPublishedId) {
            // Logic for updating: Check ownership first
            const existing = await kv.get(`published_space_${finalPublishedId}`) as any;
            if (existing && existing.creatorId !== userId) {
                return res.status(403).json({ error: 'Ownership mismatch' });
            }
        } else {
            finalPublishedId = randomUUID();
        }

        // 3. Store Snapshot
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

        // Limit size check (snapshot can be slightly larger than working sync)
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
