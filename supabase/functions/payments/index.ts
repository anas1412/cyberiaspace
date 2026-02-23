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
  
  if (action === 'create') {
    const { userId, paymentRef, amount, currency, status, metadata } = data
    
    const { data: payment, error } = await supabase
      .from('payments')
      .insert({
        user_id: userId,
        payment_ref: paymentRef,
        amount,
        currency,
        status,
        metadata: metadata || {}
      })
      .select()
      .maybeSingle()
    
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
    }
    
    return new Response(JSON.stringify({ payment }), { status: 200, headers: corsHeaders })
  }
  
  if (action === 'update-status') {
    const { paymentRef, status } = data
    
    const { data: payment, error } = await supabase
      .from('payments')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('payment_ref', paymentRef)
      .select()
      .maybeSingle()
    
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
    }
    
    return new Response(JSON.stringify({ payment }), { status: 200, headers: corsHeaders })
  }
  
  if (action === 'list') {
    const { userId } = data
    
    const { data: payments, error } = await supabase
      .from('payments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
    }
    
    return new Response(JSON.stringify({ payments }), { status: 200, headers: corsHeaders })
  }

  return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: corsHeaders })
})
