-- Health Status Change Notifications Implementation
-- Task 4.4.3: Implement health status change notifications
-- Note: This migration extends the existing notifications system

-- The notifications table already exists from previous migration
-- We just need to add the read column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifications' 
    AND column_name = 'read'
  ) THEN
    ALTER TABLE notifications ADD COLUMN read BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);

-- Function to get health status category level (for comparison)
CREATE OR REPLACE FUNCTION get_health_status_level(status TEXT)
RETURNS INTEGER AS $$
BEGIN
  CASE status
    WHEN 'excellent' THEN RETURN 5;
    WHEN 'good' THEN RETURN 4;
    WHEN 'fair' THEN RETURN 3;
    WHEN 'poor' THEN RETURN 2;
    WHEN 'critical' THEN RETURN 1;
    ELSE RETURN 0;
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get health status recommendations
CREATE OR REPLACE FUNCTION get_health_recommendations(status TEXT)
RETURNS TEXT AS $$
BEGIN
  CASE status
    WHEN 'critical' THEN RETURN 'Action urgente requise : irrigation immédiate, fertilisation, inspection des maladies';
    WHEN 'poor' THEN RETURN 'Intervention nécessaire : vérifier l''irrigation, appliquer des nutriments, surveiller les parasites';
    WHEN 'fair' THEN RETURN 'Surveillance recommandée : maintenir l''irrigation, considérer une fertilisation légère';
    WHEN 'good' THEN RETURN 'Bon état : continuer les pratiques actuelles, surveillance régulière';
    WHEN 'excellent' THEN RETURN 'Excellent état : maintenir les pratiques actuelles';
    ELSE RETURN 'Statut inconnu : consulter un agronome';
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to send health status change notification
CREATE OR REPLACE FUNCTION send_health_status_notification(
  p_parcelle_id UUID,
  p_old_status TEXT,
  p_new_status TEXT,
  p_mean_ndvi DECIMAL
)
RETURNS VOID AS $$
DECLARE
  v_parcelle RECORD;
  v_cooperative_manager_id UUID;
  v_planteur_id UUID;
  v_old_level INTEGER;
  v_new_level INTEGER;
  v_decline_categories INTEGER;
  v_recommendations TEXT;
