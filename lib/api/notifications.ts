// CocoaTrack V2 - Notifications API
// API functions for managing notifications

import { createClient } from '@/lib/supabase/client';
import type { Notification } from '@/types/database.gen';

export type NotificationWithSender = Notification & {
  sender?: {
    id: string;
    full_name: string;
    email: string;
  } | null;
};

export interface NotificationListParams {
  page?: number;
  pageSize?: number;
  unreadOnly?: boolean;
}

export interface NotificationListResult {
  data: Notification[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Fetches notifications for the current user
 */
export async function listNotifications(
  params: NotificationListParams = {}
): Promise<NotificationListResult> {
  const { page = 1, pageSize = 20, unreadOnly = false } = params;
  const supabase = createClient();

  let query = supabase
    .from('notifications')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (unreadOnly) {
    query = query.is('read_at', null);
  }

  // Apply pagination
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Failed to fetch notifications: ${error.message}`);
  }

  return {
    data: (data || []) as Notification[],
    total: count || 0,
    page,
    pageSize,
    totalPages: Math.ceil((count || 0) / pageSize),
  };
}

/**
 * Gets a single notification by ID
 */
export async function getNotification(id: string): Promise<Notification | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to fetch notification: ${error.message}`);
  }

  return data as Notification;
}

/**
 * Marks a notification as read
 */
export async function markNotificationAsRead(id: string): Promise<boolean> {
  const supabase = createClient();

  const { data, error } = await (supabase.rpc as unknown as (
    fn: string,
    args: Record<string, unknown>
  ) => Promise<{ data: boolean | null; error: Error | null }>)(
    'mark_notification_read',
    { p_notification_id: id }
  );

  if (error) {
    throw new Error(`Failed to mark notification as read: ${error.message}`);
  }

  return data ?? false;
}

/**
 * Marks all notifications as read for the current user
 */
export async function markAllNotificationsAsRead(): Promise<number> {
  const supabase = createClient();

  const { data, error } = await (supabase.rpc as unknown as (
    fn: string
  ) => Promise<{ data: number | null; error: Error | null }>)(
    'mark_all_notifications_read'
  );

  if (error) {
    throw new Error(`Failed to mark all notifications as read: ${error.message}`);
  }

  return data ?? 0;
}

/**
 * Gets the count of unread notifications
 */
export async function getUnreadNotificationCount(): Promise<number> {
  const supabase = createClient();

  const { data, error } = await (supabase.rpc as unknown as (
    fn: string
  ) => Promise<{ data: number | null; error: Error | null }>)(
    'get_unread_notification_count'
  );

  if (error) {
    throw new Error(`Failed to get unread count: ${error.message}`);
  }

  return data || 0;
}

/**
 * Deletes a notification
 */
export async function deleteNotification(id: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase.from('notifications').delete().eq('id', id);

  if (error) {
    throw new Error(`Failed to delete notification: ${error.message}`);
  }
}

/**
 * Deletes all read notifications for the current user
 */
export async function deleteReadNotifications(): Promise<number> {
  const supabase = createClient();

  // First count, then delete
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .not('read_at', 'is', null);

  const { error } = await supabase
    .from('notifications')
    .delete()
    .not('read_at', 'is', null);

  if (error) {
    throw new Error(`Failed to delete read notifications: ${error.message}`);
  }

  return count || 0;
}
