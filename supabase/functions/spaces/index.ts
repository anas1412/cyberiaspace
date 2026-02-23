import { createClient } from 'npm:@supabase/supabase-js@2'

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
  
  if (action === 'list') {
    const { userId } = data
    
    const { data: spaces, error } = await supabase
      .from('spaces')
      .select('*')
      .eq('user_id', userId)
      .order('order')
    
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
    }
    
    return new Response(JSON.stringify({ spaces }), { status: 200, headers: corsHeaders })
  }
  
  if (action === 'create') {
    const { space } = data
    
    const { data: created, error } = await supabase
      .from('spaces')
      .insert(space)
      .select()
      .maybeSingle()
    
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
    }
    
    return new Response(JSON.stringify({ space: created }), { status: 200, headers: corsHeaders })
  }
  
  if (action === 'update') {
    const { spaceId, updates } = data
    
    const { data: updated, error } = await supabase
      .from('spaces')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', spaceId)
      .select()
      .maybeSingle()
    
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
    }
    
    return new Response(JSON.stringify({ space: updated }), { status: 200, headers: corsHeaders })
  }
  
  if (action === 'delete') {
    const { spaceId } = data
    
    const { error } = await supabase
      .from('spaces')
      .delete()
      .eq('id', spaceId)
    
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
    }
    
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders })
  }

  return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: corsHeaders })
})
