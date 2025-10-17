-- Fix RLS policies on user_workspace_access to allow users to read their own access
-- This is critical for AuthContext to check if user is admin

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can read their own workspace access" ON user_workspace_access;
DROP POLICY IF EXISTS "Service role can do anything" ON user_workspace_access;

-- Allow users to read their own access entries
CREATE POLICY "Users can read their own workspace access"
ON user_workspace_access
FOR SELECT
USING (auth.uid() = user_id);

-- Allow service role full access
CREATE POLICY "Service role can do anything"
ON user_workspace_access
FOR ALL
USING (auth.role() = 'service_role');

-- Ensure RLS is enabled
ALTER TABLE user_workspace_access ENABLE ROW LEVEL SECURITY;
