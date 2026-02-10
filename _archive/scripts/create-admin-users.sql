-- Create Admin Users for Maverick Marketing Team
-- Run this in Supabase SQL Editor after creating the user accounts

DO $$
DECLARE
  admin_emails TEXT[] := ARRAY[
    'aroosa@maverickmarketingllc.com',
    'bojan@maverickmarketingllc.com',
    'hussain@maverickmarketingllc.com',
    'sarah@maverickmarketingllc.com',
    'thomaschavez@maverickmarketingllc.com'
  ];
  admin_email TEXT;
  admin_user_id UUID;
  users_added INT := 0;
BEGIN
  -- Loop through each admin email
  FOREACH admin_email IN ARRAY admin_emails
  LOOP
    -- Get the user ID from auth.users
    SELECT id INTO admin_user_id
    FROM auth.users
    WHERE email = admin_email;

    -- Only proceed if user exists
    IF admin_user_id IS NOT NULL THEN
      -- Insert admin role for this user
      INSERT INTO public.user_workspace_access (user_id, workspace_name, role, created_by)
      VALUES (admin_user_id, 'Admin Dashboard', 'admin', admin_user_id)
      ON CONFLICT (user_id, workspace_name) DO UPDATE
      SET role = 'admin';

      users_added := users_added + 1;
      RAISE NOTICE 'Admin access granted to: %', admin_email;
    ELSE
      RAISE WARNING 'User not found: % (create this user first)', admin_email;
    END IF;
  END LOOP;

  RAISE NOTICE '✅ Successfully granted admin access to % users', users_added;
END $$;

-- Verify admin users
SELECT
  u.email,
  uwa.workspace_name,
  uwa.role,
  uwa.created_at
FROM auth.users u
JOIN public.user_workspace_access uwa ON u.id = uwa.user_id
WHERE uwa.role = 'admin'
ORDER BY u.email;
