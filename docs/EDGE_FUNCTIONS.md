# Supabase Edge Functions - Ready to Deploy

## user

```typescript
import { createClient } from 'npm:@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

Deno.serve(async (req) => {
  const { action, ...data } = await req.json()
  
  if (action === 'get-profile') {
    const { userId } = data
    
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }
    
    return new Response(JSON.stringify({ user }), { status: 200 })
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
        return new Response(JSON.stringify({ error: error.message }), { status: 500 })
      }
      return new Response(JSON.stringify({ user }), { status: 200 })
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
        return new Response(JSON.stringify({ error: error.message }), { status: 500 })
      }
      return new Response(JSON.stringify({ user }), { status: 200 })
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
      .select('settings')
      .maybeSingle()
    
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }
    
    return new Response(JSON.stringify({ settings: user?.settings || {} }), { status: 200 })
  }
  
  return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400 })
})
```

---

## spaces

```typescript
import { createClient } from 'npm:@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

Deno.serve(async (req) => {
  const { action, ...data } = await req.json()
  
  if (action === 'list') {
    const { userId } = data
    
    const { data: spaces, error } = await supabase
      .from('spaces')
      .select('*')
      .eq('user_id', userId)
      .order('order', { ascending: true })
    
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }
    
    return new Response(JSON.stringify({ spaces: spaces || [] }), { status: 200 })
  }
  
  if (action === 'get') {
    const { spaceId, userId } = data
    
    const { data: space, error } = await supabase
      .from('spaces')
      .select('*')
      .eq('id', spaceId)
      .eq('user_id', userId)
      .maybeSingle()
    
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }
    
    return new Response(JSON.stringify({ space }), { status: 200 })
  }
  
  if (action === 'create') {
    const { space } = data
    
    const { data: created, error } = await supabase
      .from('spaces')
      .insert(space)
      .select()
      .maybeSingle()
    
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }
    
    return new Response(JSON.stringify({ space: created }), { status: 200 })
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
      return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }
    
    return new Response(JSON.stringify({ space: updated }), { status: 200 })
  }
  
  if (action === 'delete') {
    const { spaceId } = data
    
    const { error } = await supabase
      .from('spaces')
      .delete()
      .eq('id', spaceId)
    
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }
    
    return new Response(JSON.stringify({ success: true }), { status: 200 })
  }
  
  return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400 })
})
```

---

## thoughts

```typescript
import { createClient } from 'npm:@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

Deno.serve(async (req) => {
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
    
    const { data: thoughts, error } = await query.order('order', { ascending: true })
    
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }
    
    return new Response(JSON.stringify({ thoughts: thoughts || [] }), { status: 200 })
  }
  
  if (action === 'get') {
    const { thoughtId } = data
    
    const { data: thought, error } = await supabase
      .from('thoughts')
      .select('*')
      .eq('id', thoughtId)
      .maybeSingle()
    
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }
    
    return new Response(JSON.stringify({ thought }), { status: 200 })
  }
  
  if (action === 'create') {
    const { thought } = data
    
    const { data: created, error } = await supabase
      .from('thoughts')
      .insert(thought)
      .select()
      .maybeSingle()
    
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }
    
    return new Response(JSON.stringify({ thought: created }), { status: 200 })
  }
  
  if (action === 'createMany') {
    const { thoughts } = data
    
    const { data: created, error } = await supabase
      .from('thoughts')
      .insert(thoughts)
      .select()
    
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }
    
    return new Response(JSON.stringify({ thoughts: created || [] }), { status: 200 })
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
      return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }
    
    return new Response(JSON.stringify({ thought: updated }), { status: 200 })
  }
  
  if (action === 'delete') {
    const { thoughtId } = data
    
    const { error } = await supabase
      .from('thoughts')
      .delete()
      .eq('id', thoughtId)
    
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }
    
    return new Response(JSON.stringify({ success: true }), { status: 200 })
  }
  
  if (action === 'deleteMany') {
    const { thoughtIds } = data
    
    const { error } = await supabase
      .from('thoughts')
      .delete()
      .in('id', thoughtIds)
    
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }
    
    return new Response(JSON.stringify({ success: true }), { status: 200 })
  }
  
  return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400 })
})
```

---

## stacks

```typescript
import { createClient } from 'npm:@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

Deno.serve(async (req) => {
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
      return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }
    
    return new Response(JSON.stringify({ stacks: stacks || [] }), { status: 200 })
  }
  
  if (action === 'create') {
    const { stack } = data
    
    const { data: created, error } = await supabase
      .from('stacks')
      .insert(stack)
      .select()
      .maybeSingle()
    
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }
    
    return new Response(JSON.stringify({ stack: created }), { status: 200 })
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
      return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }
    
    return new Response(JSON.stringify({ stack: updated }), { status: 200 })
  }
  
  if (action === 'delete') {
    const { stackId } = data
    
    const { error } = await supabase
      .from('stacks')
      .delete()
      .eq('id', stackId)
    
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }
    
    return new Response(JSON.stringify({ success: true }), { status: 200 })
  }
  
  return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400 })
})
```

---

## publish

