-- CocoaTrack V2 - Search Indexes Migration
-- Enables pg_trgm extension and creates GIN indexes for fuzzy search

-- ============================================================================
-- ENABLE PG_TRGM EXTENSION
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================================
-- GIN INDEXES FOR FUZZY SEARCH ON CHEF_PLANTEURS
-- ============================================================================

-- Index on name for fuzzy search
CREATE INDEX IF NOT EXISTS idx_chef_planteurs_name_trgm 
  ON public.chef_planteurs 
  USING GIN (name gin_trgm_ops);

-- Index on code for fuzzy search
CREATE INDEX IF NOT EXISTS idx_chef_planteurs_code_trgm 
  ON public.chef_planteurs 
  USING GIN (code gin_trgm_ops);

-- Index on phone for fuzzy search
CREATE INDEX IF NOT EXISTS idx_chef_planteurs_phone_trgm 
  ON public.chef_planteurs 
  USING GIN (phone gin_trgm_ops);

-- ============================================================================
-- GIN INDEXES FOR FUZZY SEARCH ON PLANTEURS
-- ============================================================================

-- Index on name for fuzzy search
CREATE INDEX IF NOT EXISTS idx_planteurs_name_trgm 
  ON public.planteurs 
  USING GIN (name gin_trgm_ops);

-- Index on code for fuzzy search
CREATE INDEX IF NOT EXISTS idx_planteurs_code_trgm 
  ON public.planteurs 
  USING GIN (code gin_trgm_ops);

-- Index on phone for fuzzy search
CREATE INDEX IF NOT EXISTS idx_planteurs_phone_trgm 
  ON public.planteurs 
  USING GIN (phone gin_trgm_ops);

-- ============================================================================
-- SEARCH FUNCTION FOR CHEF_PLANTEURS
-- Uses similarity scoring for better search results
-- ============================================================================

CREATE OR REPLACE FUNCTION public.search_chef_planteurs(
  p_query TEXT,
  p_cooperative_id UUID DEFAULT NULL,
  p_validation_status public.validation_status DEFAULT NULL,
  p_region TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  code TEXT,
  phone TEXT,
  cooperative_id UUID,
  region TEXT,
  validation_status public.validation_status,
  quantite_max_kg NUMERIC,
  similarity_score REAL
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $
BEGIN
  RETURN QUERY
  SELECT 
    cp.id,
    cp.name,
    cp.code,
    cp.phone,
    cp.cooperative_id,
    cp.region,
    cp.validation_status,
    cp.quantite_max_kg,
    GREATEST(
      similarity(cp.name, p_query),
      similarity(cp.code, p_query),
      COALESCE(similarity(cp.phone, p_query), 0)
    ) AS similarity_score
  FROM public.chef_planteurs cp
  WHERE 
    -- Apply search if query provided
    (p_query IS NULL OR p_query = '' OR (
      cp.name ILIKE '%' || p_query || '%'
      OR cp.code ILIKE '%' || p_query || '%'
      OR cp.phone ILIKE '%' || p_query || '%'
    ))
    -- Apply cooperative filter
    AND (p_cooperative_id IS NULL OR cp.cooperative_id = p_cooperative_id)
    -- Apply validation status filter
    AND (p_validation_status IS NULL OR cp.validation_status = p_validation_status)
    -- Apply region filter
    AND (p_region IS NULL OR cp.region = p_region)
    -- Apply RLS (user can only see their cooperative's data)
    AND (public.is_admin() OR cp.cooperative_id = public.get_user_cooperative_id())
  ORDER BY 
    CASE WHEN p_query IS NOT NULL AND p_query != '' 
      THEN GREATEST(
        similarity(cp.name, p_query),
        similarity(cp.code, p_query),
        COALESCE(similarity(cp.phone, p_query), 0)
      )
      ELSE 0 
    END DESC,
    cp.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$;

-- ============================================================================
-- SEARCH FUNCTION FOR PLANTEURS
-- Uses similarity scoring for better search results
-- ============================================================================

CREATE OR REPLACE FUNCTION public.search_planteurs(
  p_query TEXT,
  p_cooperative_id UUID DEFAULT NULL,
  p_chef_planteur_id UUID DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT NULL,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  code TEXT,
  phone TEXT,
  chef_planteur_id UUID,
  cooperative_id UUID,
  is_active BOOLEAN,
  similarity_score REAL
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.code,
    p.phone,
    p.chef_planteur_id,
    p.cooperative_id,
    p.is_active,
    GREATEST(
      similarity(p.name, p_query),
      similarity(p.code, p_query),
      COALESCE(similarity(p.phone, p_query), 0)
    ) AS similarity_score
  FROM public.planteurs p
  WHERE 
    -- Apply search if query provided
    (p_query IS NULL OR p_query = '' OR (
      p.name ILIKE '%' || p_query || '%'
      OR p.code ILIKE '%' || p_query || '%'
      OR p.phone ILIKE '%' || p_query || '%'
    ))
    -- Apply cooperative filter
    AND (p_cooperative_id IS NULL OR p.cooperative_id = p_cooperative_id)
    -- Apply chef_planteur filter
    AND (p_chef_planteur_id IS NULL OR p.chef_planteur_id = p_chef_planteur_id)
    -- Apply is_active filter
    AND (p_is_active IS NULL OR p.is_active = p_is_active)
    -- Apply RLS (user can only see their cooperative's data)
    AND (public.is_admin() OR p.cooperative_id = public.get_user_cooperative_id())
  ORDER BY 
    CASE WHEN p_query IS NOT NULL AND p_query != '' 
      THEN GREATEST(
        similarity(p.name, p_query),
        similarity(p.code, p_query),
        COALESCE(similarity(p.phone, p_query), 0)
      )
      ELSE 0 
    END DESC,
    p.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON FUNCTION public.search_chef_planteurs IS 
  'Searches chef_planteurs with fuzzy matching and filters, respects RLS';

COMMENT ON FUNCTION public.search_planteurs IS 
  'Searches planteurs with fuzzy matching and filters, respects RLS';
