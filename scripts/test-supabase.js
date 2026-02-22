const SUPABASE_URL = 'https://mbgndtydoioewbynukbv.supabase.co'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1iZ25kdHlkb2lvZXdieW51a2J2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3NzQ4NjAsImV4cCI6MjA4NzM1MDg2MH0.X4X4beSTrrlUqTiCnP-QSqHrn27JuvGyqqYtiSNWlQo'

const userId = 'test-user-' + Date.now() // Unique user each run
const testEmail = `test-${Date.now()}@test.com`

async function invoke(functionName, body) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })
  const data = await res.json()
  console.log(`[${functionName}]`, res.ok ? '✅' : '❌', body.action || '', data.error || (data.user || data.space || data.thought || data.stacks || 'OK'))
  return data
}

async function test() {
  console.log('\n🧪 Testing Supabase Edge Functions')
  console.log('User ID:', userId, '\n')

  // First create the user
  console.log('--- CREATE USER ---')
  await invoke('user', { action: 'upsert-profile', userId, email: testEmail, name: 'Test User' })

  // Test user
  console.log('\n--- USER ---')
  await invoke('user', { action: 'get-profile', userId })
  await invoke('user', { action: 'update-settings', userId, settings: { theme: 'cyberia' } })

  // Test spaces
  console.log('\n--- SPACES ---')
  const space = { id: 'space-1', user_id: userId, name: 'My Space', mode: 'spatial' }
  await invoke('spaces', { action: 'create', space })
  await invoke('spaces', { action: 'list', userId })
  await invoke('spaces', { action: 'get', spaceId: 'space-1', userId })
  await invoke('spaces', { action: 'update', spaceId: 'space-1', updates: { name: 'Updated Space' } })

  // Test stacks
  console.log('\n--- STACKS ---')
  const stack = { id: 'stack-1', user_id: userId, space_id: 'space-1', name: 'My Stack', color: '#ff0000' }
  await invoke('stacks', { action: 'create', stack })
  await invoke('stacks', { action: 'list', userId, spaceId: 'space-1' })

  // Test thoughts
  console.log('\n--- THOUGHTS ---')
  const thought = { 
    user_id: userId, space_id: 'space-1', stack_id: 'stack-1',
    x: 100, y: 200, text: 'Test Thought', type: 'text', content: 'Hello world'
  }
  await invoke('thoughts', { action: 'create', thought })
  await invoke('thoughts', { action: 'list', userId, spaceId: 'space-1' })

  // Test publish
  console.log('\n--- PUBLISH ---')
  await invoke('publish', { action: 'publish', spaceId: 'space-1', userId, snapshot: { test: true }, expiresIn: 3600 })

  // Test feedback
  console.log('\n--- FEEDBACK ---')
  await invoke('feedback', { action: 'create', userId, type: 'bug', content: 'Test feedback' })
  await invoke('feedback', { action: 'list', userId })

  // Test payments
  console.log('\n--- PAYMENTS ---')
  await invoke('payments', { action: 'create', userId, paymentRef: 'pay_' + Date.now(), amount: 999 })
  await invoke('payments', { action: 'list', userId })

  console.log('\n✅ All tests completed!\n')
}

test()
