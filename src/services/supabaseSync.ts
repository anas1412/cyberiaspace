import { supabase } from './supabase'
import { sanitizeStatus, sanitizePriority } from '../utils/thought'

export { supabase }

export function toSnakeCase(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (Array.isArray(obj)) return obj.map(toSnakeCase)
  if (typeof obj !== 'object') return obj
  
  const result: any = {}
  
  for (const key in obj) {
    // Skip local-only synchronization metadata and spatial properties
    if (
      key === 'syncStatus' ||
      key === 'retryCount' ||
      key === 'isOnboarding' ||
      key === 'data' ||
      key === 'date' ||
      key === 'publishedId' ||
      key === 'x' || key === 'y' || key === 'vx' || key === 'vy'
    ) {
      continue
    }

    let value = obj[key]
    
    // GATEKEEPER: Ensure date fields are never raw numbers when sending to Supabase
    const dateKeys = ['createdAt', 'updatedAt', 'created_at', 'updated_at', 'last_published', 'lastPublished', 'expiryDate', 'expiry_date', 'startTime', 'endTime', 'start_time', 'end_time'];
    if (dateKeys.includes(key)) {
      if (typeof value === 'number') {
        value = new Date(value).toISOString();
      }
    }

    if (key === 'startTime' && (value === '' || value === undefined)) {
      value = null
    }

    const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase()
    result[snakeKey] = toSnakeCase(value)
  }

  // SPECIAL HANDLING: Spaces Transform JSONB
  if ('transformX' in obj || 'transformY' in obj || 'transformScale' in obj) {
    result.transform = {
      x: obj.transformX ?? 0,
      y: obj.transformY ?? 0,
      scale: obj.transformScale ?? 1
    };
    delete result.transform_x;
    delete result.transform_y;
    delete result.transform_scale;
  }

  // SPECIAL HANDLING: Thought Data Modular Payload
  // Map 'data' properties to flat database columns
  if (obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data)) {
    const d = obj.data;
    if (d.type === 'text' && d.content) result.content = d.content;
    else if (d.type === 'tasks') result.tasks = toSnakeCase(d.tasks);
    else if (d.type === 'table') result.table = toSnakeCase(d.rows);
    else if (d.type === 'paint') result.drawing = d.drawing;
    else if (d.type === 'embed') result.content = d.url;
    else if (d.type === 'file') {
      result.storage_url = d.url;
      result.meta = toSnakeCase(d.meta);
    }
  }

  return result
}

export function toCamelCase(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (Array.isArray(obj)) return obj.map(toCamelCase)
  if (typeof obj !== 'object') return obj
  
  const result: any = {}
  
  for (const key in obj) {
    // Skip raw special columns that we reconstruct later
    if (key === 'transform' || key === 'tasks' || key === 'table' || key === 'drawing') continue;

    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
    result[camelKey] = toCamelCase(obj[key])
  }

  // Sanitize status and priority
  if (result.status !== undefined) result.status = sanitizeStatus(result.status);
  if (result.priority !== undefined) result.priority = sanitizePriority(result.priority);
  
  // Handle timestamp conversion
  const timestampKeys = ['updatedAt', 'deletedAt', 'archivedAt', 'startTime', 'endTime'];
  timestampKeys.forEach(key => {
    if (result[key] && typeof result[key] === 'string') {
      result[key] = new Date(result[key]).getTime();
    }
  });

  // SPECIAL HANDLING: Spaces Transform JSONB
  if (obj.transform && typeof obj.transform === 'object' && !Array.isArray(obj.transform)) {
    result.transformX = obj.transform.x ?? 0;
    result.transformY = obj.transform.y ?? 0;
    result.transformScale = obj.transform.scale ?? 1;
  }

  // SPECIAL HANDLING: Thought Data Reconstruction
  // Use 'result' properties because they are already camelCased
  const type = result.type;
  if (type) {
    if (type === 'text') result.data = { type: 'text', content: result.content || '' };
    else if (type === 'tasks') result.data = { type: 'tasks', tasks: obj.tasks || [] };
    else if (type === 'table') result.data = { type: 'table', rows: obj.table || [] };
    else if (type === 'paint') result.data = { type: 'paint', drawing: obj.drawing || '' };
    else if (type === 'embed') result.data = { type: 'embed', url: result.content || '' };
    else if (type === 'file') result.data = { type: 'file', url: result.storageUrl || '', name: result.text || '', size: result.meta?.size || 0, meta: result.meta };
    else if (type === 'label') result.data = { type: 'label' };

    // Provide default spatial values if missing (new device hydration)
    if (result.x === undefined) result.x = (typeof window !== 'undefined' ? window.innerWidth / 2 : 500);
    if (result.y === undefined) result.y = (typeof window !== 'undefined' ? window.innerHeight / 2 : 500);
    if (result.vx === undefined) result.vx = 0;
    if (result.vy === undefined) result.vy = 0;
  }

  // Final cleanup of redundant content fields
  if ((type === 'text' || type === 'embed') && result.content !== undefined) {
    delete result.content;
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
    delete clean.published_id
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
      delete clean.published_id
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
      if (key !== 'id' && key !== 'user_id' && key !== 'last_published' && key !== 'published_id') {
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
