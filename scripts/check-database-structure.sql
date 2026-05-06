-- Check database structure for notifications testing
-- Run this first to understand the actual table structure

-- Check cooperatives table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'cooperatives' 
ORDER BY ordinal_position;

-- Check planteurs table structure  
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'planteurs' 
ORDER BY ordinal_position;

-- Check parcelles table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'parcelles' 
ORDER BY ordinal_position;

-- Check profiles table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'profiles' 
ORDER BY ordinal_position;

-- Check notifications table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'notifications' 
ORDER BY ordinal_position;

-- Check ndvi_results table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'ndvi_results' 
ORDER BY ordinal_position;