```typescript
import { createClient } from 'npm:@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

Deno.serve(async (req) => {
  const { action, ...data } = await req.json()
  
  if (action === 'get') {
    const { publishedId } = data
    
    const { data: published, error } = await supabase
      .from('published_spaces')
      .select('*')
      .eq('id', publishedId)
      .maybeSingle()
    
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }
    
    return new Response(JSON.stringify({ published }), { status: 200 })
  }
  
  if (action === 'publish') {
    const { spaceId, userId, snapshot, expiresIn } = data
    
    const publishedId = crypto.randomUUID()
    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null
    
    const { data: published, error } = await supabase
      .from('published_spaces')
      .insert({
        id: publishedId,
        space_id: spaceId,
        user_id: userId,
        snapshot,
        expires_at: expiresAt
      })
      .select()
      .maybeSingle()
    
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }
    
    return new Response(JSON.stringify({ published }), { status: 200 })
  }
  
  if (action === 'unpublish') {
    const { publishedId } = data
    
    const { error } = await supabase
      .from('published_spaces')
      .delete()
      .eq('id', publishedId)
    
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }
    
    return new Response(JSON.stringify({ success: true }), { status: 200 })
  }
  
  return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400 })
})
```

---

## feedback

```typescript
import { createClient } from 'npm:@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

Deno.serve(async (req) => {
  const { action, ...data } = await req.json()
  
  if (action === 'list') {
    const { userId } = data
    
    const { data: feedback, error } = await supabase
      .from('feedback')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }
    
    return new Response(JSON.stringify({ feedback: feedback || [] }), { status: 200 })
  }
  
  if (action === 'create') {
    const { userId, type, content, metadata } = data
    
    const { data: created, error } = await supabase
      .from('feedback')
      .insert({
        user_id: userId,
        type,
        content,
        metadata: metadata || {}
      })
      .select()
      .maybeSingle()
    
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }
    
    return new Response(JSON.stringify({ feedback: created }), { status: 200 })
  }
  
  if (action === 'delete') {
    const { feedbackId } = data
    
    const { error } = await supabase
      .from('feedback')
      .delete()
      .eq('id', feedbackId)
    
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }
    
    return new Response(JSON.stringify({ success: true }), { status: 200 })
  }
  
  return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400 })
})
```

---

## payments

```typescript
import { createClient } from 'npm:@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

Deno.serve(async (req) => {
  const { action, ...data } = await req.json()
  
  if (action === 'create') {
    const { userId, paymentRef, amount, currency, metadata } = data
    
    const { data: payment, error } = await supabase
      .from('payments')
      .insert({
        user_id: userId,
        payment_ref: paymentRef,
        amount,
        currency: currency || 'USD',
        metadata: metadata || {}
      })
      .select()
      .maybeSingle()
    
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }
    
    return new Response(JSON.stringify({ payment }), { status: 200 })
  }
  
  if (action === 'get') {
    const { paymentRef } = data
    
    const { data: payment, error } = await supabase
      .from('payments')
      .select('*')
      .eq('payment_ref', paymentRef)
      .maybeSingle()
    
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }
    
    return new Response(JSON.stringify({ payment }), { status: 200 })
  }
  
  if (action === 'update-status') {
    const { paymentId, status } = data
    
    const { data: updated, error } = await supabase
      .from('payments')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', paymentId)
      .select()
      .maybeSingle()
    
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }
    
    return new Response(JSON.stringify({ payment: updated }), { status: 200 })
  }
  
  if (action === 'list') {
    const { userId } = data
    
    const { data: payments, error } = await supabase
      .from('payments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }
    
    return new Response(JSON.stringify({ payments: payments || [] }), { status: 200 })
  }
  
  return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400 })
})
```

---

## admin

```typescript
import { createClient } from 'npm:@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

Deno.serve(async (req) => {
  const { action, ...data } = await req.json()
  
  const adminKey = req.headers.get('x-admin-key')
  if (adminKey !== Deno.env.get('ADMIN_SECRET_KEY')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }
  
  if (action === 'stats') {
    const { count: totalUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
    
    const { count: totalThoughts } = await supabase
      .from('thoughts')
      .select('*', { count: 'exact', head: true })
    
    const { count: totalSpaces } = await supabase
      .from('spaces')
      .select('*', { count: 'exact', head: true })
    
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count: dau } = await supabase
      .from('thoughts')
      .select('*', { count: 'exact', head: true })
      .gte('updated_at', yesterday)
    
    const { data: usersByPlan } = await supabase
      .from('users')
      .select('plan')
    
    const planCounts = usersByPlan?.reduce((acc, u) => {
      acc[u.plan || 'free'] = (acc[u.plan || 'free'] || 0) + 1
      return acc
    }, {} as Record<string, number>) || {}
    
    return new Response(JSON.stringify({
      stats: { totalUsers, totalThoughts, totalSpaces, dau, planCounts }
    }), { status: 200 })
  }
  
  if (action === 'users') {
    const { limit = 50, offset = 0 } = data
    
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
    
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }
    
    return new Response(JSON.stringify({ users: users || [] }), { status: 200 })
  }
  
  if (action === 'export-users') {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, name, plan, subscription_status, created_at, updated_at')
    
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }
    
    const headers = ['id', 'email', 'name', 'plan', 'subscription_status', 'created_at', 'updated_at']
    const csv = [
      headers.join(','),
      ...(users || []).map(u => headers.map(h => `"${u[h as keyof typeof u] || ''}"`).join(','))
    ].join('\n')
    
    return new Response(csv, {
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename=users.csv' }
    })
  }
  
  return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400 })
})
```

---

## Summary

| Function | Actions |
|----------|---------|
| user | get-profile, upsert-profile, update-settings |
| spaces | list, get, create, update, delete |
| thoughts | list, get, create, createMany, update, delete, deleteMany |
| stacks | list, create, update, delete |
| publish | get, publish, unpublish |
| feedback | list, create, delete |
| payments | create, get, update-status, list |
| admin | stats, users, export-users |
