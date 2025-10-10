-- Create exec_sql function for running SQL through Edge Functions
-- This allows us to run migrations programmatically

CREATE OR REPLACE FUNCTION public.exec_sql(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql;
END;
$$;

COMMENT ON FUNCTION public.exec_sql(text) IS 'Execute arbitrary SQL - USE WITH CAUTION';
