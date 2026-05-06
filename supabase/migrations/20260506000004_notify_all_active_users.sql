-- Fix health status notifications to send to admin and manager users only
-- Filters by role: 'admin' or 'manager'

-- Drop trigger first, then functions (correct order to avoid dependency errors)
DROP TRIGGER IF EXISTS health_status_change_trigger ON ndvi_results;

-- Now drop the functions
DROP FUNCTION IF EXISTS send_health_status_notification(UUID, TEXT, TEXT, DECIMAL);
DROP FUNCTION IF EXISTS trigger_health_status_change();

-- Function to send health status change notification to admin and manager users only
CREATE OR REPLACE FUNCTION send_health_status_notification(
  p_parcelle_id UUID,
  p_old_status TEXT,
  p_new_status TEXT,
  p_mean_ndvi DECIMAL
)
RETURNS VOID AS $$
DECLARE
  v_parcelle_name TEXT;
  v_old_level INTEGER;
  v_new_level INTEGER;
  v_decline_categories INTEGER;
  v_recommendations TEXT;
  v_user_id UUID;
BEGIN
  -- Get health status levels
  v_old_level := get_health_status_level(p_old_status);
  v_new_level := get_health_status_level(p_new_status);
  v_decline_categories := v_old_level - v_new_level;
  
  -- Only send notification if decline is 2+ categories
  IF v_decline_categories < 2 THEN
    RETURN;
  END IF;
  
  -- Get parcelle name using actual column names
  SELECT COALESCE(p.label, p.code, 'Parcelle sans nom')
  INTO v_parcelle_name
  FROM parcelles p
  WHERE p.id = p_parcelle_id;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Get recommendations
  v_recommendations := get_health_recommendations(p_new_status);
  
  -- Send notification to admin and manager users only
  -- Filter by role, no cooperative filtering
  FOR v_user_id IN 
    SELECT id 
    FROM profiles 
    WHERE is_active = true
      AND role::text IN ('admin', 'manager')
  LOOP
    INSERT INTO notifications (
      user_id,
      type,
      title,
      body,
      payload
    ) VALUES (
      v_user_id,
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
  
EXCEPTION
  WHEN OTHERS THEN
    -- If there's any error, just log it and continue
    RAISE NOTICE 'Error sending health status notification: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to detect health status changes (unchanged)
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
CREATE TRIGGER health_status_change_trigger
  AFTER INSERT ON ndvi_results
  FOR EACH ROW
  EXECUTE FUNCTION trigger_health_status_change();

-- Comment the functions
COMMENT ON FUNCTION send_health_status_notification IS 'Sends notifications to admin and manager users only when parcelle health status declines by 2+ categories';
COMMENT ON FUNCTION trigger_health_status_change IS 'Trigger function to detect and notify on health status changes';
