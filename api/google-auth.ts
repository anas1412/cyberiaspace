import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';
import { OAuth2Client } from 'google-auth-library';
import { hydrateProfile } from './profile-helper';

const CLIENT_ID = process.env.VITE_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = 'postmessage';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { action } = req.query;

    if (action === 'exchange') {
        return handleExchange(req, res);
    } else if (action === 'refresh') {
        return handleRefresh(req, res);
    } else if (action === 'revoke') {
        return handleRevoke(req, res);
    } else if (action === 'disable-drive') {
        return handleDisableDrive(req, res);
    }

    return res.status(400).json({ error: 'Invalid action' });
}

async function handleDisableDrive(req: VercelRequest, res: VercelResponse) {
    const userId = await getUserIdFromAuthHeader(req.headers.authorization);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const profileKey = `user:profile:${userId}`;
    const profile = await kv.get<any>(profileKey);

    if (profile) {
        if (profile.settings) {
            profile.settings.driveEnabled = false;
            await kv.set(profileKey, profile);
        }
    }

    return res.status(200).json({ success: true });
}

async function handleExchange(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'No code provided' });

    if (!CLIENT_ID || !CLIENT_SECRET) {
        return res.status(500).json({ error: 'Server configuration error' });
    }

    try {
        const client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
        const { tokens } = await client.getToken(code);

        if (!tokens.access_token || !tokens.id_token) {
            throw new Error('Failed to obtain tokens from Google');
        }

        // Verify ID Token
        const ticket = await client.verifyIdToken({
            idToken: tokens.id_token,
            audience: CLIENT_ID,
        });
        const payload = ticket.getPayload();
        if (!payload) throw new Error('Invalid ID Token payload');

        const userId = payload.sub;
        const grantedScopes = tokens.scope || '';
        const hasDriveScope = grantedScopes.includes('drive.file') || grantedScopes.includes('https://www.googleapis.com/auth/drive.file');

        // Update/Create Profile in KV
        const profileKey = `user:profile:${userId}`;
        const existingProfile = await kv.get<any>(profileKey) || {};
        
        const profileToHydrate = {
            ...existingProfile,
            id: userId,
            email: payload.email || existingProfile.email,
            name: payload.name || existingProfile.name,
            avatar: payload.picture || existingProfile.avatar,
            refreshToken: tokens.refresh_token || existingProfile.refreshToken
        };

        const updatedProfile = hydrateProfile(profileToHydrate);

        if (hasDriveScope) {
            updatedProfile.settings.driveEnabled = true;
        } else if (updatedProfile.settings.driveEnabled && !updatedProfile.refreshToken) {
            updatedProfile.settings.driveEnabled = false;
        }
        
        await kv.set(profileKey, updatedProfile);

        return res.status(200).json({
            access_token: tokens.access_token,
            expires_in: tokens.expiry_date ? Math.floor((tokens.expiry_date - Date.now()) / 1000) : 3600,
            user: updatedProfile
        });
    } catch (e: any) {
        console.error('[Google Auth] Exchange error:', e);
        return res.status(500).json({ error: e.message });
    }
}

async function handleRefresh(req: VercelRequest, res: VercelResponse) {
    const userId = await getUserIdFromAuthHeader(req.headers.authorization);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const profileKey = `user:profile:${userId}`;
    const profile = await kv.get<any>(profileKey);
    
    if (!profile?.refreshToken) {
        return res.status(400).json({ error: 'No refresh token available' });
    }

    try {
        const client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
        client.setCredentials({ refresh_token: profile.refreshToken });
        
        const { credentials } = await client.refreshAccessToken();

        return res.status(200).json({
            access_token: credentials.access_token,
            expires_in: credentials.expiry_date ? Math.floor((credentials.expiry_date - Date.now()) / 1000) : 3600
        });
    } catch (e: any) {
        console.error('[Google Auth] Refresh error:', e);
        return res.status(500).json({ error: e.message });
    }
}

async function handleRevoke(req: VercelRequest, res: VercelResponse) {
    const userId = await getUserIdFromAuthHeader(req.headers.authorization);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const profileKey = `user:profile:${userId}`;
    const profile = await kv.get<any>(profileKey);

    if (profile) {
        try {
            if (profile.refreshToken) {
                const client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
                await client.revokeToken(profile.refreshToken);
            }
        } catch (e) {
            console.warn('[Google Auth] Token revocation failed (might be already expired)', e);
        }
        
        profile.refreshToken = null;
        if (profile.settings) profile.settings.driveEnabled = false;
        await kv.set(profileKey, profile);
    }

    return res.status(200).json({ success: true });
}

async function getUserIdFromAuthHeader(authHeader: string | undefined) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.split(' ')[1];
    
    try {
        const client = new OAuth2Client(CLIENT_ID);
        const ticket = await client.verifyIdToken({
            idToken: token, 
            audience: CLIENT_ID,
        }).catch(async () => {
            const res = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${token}`);
            if (!res.ok) return null;
            const data = await res.json();
            return { getPayload: () => data };
        });

        const payload = (ticket as any)?.getPayload();
        return payload?.sub || payload?.user_id;
    } catch (e) {
        return null;
    }
}
