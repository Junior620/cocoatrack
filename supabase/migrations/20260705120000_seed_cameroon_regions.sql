-- Seed the 10 administrative regions of Cameroon for cooperatives.region_id
-- Replaces the legacy "Côte d'Ivoire" placeholder used in early setup scripts.

INSERT INTO public.regions (id, name, code) VALUES
  ('a1000001-0000-4000-8000-000000000001', 'Adamaoua', 'ADA'),
  ('a1000001-0000-4000-8000-000000000002', 'Centre', 'CTR'),
  ('a1000001-0000-4000-8000-000000000003', 'Est', 'EST'),
  ('a1000001-0000-4000-8000-000000000004', 'Extrême-Nord', 'ENR'),
  ('a1000001-0000-4000-8000-000000000005', 'Littoral', 'LIT'),
  ('a1000001-0000-4000-8000-000000000006', 'Nord', 'NRD'),
  ('a1000001-0000-4000-8000-000000000007', 'Nord-Ouest', 'NOU'),
  ('a1000001-0000-4000-8000-000000000008', 'Ouest', 'OUE'),
  ('a1000001-0000-4000-8000-000000000009', 'Sud', 'SUD'),
  ('a1000001-0000-4000-8000-00000000000a', 'Sud-Ouest', 'SOU')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;

-- Reassign cooperatives still linked to the Ivory Coast placeholder
UPDATE public.cooperatives c
SET region_id = r_ctr.id
FROM public.regions r_legacy,
     public.regions r_ctr
WHERE c.region_id = r_legacy.id
  AND r_ctr.code = 'CTR'
  AND (
    r_legacy.code = 'CI'
    OR r_legacy.name ILIKE 'Côte d''Ivoire'
    OR r_legacy.name ILIKE 'Cote d''Ivoire'
  );

-- Remove legacy placeholder rows (safe once cooperatives are reassigned)
DELETE FROM public.regions r
WHERE (
    r.code = 'CI'
    OR r.name ILIKE 'Côte d''Ivoire'
    OR r.name ILIKE 'Cote d''Ivoire'
  )
  AND NOT EXISTS (SELECT 1 FROM public.cooperatives c WHERE c.region_id = r.id);
