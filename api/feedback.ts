import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';
import fs from 'fs';
import path from 'path';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { action } = req.query;

  if (action === 'contact') {
    return handleContact(req, res);
  }

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
    } catch (err) { }
  }

  const authHeader = req.headers.authorization;
  const adminPassword = process.env.FEEDBACK_ADMIN_PASSWORD;
  const expectedToken = adminPassword ? Buffer.from(adminPassword).toString('base64') : null;
  const isAdmin = expectedToken && authHeader === `Bearer ${expectedToken}`;

  if (req.method === 'POST') {
    const { message, email, type } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });

    const entry = {
      id: Date.now().toString(),
      type: type || 'issue',
      message: message.substring(0, 2000),
      email: email ? email.substring(0, 200) : 'anonymous',
      timestamp: Date.now()
    };

    try {
      await kv.lpush(feedbackKey, entry);
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Feedback submission error:', error);
      return res.status(500).json({ error: 'Failed to save feedback' });
    }
  }

  if (req.method === 'GET') {
    try {
      const list: any[] = await kv.lrange(feedbackKey, 0, 100);
      const sanitizedList = isAdmin ? list : list.map(({ email: _, ...rest }) => ({
        ...rest,
        email: 'protected@cyberia.net'
      }));
      return res.status(200).json({ feedback: sanitizedList, isAdmin });
    } catch (error) {
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'DELETE') {
    if (!isAdmin) return res.status(401).json({ error: 'Unauthorized' });
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'ID required' });
    try {
      const list: any[] = await kv.lrange(feedbackKey, 0, -1);
      const filteredList = list.filter(item => item.id !== id);
      await kv.del(feedbackKey);
      if (filteredList.length > 0) await kv.rpush(feedbackKey, ...filteredList);
      return res.status(200).json({ success: true });
    } catch (error) {
      return res.status(500).json({ error: 'Delete failed' });
    }
  }

  if (req.method === 'PATCH') {
    if (!isAdmin) return res.status(401).json({ error: 'Unauthorized' });
    const { id, status, adminReply } = req.body;
    if (!id) return res.status(400).json({ error: 'ID required' });
    try {
      const list: any[] = await kv.lrange(feedbackKey, 0, -1);
      const index = list.findIndex(item => item.id === id);
      if (index === -1) return res.status(404).json({ error: 'Entry not found' });
      if (status) list[index].status = status;
      if (adminReply !== undefined) list[index].adminReply = adminReply;
      await kv.del(feedbackKey);
      await kv.rpush(feedbackKey, ...list);
      return res.status(200).json({ success: true });
    } catch (error) {
      return res.status(500).json({ error: 'Update failed' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

async function handleContact(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.RESEND_API_KEY) {
    try {
      const envPath = path.join(process.cwd(), '.env.local');
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const lines = envContent.split(/\r?\n/);
        for (const line of lines) {
          const [key, ...valueParts] = line.split('=');
          if (key && valueParts.length > 0) {
            const value = valueParts.join('=').replace(/^["']|["']$/g, '').trim();
            if (key.trim() === 'RESEND_API_KEY') process.env.RESEND_API_KEY = value;
            if (key.trim() === 'CONTACT_EMAIL') process.env.CONTACT_EMAIL = value;
          }
        }
      }
    } catch (err) { }
  }

  const { message, email, name } = req.body;
  const resendKey = process.env.RESEND_API_KEY;
  const destinationEmail = process.env.CONTACT_EMAIL;

  if (!resendKey || !destinationEmail) return res.status(500).json({ error: 'System configuration missing' });

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendKey}`
      },
      body: JSON.stringify({
        from: 'Cyberia System <onboarding@resend.dev>',
        to: destinationEmail,
        subject: `New Contact Message from ${name || 'User'}`,
        reply_to: email,
        html: `
                    <div style="font-family: sans-serif; color: #333; padding: 20px;">
                        <h2 style="color: #6366f1;">New Message from Cyberia</h2>
                        <p><strong>Name:</strong> ${name || 'N/A'}</p>
                        <p><strong>Email:</strong> ${email}</p>
                        <div style="margin-top: 20px; padding: 15px; background: #f9f9f9; border-radius: 8px;">
                            <p style="white-space: pre-wrap; margin: 0;">${message}</p>
                        </div>
                    </div>
                `
      })
    });

    if (response.ok) return res.status(200).json({ success: true });
    const errorData = await response.json() as any;
    return res.status(response.status).json({ error: errorData.message || 'Failed to send email' });
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
}
