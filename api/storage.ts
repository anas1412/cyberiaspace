import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME!;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Get user session from authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { action, path, paths, fileType } = req.method === 'GET' ? req.query : req.body;

  try {
    switch (action) {
      case 'presign': {
        if (!path) return res.status(400).json({ error: 'Missing path' });
        
        // Security: Ensure the path starts with the userId
        if (!String(path).startsWith(user.id)) {
          return res.status(403).json({ error: 'Forbidden: Cannot upload outside user directory' });
        }

        const command = new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: String(path),
          ContentType: String(fileType || 'application/octet-stream'),
        });
        
        const url = await getSignedUrl(r2, command, { expiresIn: 3600 });
        return res.status(200).json({ url });
      }

      case 'delete': {
        if (!path) return res.status(400).json({ error: 'Missing path' });
        
        if (!String(path).startsWith(user.id)) {
          return res.status(403).json({ error: 'Forbidden' });
        }

        await r2.send(new DeleteObjectCommand({
          Bucket: BUCKET_NAME,
          Key: String(path),
        }));
        
        return res.status(200).json({ success: true });
      }

      case 'deleteBatch': {
        const batchPaths = Array.isArray(paths) ? paths : [];
        if (batchPaths.length === 0) return res.status(200).json({ success: true });

        // Filter and validate paths
        const validPaths = batchPaths.filter(p => String(p).startsWith(user.id));
        if (validPaths.length === 0) return res.status(403).json({ error: 'Forbidden or invalid paths' });

        await r2.send(new DeleteObjectsCommand({
          Bucket: BUCKET_NAME,
          Delete: {
            Objects: validPaths.map(p => ({ Key: String(p) })),
            Quiet: true,
          },
        }));

        return res.status(200).json({ success: true, count: validPaths.length });
      }

      case 'list': {
        // List user's directory
        const command = new ListObjectsV2Command({
          Bucket: BUCKET_NAME,
          Prefix: `${user.id}/`,
        });

        const response = await r2.send(command);
        const files = (response.Contents || []).map(f => ({
          path: f.Key,
          size: f.Size,
          lastModified: f.LastModified,
        }));

        return res.status(200).json({ files });
      }

      case 'usage': {
        // Calculate total usage for user
        let totalSize = 0;
        let isTruncated = true;
        let continuationToken: string | undefined = undefined;

        while (isTruncated) {
          const command: ListObjectsV2Command = new ListObjectsV2Command({
            Bucket: BUCKET_NAME,
            Prefix: `${user.id}/`,
            ContinuationToken: continuationToken,
          });

          const response = await r2.send(command);
          totalSize += (response.Contents || []).reduce((sum, f) => sum + (f.Size || 0), 0);
          isTruncated = response.IsTruncated || false;
          continuationToken = response.NextContinuationToken;
        }

        return res.status(200).json({ totalSize });
      }

      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (err: any) {
    console.error(`[Storage API] Error:`, err);
    return res.status(500).json({ error: err.message });
  }
}
