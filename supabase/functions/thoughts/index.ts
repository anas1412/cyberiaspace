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
      .from('thoughts')
      .select('*')
      .eq('user_id', userId)
    
    if (spaceId) {
      query = query.eq('space_id', spaceId)
    }
    
    const { data: thoughts, error } = await query
    
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
    }
    
    return new Response(JSON.stringify({ thoughts }), { status: 200, headers: corsHeaders })
  }
  
  if (action === 'create') {
    const { thought } = data
    
    const { data: created, error } = await supabase
      .from('thoughts')
      .insert(thought)
      .select()
      .maybeSingle()
    
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
    }
    
    return new Response(JSON.stringify({ thought: created }), { status: 200, headers: corsHeaders })
  }
  
  if (action === 'createMany') {
    const { thoughts } = data
    
    const { data: created, error } = await supabase
      .from('thoughts')
      .insert(thoughts)
      .select()
    
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
    }
    
    return new Response(JSON.stringify({ thoughts: created }), { status: 200, headers: corsHeaders })
  }
  
  if (action === 'update') {
    const { thoughtId, updates } = data
    
    const { data: updated, error } = await supabase
      .from('thoughts')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', thoughtId)
      .select()
      .maybeSingle()
    
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
    }
    
    return new Response(JSON.stringify({ thought: updated }), { status: 200, headers: corsHeaders })
  }
  
  if (action === 'delete') {
    const { thoughtId } = data
    
    const { error } = await supabase
      .from('thoughts')
      .delete()
      .eq('id', thoughtId)
    
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
    }
    
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders })
  }
  
  if (action === 'deleteMany') {
    const { thoughtIds } = data
    
    const { error } = await supabase
      .from('thoughts')
      .delete()
      .in('id', thoughtIds)
    
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
    }
    
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders })
  }

  return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: corsHeaders })
})
