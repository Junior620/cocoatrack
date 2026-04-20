-- ============================================================================
-- Migration: Fix UTF-8 encoding issues in planteurs names
-- Description: Corrige les caractères mal encodés (Ã©→é, Ã→à, etc.)
--              causés par un import shapefile en Latin-1 au lieu d'UTF-8
-- Date: 2026-04-19
-- ============================================================================

-- Corriger les noms des planteurs avec les caractères les plus courants
UPDATE planteurs
SET name = 
  REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
    name,
    'Ã©', 'é'),
    'Ã¨', 'è'),
    'Ãª', 'ê'),
    'Ã ', 'à'),
    'Ã¢', 'â'),
    'Ã®', 'î'),
    'Ã´', 'ô'),
    'Ã¹', 'ù'),
    'Ã»', 'û'),
    'Ã§', 'ç'),
    'Ã‰', 'É'),
    'Ã€', 'À')
WHERE name LIKE '%Ã%';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Afficher quelques exemples de noms corrigés
SELECT 
  id,
  name,
  code
FROM planteurs
WHERE created_at > NOW() - INTERVAL '1 day'
  AND (name LIKE '%é%' OR name LIKE '%è%' OR name LIKE '%à%' OR name LIKE '%ô%')
ORDER BY name
LIMIT 10;

-- ============================================================================
-- NOTES
-- ============================================================================
-- Cette migration corrige les caractères mal encodés causés par un import
-- shapefile en Latin-1 (ISO-8859-1) au lieu d'UTF-8.
-- 
-- Exemples de corrections :
-- - "Ã©" → "é"
-- - "Ã " → "à"
-- - "Ã´" → "ô"
-- ============================================================================
