import { createClient } from 'npm:@supabase/supabase-js'

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
  const adminKey = req.headers.get('x-admin-key')
  const expectedKey = Deno.env.get('FEEDBACK_ADMIN_PASSWORD')
  const isAdmin = adminKey === expectedKey
  
  if (action === 'create') {
    const { userId, type, content, metadata } = data
    
    const { data: feedback, error } = await supabase
      .from('feedback')
      .insert({
        user_id: userId,
        type,
        content,
        metadata: metadata || {},
        status: 'todo'
      })
      .select()
      .maybeSingle()
    
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
    }
    
    return new Response(JSON.stringify({ feedback }), { status: 200, headers: corsHeaders })
  }
  
  if (action === 'list') {
    const { userId } = data
    
    const { data: feedback, error } = await supabase
      .from('feedback')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100)
    
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
    }
    
    return new Response(JSON.stringify({ feedback }), { status: 200, headers: corsHeaders })
  }

  if (action === 'listAll' && isAdmin) {
    const { status, limit = 50, offset = 0 } = data
    
    let query = supabase
      .from('feedback')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
    
    if (status && status !== 'all') {
      query = query.eq('status', status)
    }
    
    const { data: feedback, error } = await query
    
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
    }
    
    return new Response(JSON.stringify({ feedback }), { status: 200, headers: corsHeaders })
  }

  if (action === 'updateStatus' && isAdmin) {
    const { feedbackId, status } = data
    
    const { data: feedback, error } = await supabase
      .from('feedback')
      .update({ status })
      .eq('id', feedbackId)
      .select()
      .maybeSingle()
    
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
    }
    
    return new Response(JSON.stringify({ feedback }), { status: 200, headers: corsHeaders })
  }

  if (action === 'reply' && isAdmin) {
    const { feedbackId, adminReply } = data
    
    const { data: feedback, error } = await supabase
      .from('feedback')
      .update({ 
        admin_reply: adminReply,
        admin_reply_at: new Date().toISOString()
      })
      .eq('id', feedbackId)
      .select()
      .maybeSingle()
    
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
    }
    
    return new Response(JSON.stringify({ feedback }), { status: 200, headers: corsHeaders })
  }

  if (action === 'delete' && isAdmin) {
    const { feedbackId } = data
    
    const { error } = await supabase
      .from('feedback')
      .delete()
      .eq('id', feedbackId)
    
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
    }
    
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders })
  }

  return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: corsHeaders })
})
