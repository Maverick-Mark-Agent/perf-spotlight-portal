-- Emergency fix for Tony's access
-- First, let's see what access Tony has

-- Check Tony's current access
SELECT
  u.email,
  uwa.workspace_name,
  uwa.role
FROM auth.users u
LEFT JOIN public.user_workspace_access uwa ON u.id = uwa.user_id
WHERE u.email ILIKE '%tschmitz%'
ORDER BY u.email, uwa.workspace_name;

-- If Tony has admin role, remove it and give him ONLY client access to Tony Schmitz workspace
DO $$
DECLARE
  tony_user_id UUID;
BEGIN
  -- Find Tony's user ID (try all variations)
  SELECT id INTO tony_user_id
  FROM auth.users
  WHERE email IN (
    'jeremy.tschmitz@farmersagency.com',
    'sara.tschmitz@farmersagency.com',
    'sarah.tschmitz@farmersagency.com',
    'tschmitz@farmersagent.com'
  )
  LIMIT 1;

  IF tony_user_id IS NOT NULL THEN
    -- Remove ALL existing access
    DELETE FROM public.user_workspace_access
    WHERE user_id = tony_user_id;

    -- Add ONLY Tony Schmitz workspace with client role
    INSERT INTO public.user_workspace_access (user_id, workspace_name, role)
    VALUES (tony_user_id, 'Tony Schmitz', 'client');

    RAISE NOTICE '✅ Fixed access - Tony now has ONLY Tony Schmitz workspace';
  ELSE
    RAISE WARNING 'Tony user not found';
  END IF;
END $$;

-- Verify the fix
SELECT
  u.email,
  uwa.workspace_name,
  uwa.role
FROM auth.users u
JOIN public.user_workspace_access uwa ON u.id = uwa.user_id
WHERE u.email ILIKE '%tschmitz%';
