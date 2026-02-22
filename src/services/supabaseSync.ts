import { invokeFunction } from './supabase'

export const supabaseSync = {
  // User operations
  async getProfile(userId: string) {
    return invokeFunction('user', { action: 'get-profile', userId })
  },

  async upsertProfile(userId: string, email: string, name: string, avatar: string) {
    return invokeFunction('user', { action: 'upsert-profile', userId, email, name, avatar })
  },

  async updateSettings(userId: string, settings: Record<string, unknown>) {
    return invokeFunction('user', { action: 'update-settings', userId, settings })
  },

  // Space operations
  async getSpaces(userId: string) {
    return invokeFunction('spaces', { action: 'list', userId })
  },

  async createSpace(space: Record<string, unknown>) {
    return invokeFunction('spaces', { action: 'create', space })
  },

  async updateSpace(spaceId: string, updates: Record<string, unknown>) {
    return invokeFunction('spaces', { action: 'update', spaceId, updates })
  },

  async deleteSpace(spaceId: string) {
    return invokeFunction('spaces', { action: 'delete', spaceId })
  },

  // Thought operations
  async getThoughts(userId: string, spaceId?: string) {
    return invokeFunction('thoughts', { action: 'list', userId, spaceId })
  },

  async createThought(thought: Record<string, unknown>) {
    return invokeFunction('thoughts', { action: 'create', thought })
  },

  async createThoughts(thoughts: Record<string, unknown>[]) {
    return invokeFunction('thoughts', { action: 'createMany', thoughts })
  },

  async updateThought(thoughtId: number, updates: Record<string, unknown>) {
    return invokeFunction('thoughts', { action: 'update', thoughtId, updates })
  },

  async deleteThought(thoughtId: number) {
    return invokeFunction('thoughts', { action: 'delete', thoughtId })
  },

  async deleteThoughts(thoughtIds: number[]) {
    return invokeFunction('thoughts', { action: 'deleteMany', thoughtIds })
  },

  // Stack operations
  async getStacks(userId: string, spaceId?: string) {
    return invokeFunction('stacks', { action: 'list', userId, spaceId })
  },

  async createStack(stack: Record<string, unknown>) {
    return invokeFunction('stacks', { action: 'create', stack })
  },

  async updateStack(stackId: string, updates: Record<string, unknown>) {
    return invokeFunction('stacks', { action: 'update', stackId, updates })
  },

  async deleteStack(stackId: string) {
    return invokeFunction('stacks', { action: 'delete', stackId })
  },

  // Publish operations
  async publishSpace(spaceId: string, userId: string, snapshot: Record<string, unknown>, expiresIn?: number) {
    return invokeFunction('publish', { action: 'publish', spaceId, userId, snapshot, expiresIn })
  },

  async getPublishedSpace(publishedId: string) {
    return invokeFunction('publish', { action: 'get', publishedId })
  },

  async unpublishSpace(publishedId: string) {
    return invokeFunction('publish', { action: 'unpublish', publishedId })
  },

  // Feedback
  async submitFeedback(userId: string, type: string, content: string, metadata?: Record<string, unknown>) {
    return invokeFunction('feedback', { action: 'create', userId, type, content, metadata })
  },

  async getFeedback(userId: string) {
    return invokeFunction('feedback', { action: 'list', userId })
  },

  // Admin
  async getAdminStats(adminKey: string) {
    const res = await fetch('https://mbgndtydoioewbynukbv.supabase.co/functions/v1/admin', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'x-admin-key': adminKey
      },
      body: JSON.stringify({ action: 'stats' })
    })
    return res.json()
  }
}
