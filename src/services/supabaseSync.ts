import { supabase } from './supabase'

export { supabase }

export function toSnakeCase(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (Array.isArray(obj)) return obj.map(toSnakeCase)
  if (typeof obj !== 'object') return obj
  
  const result: any = {}
  for (const key in obj) {
    let value = obj[key]
    
    // GATEKEEPER: Ensure date fields are never raw numbers when sending to Supabase
    const dateKeys = ['date', 'createdAt', 'updatedAt', 'created_at', 'updated_at', 'last_published', 'lastPublished', 'expiryDate', 'expiry_date'];
    if (dateKeys.includes(key)) {
      if (typeof value === 'number') {
        value = new Date(value).toISOString();
      }
      // Special: Force 'date' to YYYY-MM-DD for thought nodes consistency
      if (key === 'date' && typeof value === 'string' && value.length > 10) {
        value = value.substring(0, 10);
      }
    }

    if (key === 'date' && (value === '' || value === undefined)) {
      value = null
    }
    // Skip local-only synchronization metadata
    if (key === 'syncStatus' || key === 'retryCount' || key === 'isOnboarding') {
      continue
    }
    const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase()
    result[snakeKey] = toSnakeCase(value)
  }
  return result
}

export function toCamelCase(obj: any): any {
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
      .select('id')
      .maybeSingle()
    if (error) {
      console.error('[Supabase] upsertProfile error:', error.message)
      throw new Error(error.message)
    }
    return { user: toCamelCase(data) }
  },

  async updateSettings(userId: string, settings: Record<string, unknown>) {
    const { data: current } = await supabase.from('users').select('settings').eq('id', userId).maybeSingle()
    // Ensure current settings are camelCased before merging to prevent duplicate keys (snake vs camel)
    const currentSettings = toCamelCase(current?.settings || {})
    const mergedSettings = { ...currentSettings, ...settings }
    
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
      .select('id')
      .maybeSingle()
    if (error) {
      console.error('[Supabase] updateSettings error:', error.message)
      throw new Error(error.message)
    }
    return { user: toCamelCase(data) }
  },

  async getSpaces(userId: string, columns: string = '*') {
    const { data, error } = await supabase
      .from('spaces')
      .select(columns)
      .eq('user_id', userId)
      .order('order')
    if (error) {
      console.error('[Supabase] getSpaces error:', error.message)
      throw new Error(error.message)
    }
    return { spaces: toCamelCase(data || []) }
  },

  async createSpace(userId: string, space: Record<string, unknown>) {
    const clean = toSnakeCase({ ...space, user_id: userId })
    delete clean.last_published
    const { data, error } = await supabase
      .from('spaces')
      .upsert(clean, { onConflict: 'id' })
      .select('id')
      .maybeSingle()
    if (error) {
      console.error('[Supabase] createSpace error:', error.message)
      throw new Error(error.message)
    }
    return { space: toCamelCase(data) }
  },

  async createSpaces(spaces: Record<string, unknown>[], userId: string) {
    const records = spaces.map(s => {
      const clean = toSnakeCase({ ...s, user_id: userId })
      delete clean.last_published
      return clean
    })
    const { data, error } = await supabase
      .from('spaces')
      .upsert(records, { onConflict: 'id' })
      .select('id')
    if (error) {
      console.error('[Supabase] createSpaces error:', error.message)
      throw new Error(error.message)
    }
    return { spaces: toCamelCase(data || []) }
  },

  async updateSpace(spaceId: string, updates: Record<string, unknown>, userId: string) {
    const clean = toSnakeCase(updates)
    const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const [key, value] of Object.entries(clean)) {
      if (key !== 'id' && key !== 'user_id' && key !== 'last_published') {
        updatePayload[key] = value
      }
    }
    const { data, error } = await supabase
      .from('spaces')
      .update(updatePayload)
      .eq('id', spaceId)
      .eq('user_id', userId)
      .select('id')
      .maybeSingle()
    if (error) {
      console.error('[Supabase] updateSpace error:', error.message)
      throw new Error(error.message)
    }
    return { space: toCamelCase(data) }
  },

  async deleteSpace(spaceId: string, userId: string) {
    const { error } = await supabase
      .from('spaces')
      .delete()
      .eq('id', spaceId)
      .eq('user_id', userId)
    if (error) {
      console.error('[Supabase] deleteSpace error:', error.message)
      throw new Error(error.message)
    }
    return { success: true }
  },

  async getThoughts(userId: string, columns: string = '*', spaceId?: string) {
    let query = supabase.from('thoughts').select(columns).eq('user_id', userId)
    if (spaceId) query = query.eq('space_id', spaceId)
    const { data, error } = await query
    if (error) {
      console.error('[Supabase] getThoughts error:', error.message)
      throw new Error(error.message)
    }
    return { thoughts: toCamelCase(data || []) }
  },

  async createThought(userId: string, thought: Record<string, unknown>) {
    const clean = toSnakeCase({ ...thought, user_id: userId })
    const { data, error } = await supabase
      .from('thoughts')
      .upsert(clean, { onConflict: 'id' })
      .select('id')
      .maybeSingle()
    if (error) {
      console.error('[Supabase] createThought error:', error.message)
      throw new Error(error.message)
    }
    return { thought: toCamelCase(data) }
  },

  async createThoughts(thoughts: Record<string, unknown>[]) {
    const records = thoughts.map(t => toSnakeCase(t))
    const { data, error } = await supabase
      .from('thoughts')
      .upsert(records, { onConflict: 'id' })
      .select('id')
    if (error) {
      console.error('[Supabase] createThoughts error:', error.message)
      throw new Error(error.message)
    }
    return { thoughts: toCamelCase(data || []) }
  },

  async updateThought(thoughtId: string, updates: Record<string, unknown>, userId: string) {
    const clean = toSnakeCase(updates)
    const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const [key, value] of Object.entries(clean)) {
      if (key !== 'id' && key !== 'user_id' && key !== 'last_published') {
        updatePayload[key] = value
      }
    }
    const { data, error } = await supabase
      .from('thoughts')
      .update(updatePayload)
      .eq('id', thoughtId)
      .eq('user_id', userId)
      .select('id')
      .maybeSingle()
    if (error) {
      cons
      console.error('[Supabase] updateThought error:', error.message)
      throw new Error(error.message)
    }
    return { thought: toCamelCase(data) }
  },

  async deleteThought(thoughtId: string, userId: string) {
    const { error } = await supabase
      .from('thoughts')
      .delete()
      .eq('id', thoughtId)
      .eq('user_id', userId)
    if (error) {
      console.error('[Supabase] deleteThought error:', error.message)
      throw new Error(error.message)
    }
    return { success: true }
  },

  async deleteThoughts(thoughtIds: string[], userId: string) {
    const { error } = await supabase
      .from('thoughts')
      .delete()
      .eq('user_id', userId)
      .in('id', thoughtIds)
    if (error) {
      console.error('[Supabase] deleteThoughts error:', error.message)
      throw new Error(error.message)
    }
    return { success: true }
  },

  async getStacks(userId: string, columns: string = '*', spaceId?: string) {
    let query = supabase.from('stacks').select(columns).eq('user_id', userId)
    if (spaceId) query = query.eq('space_id', spaceId)
    const { data, error } = await query
    if (error) {
      console.error('[Supabase] getStacks error:', error.message)
      throw new Error(error.message)
    }
    return { stacks: toCamelCase(data || []) }
  },

  async createStack(userId: string, stack: Record<string, unknown>) {
    const clean = toSnakeCase({ ...stack, user_id: userId })
    const { data, error } = await supabase
      .from('stacks')
      .upsert(clean, { onConflict: 'id' })
      .select('id')
      .maybeSingle()
    if (error) {
      console.error('[Supabase] createStack error:', error.message)
      throw new Error(error.message)
    }
    return { stack: toCamelCase(data) }
  },

  async createStacks(stacks: Record<string, unknown>[], userId: string) {
    const records = stacks.map(s => toSnakeCase({ ...s, user_id: userId }))
    const { data, error } = await supabase
      .from('stacks')
      .upsert(records, { onConflict: 'id' })
      .select('id')
    if (error) {
      console.error('[Supabase] createStacks error:', error.message)
      throw new Error(error.message)
    }
    return { stacks: toCamelCase(data || []) }
  },

  async updateStack(stackId: string, updates: Record<string, unknown>, userId: string) {
    const clean = toSnakeCase(updates)
    const updatePayload: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(clean)) {
      if (key !== 'id' && key !== 'user_id' && key !== 'last_published') {
        updatePayload[key] = value
      }
    }
    const { data, error } = await supabase
      .from('stacks')
      .update(updatePayload)
      .eq('id', stackId)
      .eq('user_id', userId)
      .select('id')
      .maybeSingle()
    if (error) {
      console.error('[Supabase] updateStack error:', error.message)
      throw new Error(error.message)
    }
    return { stack: toCamelCase(data) }
  },

  async deleteStack(stackId: string, userId: string) {
    const { error } = await supabase
      .from('stacks')
      .delete()
      .eq('id', stackId)
      .eq('user_id', userId)
    if (error) {
      console.error('[Supabase] deleteStack error:', error.message)
      throw new Error(error.message)
    }
    return { success: true }
  },

  async publishSpace(spaceId: string, userId: string, snapshot: Record<string, unknown>, expiresIn?: number) {
    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data, error } = await supabase
      .from('published_spaces')
      .insert({ space_id: spaceId, user_id: userId, snapshot, expires_at: expiresAt })
      .select('id')
      .maybeSingle()
    if (error) {
      console.error('[Supabase] publishSpace error:', error.message)
      throw new Error(error.message)
    }
    return { publishedId: data?.id, published: toCamelCase(data) }
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
      .select('id')
      .maybeSingle()
    if (error) {
      console.error('[Supabase] submitFeedback error:', error.message)
      throw new Error(error.message)
    }
    return { feedback: toCamelCase(data) }
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
    return { feedback: toCamelCase(data || []) }
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
