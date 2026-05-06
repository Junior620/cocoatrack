-- Migration: Create job_executions table
-- Description: Tracks execution of scheduled background jobs
-- Date: 2026-05-06
-- Task: 4.5.1 - Create periodic deforestation detection job

-- Create job_executions table
CREATE TABLE IF NOT EXISTS job_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_name TEXT NOT NULL,
  job_type TEXT NOT NULL CHECK (job_type IN (
    'deforestation_detection',
    'notification_digest',
    'cache_cleanup',
    'data_archival'
  )),
  status TEXT NOT NULL CHECK (status IN (
    'running',
    'completed',
    'failed',
    'cancelled'
  )),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  items_processed INTEGER DEFAULT 0,
  items_failed INTEGER DEFAULT 0,
  error_message TEXT,
  error_details JSONB,
  execution_metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_job_executions_job_name 
  ON job_executions(job_name);

CREATE INDEX IF NOT EXISTS idx_job_executions_job_type 
  ON job_executions(job_type);

CREATE INDEX IF NOT EXISTS idx_job_executions_status 
  ON job_executions(status);

CREATE INDEX IF NOT EXISTS idx_job_executions_started_at 
  ON job_executions(started_at DESC);

CREATE INDEX IF NOT EXISTS idx_job_executions_completed_at 
  ON job_executions(completed_at DESC);

-- Create composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_job_executions_type_status_date 
  ON job_executions(job_type, status, started_at DESC);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_job_executions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_job_executions_updated_at
  BEFORE UPDATE ON job_executions
  FOR EACH ROW
  EXECUTE FUNCTION update_job_executions_updated_at();

-- Add comments to table
COMMENT ON TABLE job_executions IS 'Tracks execution of scheduled background jobs';

-- Add comments to columns
COMMENT ON COLUMN job_executions.id IS 'Primary key';
COMMENT ON COLUMN job_executions.job_name IS 'Human-readable name of the job';
COMMENT ON COLUMN job_executions.job_type IS 'Type of job: deforestation_detection, notification_digest, cache_cleanup, data_archival';
COMMENT ON COLUMN job_executions.status IS 'Current status: running, completed, failed, cancelled';
COMMENT ON COLUMN job_executions.started_at IS 'Timestamp when the job started';
COMMENT ON COLUMN job_executions.completed_at IS 'Timestamp when the job completed (null if still running)';
COMMENT ON COLUMN job_executions.duration_ms IS 'Duration of job execution in milliseconds';
COMMENT ON COLUMN job_executions.items_processed IS 'Number of items successfully processed';
COMMENT ON COLUMN job_executions.items_failed IS 'Number of items that failed processing';
COMMENT ON COLUMN job_executions.error_message IS 'Error message if job failed';
COMMENT ON COLUMN job_executions.error_details IS 'Detailed error information stored as JSONB';
COMMENT ON COLUMN job_executions.execution_metadata IS 'Additional metadata about the job execution (e.g., configuration, filters)';
COMMENT ON COLUMN job_executions.created_at IS 'Timestamp when the record was created';
COMMENT ON COLUMN job_executions.updated_at IS 'Timestamp when the record was last updated';

-- Enable RLS
ALTER TABLE job_executions ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only admins can view job executions
CREATE POLICY "job_executions_select_admin" ON job_executions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Service role can insert/update job executions (for cron jobs)
CREATE POLICY "job_executions_insert_service" ON job_executions
  FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY "job_executions_update_service" ON job_executions
  FOR UPDATE TO service_role
  USING (true);
