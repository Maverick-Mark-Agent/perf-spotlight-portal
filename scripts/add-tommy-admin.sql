-- Add Tommy as admin user
-- Find the user ID first
DO $$
DECLARE
  tommy_user_id uuid;
BEGIN
  -- Get Tommy's user ID from auth.users
  SELECT id INTO tommy_user_id
  FROM auth.users
  WHERE email = 'thomaschavez@maverickmarketingllc.com';

  -- Check if user exists
  IF tommy_user_id IS NULL THEN
    RAISE NOTICE 'User with email thomaschavez@maverickmarketingllc.com not found!';
    RAISE NOTICE 'Available users:';
    FOR r IN SELECT email FROM auth.users LOOP
      RAISE NOTICE '  - %', r.email;
    END LOOP;
  ELSE
    RAISE NOTICE 'Found user: thomaschavez@maverickmarketingllc.com';
    RAISE NOTICE 'User ID: %', tommy_user_id;

    -- Insert admin role (only if doesn't exist)
    INSERT INTO user_workspace_access (user_id, workspace_name, role)
    VALUES (tommy_user_id, 'admin', 'admin')
    ON CONFLICT (user_id, workspace_name) DO NOTHING;

    RAISE NOTICE '✅ Admin role added successfully!';

    -- Verify
    RAISE NOTICE 'Verifying admin access...';
    FOR r IN
      SELECT workspace_name, role
      FROM user_workspace_access
      WHERE user_id = tommy_user_id AND role = 'admin'
    LOOP
      RAISE NOTICE '  - Workspace: %, Role: %', r.workspace_name, r.role;
    END LOOP;
  END IF;
END $$;
