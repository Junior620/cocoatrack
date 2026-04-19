-- ============================================================================
-- Migration: Fix UTF-8 encoding issues in planteurs names
-- Description: Corrige les caractères mal encodés (Ã©→é, Ã→à, etc.)
--              causés par un import shapefile en Latin-1 au lieu d'UTF-8
-- Date: 2026-04-19
-- ============================================================================

-- Fonction pour corriger l'encodage UTF-8
CREATE OR REPLACE FUNCTION fix_utf8_encoding(text_input TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN text_input
    -- Lettres minuscules avec accents
    REPLACE('Ã©', 'é')    -- e accent aigu
    REPLACE('Ã¨', 'è')    -- e accent grave
    REPLACE('Ãª', 'ê')    -- e accent circonflexe
    REPLACE('Ã«', 'ë')    -- e tréma
    REPLACE('Ã ', 'à')    -- a accent grave
    REPLACE('Ã¢', 'â')    -- a accent circonflexe
    REPLACE('Ã¤', 'ä')    -- a tréma
    REPLACE('Ã®', 'î')    -- i accent circonflexe
    REPLACE('Ã¯', 'ï')    -- i tréma
    REPLACE('Ã´', 'ô')    -- o accent circonflexe
    REPLACE('Ã¶', 'ö')    -- o tréma
    REPLACE('Ã¹', 'ù')    -- u accent grave
    REPLACE('Ã»', 'û')    -- u accent circonflexe
    REPLACE('Ã¼', 'ü')    -- u tréma
    REPLACE('Ã§', 'ç')    -- c cédille
    REPLACE('Ã±', 'ñ')    -- n tilde
    
    -- Lettres majuscules avec accents
    REPLACE('Ã‰', 'É')    -- E accent aigu
    REPLACE('Ãˆ', 'È')    -- E accent grave
    REPLACE('ÃŠ', 'Ê')    -- E accent circonflexe
    REPLACE('Ã‹', 'Ë')    -- E tréma
    REPLACE('Ã€', 'À')    -- A accent grave
    REPLACE('Ã‚', 'Â')    -- A accent circonflexe
    REPLACE('Ã„', 'Ä')    -- A tréma
    REPLACE('ÃŽ', 'Î')    -- I accent circonflexe
    REPLACE('Ã', 'Ï')    -- I tréma
    REPLACE('Ã"', 'Ô')    -- O accent circonflexe
    REPLACE('Ã–', 'Ö')    -- O tréma
    REPLACE('Ã™', 'Ù')    -- U accent grave
    REPLACE('Ã›', 'Û')    -- U accent circonflexe
    REPLACE('Ãœ', 'Ü')    -- U tréma
    REPLACE('Ã‡', 'Ç')    -- C cédille
    REPLACE('Ã'', 'Ñ')    -- N tilde
    
    -- Caractères spéciaux
    REPLACE('Å"', 'œ')    -- oe ligature
    REPLACE('Å'', 'Œ')    -- OE ligature
    REPLACE('Ã¦', 'æ')    -- ae ligature
    REPLACE('Ã†', 'Æ')    -- AE ligature
    
    -- Double encodage (cas où Ã est suivi d'un espace)
    REPLACE('Ã ', 'à')
    REPLACE('Ã©', 'é');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Corriger les noms des planteurs
UPDATE planteurs
SET name = fix_utf8_encoding(name)
WHERE name ~ 'Ã';

-- Afficher le nombre de planteurs corrigés
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM planteurs
  WHERE name ~ 'Ã';
  
  RAISE NOTICE '% planteur(s) avec encodage corrigé', v_count;
END $$;

-- Nettoyer la fonction temporaire
DROP FUNCTION IF EXISTS fix_utf8_encoding(TEXT);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Vérifier s'il reste des caractères mal encodés
SELECT 
  COUNT(*) as planteurs_avec_problemes,
  ARRAY_AGG(name) FILTER (WHERE name ~ 'Ã') as exemples
FROM planteurs
WHERE name ~ 'Ã'
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
