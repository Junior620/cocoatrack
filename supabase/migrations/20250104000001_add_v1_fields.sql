-- ============================================================================
-- CocoaTrack V2 - Migration: Add V1 Missing Fields
-- Adds superficie_hectares, statut_plantation to planteurs
-- Adds weight_loaded_kg to deliveries for loss calculation
-- ============================================================================

-- ============================================================================
-- 1. ADD MISSING FIELDS TO PLANTEURS
-- ============================================================================

-- Add superficie_hectares (plantation size in hectares)
ALTER TABLE public.planteurs 
ADD COLUMN IF NOT EXISTS superficie_hectares NUMERIC(10,2);

-- Add statut_plantation (ownership status)
ALTER TABLE public.planteurs 
ADD COLUMN IF NOT EXISTS statut_plantation TEXT;

-- Add region, departement, localite for location details
ALTER TABLE public.planteurs 
ADD COLUMN IF NOT EXISTS region TEXT;

ALTER TABLE public.planteurs 
ADD COLUMN IF NOT EXISTS departement TEXT;

ALTER TABLE public.planteurs 
ADD COLUMN IF NOT EXISTS localite TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.planteurs.superficie_hectares IS 'Plantation size in hectares. Production limit = superficie × 1000 kg';
COMMENT ON COLUMN public.planteurs.statut_plantation IS 'Ownership status: Propriétaire, Locataire, Métayer, Gérant, Autre';
COMMENT ON COLUMN public.planteurs.region IS 'Region where the plantation is located';
COMMENT ON COLUMN public.planteurs.departement IS 'Department within the region';
COMMENT ON COLUMN public.planteurs.localite IS 'Village or locality name';

-- ============================================================================
-- 2. ADD WEIGHT_LOADED_KG TO DELIVERIES (for loss calculation)
-- ============================================================================

-- Add weight_loaded_kg (quantity loaded at source, before transport losses)
ALTER TABLE public.deliveries 
ADD COLUMN IF NOT EXISTS weight_loaded_kg NUMERIC(10,2);

-- Copy existing weight_kg to weight_loaded_kg for existing records
UPDATE public.deliveries 
SET weight_loaded_kg = weight_kg 
WHERE weight_loaded_kg IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.deliveries.weight_loaded_kg IS 'Weight loaded at source (kg). Losses = weight_loaded_kg - weight_kg';

-- ============================================================================
-- 3. CREATE HELPER FUNCTIONS FOR CALCULATIONS
-- ============================================================================

-- Function to calculate planteur production limit
CREATE OR REPLACE FUNCTION public.get_planteur_production_limit(p_planteur_id UUID)
RETURNS NUMERIC
STABLE
SET search_path = public
AS $$
DECLARE
  v_superficie NUMERIC;
BEGIN
  SELECT superficie_hectares INTO v_superficie 
  FROM public.planteurs 
  WHERE id = p_planteur_id;
  
  IF v_superficie IS NULL THEN
    RETURN NULL;
  END IF;
  
  RETURN v_superficie * 1000;
END;
$$ LANGUAGE plpgsql;

-- Function to get planteur delivery stats
CREATE OR REPLACE FUNCTION public.get_planteur_stats(p_planteur_id UUID)
RETURNS TABLE (
  total_loaded_kg NUMERIC,
  total_delivered_kg NUMERIC,
  total_losses_kg NUMERIC,
  loss_percentage NUMERIC,
  production_limit_kg NUMERIC,
  remaining_kg NUMERIC,
  usage_percentage NUMERIC
)
STABLE
SET search_path = public
AS $$
DECLARE
  v_superficie NUMERIC;
  v_limit NUMERIC;
  v_loaded NUMERIC;
  v_delivered NUMERIC;
  v_losses NUMERIC;
BEGIN
  -- Get superficie
  SELECT superficie_hectares INTO v_superficie 
  FROM public.planteurs 
  WHERE id = p_planteur_id;
  
  v_limit := COALESCE(v_superficie * 1000, 0);
  
  -- Get delivery totals
  SELECT 
    COALESCE(SUM(COALESCE(weight_loaded_kg, weight_kg)), 0),
    COALESCE(SUM(weight_kg), 0)
  INTO v_loaded, v_delivered
  FROM public.deliveries 
  WHERE planteur_id = p_planteur_id;
  
  v_losses := v_loaded - v_delivered;
  
  RETURN QUERY SELECT
    v_loaded,
    v_delivered,
    v_losses,
    CASE WHEN v_loaded > 0 THEN ROUND((v_losses / v_loaded) * 100, 2) ELSE 0 END,
    v_limit,
    CASE WHEN v_limit > 0 THEN v_limit - v_delivered ELSE NULL END,
    CASE WHEN v_limit > 0 THEN ROUND((v_delivered / v_limit) * 100, 2) ELSE NULL END;
