-- ============================================================================
-- CocoaTrack V2 - Promote User to Admin
-- Run this AFTER creating the user via Authentication > Users
-- ============================================================================

-- Update the user's role to admin
UPDATE public.profiles 
SET 
  role = 'admin',
  full_name = 'Christian Ouragan',
  cooperative_id = NULL,  -- Admin has access to all cooperatives
  updated_at = NOW()
WHERE email = 'christianouragan@gmail.com';

-- Verify the update
SELECT id, email, full_name, role, is_active, created_at 
FROM public.profiles 
WHERE email = 'christianouragan@gmail.com';
