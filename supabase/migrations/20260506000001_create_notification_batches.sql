-- Migration: Create notification batching tables
-- Description: Stores batched notifications for daily digest delivery
-- Date: 2026-05-06
-- Task: 4.4.5 - Implement notification batching

-- Create notification_batches table to track daily digest batches
CREATE TABLE IF NOT EXISTS notification_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  batch_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notification_count INTEGER NOT NULL DEFAULT 0,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure only one batch per user per day
  CONSTRAINT notification_batches_unique UNIQUE (user_id, batch_date)
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_notification_batches_user_id 
  ON notification_batches(user_id);

CREATE INDEX IF NOT EXISTS idx_notification_batches_batch_date 
  ON notification_batches(batch_date);

CREATE INDEX IF NOT EXISTS idx_notification_batches_sent_at 
  ON notification_batches(sent_at);

-- Create composite index for unsent batches
CREATE INDEX IF NOT EXISTS idx_notification_batches_unsent 
  ON notification_batches(batch_date, sent_at) 
  WHERE sent_at IS NULL;

-- Add comment to table
COMMENT ON TABLE notification_batches IS 'Tracks daily notification digest batches for users';

-- Add comments to columns
COMMENT ON COLUMN notification_batches.id IS 'Primary key';
COMMENT ON COLUMN notification_batches.user_id IS 'Foreign key to profiles table - user receiving the batch';
COMMENT ON COLUMN notification_batches.batch_date IS 'Date of the batch (one batch per user per day)';
COMMENT ON COLUMN notification_batches.notification_count IS 'Number of notifications in this batch';
COMMENT ON COLUMN notification_batches.sent_at IS 'Timestamp when the batch was sent (NULL if not yet sent)';
COMMENT ON COLUMN notification_batches.created_at IS 'Timestamp when the batch was created';

-- Create batched_notifications table to store individual notifications in batches
CREATE TABLE IF NOT EXISTS batched_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id UUID NOT NULL REFERENCES notification_batches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  metadata JSONB,
  action_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_batched_notifications_batch_id 
  ON batched_notifications(batch_id);

CREATE INDEX IF NOT EXISTS idx_batched_notifications_user_id 
  ON batched_notifications(user_id);

CREATE INDEX IF NOT EXISTS idx_batched_notifications_type 
  ON batched_notifications(type);

CREATE INDEX IF NOT EXISTS idx_batched_notifications_priority 
  ON batched_notifications(priority);

CREATE INDEX IF NOT EXISTS idx_batched_notifications_created_at 
  ON batched_notifications(created_at DESC);

-- Add comment to table
COMMENT ON TABLE batched_notifications IS 'Stores individual notifications that are batched for daily digest delivery';

-- Add comments to columns
COMMENT ON COLUMN batched_notifications.id IS 'Primary key';
COMMENT ON COLUMN batched_notifications.batch_id IS 'Foreign key to notification_batches table';
COMMENT ON COLUMN batched_notifications.user_id IS 'Foreign key to profiles table - user receiving the notification';
COMMENT ON COLUMN batched_notifications.type IS 'Notification type (e.g., health_status_declined, yield_prediction_ready)';
COMMENT ON COLUMN batched_notifications.title IS 'Notification title';
COMMENT ON COLUMN batched_notifications.body IS 'Notification body text';
COMMENT ON COLUMN batched_notifications.priority IS 'Notification priority: critical, high, medium, low';
COMMENT ON COLUMN batched_notifications.metadata IS 'Additional metadata about the notification stored as JSONB';
COMMENT ON COLUMN batched_notifications.action_url IS 'URL to navigate to when notification is clicked';
COMMENT ON COLUMN batched_notifications.created_at IS 'Timestamp when the notification was created';

-- Add RLS policies for notification_batches
ALTER TABLE notification_batches ENABLE ROW LEVEL SECURITY;

-- Users can view their own batches
CREATE POLICY notification_batches_select_own 
  ON notification_batches 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Admins can view all batches
CREATE POLICY notification_batches_select_admin 
  ON notification_batches 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Add RLS policies for batched_notifications
ALTER TABLE batched_notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own batched notifications
CREATE POLICY batched_notifications_select_own 
  ON batched_notifications 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Admins can view all batched notifications
CREATE POLICY batched_notifications_select_admin 
  ON batched_notifications 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );
