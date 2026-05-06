-- ============================================================================
-- CocoaTrack V2 - Health Status Change Notifications
-- This migration adds automatic notifications when parcelle health status
-- declines by 2 or more categories (e.g., Good → Poor, Excellent → Fair)
-- ============================================================================

-- ============================================================================
-- 1. Helper function to get health status numeric value for comparison
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_health_status_value(status TEXT)
RETURNS INTEGER
IMMUTABLE
AS $$
BEGIN
  RETURN CASE status
    WHEN 'excellent' THEN 5
    WHEN 'good' THEN 4
    WHEN 'fair' THEN 3
    WHEN 'poor' THEN 2
    WHEN 'critical' THEN 1
    ELSE 0
  END;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 2. Helper function to get health status recommendation in French
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_health_status_recommendation(status TEXT)
RETURNS TEXT
IMMUTABLE
AS $$
BEGIN
  RETURN CASE status
    WHEN 'excellent' THEN 'Les cacaoyers sont en excellente santé. Continuez les pratiques actuelles de gestion et d''ombrage.'
    WHEN 'good' THEN 'Les cacaoyers sont en bonne santé. Maintenez un suivi régulier et les pratiques d''entretien.'
    WHEN 'fair' THEN 'Santé acceptable des cacaoyers. Vérifiez l''irrigation, la fertilisation et l''ombrage. Surveillez les signes de stress.'
    WHEN 'poor' THEN 'Santé des cacaoyers en déclin. Inspectez pour stress hydrique, carences nutritionnelles, maladies (pourriture brune, moniliose) ou ravageurs (mirides).'
    WHEN 'critical' THEN 'État critique des cacaoyers. Intervention immédiate requise. Consultez un agronome spécialisé en cacao. Vérifiez l''ombrage, l''irrigation et les maladies.'
    ELSE 'Statut de santé inconnu.'
  END;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. Helper function to get health status label in French
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_health_status_label(status TEXT)
RETURNS TEXT
IMMUTABLE
AS $$
BEGIN
  RETURN CASE status
    WHEN 'excellent' THEN 'Excellent'
    WHEN 'good' THEN 'Bon'
    WHEN 'fair' THEN 'Acceptable'
    WHEN 'poor' THEN 'Faible'
    WHEN 'critical' THEN 'Critique'
    ELSE 'Inconnu'
  END;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. Function to get cooperative managers for a parcelle
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_parcelle_cooperative_managers(p_parcelle_id UUID)
RETURNS UUID[]
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_cooperative_id UUID;
  v_manager_ids UUID[];
BEGIN
  -- Get cooperative_id from the parcelle's planteur
  SELECT p.cooperative_id INTO v_cooperative_id
  FROM public.parcelles pa
  LEFT JOIN public.planteurs p ON p.id = pa.planteur_id
  WHERE pa.id = p_parcelle_id;

  -- If no cooperative found, return empty array
  IF v_cooperative_id IS NULL THEN
    RETURN ARRAY[]::UUID[];
  END IF;

  -- Get all managers and admins for this cooperative
  SELECT ARRAY_AGG(id) INTO v_manager_ids
  FROM public.profiles
  WHERE cooperative_id = v_cooperative_id
    AND role IN ('manager', 'admin');

  RETURN COALESCE(v_manager_ids, ARRAY[]::UUID[]);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. Function to get planteur (owner) of a parcelle
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_parcelle_planteur(p_parcelle_id UUID)
RETURNS UUID
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_planteur_user_id UUID;
BEGIN
  -- Get the user_id of the planteur who owns this parcelle
  -- Note: planteurs table has user_id field linking to profiles
  SELECT pl.user_id INTO v_planteur_user_id
  FROM public.parcelles pa
  LEFT JOIN public.planteurs pl ON pl.id = pa.planteur_id
  WHERE pa.id = p_parcelle_id
    AND pl.user_id IS NOT NULL;

  RETURN v_planteur_user_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. Trigger function to notify on health status decline
-- ============================================================================
CREATE OR REPLACE FUNCTION public.notify_on_health_status_decline()
RETURNS TRIGGER
SECURITY DEFINER
AS $$
DECLARE
  v_previous_status TEXT;
  v_previous_value INTEGER;
  v_current_value INTEGER;
  v_decline_amount INTEGER;
  v_parcelle_name TEXT;
  v_parcelle_code TEXT;
  v_manager_id UUID;
  v_planteur_id UUID;
  v_notification_title TEXT;
  v_notification_body TEXT;
  v_recommendation TEXT;
