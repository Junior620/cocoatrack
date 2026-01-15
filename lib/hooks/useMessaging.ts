// CocoaTrack V2 - Messaging Hook
// Hook for managing conversations and messages with realtime updates

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { RealtimeChannel } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/client';
import {
  listConversations,
  getConversation,
  listMessages,
  sendMessage,
  markConversationAsRead,
  getOrCreateDirectConversation,
  createGroupConversation,
  getMessageableUsers,
  type ConversationWithDetails,
  type MessageWithSender,
} from '@/lib/api/messaging';

// ============================================================================
// CONVERSATIONS HOOK
// ============================================================================

export interface UseConversationsOptions {
  realtime?: boolean;
  pageSize?: number;
}

export interface UseConversationsReturn {
  conversations: ConversationWithDetails[];
  total: number;
  page: number;
  totalPages: number;
  isLoading: boolean;
  error: Error | null;
  nextPage: () => void;
  prevPage: () => void;
  refresh: () => void;
  startDirectConversation: (userId: string) => Promise<string>;
  startGroupConversation: (name: string, userIds: string[]) => Promise<string>;
}

export function useConversations(
  options: UseConversationsOptions = {}
): UseConversationsReturn {
  const { realtime = true, pageSize = 20 } = options;
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const supabase = createClient();

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['conversations', { page, pageSize }],
    queryFn: () => listConversations({ page, pageSize }),
  });

  // Realtime subscription for new conversations
  useEffect(() => {
    if (!realtime) return;

    let channel: RealtimeChannel | null = null;

    const setupSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      channel = supabase
        .channel('conversations-realtime')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'conversations',
          },
          () => {
            // Refresh conversations on any change
            queryClient.invalidateQueries({ queryKey: ['conversations'] });
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
  }, [realtime, supabase, queryClient]);

  const startDirectMutation = useMutation({
    mutationFn: getOrCreateDirectConversation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  const startGroupMutation = useMutation({
    mutationFn: ({ name, userIds }: { name: string; userIds: string[] }) =>
      createGroupConversation(name, userIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  return {
    conversations: data?.data || [],
    total: data?.total || 0,
    page,
    totalPages: data?.totalPages || 1,
    isLoading,
    error: error as Error | null,
    nextPage: useCallback(() => {
      if (data && page < data.totalPages) setPage((p) => p + 1);
    }, [page, data]),
    prevPage: useCallback(() => {
      if (page > 1) setPage((p) => p - 1);
    }, [page]),
    refresh: refetch,
    startDirectConversation: useCallback(
      (userId: string) => startDirectMutation.mutateAsync(userId),
      [startDirectMutation]
    ),
    startGroupConversation: useCallback(
      (name: string, userIds: string[]) =>
        startGroupMutation.mutateAsync({ name, userIds }),
      [startGroupMutation]
    ),
  };
}

// ============================================================================
// MESSAGES HOOK
// ============================================================================

export interface UseMessagesOptions {
  conversationId: string;
  realtime?: boolean;
  pageSize?: number;
}

export interface UseMessagesReturn {
  messages: MessageWithSender[];
  conversation: ConversationWithDetails | null;
  total: number;
  page: number;
  totalPages: number;
  isLoading: boolean;
  error: Error | null;
  loadMore: () => void;
  send: (body: string) => Promise<void>;
  markAsRead: () => Promise<void>;
  refresh: () => void;
}

export function useMessages(options: UseMessagesOptions): UseMessagesReturn {
  const { conversationId, realtime = true, pageSize = 50 } = options;
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const supabase = createClient();

  // Query for conversation details
  const { data: conversation } = useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: () => getConversation(conversationId),
    enabled: !!conversationId,
  });

  // Query for messages
  const {
    data: messagesData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['messages', conversationId, { page, pageSize }],
    queryFn: () => listMessages({ conversationId, page, pageSize }),
    enabled: !!conversationId,
  });

  // Realtime subscription for new messages
  useEffect(() => {
    if (!realtime || !conversationId) return;

    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          // Add new message to cache
          queryClient.setQueryData(
            ['messages', conversationId, { page: 1, pageSize }],
            (old: typeof messagesData) => {
              if (!old) return old;
              return {
                ...old,
                data: [payload.new as MessageWithSender, ...old.data],
                total: old.total + 1,
              };
            }
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ['messages', conversationId],
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [realtime, conversationId, supabase, queryClient, pageSize]);

  // Mutation for sending messages
  const sendMutation = useMutation({
    mutationFn: (body: string) => sendMessage(conversationId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  // Mutation for marking as read
  const markAsReadMutation = useMutation({
    mutationFn: () => markConversationAsRead(conversationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  return {
    messages: messagesData?.data || [],
    conversation: conversation || null,
    total: messagesData?.total || 0,
    page,
    totalPages: messagesData?.totalPages || 1,
    isLoading,
    error: error as Error | null,
    loadMore: useCallback(() => {
      if (messagesData && page < messagesData.totalPages) {
        setPage((p) => p + 1);
      }
    }, [page, messagesData]),
    send: useCallback(
      async (body: string) => {
        await sendMutation.mutateAsync(body);
      },
      [sendMutation]
    ),
    markAsRead: useCallback(async () => {
      await markAsReadMutation.mutateAsync();
    }, [markAsReadMutation]),
    refresh: refetch,
  };
}

// ============================================================================
// MESSAGEABLE USERS HOOK
// ============================================================================

export function useMessageableUsers() {
  return useQuery({
    queryKey: ['messageable-users'],
    queryFn: getMessageableUsers,
  });
}
