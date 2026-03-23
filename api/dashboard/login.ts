import type { VercelRequest, VercelResponse } from '@vercel/node';

const ADMIN_PASSWORD = process.env.FEEDBACK_ADMIN_PASSWORD;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password } = req.body;

  if (!ADMIN_PASSWORD) {
    return res.status(500).json({ error: 'Admin system not configured' });
  }

  if (password === ADMIN_PASSWORD) {
    const token = Buffer.from(ADMIN_PASSWORD).toString('base64');
    return res.status(200).json({
      success: true,
      token,
      admin: {
        email: email || 'admin@cyberia.tn',
        role: 'superadmin'
      }
    });
  }

  return res.status(401).json({ error: 'Invalid credentials' });
}
