-- CocoaTrack V2 - Notification Triggers
-- Automatic notification creation for important events
-- Requirements: 10.5, 10.6

-- ============================================================================
-- HELPER FUNCTION: Get managers for a cooperative
-- Returns all user IDs with manager or admin role for a given cooperative
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_cooperative_managers(p_cooperative_id UUID)
RETURNS UUID[]
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_managers UUID[];
BEGIN
  SELECT ARRAY_AGG(id) INTO v_managers
  FROM public.profiles
  WHERE (
    -- Managers of the same cooperative
    (role = 'manager' AND cooperative_id = p_cooperative_id)
    -- Or admins (can see all)
    OR role = 'admin'
  )
  AND is_active = true;
  
  RETURN COALESCE(v_managers, ARRAY[]::UUID[]);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGER: Notify managers on new delivery
-- Creates notifications for managers when a new delivery is created
-- ============================================================================
CREATE OR REPLACE FUNCTION public.notify_on_delivery_created()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_managers UUID[];
  v_manager_id UUID;
  v_planteur_name TEXT;
  v_chef_planteur_name TEXT;
BEGIN
  -- Get planteur and chef_planteur names for the notification
  SELECT p.name, cp.name INTO v_planteur_name, v_chef_planteur_name
  FROM public.planteurs p
  JOIN public.chef_planteurs cp ON p.chef_planteur_id = cp.id
  WHERE p.id = NEW.planteur_id;
  
  -- Get managers for this cooperative
  v_managers := public.get_cooperative_managers(NEW.cooperative_id);
  
  -- Create notification for each manager (except the creator)
  FOREACH v_manager_id IN ARRAY v_managers
  LOOP
    -- Don't notify the creator
    IF v_manager_id != NEW.created_by THEN
      INSERT INTO public.notifications (
        user_id,
        type,
        title,
        body,
        payload
      ) VALUES (
        v_manager_id,
        'delivery_created',
        'Nouvelle livraison enregistrée',
        format('Livraison de %s kg par %s (%s)', 
          NEW.weight_kg::TEXT, 
          COALESCE(v_planteur_name, 'Planteur inconnu'),
          COALESCE(v_chef_planteur_name, 'Chef planteur inconnu')
        ),
        jsonb_build_object(
          'delivery_id', NEW.id,
          'delivery_code', NEW.code,
          'planteur_id', NEW.planteur_id,
          'chef_planteur_id', NEW.chef_planteur_id,
          'weight_kg', NEW.weight_kg,
          'total_amount', NEW.total_amount
        )
      );
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_notify_delivery_created ON public.deliveries;
CREATE TRIGGER trigger_notify_delivery_created
  AFTER INSERT ON public.deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_delivery_created();

-- ============================================================================
-- TRIGGER: Notify on chef_planteur validation status change
-- Creates notifications when a chef_planteur is validated or rejected
-- ============================================================================
CREATE OR REPLACE FUNCTION public.notify_on_chef_planteur_validation()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_type TEXT;
  v_title TEXT;
  v_body TEXT;
