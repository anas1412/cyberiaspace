import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('[Dashboard] Missing SUPABASE_URL or ANON_KEY env vars');
}

const supabase = createClient(supabaseUrl!, supabaseKey!, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function isAdmin(userId: string): Promise<boolean> {
  if (!userId || !supabase) return false;
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', userId)
      .single();
    
    if (error) {
      console.error('[Dashboard] isAdmin query error:', error);
      return false;
    }
    return user?.is_admin === true;
  } catch (err) {
    console.error('[Dashboard] isAdmin error:', err);
    return false;
  }
}

async function getAdminUser(userId: string) {
  if (!userId || !supabase) return null;
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, name, is_admin, created_at')
      .eq('id', userId)
      .single();
    
    if (error) {
      console.error('[Dashboard] getAdminUser query error:', error);
      return null;
    }
    return user;
  } catch (err) {
    console.error('[Dashboard] getAdminUser error:', err);
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');
    return res.status(200).end();
  }

  const route = req.query.route as string;

  switch (route) {
    case 'login': {
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
      }

      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Missing email or password' });
      }

      const { data: user, error } = await supabase
        .from('users')
        .select('id, email, name, is_admin, created_at')
        .eq('email', email)
        .single();

      if (error || !user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const passwordMatch = password === process.env.DASHBOARD_ADMIN_PASSWORD;
      if (!passwordMatch) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      if (user.is_admin !== true) {
        return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
      }

      const token = Buffer.from(user.id).toString('base64');

      return res.status(200).json({
        success: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          is_admin: user.is_admin,
          created_at: user.created_at
        }
      });
    }

    case 'verify': {
      if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
      }

      const authHeader = req.headers.authorization?.replace('Bearer ', '');
      
      if (!authHeader) {
        return res.status(401).json({ error: 'Missing authorization token' });
      }

      // Decode base64 to get user ID
      let userId: string;
      try {
        userId = Buffer.from(authHeader, 'base64').toString('utf8');
        console.log('[Dashboard verify] Decoded userId:', userId);
      } catch (err) {
        console.error('[Dashboard verify] Failed to decode:', err);
        return res.status(400).json({ error: 'Invalid token format' });
      }

      const admin = await isAdmin(userId);
      console.log('[Dashboard verify] isAdmin result:', admin);
      
      const user = await getAdminUser(userId);
      console.log('[Dashboard verify] getAdminUser result:', user);

      if (!user) {
        // User not found - might be using a different user ID format
        console.log('[Dashboard verify] User not found in database');
        return res.status(200).json({ isAdmin: false, error: 'User not found' });
      }

      if (!admin) {
        console.log('[Dashboard verify] User found but is_admin is false');
        return res.status(200).json({ isAdmin: false, is_admin_value: user.is_admin });
      }

      return res.status(200).json({
        isAdmin: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          is_admin: user.is_admin,
          created_at: user.created_at
        }
      });
    }

    case 'stats': {
      if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
      }

      const authHeader = req.headers.authorization?.replace('Bearer ', '');
      
      if (!authHeader) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      let userId: string;
      try {
        userId = Buffer.from(authHeader, 'base64').toString('utf8');
        console.log('[Dashboard Stats] UserID:', userId);
      } catch {
        return res.status(400).json({ error: 'Invalid token format' });
      }

      if (!(await isAdmin(userId))) {
        console.log('[Dashboard Stats] Not admin:', userId);
        return res.status(401).json({ error: 'Unauthorized' });
      }

      try {
        const [
          totalUsersResult,
          totalFeedbackResult,
          feedbackByStatusResult,
          feedbackByTypeResult,
          newUsersResult,
          newFeedbackResult
        ] = await Promise.all([
          supabase.from('users').select('id', { count: 'exact', head: true }),
          supabase.from('feedback').select('id', { count: 'exact', head: true }),
          supabase.from('feedback').select('status'),
          supabase.from('feedback').select('type'),
          supabase.from('users')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
          supabase.from('feedback')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        ]);

        console.log('[Dashboard Stats] Query results:', { totalUsers: totalUsersResult.count });

        const statusCounts = { todo: 0, doing: 0, done: 0 };
        if (feedbackByStatusResult.data) {
          feedbackByStatusResult.data.forEach((f: { status: string }) => {
            if (f.status in statusCounts) {
              statusCounts[f.status as keyof typeof statusCounts]++;
            }
          });
        }

        const typeCounts = { issue: 0, feedback: 0, feature: 0 };
        if (feedbackByTypeResult.data) {
          feedbackByTypeResult.data.forEach((f: { type: string }) => {
            if (f.type in typeCounts) {
              typeCounts[f.type as keyof typeof typeCounts]++;
            }
          });
        }

        return res.status(200).json({
          totalUsers: totalUsersResult.count || 0,
          totalFeedback: totalFeedbackResult.count || 0,
          feedbackByStatus: statusCounts,
          feedbackByType: typeCounts,
          newUsersThisWeek: newUsersResult.count || 0,
          newFeedbackThisWeek: newFeedbackResult.count || 0
        });
      } catch (err) {
        console.error('[Dashboard Stats] Error:', err);
        return res.status(500).json({ error: 'Failed to fetch stats' });
      }
    }

    case 'users': {
      if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
      }

      const authHeader = req.headers.authorization?.replace('Bearer ', '');
      
      if (!authHeader) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      let userId: string;
      try {
        userId = Buffer.from(authHeader, 'base64').toString('utf8');
      } catch {
        return res.status(400).json({ error: 'Invalid token format' });
      }

      if (!(await isAdmin(userId))) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
      const offset = (page - 1) * limit;

      try {
        const { data: users, error, count } = await supabase
          .from('users')
          .select('id, email, name, plan, is_admin, created_at', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (error) {
          console.error('[Dashboard Users] Error:', error.message);
          return res.status(500).json({ error: 'Failed to fetch users' });
        }

        const userIds = (users || []).map((u: { id: string }) => u.id);
        let feedbackCounts: Record<string, number> = {};

        if (userIds.length > 0) {
          const { data: feedbackData } = await supabase
            .from('feedback')
            .select('user_id');

          if (feedbackData) {
            const counts: Record<string, number> = {};
            feedbackData.forEach((f: { user_id: string | null }) => {
              if (f.user_id) {
                counts[f.user_id] = (counts[f.user_id] || 0) + 1;
              }
            });
            feedbackCounts = counts;
          }
        }

        const usersWithCounts = (users || []).map((user: { 
          id: string; 
          email: string; 
          name: string | null; 
          plan: string | null; 
          is_admin: boolean | null; 
          created_at: string 
        }) => ({
          id: user.id,
          email: user.email,
          name: user.name,
          plan: user.plan,
          is_admin: user.is_admin,
          created_at: user.created_at,
          feedback_count: feedbackCounts[user.id] || 0
        }));

        return res.status(200).json({
          users: usersWithCounts,
          pagination: {
            page,
            limit,
            total: count || 0,
            totalPages: Math.ceil((count || 0) / limit)
          }
        });
      } catch (err) {
        console.error('[Dashboard Users] Error:', err);
        return res.status(500).json({ error: 'Failed to fetch users' });
      }
    }

    case 'updateUser': {
      if (req.method !== 'PATCH') {
        return res.status(405).json({ error: 'Method not allowed' });
      }

      const authHeader = req.headers.authorization?.replace('Bearer ', '');
      
      if (!authHeader) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      let adminUserId: string;
      try {
        adminUserId = Buffer.from(authHeader, 'base64').toString('utf8');
      } catch {
        return res.status(400).json({ error: 'Invalid token format' });
      }

      if (!(await isAdmin(adminUserId))) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { userId, is_admin } = req.body;

      if (!userId) {
        return res.status(400).json({ error: 'Missing userId' });
      }

      try {
        const { data: updatedUser, error } = await supabase
          .from('users')
          .update({ is_admin })
          .eq('id', userId)
          .select('id, email, name, is_admin, created_at')
          .single();

        if (error) {
          console.error('[Dashboard UpdateUser] Error:', error.message);
          return res.status(500).json({ error: 'Failed to update user' });
        }

        if (!updatedUser) {
          return res.status(404).json({ error: 'User not found' });
        }

        return res.status(200).json({ user: updatedUser });
      } catch (err) {
        console.error('[Dashboard UpdateUser] Error:', err);
        return res.status(500).json({ error: 'Failed to update user' });
      }
    }

    case 'resetQuota': {
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
      }

      const authHeader = req.headers.authorization?.replace('Bearer ', '');
      
      if (!authHeader) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      let adminUserId: string;
      try {
        adminUserId = Buffer.from(authHeader, 'base64').toString('utf8');
      } catch {
        return res.status(400).json({ error: 'Invalid token format' });
      }

      if (!(await isAdmin(adminUserId))) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: 'Missing userId' });
      }

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

      try {
        const { data: updatedUser, error } = await supabase
          .from('users')
          .update({ usage: resetUsage })
          .eq('id', userId)
          .select('id, email, name, usage')
          .single();

        if (error) {
          console.error('[Dashboard ResetQuota] Error:', error.message);
          return res.status(500).json({ error: 'Failed to reset quota' });
        }

        return res.status(200).json({ success: true, user: updatedUser });
      } catch (err) {
        console.error('[Dashboard ResetQuota] Error:', err);
        return res.status(500).json({ error: 'Failed to reset quota' });
      }
    }

    case 'feedback': {
      const authHeader = req.headers.authorization?.replace('Bearer ', '');
      
      if (!authHeader) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      let feedbackUserId: string;
      try {
        feedbackUserId = Buffer.from(authHeader, 'base64').toString('utf8');
      } catch {
        return res.status(400).json({ error: 'Invalid token format' });
      }

      if (!(await isAdmin(feedbackUserId))) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (req.method === 'GET') {
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
        const offset = (page - 1) * limit;
        const status = req.query.status as string;
        const type = req.query.type as string;

        try {
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

          const { data: feedbackItems, error, count } = await query;

          if (error) {
            console.error('[Dashboard Feedback List] Error:', error.message);
            return res.status(500).json({ error: 'Failed to fetch feedback' });
          }

          let enrichedFeedback = feedbackItems || [];
          const userIdSet = new Set<string>();
          (feedbackItems || []).forEach((f: { user_id: string | null }) => {
            if (f.user_id) userIdSet.add(f.user_id);
          });
          const userIds = Array.from(userIdSet);

          if (userIds.length > 0) {
            const { data: usersData } = await supabase
              .from('users')
              .select('id, email, name')
              .in('id', userIds);

            const userMap: Record<string, { email: string; name: string | null }> = {};
            (usersData || []).forEach((u: { id: string; email: string; name: string | null }) => {
              userMap[u.id] = { email: u.email, name: u.name };
            });

            enrichedFeedback = (feedbackItems || []).map((f: { 
              user_id: string | null;
              id: string;
              type: string;
              content: string;
              status: string;
              metadata: Record<string, unknown> | null;
              admin_reply: string | null;
              admin_reply_at: string | null;
              created_at: string;
              updated_at: string;
            }) => ({
              ...f,
              user_email: f.user_id ? userMap[f.user_id]?.email : null,
              user_name: f.user_id ? userMap[f.user_id]?.name : null
            }));
          }

          return res.status(200).json({
            feedback: enrichedFeedback,
            pagination: {
              page,
              limit,
              total: count || 0,
              totalPages: Math.ceil((count || 0) / limit)
            }
          });
        } catch (err) {
          console.error('[Dashboard Feedback] Error:', err);
          return res.status(500).json({ error: 'Failed to fetch feedback' });
        }
      }

      if (req.method === 'PATCH') {
        const { id, status, admin_reply } = req.body;

        if (!id) {
          return res.status(400).json({ error: 'Missing feedback id' });
        }

        try {
          const updateData: Record<string, unknown> = {};
          
          if (status) {
            updateData.status = status;
          }
          if (admin_reply !== undefined) {
            updateData.admin_reply = admin_reply;
            updateData.admin_reply_at = admin_reply ? new Date().toISOString() : null;
          }

          const { data: updatedFeedback, error } = await supabase
            .from('feedback')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

          if (error) {
            console.error('[Dashboard Feedback Update] Error:', error.message);
            return res.status(500).json({ error: 'Failed to update feedback' });
          }

          if (!updatedFeedback) {
            return res.status(404).json({ error: 'Feedback not found' });
          }

          return res.status(200).json({ feedback: updatedFeedback });
        } catch (err) {
          console.error('[Dashboard Feedback Update] Error:', err);
          return res.status(500).json({ error: 'Failed to update feedback' });
        }
      }

      if (req.method === 'DELETE') {
        const id = req.query.id || req.body.id;

        if (!id) {
          return res.status(400).json({ error: 'Missing feedback id' });
        }

        try {
          const { error } = await supabase
            .from('feedback')
            .delete()
            .eq('id', id);

          if (error) {
            console.error('[Dashboard Feedback Delete] Error:', error.message);
            return res.status(500).json({ error: 'Failed to delete feedback' });
          }

          return res.status(200).json({ success: true });
        } catch (err) {
          console.error('[Dashboard Feedback Delete] Error:', err);
          return res.status(500).json({ error: 'Failed to delete feedback' });
        }
      }

      return res.status(405).json({ error: 'Method not allowed for feedback route' });
    }

    default:
      return res.status(404).json({ error: 'Route not found' });
  }
}
