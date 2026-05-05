-- Check RLS policies on ndvi_results table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'ndvi_results'
ORDER BY policyname;
