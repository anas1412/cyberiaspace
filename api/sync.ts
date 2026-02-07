import { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';
import { OAuth2Client } from 'google-auth-library';

const client = new OAuth2Client();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Verify the access token by calling Google's tokeninfo endpoint
    // Using OAuth2Client for verification
    const tokenInfo = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${token}`);
    if (!tokenInfo.ok) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    const info = await tokenInfo.json();
    const userId = info.sub; // This is the unique Google User ID

    if (!userId) {
      return res.status(401).json({ error: 'User ID not found in token' });
    }

    const storageKey = `cyberia_sync_${userId}`;

    // --- HANDLE POST (SAVE) ---
    if (req.method === 'POST') {
      const data = req.body;
      if (!data) return res.status(400).json({ error: 'No data provided' });
      
      await kv.set(storageKey, JSON.stringify(data));
      return res.status(200).json({ success: true });
    }

    // --- HANDLE GET (FETCH) ---
    if (req.method === 'GET') {
      const data = await kv.get(storageKey);
      return res.status(200).json({ data });
    }

    // --- HANDLE DELETE (REMOVE) ---
    if (req.method === 'DELETE') {
      await kv.del(storageKey);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
