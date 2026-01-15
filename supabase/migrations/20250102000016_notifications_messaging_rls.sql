-- CocoaTrack V2 - Notifications & Messaging RLS Policies
-- This migration adds RLS policies for notifications, conversations, and messages tables
-- Also adds push_subscriptions table for web push notifications

-- ============================================================================
-- PUSH SUBSCRIPTIONS TABLE
-- Stores web push notification subscriptions for each user
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

-- Index for fast lookup by user
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON public.push_subscriptions(user_id);

-- Updated_at trigger for push_subscriptions
CREATE TRIGGER update_push_subscriptions_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- NOTIFICATION TYPE ENUM (for better categorization)
-- ============================================================================
DO $$ BEGIN
  CREATE TYPE public.notification_type AS ENUM (
    'delivery_created',
    'delivery_updated',
    'chef_planteur_validated',
    'chef_planteur_rejected',
    'invoice_generated',
    'message_received',
    'system'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add notification_type column if not exists (we'll use the existing type column)
-- The existing 'type' column is TEXT, which is flexible enough

-- ============================================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================================
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- NOTIFICATIONS RLS POLICIES
-- Users can only see their own notifications
-- ============================================================================

-- SELECT: Users can only view their own notifications
CREATE POLICY "Users can view their own notifications"
  ON public.notifications
  FOR SELECT
  USING (user_id = auth.uid());

-- INSERT: System can create notifications for any user (via triggers/functions)
-- Users cannot directly insert notifications
CREATE POLICY "System can create notifications"
  ON public.notifications
  FOR INSERT
  WITH CHECK (
    -- Only allow if the current user is creating a notification for themselves
    -- OR if it's a system operation (no auth context)
    user_id = auth.uid() OR auth.uid() IS NULL
  );

-- UPDATE: Users can only update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications"
  ON public.notifications
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- DELETE: Users can delete their own notifications
CREATE POLICY "Users can delete their own notifications"
  ON public.notifications
  FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================================
-- CONVERSATIONS RLS POLICIES
-- Users can only see conversations they are participants of
-- ============================================================================

-- SELECT: Users can view conversations they participate in
CREATE POLICY "Users can view their conversations"
  ON public.conversations
  FOR SELECT
  USING (auth.uid() = ANY(participants));

-- INSERT: Any authenticated user can create a conversation
CREATE POLICY "Authenticated users can create conversations"
  ON public.conversations
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = created_by
    AND auth.uid() = ANY(participants)
  );

-- UPDATE: Only conversation creator or admin can update
CREATE POLICY "Conversation creator or admin can update"
  ON public.conversations
  FOR UPDATE
  USING (
    created_by = auth.uid() 
    OR public.is_admin()
  )
  WITH CHECK (
    created_by = auth.uid() 
    OR public.is_admin()
  );

-- DELETE: Only admin can delete conversations
CREATE POLICY "Only admin can delete conversations"
  ON public.conversations
  FOR DELETE
  USING (public.is_admin());

-- ============================================================================
-- MESSAGES RLS POLICIES
-- Users can only see messages in conversations they participate in
-- ============================================================================

-- SELECT: Users can view messages in their conversations
CREATE POLICY "Users can view messages in their conversations"
  ON public.messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
      AND auth.uid() = ANY(c.participants)
    )
  );

-- INSERT: Users can send messages to conversations they participate in
CREATE POLICY "Users can send messages to their conversations"
  ON public.messages
  FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
      AND auth.uid() = ANY(c.participants)
    )
  );

-- UPDATE: Users can update their own messages (edit) or mark as read
CREATE POLICY "Users can update messages"
  ON public.messages
  FOR UPDATE
  USING (
    -- Can update own messages
    sender_id = auth.uid()
    OR
    -- Can mark messages as read in their conversations
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
      AND auth.uid() = ANY(c.participants)
    )
  )
  WITH CHECK (
    sender_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
      AND auth.uid() = ANY(c.participants)
    )
  );

-- DELETE: Users can only delete their own messages
CREATE POLICY "Users can delete their own messages"
  ON public.messages
  FOR DELETE
  USING (sender_id = auth.uid());

-- ============================================================================
-- PUSH SUBSCRIPTIONS RLS POLICIES
-- Users can only manage their own push subscriptions
-- ============================================================================

-- SELECT: Users can view their own subscriptions
CREATE POLICY "Users can view their own push subscriptions"
  ON public.push_subscriptions
  FOR SELECT
  USING (user_id = auth.uid());

-- INSERT: Users can create their own subscriptions
CREATE POLICY "Users can create their own push subscriptions"
  ON public.push_subscriptions
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- UPDATE: Users can update their own subscriptions
CREATE POLICY "Users can update their own push subscriptions"
  ON public.push_subscriptions
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- DELETE: Users can delete their own subscriptions
CREATE POLICY "Users can delete their own push subscriptions"
  ON public.push_subscriptions
  FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================================
-- HELPER FUNCTIONS FOR NOTIFICATIONS
-- ============================================================================

-- Function to create a notification for a user
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_body TEXT DEFAULT NULL,
  p_payload JSONB DEFAULT NULL
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, payload)
  VALUES (p_user_id, p_type, p_title, p_body, p_payload)
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql;

