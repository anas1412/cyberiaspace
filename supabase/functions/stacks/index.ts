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
    const { userId, spaceId } = data
    
    let query = supabase
      .from('stacks')
      .select('*')
      .eq('user_id', userId)
    
    if (spaceId) {
      query = query.eq('space_id', spaceId)
    }
    
    const { data: stacks, error } = await query
    
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
    }
    
    return new Response(JSON.stringify({ stacks }), { status: 200, headers: corsHeaders })
  }
  
  if (action === 'create') {
    const { stack } = data
    
    const { data: created, error } = await supabase
      .from('stacks')
      .insert(stack)
      .select()
      .maybeSingle()
    
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
    }
    
    return new Response(JSON.stringify({ stack: created }), { status: 200, headers: corsHeaders })
  }
  
  if (action === 'update') {
    const { stackId, updates } = data
    
    const { data: updated, error } = await supabase
      .from('stacks')
      .update(updates)
      .eq('id', stackId)
      .select()
      .maybeSingle()
    
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
    }
    
    return new Response(JSON.stringify({ stack: updated }), { status: 200, headers: corsHeaders })
  }
  
  if (action === 'delete') {
    const { stackId } = data
    
    const { error } = await supabase
      .from('stacks')
      .delete()
      .eq('id', stackId)
    
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
    }
    
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders })
  }

  return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: corsHeaders })
})
