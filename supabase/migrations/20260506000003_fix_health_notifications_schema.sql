-- Fix health status notifications to work with actual database schema
-- This migration corrects the functions to work with the real table structure

-- Drop trigger first, then functions (correct order to avoid dependency errors)
DROP TRIGGER IF EXISTS health_status_change_trigger ON ndvi_results;
DROP TRIGGER IF EXISTS trigger_notify_health_status_decline ON ndvi_results;

-- Now drop the functions
DROP FUNCTION IF EXISTS send_health_status_notification(UUID, TEXT, TEXT, DECIMAL);
DROP FUNCTION IF EXISTS trigger_health_status_change();
DROP FUNCTION IF EXISTS notify_on_health_status_decline();

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
-- Uses actual database schema with correct column names
CREATE OR REPLACE FUNCTION send_health_status_notification(
  p_parcelle_id UUID,
  p_old_status TEXT,
  p_new_status TEXT,
  p_mean_ndvi DECIMAL
)
RETURNS VOID AS $$
DECLARE
  v_parcelle RECORD;
  v_cooperative_manager_ids UUID[];
  v_planteur_profile_id UUID;
  v_old_level INTEGER;
  v_new_level INTEGER;
  v_decline_categories INTEGER;
  v_recommendations TEXT;
  v_parcelle_name TEXT;
  v_manager_id UUID;
BEGIN
  -- Get health status levels
  v_old_level := get_health_status_level(p_old_status);
  v_new_level := get_health_status_level(p_new_status);
  v_decline_categories := v_old_level - v_new_level;
  
  -- Only send notification if decline is 2+ categories
  IF v_decline_categories < 2 THEN
    RETURN;
  END IF;
  
  -- Get parcelle details using actual column names
  SELECT 
    COALESCE(p.label, p.code, 'Parcelle sans nom') as parcelle_name,
    p.planteur_id,
    pl.cooperative_id
  INTO v_parcelle
  FROM parcelles p
  LEFT JOIN planteurs pl ON p.planteur_id = pl.id
  WHERE p.id = p_parcelle_id;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  v_parcelle_name := v_parcelle.parcelle_name;
  
  -- Get recommendations
  v_recommendations := get_health_recommendations(p_new_status);
  
  -- Get cooperative managers (users with role admin/manager in same cooperative)
  SELECT ARRAY_AGG(pr.id) INTO v_cooperative_manager_ids
  FROM profiles pr
  WHERE pr.cooperative_id = v_parcelle.cooperative_id 
    AND pr.role::text IN ('admin', 'manager')
    AND pr.is_active = true;
  
  -- Send notification to cooperative managers
  IF v_cooperative_manager_ids IS NOT NULL THEN
    FOREACH v_manager_id IN ARRAY v_cooperative_manager_ids
    LOOP
      INSERT INTO notifications (
        user_id,
        type,
        title,
        body,
        payload
      ) VALUES (
        v_manager_id,
        'health_status_decline',
        'Déclin de santé détecté - ' || v_parcelle_name,
        format('La parcelle %s a subi un déclin de santé significatif : %s → %s (NDVI: %s). %s',
          v_parcelle_name,
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
          'parcelle_name', v_parcelle_name,
          'old_status', p_old_status,
          'new_status', p_new_status,
          'mean_ndvi', p_mean_ndvi,
          'decline_categories', v_decline_categories,
          'recommendations', v_recommendations
        )
      );
    END LOOP;
  END IF;
  
  -- Try to find planteur profile and send notification
  -- Note: This assumes planteurs might have profiles, but handles gracefully if not
  SELECT pr.id INTO v_planteur_profile_id
  FROM profiles pr
  JOIN planteurs pl ON pr.id = pl.id -- Assuming profiles.id might match planteurs.id
  WHERE pl.id = v_parcelle.planteur_id
    AND pr.is_active = true
  LIMIT 1;
  
  -- If planteur has a profile, send notification
  IF v_planteur_profile_id IS NOT NULL THEN
    INSERT INTO notifications (
      user_id,
      type,
      title,
      body,
      payload
    ) VALUES (
      v_planteur_profile_id,
      'health_status_decline',
      'Attention : Santé de votre parcelle - ' || v_parcelle_name,
      format('Votre parcelle %s nécessite votre attention. Santé : %s → %s (NDVI: %s). Recommandations : %s',
        v_parcelle_name,
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
        'parcelle_name', v_parcelle_name,
        'old_status', p_old_status,
        'new_status', p_new_status,
        'mean_ndvi', p_mean_ndvi,
        'decline_categories', v_decline_categories,
        'recommendations', v_recommendations
      )
    );
  END IF;
  
EXCEPTION
  WHEN OTHERS THEN
    -- If there's any error, just log it and continue
    RAISE NOTICE 'Error sending health status notification: %', SQLERRM;
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

-- Recreate trigger on ndvi_results table
DROP TRIGGER IF EXISTS health_status_change_trigger ON ndvi_results;
CREATE TRIGGER health_status_change_trigger
  AFTER INSERT ON ndvi_results
  FOR EACH ROW
  EXECUTE FUNCTION trigger_health_status_change();

-- Comment the functions
COMMENT ON FUNCTION send_health_status_notification IS 'Sends simplified notifications when parcelle health status declines by 2+ categories';
COMMENT ON FUNCTION trigger_health_status_change IS 'Trigger function to detect and notify on health status changes (schema-agnostic version)';