BEGIN
  -- Get health status levels
  v_old_level := get_health_status_level(p_old_status);
  v_new_level := get_health_status_level(p_new_status);
  v_decline_categories := v_old_level - v_new_level;
  
  -- Only send notification if decline is 2+ categories
  IF v_decline_categories < 2 THEN
    RETURN;
  END IF;
  
  -- Get parcelle details
  SELECT 
    p.nom,
    p.planteur_id,
    pl.cooperative_id
  INTO v_parcelle
  FROM parcelles p
  JOIN planteurs pl ON p.planteur_id = pl.id
  WHERE p.id = p_parcelle_id;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Get cooperative manager
  SELECT user_id INTO v_cooperative_manager_id
  FROM profiles 
  WHERE cooperative_id = v_parcelle.cooperative_id 
    AND role = 'cooperative_manager'
  LIMIT 1;
  
  -- Get planteur user ID
  SELECT user_id INTO v_planteur_id
  FROM profiles 
  WHERE id = v_parcelle.planteur_id;
  
  -- Get recommendations
  v_recommendations := get_health_recommendations(p_new_status);
  
  -- Send notification to cooperative manager
  IF v_cooperative_manager_id IS NOT NULL THEN
    INSERT INTO notifications (
      user_id,
      type,
      title,
      body,
      payload
    ) VALUES (
      v_cooperative_manager_id,
      'health_status_decline',
      'Déclin de santé détecté - ' || v_parcelle.nom,
      format('La parcelle %s a subi un déclin de santé significatif : %s → %s (NDVI: %s). %s',
        v_parcelle.nom,
        CASE p_old_status
          WHEN 'excellent' THEN 'Excellent'
          WHEN 'good' THEN 'Bon'
          WHEN 'fair' THEN 'Moyen'
          WHEN 'poor' THEN 'Faible'
          WHEN 'critical' THEN 'Critique'
        END,
        CASE p_new_status
          WHEN 'excellent' THEN 'Excellent'
          WHEN 'good' THEN 'Bon'
          WHEN 'fair' THEN 'Moyen'
          WHEN 'poor' THEN 'Faible'
          WHEN 'critical' THEN 'Critique'
        END,
        p_mean_ndvi,
        v_recommendations
      ),
      jsonb_build_object(
        'parcelle_id', p_parcelle_id,
        'parcelle_name', v_parcelle.nom,
        'old_status', p_old_status,
        'new_status', p_new_status,
        'mean_ndvi', p_mean_ndvi,
        'decline_categories', v_decline_categories,
        'recommendations', v_recommendations
      )
    );
  END IF;
  
  -- Send notification to planteur
  IF v_planteur_id IS NOT NULL THEN
    INSERT INTO notifications (
      user_id,
      type,
      title,
      body,
      payload
    ) VALUES (
      v_planteur_id,
      'health_status_decline',
      'Attention : Santé de votre parcelle - ' || v_parcelle.nom,
      format('Votre parcelle %s nécessite votre attention. Santé : %s → %s (NDVI: %s). Recommandations : %s',
        v_parcelle.nom,
        CASE p_old_status
          WHEN 'excellent' THEN 'Excellent'
          WHEN 'good' THEN 'Bon'
          WHEN 'fair' THEN 'Moyen'
          WHEN 'poor' THEN 'Faible'
          WHEN 'critical' THEN 'Critique'
        END,
        CASE p_new_status
          WHEN 'excellent' THEN 'Excellent'
          WHEN 'good' THEN 'Bon'
          WHEN 'fair' THEN 'Moyen'
          WHEN 'poor' THEN 'Faible'
          WHEN 'critical' THEN 'Critique'
        END,
        p_mean_ndvi,
        v_recommendations
      ),
      jsonb_build_object(
        'parcelle_id', p_parcelle_id,
        'parcelle_name', v_parcelle.nom,
        'old_status', p_old_status,
        'new_status', p_new_status,
        'mean_ndvi', p_mean_ndvi,
        'decline_categories', v_decline_categories,
        'recommendations', v_recommendations
      )
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to detect health status changes
CREATE OR REPLACE FUNCTION trigger_health_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_old_status TEXT;
  v_old_level INTEGER;
  v_new_level INTEGER;
BEGIN
  -- Get the previous health status for this parcelle
  SELECT health_status INTO v_old_status
  FROM ndvi_results 
  WHERE parcelle_id = NEW.parcelle_id 
    AND calculation_date < NEW.calculation_date
  ORDER BY calculation_date DESC
  LIMIT 1;
  
  -- If no previous status, no notification needed
  IF v_old_status IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Check if there's a significant decline (2+ categories)
  v_old_level := get_health_status_level(v_old_status);
  v_new_level := get_health_status_level(NEW.health_status);
  
  -- Send notification if decline is significant
  IF (v_old_level - v_new_level) >= 2 THEN
    PERFORM send_health_status_notification(
      NEW.parcelle_id,
      v_old_status,
      NEW.health_status,
      NEW.mean_ndvi
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on ndvi_results table
DROP TRIGGER IF EXISTS health_status_change_trigger ON ndvi_results;
CREATE TRIGGER health_status_change_trigger
  AFTER INSERT ON ndvi_results
  FOR EACH ROW
  EXECUTE FUNCTION trigger_health_status_change();

-- RLS policies for notifications table (extend existing policies)
-- Note: The table already has RLS enabled from previous migration

-- Users can mark their own notifications as read (if read column exists)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifications' 
    AND column_name = 'read'
  ) THEN
    -- Drop existing policy if it exists
    DROP POLICY IF EXISTS "Users can update own notifications read status" ON notifications;
    
    -- Create new policy for updating read status
    CREATE POLICY "Users can update own notifications read status" ON notifications
      FOR UPDATE USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Grant necessary permissions (extend existing grants)
GRANT SELECT, INSERT, UPDATE ON notifications TO authenticated;

-- Comment the migration
COMMENT ON FUNCTION send_health_status_notification IS 'Sends notifications when parcelle health status declines by 2+ categories';
COMMENT ON FUNCTION trigger_health_status_change IS 'Trigger function to detect and notify on health status changes';