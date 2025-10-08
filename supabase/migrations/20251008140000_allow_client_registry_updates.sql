-- Allow authenticated users to update client_registry
-- This is needed for the Client Management dashboard to work

CREATE POLICY "Allow authenticated updates to client_registry"
  ON public.client_registry
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

COMMENT ON POLICY "Allow authenticated updates to client_registry" ON public.client_registry
IS 'Allows Client Management dashboard to update client data';
