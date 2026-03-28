import { SupabaseClient } from '@supabase/supabase-js';

export type SubscriptionStatus = 'none' | 'active' | 'past_due' | 'canceled' | 'expired';

export interface UserProfile {
  id: string;
  plan: 'free' | 'pro';
  subscription_status: SubscriptionStatus;
  expiry_date?: string;
  [key: string]: any;
}

/**
 * Checks if a user's Pro subscription has expired and updates the database if it has.
 * This is the "Lazy Healing" mechanism.
 */
export async function checkAndHealSubscription(user: UserProfile, supabase: SupabaseClient): Promise<UserProfile> {
  if (user.plan !== 'pro' || !user.expiry_date) {
    return user;
  }

  const expiryDate = new Date(user.expiry_date);
  const now = new Date();

  if (expiryDate < now) {
    console.log(`[Subscription Helper] User ${user.id} Pro plan expired on ${user.expiry_date}. Healing...`);
    
    const updatePayload = {
      plan: 'free',
      subscription_status: 'expired',
      updated_at: now.toISOString()
    };

    const { data: updatedUser, error } = await supabase
      .from('users')
      .update(updatePayload)
      .eq('id', user.id)
      .select()
      .single();

    if (error) {
      console.error(`[Subscription Helper] Failed to heal subscription for user ${user.id}:`, error);
      return user; // Return original user if update fails, we'll try again next time
    }

    console.log(`[Subscription Helper] User ${user.id} successfully healed to Free/Expired.`);
    return updatedUser as UserProfile;
  }

  return user;
}

/**
 * Maps Polar subscription status to Cyberia unified status machine.
 */
export function mapPolarStatus(status: string): SubscriptionStatus {
  switch (status) {
    case 'active':
    case 'trialing':
      return 'active';
    case 'canceled':
      return 'canceled';
    case 'past_due':
    case 'unpaid':
      return 'past_due';
    case 'incomplete_expired':
      return 'expired';
    default:
      return 'none';
  }
}
