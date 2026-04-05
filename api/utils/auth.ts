import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.VITE_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_PUBLIC_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey 
    ? createClient(supabaseUrl, supabaseKey, { auth: { autoRefreshToken: false, persistSession: false } })
    : null;

// Cache for token verification
const tokenCache = new Map<string, { userId: string; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

interface AuthResult {
  userId: string;
  email?: string;
}

export async function verifyAuth(authHeader: string | undefined): Promise<AuthResult | null> {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  
  if (!token) return null;
  
  // Check cache first
  const cached = tokenCache.get(token);
  if (cached && cached.expiresAt > Date.now()) {
    return { userId: cached.userId };
  }
  
  try {
    console.log('[Auth] Verifying Supabase JWT...');
    
    if (!supabase) {
      console.log('[Auth] No Supabase client configured');
      return null;
    }
    
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (user && !error) {
      console.log('[Auth] Supabase verification succeeded for user:', user.id);
      
      // Look up the user in public.users by auth_user_id to get the actual userId used for data
      const { data: publicUser, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('auth_user_id', user.id)
        .maybeSingle();
      
      if (userError) {
        console.error('[Auth] Error looking up public user:', userError);
      }
      
      // Use the public.users id (which may be the old numeric ID) for data operations
      const actualUserId = publicUser?.id || user.id;
      console.log('[Auth] Public user ID:', actualUserId);
      
      // Cache the result
      tokenCache.set(token, { userId: actualUserId, expiresAt: Date.now() + CACHE_TTL_MS });
      return { 
        userId: actualUserId, 
        email: user.email ?? undefined 
      };
    } else {
      console.log('[Auth] Supabase verification failed:', error?.message);
      return null;
    }
  } catch (e) {
    console.error('[Auth] Token verification failed:', e);
    return null;
  }
}

export function clearAuthCache(token?: string): void {
  if (token) {
    tokenCache.delete(token);
  } else {
    tokenCache.clear();
  }
}
