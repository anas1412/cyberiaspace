import { VercelRequest, VercelResponse } from '@vercel/node';
import fs from 'fs';
import path from 'path';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

    // Native Fallback for Local Development (Robust Read)
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
      } catch (err) {
        console.error('Local env fallback error:', err);
      }
    }
  const { message, email, name } = req.body;
  const resendKey = process.env.RESEND_API_KEY;
  const destinationEmail = process.env.CONTACT_EMAIL;

  if (!resendKey || !destinationEmail) {
    console.error('Contact system configuration missing');
    return res.status(500).json({ error: 'System configuration missing' });
  }

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

    if (response.ok) {
      return res.status(200).json({ success: true });
    } else {
      const errorData = await response.json();
      return res.status(response.status).json({ error: errorData.message || 'Failed to send email' });
    }
  } catch {
    return res.status(500).json({ error: 'Internal server error' });
  }
}