-- Function to mark notification as read
CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  UPDATE public.notifications
  SET read_at = NOW()
  WHERE id = p_notification_id
  AND user_id = auth.uid()
  AND read_at IS NULL;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to mark all notifications as read for current user
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS INTEGER
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.notifications
  SET read_at = NOW()
  WHERE user_id = auth.uid()
  AND read_at IS NULL;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get unread notification count for current user
CREATE OR REPLACE FUNCTION public.get_unread_notification_count()
RETURNS INTEGER
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM public.notifications
    WHERE user_id = auth.uid()
    AND read_at IS NULL
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- HELPER FUNCTIONS FOR MESSAGING
-- ============================================================================

-- Function to create or get existing direct conversation between two users
CREATE OR REPLACE FUNCTION public.get_or_create_direct_conversation(p_other_user_id UUID)
RETURNS UUID
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_conversation_id UUID;
  v_current_user_id UUID;
BEGIN
  v_current_user_id := auth.uid();
  
  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  IF v_current_user_id = p_other_user_id THEN
    RAISE EXCEPTION 'Cannot create conversation with yourself';
  END IF;
  
  -- Try to find existing direct conversation
  SELECT id INTO v_conversation_id
  FROM public.conversations
  WHERE type = 'direct'
  AND participants @> ARRAY[v_current_user_id, p_other_user_id]
  AND array_length(participants, 1) = 2
  LIMIT 1;
  
  -- If not found, create new conversation
  IF v_conversation_id IS NULL THEN
    INSERT INTO public.conversations (type, participants, created_by)
    VALUES ('direct', ARRAY[v_current_user_id, p_other_user_id], v_current_user_id)
    RETURNING id INTO v_conversation_id;
  END IF;
  
  RETURN v_conversation_id;
END;
$$ LANGUAGE plpgsql;

-- Function to create a group conversation
CREATE OR REPLACE FUNCTION public.create_group_conversation(
  p_name TEXT,
  p_participant_ids UUID[]
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_conversation_id UUID;
  v_current_user_id UUID;
  v_all_participants UUID[];
BEGIN
  v_current_user_id := auth.uid();
  
  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Ensure creator is in participants
  IF NOT v_current_user_id = ANY(p_participant_ids) THEN
    v_all_participants := array_append(p_participant_ids, v_current_user_id);
  ELSE
    v_all_participants := p_participant_ids;
  END IF;
  
  -- Create the group conversation
  INSERT INTO public.conversations (type, name, participants, created_by)
  VALUES ('group', p_name, v_all_participants, v_current_user_id)
  RETURNING id INTO v_conversation_id;
  
  RETURN v_conversation_id;
END;
$$ LANGUAGE plpgsql;

-- Function to add participant to group conversation
CREATE OR REPLACE FUNCTION public.add_conversation_participant(
  p_conversation_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_conversation RECORD;
BEGIN
  -- Get conversation and verify permissions
  SELECT * INTO v_conversation
  FROM public.conversations
  WHERE id = p_conversation_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversation not found';
  END IF;
  
  IF v_conversation.type != 'group' THEN
    RAISE EXCEPTION 'Can only add participants to group conversations';
  END IF;
  
  -- Only creator or admin can add participants
  IF v_conversation.created_by != auth.uid() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized to add participants';
  END IF;
  
  -- Add participant if not already present
  IF NOT p_user_id = ANY(v_conversation.participants) THEN
    UPDATE public.conversations
    SET participants = array_append(participants, p_user_id)
    WHERE id = p_conversation_id;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to mark messages as read in a conversation
CREATE OR REPLACE FUNCTION public.mark_conversation_read(p_conversation_id UUID)
RETURNS INTEGER
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_count INTEGER;
  v_current_user_id UUID;
BEGIN
  v_current_user_id := auth.uid();
  
  -- Verify user is participant
  IF NOT EXISTS (
    SELECT 1 FROM public.conversations
    WHERE id = p_conversation_id
    AND v_current_user_id = ANY(participants)
  ) THEN
    RAISE EXCEPTION 'Not a participant of this conversation';
  END IF;
  
  -- Add current user to read_by array for all unread messages
  UPDATE public.messages
  SET read_by = array_append(read_by, v_current_user_id)
  WHERE conversation_id = p_conversation_id
  AND NOT v_current_user_id = ANY(read_by)
  AND sender_id != v_current_user_id;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Index for finding conversations by participant
CREATE INDEX IF NOT EXISTS idx_conversations_participants ON public.conversations USING GIN(participants);

-- Index for unread messages
CREATE INDEX IF NOT EXISTS idx_messages_read_by ON public.messages USING GIN(read_by);

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE public.push_subscriptions IS 'Stores web push notification subscriptions for users';
COMMENT ON FUNCTION public.create_notification IS 'Creates a notification for a specific user';
COMMENT ON FUNCTION public.mark_notification_read IS 'Marks a single notification as read';
COMMENT ON FUNCTION public.mark_all_notifications_read IS 'Marks all notifications as read for current user';
COMMENT ON FUNCTION public.get_unread_notification_count IS 'Returns count of unread notifications for current user';
COMMENT ON FUNCTION public.get_or_create_direct_conversation IS 'Gets or creates a direct conversation between current user and another user';
COMMENT ON FUNCTION public.create_group_conversation IS 'Creates a new group conversation';
COMMENT ON FUNCTION public.add_conversation_participant IS 'Adds a participant to a group conversation';
COMMENT ON FUNCTION public.mark_conversation_read IS 'Marks all messages in a conversation as read by current user';
