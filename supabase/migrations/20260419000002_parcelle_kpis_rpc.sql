-- ============================================================================
-- Migration: Parcelle KPIs RPC
-- Description: Fonction pour calculer les KPIs des parcelles
--              Respecte les permissions admin (voit tout)
-- Date: 2026-04-19
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_parcelle_kpis()
RETURNS TABLE (
  conformity_status TEXT,
  count BIGINT,
  total_hectares NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_user_role TEXT;
  v_user_cooperative_id UUID;
BEGIN
  v_user_id := auth.uid();

  SELECT role INTO v_user_role
  FROM public.profiles WHERE id = v_user_id;

  SELECT cooperative_id INTO v_user_cooperative_id
  FROM public.profiles WHERE id = v_user_id;

  RETURN QUERY
  SELECT
    par.conformity_status,
    COUNT(*)::BIGINT AS count,
    COALESCE(SUM(par.surface_hectares), 0) AS total_hectares
  FROM public.parcelles par
  LEFT JOIN public.planteurs pl ON pl.id = par.planteur_id
  WHERE par.is_active = true
    AND (
      v_user_role = 'admin'
      OR (pl.cooperative_id IS NOT NULL AND pl.cooperative_id = v_user_cooperative_id)
      OR (pl.cooperative_id IS NULL AND pl.created_by = v_user_id)
      OR (par.created_by = v_user_id)
    )
  GROUP BY par.conformity_status;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_parcelle_kpis TO authenticated;
