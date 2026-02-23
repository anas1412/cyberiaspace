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
  
  if (action === 'get-profile') {
    const { userId } = data
    
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
    }
    
    return new Response(JSON.stringify({ user }), { status: 200, headers: corsHeaders })
  }
  
  if (action === 'upsert-profile') {
    const { userId, email, name, avatar } = data
    
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .maybeSingle()
    
    if (existing) {
      const { data: user, error } = await supabase
        .from('users')
        .update({
          name: name || null,
          avatar: avatar || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .maybeSingle()
      
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
      }
      return new Response(JSON.stringify({ user }), { status: 200, headers: corsHeaders })
    } else {
      const { data: user, error } = await supabase
        .from('users')
        .insert({
          id: userId,
          email: email || '',
          name: name || '',
          avatar: avatar || ''
        })
        .select()
        .maybeSingle()
      
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
      }
      return new Response(JSON.stringify({ user }), { status: 200, headers: corsHeaders })
    }
  }
  
  if (action === 'update-settings') {
    const { userId, settings } = data
    
    const { data: current } = await supabase
      .from('users')
      .select('settings')
      .eq('id', userId)
      .maybeSingle()
    
    const mergedSettings = { ...(current?.settings || {}), ...settings }
    
    const { data: user, error } = await supabase
      .from('users')
      .update({ 
        settings: mergedSettings,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .maybeSingle()
    
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
    }
    
    return new Response(JSON.stringify({ user }), { status: 200, headers: corsHeaders })
  }

  return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: corsHeaders })
})
