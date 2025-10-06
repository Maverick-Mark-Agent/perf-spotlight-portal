-- Fix RLS policy to allow anonymous (frontend) access to client_zipcodes
-- The frontend uses the anon key, not authenticated sessions
-- This allows public read access to ZIP code data

CREATE POLICY "Allow public read client_zipcodes"
  ON public.client_zipcodes
  FOR SELECT
  USING (true);

-- Note: Write operations still require service_role via existing policy
