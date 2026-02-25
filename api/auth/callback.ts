import type { VercelRequest, VercelResponse } from '@vercel/node';
import { OAuth2Client } from 'google-auth-library';
import { createClient } from '@supabase/supabase-js';

const CLIENT_ID = process.env.VITE_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.VITE_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_PUBLIC_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey 
    ? createClient(supabaseUrl, supabaseKey, { auth: { autoRefreshToken: false, persistSession: false } })
    : null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { code, state, error } = req.query;

    const host = req.headers.host || '';
    const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');
    const REDIRECT_URI = isLocalhost 
        ? `http://${host}/api/auth/callback` 
        : 'https://app.cyberia.tn/api/auth/callback';

    console.log(`[Auth Callback] Host: ${host} | Redirect: ${REDIRECT_URI}`);

    if (error) {
        return res.redirect('/login?error=' + encodeURIComponent(error as string));
    }
    if (!code) {
        return res.redirect('/login?error=no_code_provided');
    }

    const storedState = req.cookies.auth_state;
    const storedNonce = req.cookies.auth_nonce;

    if (!storedState || state !== storedState) {
        return res.redirect('/login?error=security_mismatch');
    }

    if (!CLIENT_ID || !CLIENT_SECRET) {
        return res.redirect('/login?error=server_config_error');
    }

    try {
        const client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
        const { tokens } = await client.getToken(code as string);

        if (!tokens.access_token || !tokens.id_token) {
            return res.redirect('/login?error=token_exchange_failed');
        }

        const ticket = await client.verifyIdToken({
            idToken: tokens.id_token,
            audience: CLIENT_ID,
        });
        
        const payload = ticket.getPayload();
        if (!payload) {
            return res.redirect('/login?error=invalid_id_token_payload');
        }

        if (payload.nonce !== storedNonce) {
            return res.redirect('/login?error=nonce_mismatch');
        }

        const userId = payload.sub;
        const grantedScopes = tokens.scope || '';
        const hasDriveScope = grantedScopes.includes('drive.file') || grantedScopes.includes('https://www.googleapis.com/auth/drive.file');

        const today = new Date().toISOString().split('T')[0];
        const profile = {
            id: userId,
            email: payload.email || '',
            name: payload.name || '',
            avatar: payload.picture || '',
            plan: 'free',
            subscriptionStatus: 'none',
            usage: { ai_daily_count: 0, sync_thoughts: 0, last_ai_reset: today },
            settings: { theme: 'cyberia', autoSync: true, driveEnabled: hasDriveScope },
            lastSeen: new Date().toISOString()
        };

        // Save to Supabase only
        if (supabase) {
            const { error: supabaseError } = await supabase.from('users').upsert({
                id: userId,
                email: profile.email,
                name: profile.name,
                avatar: profile.avatar,
                plan: profile.plan,
                subscription_status: profile.subscriptionStatus,
                settings: profile.settings,
                usage: profile.usage,
                updated_at: new Date().toISOString()
            }, { onConflict: 'id' });
            
            if (supabaseError) {
                console.error('[Auth Callback] Supabase error:', supabaseError.message);
            }
        }

        res.setHeader('Set-Cookie', [
            'auth_state=; Path=/; Max-Age=0; SameSite=Lax; Secure',
            'auth_nonce=; Path=/; Max-Age=0; SameSite=Lax; Secure'
        ]);

        const responseData = {
            token: tokens.access_token,
            user: profile,
            scopes: ['openid', 'email', 'profile', ...(hasDriveScope ? ['https://www.googleapis.com/auth/drive.file'] : [])]
        };

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
        console.error('[Auth Callback] Error:', e.message || e);
        return res.redirect('/login?error=auth_process_failed');
    }
}
