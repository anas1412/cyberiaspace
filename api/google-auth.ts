import type { VercelRequest, VercelResponse } from '@vercel/node';
import { OAuth2Client } from 'google-auth-library';
import { createClient } from '@supabase/supabase-js';

const CLIENT_ID = process.env.VITE_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = 'postmessage';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey 
    ? createClient(supabaseUrl, supabaseKey, { auth: { autoRefreshToken: false, persistSession: false } })
    : null;

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

    if (supabase) {
        const { data } = await supabase.from('users').select('settings').eq('id', userId).maybeSingle();
        if (data) {
            await supabase.from('users').update({
                settings: { ...data.settings, driveEnabled: false }
            }).eq('id', userId);
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

        const ticket = await client.verifyIdToken({
            idToken: tokens.id_token,
            audience: CLIENT_ID,
        });
        const payload = ticket.getPayload();
        if (!payload) throw new Error('Invalid ID Token payload');

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
            await supabase.from('users').upsert({
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
        }

        return res.status(200).json({
            access_token: tokens.access_token,
            expires_in: tokens.expiry_date ? Math.floor((tokens.expiry_date - Date.now()) / 1000) : 3600,
            user: profile
        });
    } catch (e: any) {
        console.error('[Google Auth] Exchange error:', e);
        return res.status(500).json({ error: e.message });
    }
}

async function handleRefresh(req: VercelRequest, res: VercelResponse) {
    const userId = await getUserIdFromAuthHeader(req.headers.authorization);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    // For now, just return success - Google tokens are handled client-side
    return res.status(200).json({
        access_token: req.headers.authorization?.split(' ')[1],
        expires_in: 3600
    });
}

async function handleRevoke(req: VercelRequest, res: VercelResponse) {
    const userId = await getUserIdFromAuthHeader(req.headers.authorization);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    if (supabase) {
        const { data } = await supabase.from('users').select('settings').eq('id', userId).maybeSingle();
        if (data) {
            await supabase.from('users').update({
                settings: { ...data.settings, driveEnabled: false }
            }).eq('id', userId);
        }
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
