import type { VercelRequest, VercelResponse } from '@vercel/node';
import fs from 'fs';
import path from 'path';
import { OAuth2Client } from 'google-auth-library';
import { createClient } from '@supabase/supabase-js';
import { checkAndHealSubscription } from './subscription-helper.js';

const CLIENT_ID = process.env.VITE_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.VITE_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_PUBLIC_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey, { auth: { autoRefreshToken: false, persistSession: false } })
    : null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method === 'GET') {
        // Handle Callback
        const { code, state, error } = req.query;

        const host = req.headers.host || '';
        const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');
        const protocol = isLocalhost ? 'http' : 'https';
        const REDIRECT_URI = `${protocol}://${host}/api/auth?route=callback`;

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

            if (!supabase) {
                throw new Error('Supabase client not initialized');
            }

            const { data: existingUser } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();

            const refreshSecret = crypto.randomUUID();
            let dbProfile;

            if (existingUser) {
                const updatePayload: any = {
                    email: payload.email,
                    name: payload.name,
                    avatar: payload.picture,
                    updated_at: new Date().toISOString(),
                    refresh_secret: refreshSecret
                };

                if (tokens.refresh_token) {
                    updatePayload.refresh_token = tokens.refresh_token;
                } else if (existingUser.refresh_token) {
                    updatePayload.refresh_token = existingUser.refresh_token;
                }

                const { data: updatedUser, error: updateError } = await supabase.from('users').update(updatePayload).eq('id', userId).select().single();
                if (updateError) throw updateError;
                
                // Lazy healing check
                dbProfile = await checkAndHealSubscription(updatedUser, supabase);
            } else {
                const insertData: any = {
                    id: userId,
                    email: payload.email,
                    name: payload.name,
                    avatar: payload.picture,
                    plan: 'free',
                    subscription_status: 'none',
                    settings: { theme: 'dark', autoSync: true },
                    usage: { ai_daily_count: 0, sync_thoughts: 0, last_ai_reset: new Date().toISOString().split('T')[0] },
                    updated_at: new Date().toISOString(),
                    refresh_secret: refreshSecret
                };

                if (tokens.refresh_token) {
                    insertData.refresh_token = tokens.refresh_token;
                }

                const { data: newUser, error: insertError } = await supabase.from('users').insert(insertData).select().single();
                if (insertError) throw insertError;
                dbProfile = newUser;
            }

            const profile = {
                id: dbProfile.id,
                email: dbProfile.email,
                name: dbProfile.name,
                avatar: dbProfile.avatar,
                plan: dbProfile.plan,
                subscriptionStatus: dbProfile.subscription_status,
                expiryDate: dbProfile.expiry_date,
                polarCustomerId: dbProfile.polar_customer_id,
                polarSubscriptionId: dbProfile.polar_subscription_id,
                paymentProvider: dbProfile.payment_provider,
                usage: dbProfile.usage,
                settings: dbProfile.settings,
                lastSeen: dbProfile.updated_at
            };

            res.setHeader('Set-Cookie', [
                'auth_state=; Path=/; Max-Age=0; SameSite=Lax; Secure',
                'auth_nonce=; Path=/; Max-Age=0; SameSite=Lax; Secure'
            ]);

            const responseData = {
                token: tokens.access_token,
                expiresIn: tokens.expiry_date ? Math.floor((tokens.expiry_date - Date.now()) / 1000) : 3600,
                refreshSecret: refreshSecret,
                user: profile,
                scopes: ['openid', 'email', 'profile']
            };

            const html = `
                <!DOCTYPE html>
                <html>
                <head><title>Authenticating...</title></head>
                <body>
                    <script>
                        const expiryTime = Date.now() + (${responseData.expiresIn} * 1000);
                        localStorage.setItem('cyberia-token', ${JSON.stringify(responseData.token)});
                        localStorage.setItem('cyberia-token-expiry', expiryTime.toString());
                        localStorage.setItem('cyberia-refresh-secret', ${JSON.stringify(responseData.refreshSecret)});
                        localStorage.setItem('cyberia-user', ${JSON.stringify(JSON.stringify(responseData.user))});
                        localStorage.setItem('cyberia-scopes', ${JSON.stringify(JSON.stringify(responseData.scopes))});
                        window.location.href = '/home';
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
    } else if (req.method === 'POST') {
        // Handle Admin Login (Existing logic)
        if (!process.env.FEEDBACK_ADMIN_PASSWORD) {
            try {
                const envPath = path.resolve(process.cwd(), '.env.local');
                if (fs.existsSync(envPath)) {
                    const envContent = fs.readFileSync(envPath, 'utf8');
                    const match = envContent.match(/FEEDBACK_ADMIN_PASSWORD=["']?([^"'\n\r]+)["']?/);
                    if (match) process.env.FEEDBACK_ADMIN_PASSWORD = match[1];
                }
            } catch (err) {
                console.error('Fallback env read failed:', err);
            }
        }

        const { password } = req.body;
        const adminPassword = process.env.FEEDBACK_ADMIN_PASSWORD;

        if (!adminPassword) {
            return res.status(500).json({ error: 'Admin system not configured' });
        }

        if (password === adminPassword) {
            const token = Buffer.from(adminPassword).toString('base64');
            return res.status(200).json({ success: true, token });
        }

        return res.status(401).json({ error: 'Invalid password' });
    } else {
        return res.status(405).json({ error: 'Method not allowed' });
    }
}
