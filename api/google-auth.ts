import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';
import { hydrateProfile } from './profile-helper';

const CLIENT_ID = process.env.VITE_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = 'postmessage'; // standard for react-oauth/google code flow

interface GoogleTokens {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
}

interface GoogleUser {
    sub: string;
    email: string;
    name: string;
    picture: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { action } = req.query;

    if (action === 'exchange') {
        return handleExchange(req, res);
    } else if (action === 'refresh') {
        return handleRefresh(req, res);
    } else if (action === 'revoke') {
        return handleRevoke(req, res);
    }

    return res.status(400).json({ error: 'Invalid action' });
}

async function handleExchange(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'No code provided' });

    if (!CLIENT_ID || !CLIENT_SECRET) {
        console.error('[Google Auth] Missing Environment Variables');
        return res.status(500).json({ 
            error: 'Server configuration error', 
            details: 'GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is not defined in environment variables.' 
        });
    }

    try {
        console.log('[Google Auth] Exchanging code for tokens...');
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                redirect_uri: REDIRECT_URI,
                grant_type: 'authorization_code',
            }),
        });

        const tokens = await tokenRes.json() as GoogleTokens;
        if (!tokenRes.ok) {
            console.error('[Google Auth] Google API Error:', tokens);
            return res.status(tokenRes.status).json({ 
                error: 'Token exchange failed', 
                details: tokens 
            });
        }

        const grantedScopes = tokens.scope || '';
        // Be flexible with scope detection
        const hasDriveScope = grantedScopes.includes('drive.file') || grantedScopes.includes('https://www.googleapis.com/auth/drive.file');

        console.log(`[Google Auth] Tokens received. hasDriveScope: ${hasDriveScope}`);

        // Fetch user info to identify the profile
        const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        const userData = await userRes.json() as GoogleUser;
        const userId = userData.sub;

        // Save refresh token in KV profile
        const profileKey = `user:profile:${userId}`;
        const existingProfile = await kv.get<any>(profileKey) || {};
        
        // Merging logic
        const profileToHydrate = {
            ...existingProfile,
            id: userId,
            email: userData.email || existingProfile.email,
            name: userData.name || existingProfile.name,
            avatar: userData.picture || existingProfile.avatar,
            refreshToken: tokens.refresh_token || existingProfile.refreshToken
        };

        const updatedProfile = hydrateProfile(profileToHydrate);

        // Specialized incremental scope check
        if (hasDriveScope) {
            updatedProfile.settings.driveEnabled = true;
        } else if (updatedProfile.settings.driveEnabled && !updatedProfile.refreshToken) {
            // Safety: if drive is enabled but we lost the refresh token, disable it
            updatedProfile.settings.driveEnabled = false;
        }
        
        await kv.set(profileKey, updatedProfile);

        return res.status(200).json({
            access_token: tokens.access_token,
            expires_in: tokens.expires_in,
            user: updatedProfile
        });
    } catch (e: any) {
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
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: CLIENT_ID!,
                client_secret: CLIENT_SECRET!,
                refresh_token: profile.refreshToken,
                grant_type: 'refresh_token',
            }),
        });

        const tokens = await tokenRes.json() as GoogleTokens;
        if (!tokenRes.ok) return res.status(tokenRes.status).json(tokens);

        return res.status(200).json({
            access_token: tokens.access_token,
            expires_in: tokens.expires_in
        });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}

async function handleRevoke(req: VercelRequest, res: VercelResponse) {
    const userId = await getUserIdFromAuthHeader(req.headers.authorization);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const profileKey = `user:profile:${userId}`;
    const profile = await kv.get<any>(profileKey);

    if (profile) {
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
        const tokenInfo = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${token}`);
        if (!tokenInfo.ok) return null;
        const info = await tokenInfo.json() as any;
        return info.sub || info.user_id;
    } catch (e) {
        return null;
    }
}