END;
$$ LANGUAGE plpgsql;

-- Function to get chef_planteur stats
CREATE OR REPLACE FUNCTION public.get_chef_planteur_stats(p_chef_planteur_id UUID)
RETURNS TABLE (
  total_delivered_kg NUMERIC,
  total_planteurs INTEGER,
  total_planteurs_limit_kg NUMERIC,
  quantite_max_kg NUMERIC,
  remaining_kg NUMERIC,
  usage_percentage NUMERIC,
  is_exploited BOOLEAN
)
STABLE
SET search_path = public
AS $$
DECLARE
  v_max NUMERIC;
  v_delivered NUMERIC;
  v_planteurs_count INTEGER;
  v_planteurs_limit NUMERIC;
BEGIN
  -- Get chef_planteur max quantity
  SELECT cp.quantite_max_kg INTO v_max 
  FROM public.chef_planteurs cp 
  WHERE cp.id = p_chef_planteur_id;
  
  -- Get total delivered
  SELECT COALESCE(SUM(d.weight_kg), 0) INTO v_delivered
  FROM public.deliveries d 
  WHERE d.chef_planteur_id = p_chef_planteur_id;
  
  -- Get planteurs count and their total limit
  SELECT 
    COUNT(*),
    COALESCE(SUM(COALESCE(p.superficie_hectares, 0) * 1000), 0)
  INTO v_planteurs_count, v_planteurs_limit
  FROM public.planteurs p 
  WHERE p.chef_planteur_id = p_chef_planteur_id;
  
  RETURN QUERY SELECT
    v_delivered,
    v_planteurs_count,
    v_planteurs_limit,
    v_max,
    v_max - v_delivered,
    CASE WHEN v_max > 0 THEN ROUND((v_delivered / v_max) * 100, 2) ELSE 0 END,
    v_delivered > 0;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. CREATE VIEW FOR PLANTEURS WITH STATS
-- ============================================================================

CREATE OR REPLACE VIEW public.planteurs_with_stats AS
SELECT 
  p.*,
  COALESCE(p.superficie_hectares * 1000, 0) AS limite_production_kg,
  COALESCE(stats.total_loaded_kg, 0) AS total_charge_kg,
  COALESCE(stats.total_delivered_kg, 0) AS total_decharge_kg,
  COALESCE(stats.total_losses_kg, 0) AS pertes_kg,
  COALESCE(stats.loss_percentage, 0) AS pourcentage_pertes,
  stats.remaining_kg AS restant_kg,
  stats.usage_percentage AS pourcentage_utilise,
  cp.name AS chef_planteur_name,
  cp.code AS chef_planteur_code
FROM public.planteurs p
LEFT JOIN LATERAL public.get_planteur_stats(p.id) stats ON true
LEFT JOIN public.chef_planteurs cp ON cp.id = p.chef_planteur_id;

-- ============================================================================
-- 5. CREATE VIEW FOR CHEF_PLANTEURS WITH STATS
-- ============================================================================

CREATE OR REPLACE VIEW public.chef_planteurs_with_stats AS
SELECT 
  cp.*,
  COALESCE(stats.total_delivered_kg, 0) AS total_livre_kg,
  COALESCE(stats.total_planteurs, 0) AS nombre_planteurs,
  COALESCE(stats.total_planteurs_limit_kg, 0) AS total_limite_planteurs_kg,
  COALESCE(stats.remaining_kg, cp.quantite_max_kg) AS restant_kg,
  COALESCE(stats.usage_percentage, 0) AS pourcentage_utilise,
  COALESCE(stats.is_exploited, false) AS est_exploite
FROM public.chef_planteurs cp
LEFT JOIN LATERAL public.get_chef_planteur_stats(cp.id) stats ON true;

-- ============================================================================
-- 6. GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT ON public.planteurs_with_stats TO authenticated;
GRANT SELECT ON public.chef_planteurs_with_stats TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_planteur_production_limit(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_planteur_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_chef_planteur_stats(UUID) TO authenticated;
