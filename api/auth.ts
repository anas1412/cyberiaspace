import { VercelRequest, VercelResponse } from '@vercel/node';
import fs from 'fs';
import path from 'path';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Native Fallback for Local Development
  if (!process.env.FEEDBACK_ADMIN_PASSWORD) {
    try {
      const envPath = path.resolve(process.cwd(), '.env.local');
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const match = envContent.match(/FEEDBACK_ADMIN_PASSWORD=["']?([^"'\n\r]+)["']?/);
        if (match) process.env.FEEDBACK_ADMIN_PASSWORD = match[1];
      }
    } catch (err) {
      console.error('Fallback env read failed:', err);
    }
  }

  const { password } = req.body;
  const adminPassword = process.env.FEEDBACK_ADMIN_PASSWORD;

  if (!adminPassword) {
    return res.status(500).json({ error: 'Admin system not configured' });
  }

  if (password === adminPassword) {
    const token = Buffer.from(adminPassword).toString('base64');
    return res.status(200).json({ success: true, token });
  }

  return res.status(401).json({ error: 'Invalid password' });
}
