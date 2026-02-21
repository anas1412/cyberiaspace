import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';

import { hydrateProfile } from '../profile-helper';

const CLIENT_ID = process.env.VITE_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

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
    const { code, error } = req.query;

    // Dynamically determine redirect URI based on host to support localhost:3000, 5173, and production
    const host = req.headers.host;
    const protocol = host?.includes('localhost') ? 'http' : 'https';
    const REDIRECT_URI = `${protocol}://${host}/api/auth/callback`;

    if (error) {
        return res.redirect('/login?error=' + encodeURIComponent(error as string));
    }

    if (!code) {
        return res.redirect('/login');
    }

    if (!CLIENT_ID || !CLIENT_SECRET) {
        return res.status(500).send('Server configuration error: Missing Google Credentials');
    }

    try {
        // 1. Exchange code for tokens
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code: code as string,
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                redirect_uri: REDIRECT_URI,
                grant_type: 'authorization_code',
            }),
        });

        const tokens = await tokenRes.json() as GoogleTokens;
        if (!tokenRes.ok) {
            console.error('[Auth Callback] Token exchange failed:', tokens);
            console.error('[Auth Callback] Used Redirect URI:', REDIRECT_URI);
            return res.status(500).json({ error: 'Token exchange failed', details: tokens, usedRedirectUri: REDIRECT_URI });
        }

        // 2. Fetch user info
        const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        const userData = await userRes.json() as GoogleUser;
        const userId = userData.sub;

        // 3. Update/Create Profile in KV
        const profileKey = `user:profile:${userId}`;
        const existingProfile = await kv.get<any>(profileKey) || {};
        
        const grantedScopes = tokens.scope || '';
        const hasDriveScope = grantedScopes.includes('drive.file') || grantedScopes.includes('https://www.googleapis.com/auth/drive.file');

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

        // 4. Return HTML that sets localStorage and redirects
        // We pass the data to the frontend so it can initialize the session
        const responseData = {
            token: tokens.access_token,
            user: updatedProfile,
            scopes: ['openid', 'email', 'profile']
        };

        if (hasDriveScope) {
            responseData.scopes.push('https://www.googleapis.com/auth/drive.file');
        }

        const html = `
            <!DOCTYPE html>
            <html>
            <head><title>Authenticating...</title></head>
            <body>
                <script>
                    localStorage.setItem('cyberia-token', ${JSON.stringify(responseData.token)});
                    localStorage.setItem('cyberia-user', ${JSON.stringify(JSON.stringify(responseData.user))});
                    localStorage.setItem('cyberia-scopes', ${JSON.stringify(JSON.stringify(responseData.scopes))});
                    window.location.href = '/';
                </script>
                <div style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #000; color: #fff;">
                    <p>Redirecting to Cyberia...</p>
                </div>
            </body>
            </html>
        `;

        res.setHeader('Content-Type', 'text/html');
        return res.status(200).send(html);

    } catch (e: any) {
        console.error('[Auth Callback] Error:', e);
        return res.status(500).send('Internal Server Error');
    }
}