BEGIN
  -- Only trigger on validation_status change
  IF OLD.validation_status = NEW.validation_status THEN
    RETURN NEW;
  END IF;
  
  -- Only notify on validated or rejected status
  IF NEW.validation_status NOT IN ('validated', 'rejected') THEN
    RETURN NEW;
  END IF;
  
  -- Set notification details based on status
  IF NEW.validation_status = 'validated' THEN
    v_notification_type := 'chef_planteur_validated';
    v_title := 'Chef planteur validé';
    v_body := format('Le chef planteur "%s" a été validé.', NEW.name);
  ELSE
    v_notification_type := 'chef_planteur_rejected';
    v_title := 'Chef planteur rejeté';
    v_body := format('Le chef planteur "%s" a été rejeté. Raison: %s', 
      NEW.name, 
      COALESCE(NEW.rejection_reason, 'Non spécifiée')
    );
  END IF;
  
  -- Notify the creator
  INSERT INTO public.notifications (
    user_id,
    type,
    title,
    body,
    payload
  ) VALUES (
    NEW.created_by,
    v_notification_type,
    v_title,
    v_body,
    jsonb_build_object(
      'chef_planteur_id', NEW.id,
      'chef_planteur_name', NEW.name,
      'chef_planteur_code', NEW.code,
      'validation_status', NEW.validation_status,
      'validated_by', NEW.validated_by,
      'rejection_reason', NEW.rejection_reason
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_notify_chef_planteur_validation ON public.chef_planteurs;
CREATE TRIGGER trigger_notify_chef_planteur_validation
  AFTER UPDATE ON public.chef_planteurs
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_chef_planteur_validation();

-- ============================================================================
-- TRIGGER: Notify on invoice generation
-- Creates notifications when an invoice is generated
-- ============================================================================
CREATE OR REPLACE FUNCTION public.notify_on_invoice_created()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_managers UUID[];
  v_manager_id UUID;
  v_cooperative_name TEXT;
BEGIN
  -- Get cooperative name
  SELECT name INTO v_cooperative_name
  FROM public.cooperatives
  WHERE id = NEW.cooperative_id;
  
  -- Get managers for this cooperative
  v_managers := public.get_cooperative_managers(NEW.cooperative_id);
  
  -- Create notification for each manager (except the creator)
  FOREACH v_manager_id IN ARRAY v_managers
  LOOP
    IF v_manager_id != NEW.created_by THEN
      INSERT INTO public.notifications (
        user_id,
        type,
        title,
        body,
        payload
      ) VALUES (
        v_manager_id,
        'invoice_generated',
        'Nouvelle facture générée',
        format('Facture %s pour %s - Montant: %s XAF', 
          NEW.code,
          COALESCE(v_cooperative_name, 'Coopérative'),
          NEW.total_amount::TEXT
        ),
        jsonb_build_object(
          'invoice_id', NEW.id,
          'invoice_code', NEW.code,
          'cooperative_id', NEW.cooperative_id,
          'total_amount', NEW.total_amount,
          'period_start', NEW.period_start,
          'period_end', NEW.period_end
        )
      );
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_notify_invoice_created ON public.invoices;
CREATE TRIGGER trigger_notify_invoice_created
  AFTER INSERT ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_invoice_created();

-- ============================================================================
-- TRIGGER: Notify on new message
-- Creates notifications when a new message is sent in a conversation
-- ============================================================================
CREATE OR REPLACE FUNCTION public.notify_on_message_created()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversation RECORD;
  v_participant_id UUID;
  v_sender_name TEXT;
BEGIN
  -- Get conversation details
  SELECT * INTO v_conversation
  FROM public.conversations
  WHERE id = NEW.conversation_id;
  
  -- Get sender name
  SELECT full_name INTO v_sender_name
  FROM public.profiles
  WHERE id = NEW.sender_id;
  
  -- Notify all participants except the sender
  FOREACH v_participant_id IN ARRAY v_conversation.participants
  LOOP
    IF v_participant_id != NEW.sender_id THEN
      INSERT INTO public.notifications (
        user_id,
        type,
        title,
        body,
        payload
      ) VALUES (
        v_participant_id,
        'message_received',
        CASE 
          WHEN v_conversation.type = 'group' THEN format('Nouveau message dans %s', COALESCE(v_conversation.name, 'Groupe'))
          ELSE format('Message de %s', COALESCE(v_sender_name, 'Utilisateur'))
        END,
        LEFT(NEW.body, 100) || CASE WHEN LENGTH(NEW.body) > 100 THEN '...' ELSE '' END,
        jsonb_build_object(
          'message_id', NEW.id,
          'conversation_id', NEW.conversation_id,
          'sender_id', NEW.sender_id,
          'sender_name', v_sender_name,
          'conversation_type', v_conversation.type,
          'conversation_name', v_conversation.name
        )
      );
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_notify_message_created ON public.messages;
CREATE TRIGGER trigger_notify_message_created
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_message_created();

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON FUNCTION public.get_cooperative_managers IS 'Returns array of user IDs for managers and admins of a cooperative';
COMMENT ON FUNCTION public.notify_on_delivery_created IS 'Creates notifications for managers when a new delivery is created';
COMMENT ON FUNCTION public.notify_on_chef_planteur_validation IS 'Creates notifications when a chef_planteur validation status changes';
COMMENT ON FUNCTION public.notify_on_invoice_created IS 'Creates notifications for managers when an invoice is generated';
COMMENT ON FUNCTION public.notify_on_message_created IS 'Creates notifications for conversation participants when a new message is sent';
