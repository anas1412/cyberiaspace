import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';
import { OAuth2Client } from 'google-auth-library';
import { hydrateProfile } from '../profile-helper';

const CLIENT_ID = process.env.VITE_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { code, state, error } = req.query;

    // 1. Validate State (CSRF Protection)
    const storedState = req.cookies.auth_state;
    const storedNonce = req.cookies.auth_nonce;

    if (error) {
        return res.redirect('/login?error=' + encodeURIComponent(error as string));
    }

    if (!code) {
        return res.redirect('/login');
    }

    if (!storedState || state !== storedState) {
        console.error('[Auth Callback] State mismatch or missing. CSRF potential.');
        return res.status(403).send('Security Error: Invalid state. Please try logging in again.');
    }

    if (!CLIENT_ID || !CLIENT_SECRET) {
        return res.status(500).send('Server configuration error: Missing Google Credentials');
    }

    // Dynamically determine redirect URI
    const host = req.headers.host;
    const protocol = host?.includes('localhost') ? 'http' : 'https';
    const REDIRECT_URI = `${protocol}://${host}/api/auth/callback`;

    try {
        const client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

        // 2. Exchange code for tokens
        const { tokens } = await client.getToken(code as string);
        
        if (!tokens.access_token) {
            throw new Error('Failed to obtain access token');
        }

        // 3. Verify ID Token (Identity & Nonce Validation)
        if (!tokens.id_token) {
            throw new Error('Missing ID Token from Google');
        }

        const ticket = await client.verifyIdToken({
            idToken: tokens.id_token,
            audience: CLIENT_ID,
        });
        
        const payload = ticket.getPayload();
        if (!payload) throw new Error('Invalid ID Token payload');

        // Nonce verification (Replay Protection)
        if (payload.nonce !== storedNonce) {
            console.error('[Auth Callback] Nonce mismatch. Replay attack potential.');
            return res.status(403).send('Security Error: Invalid nonce. Please try logging in again.');
        }

        const userId = payload.sub;

        // 4. Update/Create Profile in KV
        const profileKey = `user:profile:${userId}`;
        const existingProfile = await kv.get<any>(profileKey) || {};
        
        const grantedScopes = tokens.scope || '';
        const hasDriveScope = grantedScopes.includes('drive.file') || grantedScopes.includes('https://www.googleapis.com/auth/drive.file');

        // Merging logic
        const profileToHydrate = {
            ...existingProfile,
            id: userId,
            email: payload.email || existingProfile.email,
            name: payload.name || existingProfile.name,
            avatar: payload.picture || existingProfile.avatar,
            refreshToken: tokens.refresh_token || existingProfile.refreshToken
        };

        const updatedProfile = hydrateProfile(profileToHydrate);

        // Specialized incremental scope check
        if (hasDriveScope) {
            updatedProfile.settings.driveEnabled = true;
        } else if (updatedProfile.settings.driveEnabled && !updatedProfile.refreshToken) {
            updatedProfile.settings.driveEnabled = false;
        }
        
        await kv.set(profileKey, updatedProfile);

        // 5. Clean up security cookies
        res.setHeader('Set-Cookie', [
            'auth_state=; Path=/; Max-Age=0; SameSite=Lax; Secure',
            'auth_nonce=; Path=/; Max-Age=0; SameSite=Lax; Secure'
        ]);

        // 6. Return HTML that sets localStorage and redirects
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
        return res.status(500).send('Authentication failed: ' + (e.message || 'Unknown error'));
    }
}

