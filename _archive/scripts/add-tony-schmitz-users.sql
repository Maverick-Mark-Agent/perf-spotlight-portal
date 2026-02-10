-- Add Tony Schmitz workspace access for his team
-- Run this in Supabase SQL Editor after creating the user accounts

DO $$
DECLARE
  tony_emails TEXT[] := ARRAY[
    'jeremy.tschmitz@farmersagency.com',
    'sara.tschmitz@farmersagency.com',
    'sarah.tschmitz@farmersagency.com',
    'tschmitz@farmersagent.com'
  ];
  user_email TEXT;
  user_id UUID;
  users_added INT := 0;
BEGIN
  -- Loop through each email
  FOREACH user_email IN ARRAY tony_emails
  LOOP
    -- Get the user ID from auth.users
    SELECT id INTO user_id
    FROM auth.users
    WHERE email = user_email;

    -- Only proceed if user exists
    IF user_id IS NOT NULL THEN
      -- Insert client role for Tony Schmitz workspace
      INSERT INTO public.user_workspace_access (user_id, workspace_name, role, created_by)
      VALUES (user_id, 'Tony Schmitz', 'client', user_id)
      ON CONFLICT (user_id, workspace_name) DO UPDATE
      SET role = 'client';

      users_added := users_added + 1;
      RAISE NOTICE 'Tony Schmitz workspace access granted to: %', user_email;
    ELSE
      RAISE WARNING 'User not found: % (create this user first)', user_email;
    END IF;
  END LOOP;

  RAISE NOTICE '✅ Successfully granted Tony Schmitz access to % users', users_added;
END $$;

-- Verify the users were added
SELECT
  u.email,
  uwa.workspace_name,
  uwa.role,
  uwa.created_at
FROM auth.users u
JOIN public.user_workspace_access uwa ON u.id = uwa.user_id
WHERE uwa.workspace_name = 'Tony Schmitz'
ORDER BY u.email;
