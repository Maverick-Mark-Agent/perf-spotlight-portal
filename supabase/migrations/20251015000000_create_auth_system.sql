-- =====================================================
-- AUTHENTICATION SYSTEM FOR CLIENT PORTAL
-- =====================================================
-- This migration creates the authentication infrastructure
-- for secure client portal access with workspace isolation
-- =====================================================

-- 1. Create user_workspace_access table
-- This table links authenticated users to their allowed workspaces
CREATE TABLE IF NOT EXISTS public.user_workspace_access (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_name TEXT NOT NULL,
  role TEXT DEFAULT 'client' CHECK (role IN ('client', 'admin', 'viewer')),

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,

  -- Ensure one record per user per workspace
  UNIQUE(user_id, workspace_name)
);

-- 2. Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_workspace_user_id ON public.user_workspace_access(user_id);
CREATE INDEX IF NOT EXISTS idx_user_workspace_workspace_name ON public.user_workspace_access(workspace_name);

-- 3. Enable RLS on user_workspace_access
ALTER TABLE public.user_workspace_access ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for user_workspace_access
-- Users can only see their own workspace access
CREATE POLICY "Users can view their own workspace access" ON public.user_workspace_access
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Service role can do anything
CREATE POLICY "Service role full access to workspace access" ON public.user_workspace_access
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Admins can manage all access (for future admin panel)
CREATE POLICY "Admins can manage workspace access" ON public.user_workspace_access
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_workspace_access
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_workspace_access
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- 5. Update client_leads RLS policies for workspace isolation
-- First, drop existing anon read policy (we'll require authentication)
DROP POLICY IF EXISTS "Allow anon read access" ON public.client_leads;
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.client_leads;

-- Enable RLS on client_leads if not already enabled
ALTER TABLE public.client_leads ENABLE ROW LEVEL SECURITY;

-- Users can only see leads from workspaces they have access to
CREATE POLICY "Users can view leads from their workspaces" ON public.client_leads
  FOR SELECT
  TO authenticated
  USING (
    workspace_name IN (
      SELECT workspace_name
      FROM public.user_workspace_access
      WHERE user_id = auth.uid()
    )
  );

-- Users can update leads in their workspaces (for pipeline management)
CREATE POLICY "Users can update leads in their workspaces" ON public.client_leads
  FOR UPDATE
  TO authenticated
  USING (
    workspace_name IN (
      SELECT workspace_name
      FROM public.user_workspace_access
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    workspace_name IN (
      SELECT workspace_name
      FROM public.user_workspace_access
      WHERE user_id = auth.uid()
    )
  );

-- Service role maintains full access for sync operations
CREATE POLICY "Service role full access to client_leads" ON public.client_leads
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Anon users can still read (for now, until we migrate dashboard to auth)
-- This allows the admin dashboard to continue working
CREATE POLICY "Anon read access for admin dashboard" ON public.client_leads
  FOR SELECT
  TO anon
  USING (true);

-- 6. Create helper function to check workspace access
CREATE OR REPLACE FUNCTION public.user_has_workspace_access(
  p_user_id UUID,
  p_workspace_name TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_workspace_access
    WHERE user_id = p_user_id
    AND workspace_name = p_workspace_name
  );
END;
$$;

-- 7. Create function to get user's workspaces
CREATE OR REPLACE FUNCTION public.get_user_workspaces(p_user_id UUID)
RETURNS TABLE (
  workspace_name TEXT,
  role TEXT,
  leads_count BIGINT,
  won_leads_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    uwa.workspace_name,
    uwa.role,
    COUNT(DISTINCT cl.id) AS leads_count,
    COUNT(DISTINCT cl.id) FILTER (WHERE cl.pipeline_stage = 'won') AS won_leads_count
  FROM public.user_workspace_access uwa
  LEFT JOIN public.client_leads cl ON cl.workspace_name = uwa.workspace_name
  WHERE uwa.user_id = p_user_id
  GROUP BY uwa.workspace_name, uwa.role
  ORDER BY uwa.workspace_name;
END;
$$;

-- 8. Create profile table for additional user info (optional)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  company TEXT,
  phone TEXT,
  avatar_url TEXT,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS on user_profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Users can only see and update their own profile
CREATE POLICY "Users can view own profile" ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Service role full access
CREATE POLICY "Service role full access to profiles" ON public.user_profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 9. Create trigger to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 10. Updated_at triggers
CREATE OR REPLACE FUNCTION update_user_workspace_access_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_workspace_access_updated_at
  BEFORE UPDATE ON public.user_workspace_access
  FOR EACH ROW
  EXECUTE FUNCTION update_user_workspace_access_updated_at();

CREATE OR REPLACE FUNCTION update_user_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_user_profiles_updated_at();

-- 11. Comments for documentation
COMMENT ON TABLE public.user_workspace_access IS 'Links authenticated users to their allowed workspaces for client portal access';
COMMENT ON TABLE public.user_profiles IS 'Extended user profile information for client portal users';
COMMENT ON FUNCTION public.user_has_workspace_access IS 'Check if a user has access to a specific workspace';
COMMENT ON FUNCTION public.get_user_workspaces IS 'Get all workspaces accessible by a user with lead counts';

-- 12. Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_workspace_access TO authenticated;
GRANT SELECT, UPDATE ON public.user_profiles TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_workspaces TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_workspace_access TO authenticated;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- Next steps:
-- 1. Enable Email Authentication in Supabase Dashboard
-- 2. Create initial users via Supabase Auth Admin
-- 3. Insert workspace access for each user
-- 4. Update frontend to use authentication
-- =====================================================
