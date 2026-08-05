-- Migration: Agent feedback for satellite early-alert calibration
-- Used to refine NDMI/EVI thresholds from field truth (true/false positive)

CREATE TABLE IF NOT EXISTS satellite_alert_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parcelle_id UUID NOT NULL REFERENCES parcelles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  alert_kind TEXT NOT NULL CHECK (alert_kind IN ('ndmi', 'evi', 'combined')),
  alert_level TEXT NOT NULL CHECK (alert_level IN ('watch', 'alert')),
  alert_code TEXT,
  verdict TEXT NOT NULL CHECK (verdict IN ('true_positive', 'false_positive', 'uncertain')),
  note TEXT,
  context JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_satellite_alert_feedback_parcelle
  ON satellite_alert_feedback(parcelle_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_satellite_alert_feedback_kind_verdict
  ON satellite_alert_feedback(alert_kind, verdict, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_satellite_alert_feedback_user
  ON satellite_alert_feedback(user_id, created_at DESC);

COMMENT ON TABLE satellite_alert_feedback IS
  'Field-agent feedback on EVI/NDMI early alerts for threshold calibration';

ALTER TABLE satellite_alert_feedback ENABLE ROW LEVEL SECURITY;

-- Agents/managers: insert own feedback; read coop-scoped via existing roles
CREATE POLICY satellite_alert_feedback_select ON satellite_alert_feedback
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role = 'admin'
          OR user_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM parcelles parc
            JOIN planteurs pl ON pl.id = parc.planteur_id
            WHERE parc.id = satellite_alert_feedback.parcelle_id
              AND pl.cooperative_id = p.cooperative_id
          )
        )
    )
  );

CREATE POLICY satellite_alert_feedback_insert ON satellite_alert_feedback
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
