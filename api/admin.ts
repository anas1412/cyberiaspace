import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const ADMIN_PASSWORD = process.env.FEEDBACK_ADMIN_PASSWORD;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');
    return res.status(200).end();
  }

  const adminKey = req.headers['x-admin-key'] as string;

  if (adminKey !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { action } = req.method === 'GET' ? req.query : req.body;

  if (action === 'stats') {
    const [usersCount, spacesCount, thoughtsCount, feedbackCount] = await Promise.all([
      supabase.from('users').select('id', { count: 'exact', head: true }),
      supabase.from('spaces').select('id', { count: 'exact', head: true }),
      supabase.from('thoughts').select('id', { count: 'exact', head: true }),
      supabase.from('feedback').select('id', { count: 'exact', head: true })
    ]);

    return res.status(200).json({
      users: usersCount.count,
      spaces: spacesCount.count,
      thoughts: thoughtsCount.count,
      feedback: feedbackCount.count
    });
  }

  if (action === 'cleanupExpired') {
    const { data: deleted, error } = await supabase
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
