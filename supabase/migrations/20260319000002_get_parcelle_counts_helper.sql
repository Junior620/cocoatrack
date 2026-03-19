-- Migration: Add helper function to get parcelle counts for multiple planteurs
-- This optimizes the import process by fetching all counts in one query

CREATE OR REPLACE FUNCTION get_parcelle_counts_by_planteur(p_planteur_ids UUID[])
RETURNS TABLE(planteur_id UUID, count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id AS planteur_id,
    COUNT(parc.id) AS count
  FROM unnest(p_planteur_ids) AS p(id)
  LEFT JOIN parcelles parc ON parc.planteur_id = p.id AND parc.is_active = true
  GROUP BY p.id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_parcelle_counts_by_planteur(UUID[]) TO authenticated;

COMMENT ON FUNCTION get_parcelle_counts_by_planteur IS 
'Helper function to fetch parcelle counts for multiple planteurs in a single query. Used during bulk import optimization.';
