// CocoaTrack V2 - Push Notifications API
// API functions for managing push notification subscriptions

import { createClient } from '@/lib/supabase/client';
import type { Database, PushSubscription } from '@/types/database.gen';

/**
 * Converts a PushSubscription to the format needed for storage
 */
function serializeSubscription(subscription: globalThis.PushSubscription) {
  const json = subscription.toJSON();
  return {
    endpoint: subscription.endpoint,
    p256dh: json.keys?.p256dh || '',
    auth: json.keys?.auth || '',
  };
}

/**
 * Saves a push subscription to the database
 */
export async function savePushSubscription(
  subscription: globalThis.PushSubscription
): Promise<PushSubscription> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  const serialized = serializeSubscription(subscription);

  const insertData: Database['public']['Tables']['push_subscriptions']['Insert'] = {
    user_id: user.id,
    endpoint: serialized.endpoint,
    p256dh: serialized.p256dh,
    auth: serialized.auth,
    user_agent: navigator.userAgent,
  };

  const { data, error } = await (supabase
    .from('push_subscriptions') as unknown as {
      upsert: (data: Database['public']['Tables']['push_subscriptions']['Insert'], options: { onConflict: string }) => {
        select: () => { single: () => Promise<{ data: PushSubscription | null; error: Error | null }> }
      }
    })
    .upsert(insertData, { onConflict: 'user_id,endpoint' })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save push subscription: ${error.message}`);
  }

  return data as PushSubscription;
}

/**
 * Removes a push subscription from the database
 */
export async function removePushSubscription(endpoint: string): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', user.id)
    .eq('endpoint', endpoint);

  if (error) {
    throw new Error(`Failed to remove push subscription: ${error.message}`);
  }
}

/**
 * Gets all push subscriptions for the current user
 */
export async function getUserPushSubscriptions(): Promise<PushSubscription[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', user.id);

  if (error) {
    throw new Error(`Failed to get push subscriptions: ${error.message}`);
  }

  return (data || []) as PushSubscription[];
}

/**
 * Checks if the current browser subscription is registered
 */
export async function isSubscriptionRegistered(
  subscription: globalThis.PushSubscription
): Promise<boolean> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return false;
  }

  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('id')
    .eq('user_id', user.id)
    .eq('endpoint', subscription.endpoint)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error checking subscription:', error);
    return false;
  }

  return !!data;
}
