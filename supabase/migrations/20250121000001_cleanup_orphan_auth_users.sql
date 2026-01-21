-- Cleanup orphan auth users that don't have profiles
-- This can happen when user creation partially fails

-- Find and delete auth users without profiles
DO $$
DECLARE
    orphan_user_id uuid;
BEGIN
    -- Find auth users without corresponding profiles
    FOR orphan_user_id IN 
        SELECT id 
        FROM auth.users 
        WHERE id NOT IN (SELECT id FROM public.profiles)
    LOOP
        -- Delete the orphan auth user
        DELETE FROM auth.users WHERE id = orphan_user_id;
        RAISE NOTICE 'Deleted orphan auth user: %', orphan_user_id;
    END LOOP;
END $$;
