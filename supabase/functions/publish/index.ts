import { createClient } from 'npm:@supabase/supabase-js@2'
import { randomUUID } from 'npm:uuid@9'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!

const supabase = createClient(supabaseUrl, supabaseKey)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const { action, ...data } = await req.json()
  
  if (action === 'publish') {
    const { spaceId, userId, snapshot, expiresIn } = data
    
    const publishedId = randomUUID()
    const expiresAt = expiresIn 
      ? new Date(Date.now() + expiresIn * 1000).toISOString()
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    
    const { data: published, error } = await supabase
      .from('published_spaces')
      .insert({
        id: publishedId,
        space_id: spaceId,
        user_id: userId,
        snapshot,
        expires_at: expiresAt
      })
      .select()
      .maybeSingle()
    
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
    }
    
    return new Response(JSON.stringify({ publishedId, published }), { status: 200, headers: corsHeaders })
  }
  
  if (action === 'get') {
    const { publishedId } = data
    
    const { data: published, error } = await supabase
      .from('published_spaces')
      .select('snapshot')
      .eq('id', publishedId)
      .maybeSingle()
    
    if (error || !published) {
      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: corsHeaders })
    }
    
    return new Response(JSON.stringify({ snapshot: published.snapshot }), { status: 200, headers: corsHeaders })
  }
  
  if (action === 'unpublish') {
    const { publishedId } = data
    
    const { error } = await supabase
      .from('published_spaces')
      .delete()
      .eq('id', publishedId)
    
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
    }
    
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders })
  }

  return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: corsHeaders })
})
