// CocoaTrack V2 - Notifications Hook
// Hook for managing notifications with realtime updates

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { RealtimeChannel } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/client';
import {
  listNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadNotificationCount,
  deleteNotification,
  type NotificationListParams,
} from '@/lib/api/notifications';
import type { Notification } from '@/types/database.gen';

export interface UseNotificationsOptions {
  /** Enable realtime updates */
  realtime?: boolean;
  /** Only fetch unread notifications */
  unreadOnly?: boolean;
  /** Page size for pagination */
  pageSize?: number;
}

export interface UseNotificationsReturn {
  /** List of notifications */
  notifications: Notification[];
  /** Total count of notifications */
  total: number;
  /** Count of unread notifications */
  unreadCount: number;
  /** Current page */
  page: number;
  /** Total pages */
  totalPages: number;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Go to next page */
  nextPage: () => void;
  /** Go to previous page */
  prevPage: () => void;
  /** Go to specific page */
  goToPage: (page: number) => void;
  /** Mark a notification as read */
  markAsRead: (id: string) => Promise<void>;
  /** Mark all notifications as read */
  markAllAsRead: () => Promise<void>;
  /** Delete a notification */
  remove: (id: string) => Promise<void>;
  /** Refresh notifications */
  refresh: () => void;
}

export function useNotifications(
  options: UseNotificationsOptions = {}
): UseNotificationsReturn {
  const { realtime = true, unreadOnly = false, pageSize = 20 } = options;
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const supabase = createClient();

  // Query for notifications list
  const {
    data: notificationsData,
    isLoading: isLoadingNotifications,
    error: notificationsError,
    refetch: refetchNotifications,
  } = useQuery({
    queryKey: ['notifications', { page, pageSize, unreadOnly }],
    queryFn: () => listNotifications({ page, pageSize, unreadOnly }),
  });

  // Query for unread count
  const {
    data: unreadCount = 0,
    refetch: refetchUnreadCount,
  } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: getUnreadNotificationCount,
  });

  // Mutation for marking as read
  const markAsReadMutation = useMutation({
    mutationFn: markNotificationAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Mutation for marking all as read
  const markAllAsReadMutation = useMutation({
    mutationFn: markAllNotificationsAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Mutation for deleting
  const deleteMutation = useMutation({
    mutationFn: deleteNotification,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Setup realtime subscription
  useEffect(() => {
    if (!realtime) return;

    let channel: RealtimeChannel | null = null;

    const setupSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      channel = supabase
        .channel('notifications-realtime')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            // Add new notification to the cache
            queryClient.setQueryData(
              ['notifications', { page: 1, pageSize, unreadOnly }],
              (old: typeof notificationsData) => {
                if (!old) return old;
                return {
                  ...old,
                  data: [payload.new as Notification, ...old.data.slice(0, pageSize - 1)],
                  total: old.total + 1,
                };
              }
            );
            // Update unread count
            queryClient.setQueryData(
              ['notifications', 'unread-count'],
              (old: number) => (old || 0) + 1
            );
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            // Update notification in cache
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            // Refresh on delete
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
          }
        )
        .subscribe();
    };

    setupSubscription();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [realtime, supabase, queryClient, pageSize, unreadOnly]);

  const nextPage = useCallback(() => {
    if (notificationsData && page < notificationsData.totalPages) {
      setPage((p) => p + 1);
    }
  }, [page, notificationsData]);

  const prevPage = useCallback(() => {
    if (page > 1) {
      setPage((p) => p - 1);
    }
  }, [page]);

  const goToPage = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  const markAsRead = useCallback(
    async (id: string) => {
      await markAsReadMutation.mutateAsync(id);
    },
    [markAsReadMutation]
  );

  const markAllAsRead = useCallback(async () => {
    await markAllAsReadMutation.mutateAsync();
  }, [markAllAsReadMutation]);

  const remove = useCallback(
    async (id: string) => {
      await deleteMutation.mutateAsync(id);
    },
    [deleteMutation]
  );

  const refresh = useCallback(() => {
    refetchNotifications();
    refetchUnreadCount();
  }, [refetchNotifications, refetchUnreadCount]);

  return {
    notifications: notificationsData?.data || [],
    total: notificationsData?.total || 0,
    unreadCount,
    page,
    totalPages: notificationsData?.totalPages || 1,
    isLoading: isLoadingNotifications,
    error: notificationsError as Error | null,
    nextPage,
    prevPage,
    goToPage,
    markAsRead,
    markAllAsRead,
    remove,
    refresh,
  };
}

/**
 * Hook for just the unread notification count
 * Useful for displaying badge counts without loading full notifications
 */
export function useUnreadNotificationCount(options: { realtime?: boolean } = {}) {
  const { realtime = true } = options;
  const queryClient = useQueryClient();
  const supabase = createClient();

  const { data: count = 0, isLoading, refetch } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: getUnreadNotificationCount,
    refetchInterval: realtime ? false : 30000, // Poll every 30s if realtime is disabled
  });

  // Setup realtime subscription for count updates
  useEffect(() => {
    if (!realtime) return;

    let channel: RealtimeChannel | null = null;

    const setupSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      channel = supabase
        .channel('notifications-count')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            // Refetch count on any change
            refetch();
          }
        )
        .subscribe();
    };

    setupSubscription();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [realtime, supabase, refetch]);

  return { count, isLoading, refetch };
}
