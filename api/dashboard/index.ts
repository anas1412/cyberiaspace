import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const ADMIN_PASSWORD = process.env.FEEDBACK_ADMIN_PASSWORD;

function verifyAdmin(authHeader: string | null | undefined): boolean {
  if (!authHeader) return false;
  const token = Buffer.from(ADMIN_PASSWORD || '').toString('base64');
  return authHeader === `Bearer ${token}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');
    return res.status(200).end();
  }

  const authHeader = req.headers.authorization;
  if (!verifyAdmin(authHeader)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    const { resource } = req.query;

    if (resource === 'stats') {
      const [usersCount, spacesCount, thoughtsCount, feedbackCount, recentFeedback] = await Promise.all([
        supabase.from('users').select('id', { count: 'exact', head: true }),
        supabase.from('spaces').select('id', { count: 'exact', head: true }),
        supabase.from('thoughts').select('id', { count: 'exact', head: true }),
        supabase.from('feedback').select('id', { count: 'exact', head: true }),
        supabase.from('feedback')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(5)
      ]);

      return res.status(200).json({
        stats: {
          users: usersCount.count || 0,
          spaces: spacesCount.count || 0,
          thoughts: thoughtsCount.count || 0,
          feedback: feedbackCount.count || 0
        },
        recentFeedback: recentFeedback.data || []
      });
    }

    if (resource === 'users') {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;
      const search = req.query.search as string || '';

      let query = supabase
        .from('users')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (search) {
        query = query.ilike('email', `%${search}%`);
      }

      const { data, error, count } = await query;

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({
        users: data || [],
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit)
      });
    }

    if (resource === 'feedback') {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;
      const status = req.query.status as string;
      const type = req.query.type as string;

      let query = supabase
        .from('feedback')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (status && status !== 'all') {
        query = query.eq('status', status);
      }

      if (type && type !== 'all') {
        query = query.eq('type', type);
      }

      const { data, error, count } = await query;

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({
        feedback: data || [],
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit)
      });
    }

    return res.status(400).json({ error: 'Invalid resource' });
  }

  if (req.method === 'PATCH') {
    const { resource, id, updates } = req.body;

    if (resource === 'user') {
      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({ user: data });
    }

    if (resource === 'feedback') {
      const { data, error } = await supabase
        .from('feedback')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({ feedback: data });
    }

    return res.status(400).json({ error: 'Invalid resource' });
  }

  if (req.method === 'DELETE') {
    if (req.query.resource === 'feedback') {
      const { id } = req.query;
      const { error } = await supabase
        .from('feedback')
        .delete()
        .eq('id', id);

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Invalid resource' });
  }

  if (req.method === 'POST') {
    const { resource, userId } = req.body;

    if (resource === 'resetQuota') {
      // Reset all usage counters for a user
      const resetUsage = {
        ai_daily_count: 0,
        ai_top_count: 0,
        ai_medium_count: 0,
        ai_small_count: 0,
        daily_anchor: null,
        weekly_anchor: null,
        monthly_anchor: null,
        weekly_top_count: 0,
        weekly_medium_count: 0,
        weekly_small_count: 0,
        monthly_top_count: 0,
        monthly_medium_count: 0,
        monthly_small_count: 0
      };

      const { data, error } = await supabase
        .from('users')
        .update({ usage: resetUsage })
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({ success: true, user: data });
    }

    return res.status(400).json({ error: 'Invalid resource' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
