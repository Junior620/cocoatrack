-- Check all relevant table structures
SELECT 'parcelles' as table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'parcelles' 
UNION ALL
SELECT 'planteurs' as table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'planteurs' 
UNION ALL
SELECT 'profiles' as table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles'
ORDER BY table_name, column_name;