import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';
import { OAuth2Client } from 'google-auth-library';
import { hydrateProfile } from '../profile-helper.js';

const CLIENT_ID = process.env.VITE_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { code, state, error } = req.query;

    // 1. Determine redirect URI based on host for consistency
    const host = req.headers.host || '';
    const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');
    const REDIRECT_URI = isLocalhost 
        ? `http://${host}/api/auth/callback` 
        : 'https://cyberia.tn/api/auth/callback'; // Always enforce production for non-localhost

    console.log(`[Auth Callback] Initializing callback. Host: ${host} | Expected Redirect: ${REDIRECT_URI}`);

    // Early exit for Google's errors or missing code
    if (error) {
        console.error('[Auth Callback] Google returned error:', error);
        return res.redirect('/login?error=' + encodeURIComponent(error as string));
    }
    if (!code) {
        console.warn('[Auth Callback] No code provided in request');
        return res.redirect('/login?error=no_code_provided');
    }

    // 2. Validate State (CSRF Protection)
    const storedState = req.cookies.auth_state;
    const storedNonce = req.cookies.auth_nonce;

    if (!storedState || state !== storedState) {
        console.error('[Auth Callback] Security mismatch. URL State:', state, 'Stored State:', storedState, 'Cookies:', req.headers.cookie);
        return res.redirect('/login?error=security_mismatch');
    }

    if (!CLIENT_ID || !CLIENT_SECRET) {
        console.error('[Auth Callback] Missing credentials in environment');
        return res.redirect('/login?error=server_config_error');
    }

    try {
        const client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

        // 3. Exchange code for tokens
        console.log('[Auth Callback] Exchanging code...');
        const { tokens } = await client.getToken(code as string);

        console.log('[Auth Callback] Tokens received. Access Token:', tokens.access_token ? 'OK' : 'MISSING', '| ID Token:', tokens.id_token ? 'OK' : 'MISSING');
        
        if (!tokens.access_token) {
            console.error('[Auth Callback] Failed to obtain access token (empty response).');
            return res.redirect('/login?error=token_exchange_failed');
        }
        if (!tokens.id_token) {
            console.error('[Auth Callback] Missing ID Token from Google.');
            return res.redirect('/login?error=missing_id_token');
        }

        // 4. Verify ID Token (Identity & Nonce Validation)
        const ticket = await client.verifyIdToken({
            idToken: tokens.id_token,
            audience: CLIENT_ID,
        });
        
        const payload = ticket.getPayload();
        if (!payload) {
            console.error('[Auth Callback] Invalid ID Token payload (empty).');
            return res.redirect('/login?error=invalid_id_token_payload');
        }

        // Nonce verification (Replay Protection)
        if (payload.nonce !== storedNonce) {
            console.error('[Auth Callback] Nonce mismatch. Replay attack potential. Payload Nonce:', payload.nonce, 'Stored Nonce:', storedNonce);
            return res.redirect('/login?error=nonce_mismatch');
        }

        const userId = payload.sub;
        console.log('[Auth Callback] User ID:', userId);

        // 5. Update/Create Profile in KV
        const profileKey = `user:profile:${userId}`;
        console.log('[Auth Callback] Fetching profile from KV:', profileKey);
        const existingProfile = await kv.get<any>(profileKey) || {};
        console.log('[Auth Callback] Profile fetched, hydrating...');
        
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
        console.log('[Auth Callback] Profile updated successfully in KV.');

        // 6. Clean up security cookies
        res.setHeader('Set-Cookie', [
            'auth_state=; Path=/; Max-Age=0; SameSite=Lax; Secure',
            'auth_nonce=; Path=/; Max-Age=0; SameSite=Lax; Secure'
        ]);
        console.log('[Auth Callback] Security cookies cleared.');

        // 7. Return HTML that sets localStorage and redirects
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
        console.log('[Auth Callback] Sending success HTML and redirecting to /');
        return res.status(200).send(html);

    } catch (e: any) {
        console.error('[Auth Callback] General error during authentication:', e.message || e, e.stack);
        return res.redirect('/login?error=auth_process_failed');
    }
}