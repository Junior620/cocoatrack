// CocoaTrack V2 - Messaging API
// API functions for conversations and messages
// @ts-nocheck - Types need to be regenerated from Supabase

import { createClient } from '@/lib/supabase/client';
import type { Conversation, Message, Profile } from '@/types/database.gen';

// ============================================================================
// TYPES
// ============================================================================

export interface ConversationWithDetails extends Conversation {
  participants_details?: Pick<Profile, 'id' | 'full_name' | 'email'>[];
  last_message?: Message | null;
  unread_count?: number;
}

export interface MessageWithSender extends Message {
  sender?: Pick<Profile, 'id' | 'full_name' | 'email'> | null;
}

export interface ConversationListParams {
  page?: number;
  pageSize?: number;
}

export interface ConversationListResult {
  data: ConversationWithDetails[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface MessageListParams {
  conversationId: string;
  page?: number;
  pageSize?: number;
}

export interface MessageListResult {
  data: MessageWithSender[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ============================================================================
// CONVERSATIONS
// ============================================================================

/**
 * Lists conversations for the current user
 */
export async function listConversations(
  params: ConversationListParams = {}
): Promise<ConversationListResult> {
  const { page = 1, pageSize = 20 } = params;
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  // Get conversations where user is a participant
  const { data: conversations, error, count } = await supabase
    .from('conversations')
    .select('*', { count: 'exact' })
    .contains('participants', [user.id])
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (error) {
    throw new Error(`Failed to fetch conversations: ${error.message}`);
  }

  // Enrich with participant details and last message
  const enrichedConversations = await Promise.all(
    (conversations || []).map(async (conv) => {
      // Get participant details
      const { data: participants } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', conv.participants);

      // Get last message
      const { data: lastMessages } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: false })
        .limit(1);

      // Get unread count
      const { count: unreadCount } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', conv.id)
        .not('read_by', 'cs', `{${user.id}}`);

      return {
        ...conv,
        participants_details: participants || [],
        last_message: lastMessages?.[0] || null,
        unread_count: unreadCount || 0,
      };
    })
  );

  return {
    data: enrichedConversations,
    total: count || 0,
    page,
    pageSize,
    totalPages: Math.ceil((count || 0) / pageSize),
  };
}

/**
 * Gets a single conversation by ID
 */
export async function getConversation(id: string): Promise<ConversationWithDetails | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data: conversation, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to fetch conversation: ${error.message}`);
  }

  // Get participant details
  const { data: participants } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('id', conversation.participants);

  return {
    ...conversation,
    participants_details: participants || [],
  };
}

/**
 * Creates or gets a direct conversation with another user
 */
export async function getOrCreateDirectConversation(
  otherUserId: string
): Promise<string> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc('get_or_create_direct_conversation', {
    p_other_user_id: otherUserId,
  });

  if (error) {
    throw new Error(`Failed to create conversation: ${error.message}`);
  }

  return data;
}

/**
 * Creates a group conversation
 */
export async function createGroupConversation(
  name: string,
  participantIds: string[]
): Promise<string> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc('create_group_conversation', {
    p_name: name,
    p_participant_ids: participantIds,
  });

  if (error) {
    throw new Error(`Failed to create group conversation: ${error.message}`);
  }

  return data;
}

/**
 * Adds a participant to a group conversation
 */
export async function addConversationParticipant(
  conversationId: string,
  userId: string
): Promise<boolean> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc('add_conversation_participant', {
    p_conversation_id: conversationId,
    p_user_id: userId,
  });

  if (error) {
    throw new Error(`Failed to add participant: ${error.message}`);
  }

  return data;
}

// ============================================================================
// MESSAGES
// ============================================================================

/**
 * Lists messages in a conversation
 */
export async function listMessages(
  params: MessageListParams
): Promise<MessageListResult> {
  const { conversationId, page = 1, pageSize = 50 } = params;
  const supabase = createClient();

  const { data: messages, error, count } = await supabase
    .from('messages')
    .select('*', { count: 'exact' })
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (error) {
    throw new Error(`Failed to fetch messages: ${error.message}`);
  }

  // Get sender details for all messages
  const senderIds = [...new Set((messages || []).map((m) => m.sender_id))];
  const { data: senders } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('id', senderIds);

  const senderMap = new Map(senders?.map((s) => [s.id, s]) || []);

  const enrichedMessages = (messages || []).map((msg) => ({
    ...msg,
    sender: senderMap.get(msg.sender_id) || null,
  }));

  return {
    data: enrichedMessages,
    total: count || 0,
    page,
    pageSize,
    totalPages: Math.ceil((count || 0) / pageSize),
  };
}

/**
 * Sends a message to a conversation
 */
export async function sendMessage(
  conversationId: string,
  body: string,
  attachments?: Record<string, unknown>[]
): Promise<Message> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      body,
      attachments: attachments || null,
      read_by: [user.id], // Sender has read their own message
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to send message: ${error.message}`);
  }

  return data;
}

/**
 * Marks all messages in a conversation as read
 */
export async function markConversationAsRead(conversationId: string): Promise<number> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc('mark_conversation_read', {
    p_conversation_id: conversationId,
  });

  if (error) {
    throw new Error(`Failed to mark conversation as read: ${error.message}`);
  }

  return data;
}

/**
 * Deletes a message (only sender can delete)
 */
export async function deleteMessage(messageId: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from('messages')
    .delete()
    .eq('id', messageId);

  if (error) {
    throw new Error(`Failed to delete message: ${error.message}`);
  }
}

/**
 * Gets users that can be messaged (for starting new conversations)
 */
export async function getMessageableUsers(): Promise<Pick<Profile, 'id' | 'full_name' | 'email'>[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  // Get all active users except current user
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('is_active', true)
    .neq('id', user.id)
    .order('full_name');

  if (error) {
    throw new Error(`Failed to fetch users: ${error.message}`);
  }

  return data || [];
}
