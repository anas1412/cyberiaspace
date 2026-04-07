import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from './utils/auth.js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Anon client for auth verification
const supabase = createClient(supabaseUrl!, supabaseAnonKey!, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Service role client for admin operations (bypasses RLS)
const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl!, supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  : supabase;

export const config = {
  runtime: 'nodejs',
};

async function checkIsAdmin(userId: string): Promise<boolean> {
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('is_admin')
    .eq('id', userId)
    .maybeSingle();
  return user?.is_admin === true;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');
    return res.status(200).end();
  }

  // Verify Supabase JWT
  const auth = await verifyAuth(req.headers.authorization);
  if (!auth) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Check admin role
  const isAdmin = await checkIsAdmin(auth.userId);
  if (!isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { action } = req.method === 'GET' ? req.query : req.body;

  if (action === 'stats') {
    const [usersCount, spacesCount, thoughtsCount, feedbackCount] = await Promise.all([
      supabaseAdmin.from('users').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('spaces').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('thoughts').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('feedback').select('id', { count: 'exact', head: true })
    ]);

    return res.status(200).json({
      users: usersCount.count,
      spaces: spacesCount.count,
      thoughts: thoughtsCount.count,
      feedback: feedbackCount.count
    });
  }

  if (action === 'cleanupExpired') {
    const { data: deleted, error } = await supabaseAdmin
      .from('published_spaces')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .select('id');

    if (error) {
      console.error('[Cleanup] Error:', error.message);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ deleted: deleted?.length || 0 });
  }

  return res.status(400).json({ error: 'Invalid action' });
}
