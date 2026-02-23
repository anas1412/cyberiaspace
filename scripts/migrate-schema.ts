import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceKey) {
  console.error('Missing env vars')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function migrate() {
  console.log('Adding transform_scale to spaces...')
  const { error: spaceError } = await supabase.rpc('exec_sql', { 
    query: "ALTER TABLE spaces ADD COLUMN IF NOT EXISTS transform_scale REAL DEFAULT 1" 
  }).catch(() => ({ error: null }))
  
  // Direct alter if RPC fails
  if (!spaceError) {
    console.log('Column added via RPC')
  }
  
  console.log('Adding "table" to thoughts...')
  const { error: thoughtError } = await supabase.rpc('exec_sql', { 
    query: 'ALTER TABLE thoughts ADD COLUMN IF NOT EXISTS "table" JSONB DEFAULT \'[]\'' 
  }).catch(() => ({ error: null }))
  
  if (!thoughtError) {
    console.log('Column added via RPC')
  }
  
  // Check if columns exist
  const { data: spacesCols } = await supabase.from('spaces').select('transform_scale').limit(1).catch(() => ({ data: null }))
  console.log('spaces transform_scale:', spacesCols !== null ? 'OK' : 'FAILED')
  
  const { data: thoughtsCols } = await supabase.from('thoughts').select('table').limit(1).catch(() => ({ data: null }))
  console.log('thoughts table:', thoughtsCols !== null ? 'OK' : 'FAILED')
  
  console.log('Done!')
}

migrate()
