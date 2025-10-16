-- =====================================================
-- VERIFY get_user_workspaces FUNCTION STATUS
-- =====================================================

-- 1. Check if function exists and view its definition
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'get_user_workspaces'
  AND pronamespace = 'public'::regnamespace;

-- 2. Test the function with a known user
-- Replace this UUID with an actual user ID from your system
-- You can get one by running: SELECT id, email FROM auth.users LIMIT 1;

-- First, let's see if we have any users at all
SELECT id, email, created_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 5;

-- Then check their workspace access
SELECT ua.user_id, u.email, ua.workspace_name, ua.role
FROM user_workspace_access ua
JOIN auth.users u ON u.id = ua.user_id
LIMIT 10;
