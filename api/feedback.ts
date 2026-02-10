import { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';
import fs from 'fs';
import path from 'path';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const feedbackKey = 'cyberia_feedback_list';

  // Native Fallback for Local Development
  if (!process.env.FEEDBACK_ADMIN_PASSWORD) {
    try {
      const envPath = path.resolve(process.cwd(), '.env.local');
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const match = envContent.match(/FEEDBACK_ADMIN_PASSWORD=["']?([^"'\n\r]+)["']?/);
        if (match) process.env.FEEDBACK_ADMIN_PASSWORD = match[1];
      }
    } catch (err) {}
  }

  const authHeader = req.headers.authorization;
  const adminPassword = process.env.FEEDBACK_ADMIN_PASSWORD;

  const expectedToken = adminPassword ? Buffer.from(adminPassword).toString('base64') : null;
  const isAdmin = expectedToken && authHeader === `Bearer ${expectedToken}`;

  // --- HANDLE POST (SUBMIT FEEDBACK) ---
  if (req.method === 'POST') {
    const { message, email, type } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const entry = {
      id: Date.now().toString(),
      type: type || 'issue',
      message: message.substring(0, 2000), // Limit message length
      email: email ? email.substring(0, 200) : 'anonymous',
      timestamp: Date.now()
    };

    try {
      // Append to list in KV
      await kv.lpush(feedbackKey, entry);
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Feedback submission error:', error);
      return res.status(500).json({ error: 'Failed to save feedback' });
    }
  }

  // --- HANDLE GET (FETCH FEEDBACK) ---
  if (req.method === 'GET') {
    try {
      const list: any[] = await kv.lrange(feedbackKey, 0, 100);
      
      // If not admin, sanitize the data (hide emails)
      const sanitizedList = isAdmin ? list : list.map(({ email: _, ...rest }) => ({ 
        ...rest, 
        email: 'protected@cyberia.net'
         
      }));

      return res.status(200).json({ feedback: sanitizedList, isAdmin });
    } catch (error) {
      console.error('Feedback fetch error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // --- HANDLE DELETE (REMOVE ENTRY - ADMIN ONLY) ---
  if (req.method === 'DELETE') {
    if (!isAdmin) return res.status(401).json({ error: 'Unauthorized' });
    
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'ID required' });

    try {
      const list: any[] = await kv.lrange(feedbackKey, 0, -1);
      const filteredList = list.filter(item => item.id !== id);
      
      await kv.del(feedbackKey);
      if (filteredList.length > 0) {
        await kv.rpush(feedbackKey, ...filteredList);
      }
      
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Feedback delete error:', error);
      return res.status(500).json({ error: 'Delete failed' });
    }
  }

  // --- HANDLE PATCH (UPDATE ENTRY - ADMIN ONLY) ---
  if (req.method === 'PATCH') {
    if (!isAdmin) return res.status(401).json({ error: 'Unauthorized' });
    
    const { id, status, adminReply } = req.body;
    if (!id) return res.status(400).json({ error: 'ID required' });

    try {
      const list: any[] = await kv.lrange(feedbackKey, 0, -1);
      const index = list.findIndex(item => item.id === id);
      
      if (index === -1) return res.status(404).json({ error: 'Entry not found' });

      // Update fields
      if (status) list[index].status = status;
      if (adminReply !== undefined) list[index].adminReply = adminReply;

      // Update the entire list (KV lists don't support direct index updates easily without LSET, but replacing the list is safer for this scale)
      await kv.del(feedbackKey);
      await kv.rpush(feedbackKey, ...list);
      
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Feedback update error:', error);
      return res.status(500).json({ error: 'Update failed' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
