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

  const adminKey = req.headers.get('x-admin-key')
  const expectedKey = Deno.env.get('FEEDBACK_ADMIN_PASSWORD')
  
  if (adminKey !== expectedKey) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
  }

  const { action } = await req.json()
  
  if (action === 'stats') {
    const [usersCount, spacesCount, thoughtsCount, feedbackCount] = await Promise.all([
      supabase.from('users').select('id', { count: 'exact', head: true }),
      supabase.from('spaces').select('id', { count: 'exact', head: true }),
      supabase.from('thoughts').select('id', { count: 'exact', head: true }),
      supabase.from('feedback').select('id', { count: 'exact', head: true })
    ])
    
    return new Response(JSON.stringify({ 
      users: usersCount.count,
      spaces: spacesCount.count,
      thoughts: thoughtsCount.count,
      feedback: feedbackCount.count
    }), { status: 200, headers: corsHeaders })
  }

  return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: corsHeaders })
})