BEGIN
  -- Only process INSERT and UPDATE operations
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  -- For INSERT, check if there's a previous NDVI result for this parcelle
  -- For UPDATE, compare with the OLD value
  IF TG_OP = 'INSERT' THEN
    -- Get the most recent previous NDVI result (excluding the current one)
    SELECT health_status INTO v_previous_status
    FROM public.ndvi_results
    WHERE parcelle_id = NEW.parcelle_id
      AND calculation_date < NEW.calculation_date
    ORDER BY calculation_date DESC
    LIMIT 1;
  ELSIF TG_OP = 'UPDATE' THEN
    v_previous_status := OLD.health_status;
  END IF;

  -- If no previous status, nothing to compare
  IF v_previous_status IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get numeric values for comparison
  v_previous_value := public.get_health_status_value(v_previous_status);
  v_current_value := public.get_health_status_value(NEW.health_status);

  -- Calculate decline amount (positive means decline, negative means improvement)
  v_decline_amount := v_previous_value - v_current_value;

  -- Only notify if decline is 2 or more categories
  IF v_decline_amount < 2 THEN
    RETURN NEW;
  END IF;

  -- Get parcelle details for notification
  SELECT 
    COALESCE(pa.nom, 'Parcelle sans nom'),
    COALESCE(pa.code, 'N/A')
  INTO v_parcelle_name, v_parcelle_code
  FROM public.parcelles pa
  WHERE pa.id = NEW.parcelle_id;

  -- Get recommendation for current health status
  v_recommendation := public.get_health_status_recommendation(NEW.health_status);

  -- Build notification content
  v_notification_title := 'Alerte: Déclin de santé de parcelle';
  v_notification_body := format(
    'La parcelle "%s" (Code: %s) a connu un déclin significatif de santé: %s → %s. NDVI moyen: %.3f. Recommandation: %s',
    v_parcelle_name,
    v_parcelle_code,
    public.get_health_status_label(v_previous_status),
    public.get_health_status_label(NEW.health_status),
    NEW.mean_ndvi,
    v_recommendation
  );

  -- Notify cooperative managers
  FOR v_manager_id IN 
    SELECT UNNEST(public.get_parcelle_cooperative_managers(NEW.parcelle_id))
  LOOP
    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      body,
      payload
    ) VALUES (
      v_manager_id,
      'health_status_decline',
      v_notification_title,
      v_notification_body,
      jsonb_build_object(
        'parcelle_id', NEW.parcelle_id,
        'parcelle_name', v_parcelle_name,
        'parcelle_code', v_parcelle_code,
        'previous_status', v_previous_status,
        'current_status', NEW.health_status,
        'mean_ndvi', NEW.mean_ndvi,
        'calculation_date', NEW.calculation_date,
        'decline_amount', v_decline_amount,
        'recommendation', v_recommendation
      )
    );
  END LOOP;

  -- Notify planteur (owner) if they have a user account
  v_planteur_id := public.get_parcelle_planteur(NEW.parcelle_id);
  
  IF v_planteur_id IS NOT NULL THEN
    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      body,
      payload
    ) VALUES (
      v_planteur_id,
      'health_status_decline',
      v_notification_title,
      v_notification_body,
      jsonb_build_object(
        'parcelle_id', NEW.parcelle_id,
        'parcelle_name', v_parcelle_name,
        'parcelle_code', v_parcelle_code,
        'previous_status', v_previous_status,
        'current_status', NEW.health_status,
        'mean_ndvi', NEW.mean_ndvi,
        'calculation_date', NEW.calculation_date,
        'decline_amount', v_decline_amount,
        'recommendation', v_recommendation
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. Create trigger on ndvi_results table
-- ============================================================================
DROP TRIGGER IF EXISTS trigger_notify_health_status_decline ON public.ndvi_results;

CREATE TRIGGER trigger_notify_health_status_decline
  AFTER INSERT OR UPDATE OF health_status
  ON public.ndvi_results
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_health_status_decline();

-- ============================================================================
-- 8. Add comments for documentation
-- ============================================================================
COMMENT ON FUNCTION public.get_health_status_value IS 'Converts health status text to numeric value for comparison (1=critical, 5=excellent)';
COMMENT ON FUNCTION public.get_health_status_recommendation IS 'Returns French recommendation text for a given health status';
COMMENT ON FUNCTION public.get_health_status_label IS 'Returns French label for a given health status';
COMMENT ON FUNCTION public.get_parcelle_cooperative_managers IS 'Returns array of user IDs for managers and admins of the cooperative that owns the parcelle';
COMMENT ON FUNCTION public.get_parcelle_planteur IS 'Returns user_id of the planteur (owner) of the parcelle';
COMMENT ON FUNCTION public.notify_on_health_status_decline IS 'Creates notifications when parcelle health status declines by 2+ categories';
COMMENT ON TRIGGER trigger_notify_health_status_decline ON public.ndvi_results IS 'Automatically notifies managers and planteur when health status declines significantly';
