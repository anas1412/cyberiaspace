import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_PUBLIC_SUPABASE_ANON_KEY;

const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
  : null;

// Simple in-memory cache to avoid hammering the database
let cachedResponse: { body: unknown; expiresAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Allow GET and OPTIONS only
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'content-type');
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Return cached response if still valid
  if (cachedResponse && cachedResponse.expiresAt > Date.now()) {
    return res.status(200).json(cachedResponse.body);
  }

  if (!supabase) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Fetch recently active users (only safe public fields)
    const { data: activeUsers, error } = await supabase
      .from('users')
      .select('id, name, avatar, updated_at')
      .gte('updated_at', thirtyDaysAgo)
      .order('updated_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('[PublicStats] Query error:', error);
      return res.status(500).json({ error: 'Failed to fetch stats' });
    }

    // Get total user count
    const { count: totalUsers, error: countError } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true });

    if (countError) {
      console.error('[PublicStats] Count error:', countError);
    }

    const result = {
      activeCount: activeUsers?.length ?? 0,
      totalUsers: totalUsers ?? 0,
      users: (activeUsers ?? [])
        .filter((u) => u.name || u.avatar)
        .slice(0, 8)
        .map((u) => {
          const fullName = u.name || 'User';
          const parts = fullName.split(' ');
          const displayName = parts.length > 1 
            ? `${parts[0]} ${parts[parts.length - 1][0]}.` 
            : fullName;
          return {
            name: displayName,
            avatar: u.avatar || null,
          };
        }),
    };

    // Cache the response
    cachedResponse = { body: result, expiresAt: Date.now() + CACHE_TTL_MS };

    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return res.status(200).json(result);
  } catch (err) {
    console.error('[PublicStats] Unexpected error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
