import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';
import { OAuth2Client } from 'google-auth-library';

function hydrateProfile(profile: any) {
    const today = new Date().toISOString().split('T')[0];
    
    const defaultUsage = {
        ai_daily_count: 0,
        sync_thoughts: 0,
        last_ai_reset: today
    };

    const defaultSettings = {
        theme: 'cyberia',
        autoSync: true,
        driveEnabled: false
    };

    const hydrated = {
        ...profile,
        plan: profile.plan || 'free',
        subscriptionStatus: profile.subscriptionStatus || 'none',
        expiryDate: profile.expiryDate || null,
        usage: {
            ...defaultUsage,
            ...(profile.usage || {})
        },
        settings: {
            ...defaultSettings,
            ...(profile.settings || {})
        },
        lastSeen: new Date().toISOString()
    };

    if (hydrated.usage.last_ai_reset !== today) {
        hydrated.usage.ai_daily_count = 0;
        hydrated.usage.last_ai_reset = today;
    }

    return hydrated;
}

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
        console.error('[Auth Callback] Missing credentials. CLIENT_ID:', CLIENT_ID ? 'set' : 'MISSING', 'CLIENT_SECRET:', CLIENT_SECRET ? 'set' : 'MISSING');
        return res.status(500).send('Server configuration error: Missing Google Credentials');
    }

    // Determine redirect URI based on environment
    const host = req.headers.host || '';
    const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');
    const protocol = isLocalhost ? 'http' : 'https';
    
    // Use APP_URL only in production (not localhost)
    const baseUrl = isLocalhost ? `${protocol}://${host}` : (process.env.APP_URL || `${protocol}://${host}`);
    const REDIRECT_URI = `${baseUrl}/api/auth/callback`;

    console.log('[Auth Callback] Host:', host, '| REDIRECT_URI:', REDIRECT_URI);

    try {
        console.log('[Auth Callback] Creating OAuth client with REDIRECT_URI:', REDIRECT_URI);
        const client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

        // 2. Exchange code for tokens
        console.log('[Auth Callback] Exchanging code for tokens...');
        const { tokens } = await client.getToken(code as string);
        console.log('[Auth Callback] Tokens received:', tokens.access_token ? 'access_token OK' : 'NO access_token', '| id_token:', tokens.id_token ? 'OK' : 'MISSING');
        
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
        console.log('[Auth Callback] User ID:', userId);

        // 4. Update/Create Profile in KV
        const profileKey = `user:profile:${userId}`;
        console.log('[Auth Callback] Fetching profile from KV:', profileKey);
        const existingProfile = await kv.get<any>(profileKey) || {};
        console.log('[Auth Callback] Profile fetched, saving...');
        
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
        console.error('[Auth Callback] Error:', e.message || e, e.stack);
        return res.status(500).send('Authentication failed: ' + (e.message || 'Unknown error'));
    }
}

