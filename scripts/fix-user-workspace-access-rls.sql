-- =====================================================
-- FIX user_workspace_access RLS TO ALLOW ANON READ
-- =====================================================
-- The issue is that anon users (unauthenticated) cannot read
-- user_workspace_access table, which breaks the Edge Function.
-- We need to allow the Edge Function (running as service_role)
-- to access this table.
-- =====================================================

-- First, let's check existing policies
-- You can run: SELECT * FROM pg_policies WHERE tablename = 'user_workspace_access';

-- Drop the restrictive policy that only allows users to see their own access
-- DROP POLICY IF EXISTS "Users can view their own workspace access" ON public.user_workspace_access;

-- Actually, we should keep the existing policies and just make sure
-- the Edge Function can access this table. The Edge Function uses
-- service_role key which should bypass RLS.

-- Let's verify the grants are correct
GRANT USAGE ON SCHEMA public TO authenticated, anon, service_role;
GRANT SELECT ON public.user_workspace_access TO authenticated, anon, service_role;
GRANT SELECT ON public.client_registry TO authenticated, anon, service_role;
GRANT SELECT ON public.client_leads TO authenticated, anon, service_role;

-- The actual issue might be that the get_user_workspaces function
-- needs to run as SECURITY DEFINER to bypass RLS when querying
-- Let's verify it's set correctly

-- Check if the function exists and has correct settings
SELECT
  p.proname as function_name,
  CASE
    WHEN prosecdef THEN 'SECURITY DEFINER'
    ELSE 'SECURITY INVOKER'
  END as security_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'get_user_workspaces'
  AND n.nspname = 'public';

-- If the above shows SECURITY INVOKER, that's the problem!
-- The function should be SECURITY DEFINER to bypass RLS

-- Let's also check if there are any NULL workspace_ids in client_registry
-- which could cause the LEFT JOIN to fail
SELECT COUNT(*) as total_workspaces,
       COUNT(workspace_id) as workspaces_with_id,
       COUNT(*) - COUNT(workspace_id) as workspaces_missing_id
FROM client_registry;
