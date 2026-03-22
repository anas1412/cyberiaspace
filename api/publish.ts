import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!, {
  auth: { autoRefreshToken: false, persistSession: false }
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');
    return res.status(200).end();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { action, ...data } = req.method === 'GET' ? req.query : req.body;
  const publishedId = req.query.id || req.query.publishedId || data?.publishedId;

  if (action === 'publish' || req.method === 'POST') {
    const { space, thoughts, stacks, creatorName, publishedId: existingPublishedId } = req.body;

    if (!space?.id) {
      return res.status(400).json({ error: 'Missing space data' });
    }

    // Unified IDs: local ID is the cloud ID
    const spaceId = space.id;
    const userId = space.user_id || space.userId || '';
    // Filter out deprecated 'date' field from thought snapshots
    const cleanThoughts = (thoughts || []).map(({ date, ...rest }: any) => rest);
    const snapshot = { space, thoughts: cleanThoughts, stacks, creatorName };
    const newPublishedId = existingPublishedId || randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const { error } = await supabase
      .from('published_spaces')
      .upsert({
        id: newPublishedId,
        space_id: spaceId,
        user_id: userId,
        snapshot,
        last_published: new Date().toISOString(),
        expires_at: expiresAt
      }, { onConflict: 'id' });

    if (error) {
      console.error('[Publish] Error:', error.message);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ publishedId: newPublishedId, lastPublished: new Date().toISOString() });
  }

  if (action === 'get' || (req.method === 'GET' && publishedId)) {
    if (!publishedId) {
      return res.status(400).json({ error: 'Missing publishedId' });
    }

    const { data: published, error } = await supabase
      .from('published_spaces')
      .select('snapshot, expires_at, created_at, last_published')
      .eq('id', publishedId)
      .single();

    if (error || !published) {
      return res.status(404).json({ error: 'Not found' });
    }

    if (new Date(published.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Expired' });
    }

    const snapshot = published.snapshot;
    return res.status(200).json({
      ...snapshot,
      id: snapshot.space?.id || publishedId,
      lastUpdated: published.last_published || published.created_at
    });
  }

  if (action === 'unpublish' || (req.method === 'DELETE' && publishedId)) {
    if (!publishedId) {
      return res.status(400).json({ error: 'Missing publishedId' });
    }

    const { error } = await supabase
      .from('published_spaces')
      .delete()
      .eq('id', publishedId);

    if (error) {
      console.error('[Unpublish] Error:', error.message);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ success: true });
  }

  return res.status(400).json({ error: 'Invalid action' });
}
