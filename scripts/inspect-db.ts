
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.VITE_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase configuration');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
  console.log('--- Triggers on users table ---');
  const { data: triggers, error: triggerError } = await supabase.rpc('inspect_triggers', {}) || 
    await supabase.from('information_schema.triggers').select('trigger_name, event_manipulation, action_statement').eq('event_object_table', 'users');
  
  // Since I might not have the RPC, I'll use the query directly via supabase.postgrest if possible, 
  // but information_schema is usually restricted. 
  // However, I can try a raw query if the user has a custom RPC or just try the standard way.
  
  const { data: triggerData, error: err1 } = await supabase.from('information_schema.triggers')
    .select('trigger_name, event_manipulation, action_statement')
    .eq('event_object_table', 'users');
    
  if (err1) console.error('Error fetching triggers:', err1);
  else console.table(triggerData);

  console.log('\n--- Column defaults for users table ---');
  const { data: columnData, error: err2 } = await supabase.from('information_schema.columns')
    .select('column_name, column_default')
    .eq('table_name', 'users');

  if (err2) console.error('Error fetching column defaults:', err2);
  else {
    const planColumn = columnData?.find(c => c.column_name === 'plan');
    console.log('Plan column default:', planColumn);
    console.table(columnData);
  }
}

// Alternatively, use a raw SQL approach if possible via a known helper or just try-catch the above.
// Since information_schema might be tricky over Postgrest, I'll try to run it.
inspect();
