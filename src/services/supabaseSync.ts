import { supabase } from './supabase'

export { supabase }

function toSnakeCase(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (Array.isArray(obj)) return obj.map(toSnakeCase)
  if (typeof obj !== 'object') return obj
  
  const result: any = {}
  for (const key in obj) {
    let value = obj[key]
    if (key === 'date' && (value === '' || value === undefined)) {
      value = null
    }
    // Skip local-only fields
    if (key === 'isOnboarding') {
      continue
    }
    const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase()
    result[snakeKey] = toSnakeCase(value)
  }
  return result
}

function toCamelCase(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (Array.isArray(obj)) return obj.map(toCamelCase)
  if (typeof obj !== 'object') return obj
  
  const result: any = {}
  for (const key in obj) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
    result[camelKey] = toCamelCase(obj[key])
  }
  return result
}

export const supabaseSync = {
  async getProfile(userId: string) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    if (error) {
      console.error('[Supabase] getProfile error:', error.message)
      throw new Error(error.message)
    }
    return { user: toCamelCase(data) }
  },

  async upsertProfile(userId: string, email: string, name: string, avatar: string) {
    const { data, error } = await supabase
      .from('users')
      .upsert({ id: userId, email, name, avatar }, { onConflict: 'id' })
      .select()
      .maybeSingle()
    if (error) {
      console.error('[Supabase] upsertProfile error:', error.message)
      throw new Error(error.message)
    }
    console.log('[Supabase] upsertProfile success:', data)
    return { user: toCamelCase(data) }
  },

  async updateSettings(userId: string, settings: Record<string, unknown>) {
    const { data: current } = await supabase.from('users').select('settings').eq('id', userId).maybeSingle()
    const mergedSettings = { ...(current?.settings || {}), ...settings }
    
    // Build update payload
    const updatePayload: Record<string, unknown> = { 
      settings: mergedSettings, 
      updated_at: new Date().toISOString() 
    }
    
    // Also update auto_sync as separate column if provided
    if (settings.autoSync !== undefined) {
      updatePayload.auto_sync = settings.autoSync
    }
    
    const { data, error } = await supabase
      .from('users')
      .update(updatePayload)
      .eq('id', userId)
      .select()
      .maybeSingle()
    if (error) {
      console.error('[Supabase] updateSettings error:', error.message)
      throw new Error(error.message)
    }
    return { user: toCamelCase(data) }
  },

  async getSpaces(userId: string) {
    const { data, error } = await supabase
      .from('spaces')
      .select('*')
      .eq('user_id', userId)
      .order('order')
    if (error) {
      console.error('[Supabase] getSpaces error:', error.message)
      throw new Error(error.message)
    }
    console.log('[Supabase] getSpaces:', data?.length, 'spaces')
    const spaces = (data || []).map(s => toCamelCase({ ...s, id: s.local_id || s.id }))
    return { spaces }
  },

  async createSpace(userId: string, space: Record<string, unknown>) {
    const clean = toSnakeCase({ ...space, local_id: space.id, user_id: userId })
    delete clean.id
    delete clean.last_published  // Remove - stored in published_spaces table
    const { data, error } = await supabase
      .from('spaces')
      .upsert(clean, { onConflict: 'local_id,user_id' })
      .select()
      .maybeSingle()
    if (error) {
      console.error('[Supabase] createSpace error:', error.message, 'payload:', clean)
      throw new Error(error.message)
    }
    console.log('[Supabase] createSpace success:', data?.id, 'local_id:', data?.local_id)
    return { space: data }
  },

  async createSpaces(spaces: Record<string, unknown>[], userId: string) {
    const records = spaces.map(s => {
      const clean = toSnakeCase({ ...s, local_id: s.id, user_id: userId })
      delete clean.id
      delete clean.last_published  // Remove - stored in published_spaces table
      return clean
    })
    const { data, error } = await supabase
      .from('spaces')
      .upsert(records, { onConflict: 'local_id,user_id' })
      .select()
    if (error) {
      console.error('[Supabase] createSpaces error:', error.message)
      throw new Error(error.message)
    }
    console.log('[Supabase] createSpaces success:', data?.length, 'spaces')
    return { spaces: data }
  },

  async updateSpace(spaceId: string, updates: Record<string, unknown>, userId: string) {
    const clean = toSnakeCase(updates)
    const { data: found, error: findError } = await supabase
      .from('spaces')
      .select('id,local_id')
      .eq('local_id', spaceId)
      .eq('user_id', userId)
      .maybeSingle()
    if (findError || !found) {
      return { space: null }
    }
    const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const [key, value] of Object.entries(clean)) {
      if (key !== 'id' && key !== 'local_id' && key !== 'user_id' && key !== 'last_published') {
        updatePayload[key] = value
      }
    }
    const { data, error } = await supabase
      .from('spaces')
      .update(updatePayload)
      .eq('id', found.id)
      .select()
      .maybeSingle()
    if (error) {
      console.error('[Supabase] updateSpace error:', error.message)
      throw new Error(error.message)
    }
    return { space: data }
  },

  async deleteSpace(spaceId: string, userId: string) {
    const { data: found } = await supabase
      .from('spaces')
      .select('id')
      .eq('local_id', spaceId)
      .eq('user_id', userId)
      .maybeSingle()
    if (!found) {
      return { success: true }
    }
    const { error } = await supabase.from('spaces').delete().eq('id', found.id)
    if (error) {
      console.error('[Supabase] deleteSpace error:', error.message)
      throw new Error(error.message)
    }
    return { success: true }
  },

  async getThoughts(userId: string, spaceId?: string) {
    let query = supabase.from('thoughts').select('*').eq('user_id', userId)
    if (spaceId) query = query.eq('space_id', spaceId)
    const { data, error } = await query
    if (error) {
      console.error('[Supabase] getThoughts error:', error.message)
      throw new Error(error.message)
    }
    console.log('[Supabase] getThoughts:', data?.length, 'thoughts')
    const thoughts = (data || []).map(t => toCamelCase({ ...t, id: t.local_id || t.id }))
    return { thoughts }
  },

  async createThought(userId: string, thought: Record<string, unknown>) {
    const clean = toSnakeCase({ ...thought, local_id: thought.id, user_id: userId })
    delete clean.id
    const { data, error } = await supabase
      .from('thoughts')
      .upsert(clean, { onConflict: 'local_id,user_id' })
      .select()
      .maybeSingle()
    if (error) {
      console.error('[Supabase] createThought error:', error.message, 'payload:', clean)
      throw new Error(error.message)
    }
    console.log('[Supabase] createThought success:', data?.id, 'local_id:', data?.local_id)
    return { thought: data }
  },

  async createThoughts(thoughts: Record<string, unknown>[]) {
    const records = thoughts.map(t => {
      const clean = toSnakeCase({ ...t, local_id: t.id })
      delete clean.id
      return clean
    })
    const { data, error } = await supabase.from('thoughts').upsert(records, { onConflict: 'local_id,user_id' }).select()
    if (error) {
      console.error('[Supabase] createThoughts error:', error.message)
      throw new Error(error.message)
    }
    return { thoughts: data }
  },

  async updateThought(thoughtId: number | string, updates: Record<string, unknown>, userId: string) {
    const clean = toSnakeCase(updates)
    const numericId = typeof thoughtId === 'string' ? parseInt(thoughtId, 10) : thoughtId
    const { data: found, error: findError } = await supabase
      .from('thoughts')
      .select('id,local_id')
      .eq('local_id', numericId)
      .eq('user_id', userId)
      .maybeSingle()
    if (findError || !found) {
      return { thought: null }
    }
    const uuidValue = found.id
    const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const [key, value] of Object.entries(clean)) {
      if (key !== 'id' && key !== 'local_id' && key !== 'user_id' && key !== 'last_published') {
        updatePayload[key] = value
      }
    }
    const { data, error } = await supabase
      .from('thoughts')
      .update(updatePayload)
      .eq('id', uuidValue)
      .select()
      .maybeSingle()
    if (error) {
      console.error('[Supabase] updateThought error:', error.message)
      throw new Error(error.message)
    }
    return { thought: data }
  },

  async deleteThought(thoughtId: number | string, userId: string) {
    const numericId = typeof thoughtId === 'string' ? parseInt(thoughtId, 10) : thoughtId
    const { data: found } = await supabase
      .from('thoughts')
      .select('id')
      .eq('local_id', numericId)
      .eq('user_id', userId)
      .maybeSingle()
    if (!found) {
      console.log('[Supabase] deleteThought: thought not found for local_id:', thoughtId)
      return { success: true }
    }
    const { error } = await supabase.from('thoughts').delete().eq('id', found.id)
    if (error) {
      console.error('[Supabase] deleteThought error:', error.message)
      throw new Error(error.message)
    }
    return { success: true }
  },

  async deleteThoughts(thoughtIds: (number | string)[], userId: string) {
    const numericIds = thoughtIds.map(id => typeof id === 'string' ? parseInt(id, 10) : id)
    const { data: found } = await supabase
      .from('thoughts')
      .select('id,local_id')
      .eq('user_id', userId)
      .in('local_id', numericIds)
    if (!found || found.length === 0) {
      return { success: true }
    }
    const { error } = await supabase.from('thoughts').delete().in('id', found.map(f => f.id))
    if (error) {
      console.error('[Supabase] deleteThoughts error:', error.message)
      throw new Error(error.message)
    }
    return { success: true }
  },

  async getStacks(userId: string, spaceId?: string) {
    let query = supabase.from('stacks').select('*').eq('user_id', userId)
    if (spaceId) query = query.eq('space_id', spaceId)
    const { data, error } = await query
    if (error) {
      console.error('[Supabase] getStacks error:', error.message)
      throw new Error(error.message)
    }
    console.log('[Supabase] getStacks:', data?.length, 'stacks')
    const stacks = (data || []).map(s => toCamelCase({ ...s, id: s.local_id || s.id }))
    return { stacks }
  },

  async createStack(userId: string, stack: Record<string, unknown>) {
    const clean = toSnakeCase({ ...stack, local_id: stack.id, user_id: userId })
    delete clean.id
    const { data, error } = await supabase
      .from('stacks')
      .upsert(clean, { onConflict: 'local_id,user_id' })
      .select()
      .maybeSingle()
    if (error) {
      console.error('[Supabase] createStack error:', error.message, 'payload:', clean)
      throw new Error(error.message)
    }
    console.log('[Supabase] createStack success:', data?.id, 'local_id:', data?.local_id)
    return { stack: data }
  },

  async createStacks(stacks: Record<string, unknown>[], userId: string) {
    const records = stacks.map(s => {
      const clean = toSnakeCase({ ...s, local_id: s.id, user_id: userId })
      delete clean.id
      return clean
    })
    const { data, error } = await supabase
      .from('stacks')
      .upsert(records, { onConflict: 'local_id,user_id' })
      .select()
    if (error) {
      console.error('[Supabase] createStacks error:', error.message)
      throw new Error(error.message)
    }
    console.log('[Supabase] createStacks success:', data?.length, 'stacks')
    return { stacks: data }
  },

  async updateStack(stackId: string, updates: Record<string, unknown>, userId: string) {
    const clean = toSnakeCase(updates)
    const { data: found, error: findError } = await supabase
      .from('stacks')
      .select('id,local_id')
      .eq('local_id', stackId)
      .eq('user_id', userId)
      .maybeSingle()
    if (findError || !found) {
      return { stack: null }
    }
    const updatePayload: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(clean)) {
      if (key !== 'id' && key !== 'local_id' && key !== 'user_id' && key !== 'last_published') {
        updatePayload[key] = value
      }
    }
    const { data, error } = await supabase
      .from('stacks')
      .update(updatePayload)
      .eq('id', found.id)
      .select()
      .maybeSingle()
    if (error) {
      console.error('[Supabase] updateStack error:', error.message)
      throw new Error(error.message)
    }
    return { stack: data }
  },

  async deleteStack(stackId: string, userId: string) {
    const { data: found } = await supabase
      .from('stacks')
      .select('id')
      .eq('local_id', stackId)
      .eq('user_id', userId)
      .maybeSingle()
    if (!found) {
      return { success: true }
    }
    const { error } = await supabase.from('stacks').delete().eq('id', found.id)
    if (error) {
      console.error('[Supabase] deleteStack error:', error.message)
      throw new Error(error.message)
    }
    return { success: true }
  },

  async publishSpace(spaceId: string, userId: string, snapshot: Record<string, unknown>, expiresIn?: number) {
    const { data: space } = await supabase.from('spaces').select('id').eq('local_id', spaceId).maybeSingle()
    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data, error } = await supabase
      .from('published_spaces')
      .insert({ space_id: space?.id, user_id: userId, snapshot, expires_at: expiresAt })
      .select()
      .maybeSingle()
    if (error) {
      console.error('[Supabase] publishSpace error:', error.message)
      throw new Error(error.message)
    }
    return { publishedId: data?.id, published: data }
  },

  async getPublishedSpace(publishedId: string) {
    const { data, error } = await supabase
      .from('published_spaces')
      .select('snapshot')
      .eq('id', publishedId)
      .maybeSingle()
    if (error || !data) throw new Error('Not found')
    return { snapshot: data.snapshot }
  },

  async unpublishSpace(publishedId: string) {
    const { error } = await supabase.from('published_spaces').delete().eq('id', publishedId)
    if (error) {
      console.error('[Supabase] unpublishSpace error:', error.message)
      throw new Error(error.message)
    }
    return { success: true }
  },

  async submitFeedback(userId: string, type: string, content: string, metadata?: Record<string, unknown>) {
    const { data, error } = await supabase
      .from('feedback')
      .insert({ user_id: userId, type, content, metadata: metadata || {} })
      .select()
      .maybeSingle()
    if (error) {
      console.error('[Supabase] submitFeedback error:', error.message)
      throw new Error(error.message)
    }
    return { feedback: data }
  },

  async getFeedback(userId: string) {
    const { data, error } = await supabase
      .from('feedback')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) {
      console.error('[Supabase] getFeedback error:', error.message)
      throw new Error(error.message)
    }
    return { feedback: data || [] }
  },

  async getAdminStats(_adminKey: string) {
    const [usersCount, spacesCount, thoughtsCount] = await Promise.all([
      supabase.from('users').select('id', { count: 'exact', head: true }),
      supabase.from('spaces').select('id', { count: 'exact', head: true }),
      supabase.from('thoughts').select('id', { count: 'exact', head: true })
    ])
    return {
      users: usersCount.count,
      spaces: spacesCount.count,
      thoughts: thoughtsCount.count
    }
  }
}
