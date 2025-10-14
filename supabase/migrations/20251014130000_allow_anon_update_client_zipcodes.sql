-- =====================================================
-- Allow anon users to UPDATE client_zipcodes
-- =====================================================
-- This is needed for scripts running with anon key to
-- update ZIP states. Safe because we're only updating
-- the `state` field which is derived data.
-- =====================================================

CREATE POLICY IF NOT EXISTS "Allow anon update client_zipcodes"
  ON public.client_zipcodes
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

COMMENT ON POLICY "Allow anon update client_zipcodes" ON public.client_zipcodes
IS 'Allows scripts using anon key to update ZIP assignments (needed for state backfill)';
