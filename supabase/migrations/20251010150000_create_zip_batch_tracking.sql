-- Create ZIP batch pulls tracking table
CREATE TABLE IF NOT EXISTS public.zip_batch_pulls (
  id BIGSERIAL PRIMARY KEY,
  workspace_name TEXT NOT NULL REFERENCES public.client_registry(workspace_name) ON DELETE CASCADE,
  month TEXT NOT NULL, -- Format: YYYY-MM (e.g., "2025-12")
  zip TEXT NOT NULL,
  state TEXT,
  batch_number INTEGER NOT NULL, -- Which batch of 25 this ZIP belongs to

  -- Pull tracking
  pulled_at TIMESTAMPTZ,
  pulled_by TEXT, -- User who pulled it

  -- Raw data tracking
  raw_contacts_uploaded INTEGER DEFAULT 0,
  csv_filename TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(workspace_name, month, zip)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_zip_batch_pulls_client_month ON public.zip_batch_pulls(workspace_name, month);
CREATE INDEX IF NOT EXISTS idx_zip_batch_pulls_pulled ON public.zip_batch_pulls(workspace_name, month, pulled_at);
CREATE INDEX IF NOT EXISTS idx_zip_batch_pulls_batch ON public.zip_batch_pulls(workspace_name, month, batch_number);

-- Enable RLS
ALTER TABLE public.zip_batch_pulls ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role full access zip_batch_pulls" ON public.zip_batch_pulls
  FOR ALL USING (auth.role() = 'service_role');

-- Authenticated users can read
CREATE POLICY "Authenticated read zip_batch_pulls" ON public.zip_batch_pulls
  FOR SELECT USING (auth.role() = 'authenticated');

-- Authenticated users can update (for marking as pulled)
CREATE POLICY "Authenticated update zip_batch_pulls" ON public.zip_batch_pulls
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Create view for ZIP progress per client/month
CREATE OR REPLACE VIEW public.client_zip_progress AS
SELECT
  cr.workspace_name,
  cr.display_name,
  zbp.month,
  COUNT(DISTINCT zbp.zip) AS total_zips,
  COUNT(DISTINCT zbp.zip) FILTER (WHERE zbp.pulled_at IS NOT NULL) AS zips_pulled,
  COUNT(DISTINCT zbp.zip) FILTER (WHERE zbp.pulled_at IS NULL) AS zips_remaining,
  SUM(zbp.raw_contacts_uploaded) AS total_raw_contacts,
  MAX(zbp.pulled_at) AS last_pull_date,
  MAX(zbp.batch_number) AS total_batches
FROM public.client_registry cr
LEFT JOIN public.zip_batch_pulls zbp ON cr.workspace_name = zbp.workspace_name
WHERE cr.is_active = true
GROUP BY cr.workspace_name, cr.display_name, zbp.month;

-- Grant access to view
GRANT SELECT ON public.client_zip_progress TO authenticated;
GRANT SELECT ON public.client_zip_progress TO service_role;
