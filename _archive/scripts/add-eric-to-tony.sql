-- =====================================================
-- ADD ERIC TO TONY SCHMITZ WORKSPACE
-- =====================================================
-- Adds eric.tschmitz@farmersagency.com to Tony Schmitz workspace
-- =====================================================

DO $$
DECLARE
  user_id UUID;
  user_email TEXT := 'eric.tschmitz@farmersagency.com';
BEGIN
  -- Get user ID from auth.users
  SELECT id INTO user_id
  FROM auth.users
  WHERE email = user_email;

  IF user_id IS NOT NULL THEN
    -- Add Tony Schmitz workspace access with client role
    INSERT INTO public.user_workspace_access (user_id, workspace_name, role)
    VALUES (user_id, 'Tony Schmitz', 'client')
    ON CONFLICT (user_id, workspace_name) DO UPDATE
    SET role = 'client';

    RAISE NOTICE '✅ Success: % now has access to Tony Schmitz workspace', user_email;
  ELSE
    RAISE WARNING '⚠️  User not found: %', user_email;
    RAISE NOTICE 'Please create this user first in Supabase Auth Dashboard, then run this script again.';
  END IF;
END $$;
