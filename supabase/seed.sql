-- CocoaTrack V2 - Seed Data
-- This file seeds the database with initial data for development and testing

-- ============================================================================
-- REGIONS
-- ============================================================================
INSERT INTO public.regions (id, name, code, created_at)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Centre', 'CTR', NOW()),
  ('22222222-2222-2222-2222-222222222222', 'Littoral', 'LIT', NOW()),
  ('33333333-3333-3333-3333-333333333333', 'Sud-Ouest', 'SWR', NOW()),
  ('44444444-4444-4444-4444-444444444444', 'Sud', 'SUD', NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- COOPERATIVES
-- ============================================================================
INSERT INTO public.cooperatives (id, name, code, region_id, address, phone, created_at, updated_at)
VALUES 
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Coopérative Centrale du Cacao', 'CCC', '11111111-1111-1111-1111-111111111111', 'Yaoundé, Centre', '+237 600 000 001', NOW(), NOW()),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Coopérative du Littoral', 'CDL', '22222222-2222-2222-2222-222222222222', 'Douala, Littoral', '+237 600 000 002', NOW(), NOW()),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Coopérative Sud-Ouest Cacao', 'CSO', '33333333-3333-3333-3333-333333333333', 'Buea, Sud-Ouest', '+237 600 000 003', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- WAREHOUSES
-- ============================================================================
INSERT INTO public.warehouses (id, name, code, cooperative_id, latitude, longitude, capacity_kg, is_active, created_at, updated_at)
VALUES 
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Entrepôt Central Yaoundé', 'ECY', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 3.8480, 11.5021, 50000.00, true, NOW(), NOW()),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Entrepôt Douala Port', 'EDP', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 4.0511, 9.7679, 100000.00, true, NOW(), NOW()),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'Entrepôt Buea', 'EBU', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 4.1560, 9.2400, 30000.00, true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- ADMIN USER
-- Note: The admin user is created via Supabase Auth, then the profile is auto-created
-- by the handle_new_user() trigger. This seed creates a profile for testing purposes.
-- In production, users are created through the Auth flow.
-- ============================================================================

-- Create admin user in auth.users (for local development only)
-- Password: Admin123!
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  role,
  aud,
  confirmation_token
)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'admin@cocoatrack.cm',
  crypt('Admin123!', gen_salt('bf')),
  NOW(),
  '{"provider": "email", "providers": ["email"]}',
  '{"full_name": "Administrateur Système"}',
  NOW(),
  NOW(),
  'authenticated',
  'authenticated',
  ''
)
ON CONFLICT (id) DO NOTHING;

-- Create admin profile
INSERT INTO public.profiles (id, email, full_name, role, cooperative_id, region_id, phone, is_active, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'admin@cocoatrack.cm',
  'Administrateur Système',
  'admin',
  NULL, -- Admin has access to all cooperatives
  NULL, -- Admin has access to all regions
  '+237 600 000 000',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- TEST USERS (for development)
-- ============================================================================

-- Manager user for Coopérative Centrale
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  role,
  aud,
  confirmation_token
)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000000',
  'manager@cocoatrack.cm',
  crypt('Manager123!', gen_salt('bf')),
  NOW(),
  '{"provider": "email", "providers": ["email"]}',
  '{"full_name": "Manager CCC"}',
  NOW(),
  NOW(),
  'authenticated',
  'authenticated',
  ''
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, email, full_name, role, cooperative_id, region_id, phone, is_active, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'manager@cocoatrack.cm',
  'Manager CCC',
  'manager',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111',
  '+237 600 000 010',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Agent user for Coopérative Centrale
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  role,
  aud,
  confirmation_token
)
VALUES (
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000000',
  'agent@cocoatrack.cm',
  crypt('Agent123!', gen_salt('bf')),
  NOW(),
  '{"provider": "email", "providers": ["email"]}',
  '{"full_name": "Agent Terrain"}',
  NOW(),
  NOW(),
  'authenticated',
  'authenticated',
  ''
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, email, full_name, role, cooperative_id, region_id, phone, is_active, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000003',
  'agent@cocoatrack.cm',
  'Agent Terrain',
  'agent',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111',
  '+237 600 000 020',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Viewer user for Coopérative du Littoral
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  role,
  aud,
  confirmation_token
)
VALUES (
  '00000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000000',
  'viewer@cocoatrack.cm',
  crypt('Viewer123!', gen_salt('bf')),
  NOW(),
  '{"provider": "email", "providers": ["email"]}',
  '{"full_name": "Observateur CDL"}',
  NOW(),
  NOW(),
  'authenticated',
  'authenticated',
  ''
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, email, full_name, role, cooperative_id, region_id, phone, is_active, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000004',
  'viewer@cocoatrack.cm',
  'Observateur CDL',
  'viewer',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  '22222222-2222-2222-2222-222222222222',
  '+237 600 000 030',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- Test Users:
-- | Email                  | Password     | Role    | Cooperative              |
-- |------------------------|--------------|---------|--------------------------|
-- | admin@cocoatrack.cm    | Admin123!    | admin   | All (NULL)               |
-- | manager@cocoatrack.cm  | Manager123!  | manager | Coopérative Centrale     |
-- | agent@cocoatrack.cm    | Agent123!    | agent   | Coopérative Centrale     |
-- | viewer@cocoatrack.cm   | Viewer123!   | viewer  | Coopérative du Littoral  |
