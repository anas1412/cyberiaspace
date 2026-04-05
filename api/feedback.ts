import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from './utils/auth.js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const ADMIN_PASSWORD = process.env.FEEDBACK_ADMIN_PASSWORD;

// Helper to verify admin token
const isAdminToken = (token: string): boolean => {
  if (!token || !ADMIN_PASSWORD) return false;
  // Token is base64 encoded password - compare decoded token to password
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    return decoded === ADMIN_PASSWORD;
  } catch {
    return false;
  }
};

// Helper to extract userId from auth header
const getUserIdFromToken = async (authHeader?: string): Promise<string | null> => {
  const auth = await verifyAuth(authHeader);
  return auth?.userId ?? null;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');
    return res.status(200).end();
  }

  // Support both x-admin-key and Authorization Bearer token for admin
  const adminKey = req.headers['x-admin-key'] as string || 
                   req.headers['authorization']?.replace('Bearer ', '') as string;
  const isAdmin = adminKey ? isAdminToken(adminKey) : false;

  // CREATE - Submit new feedback
  if (req.method === 'POST') {
    const { action, message, email, type, userId, content, metadata, name } = req.body;

    // Handle contact form submission
    if (action === 'contact' || (!type && message)) {
      const { error } = await supabase
        .from('feedback')
        .insert({
          user_id: null, // Contact submissions are anonymous
          type: 'issue', // Default to issue for contact
          content: message,
          metadata: { name, email, isContact: true },
          status: 'none' // Admin sets status
        });

      if (error) {
        console.error('[Feedback Contact] Error:', error.message);
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({ success: true });
    }

    // Handle regular feedback submission
    if (!type || (!message && !content)) {
      return res.status(400).json({ error: 'Missing type or content' });
    }

    const { data: feedback, error } = await supabase
      .from('feedback')
      .insert({
        user_id: userId || email || null,
        type,
        content: content || message,
        metadata: metadata || { email },
        status: 'none' // Admin sets status
      })
      .select()
      .single();

    if (error) {
      console.error('[Feedback Create] Error:', error.message);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ feedback });
  }

  // LIST - Get feedback (user's own or all)
  if (req.method === 'GET') {
    const { action, userId: queryUserId, status, limit = 50, offset = 0 } = req.query;
    const authHeader = req.headers.authorization;
    const tokenUserId = getUserIdFromToken(authHeader);
    const userId = queryUserId as string || tokenUserId;

    // Return all feedback (no auth required) - for public feedback page
    if (action === 'listAll') {
      let query = supabase
        .from('feedback')
        .select('*')
        .order('created_at', { ascending: false })
        .range(Number(offset), Number(offset) + Number(limit) - 1);

      if (status && status !== 'all') {
        query = query.eq('status', status);
      }

      const { data: feedback, error } = await query;

      if (error) {
        console.error('[Feedback ListAll] Error:', error.message);
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({ feedback: feedback || [], isAdmin: false });
    }

    // Admin only: return all feedback with admin flag
    if (isAdmin && (!userId || action === 'listAll')) {
      let query = supabase
        .from('feedback')
        .select('*')
        .order('created_at', { ascending: false })
        .range(Number(offset), Number(offset) + Number(limit) - 1);

      if (status && status !== 'all') {
        query = query.eq('status', status);
      }

      const { data: feedback, error } = await query;

      if (error) {
        console.error('[Feedback ListAll] Error:', error.message);
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({ feedback: feedback || [], isAdmin: true });
    }

    // Regular user listing - their own feedback only
    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    const { data: feedback, error } = await supabase
      .from('feedback')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('[Feedback List] Error:', error.message);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ feedback: feedback || [] });
  }

  // UPDATE - Update feedback status or reply (admin only)
  if (req.method === 'PATCH') {
    if (!isAdmin) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id, feedbackId, status, adminReply } = req.body;
    const targetId = feedbackId || id;

    if (!targetId) {
      return res.status(400).json({ error: 'Missing feedbackId' });
    }

    const updateData: Record<string, unknown> = {};
    
    if (status) {
      updateData.status = status;
    }
    if (adminReply) {
      updateData.admin_reply = adminReply;
      updateData.admin_reply_at = new Date().toISOString();
    }

    const { data: feedback, error } = await supabase
      .from('feedback')
      .update(updateData)
      .eq('id', targetId)
      .select()
      .single();

    if (error) {
      console.error('[Feedback Update] Error:', error.message);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ feedback });
  }

  // DELETE - Delete feedback (admin only)
  if (req.method === 'DELETE') {
    if (!isAdmin) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const feedbackId = req.query.id || req.query.feedbackId;

    if (!feedbackId) {
      return res.status(400).json({ error: 'Missing feedbackId' });
    }

    const { error } = await supabase
      .from('feedback')
      .delete()
      .eq('id', feedbackId);

    if (error) {
      console.error('[Feedback Delete] Error:', error.message);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ success: true });
  }

  return res.status(400).json({ error: 'Invalid request' });
}
