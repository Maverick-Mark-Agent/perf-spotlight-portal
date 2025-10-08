-- =====================================================
-- CONTACT PIPELINE: Automated List Cleaning System
-- =====================================================
-- This migration creates the schema for automating the Cole X Dates → Debounce → Email Bison pipeline.
-- Replaces the manual Clay workflow with fully automated contact processing.
--
-- WORKFLOW:
-- 1. Upload raw CSV from Cole X Dates → raw_contacts
-- 2. Auto-filter & verify via Debounce → verified_contacts
-- 3. Generate weekly batches by renewal window → weekly_batches
-- 4. Upload to Email Bison & track → upload_audit_log
-- =====================================================

-- =====================================================
-- 1. RAW CONTACTS: Store uploaded Cole X Dates data
-- =====================================================
CREATE TABLE IF NOT EXISTS public.raw_contacts (
  id BIGSERIAL PRIMARY KEY,

  -- Upload metadata
  upload_batch_id UUID NOT NULL DEFAULT gen_random_uuid(),
  client_name TEXT NOT NULL,
  workspace_name TEXT REFERENCES public.client_registry(workspace_name),
  month TEXT NOT NULL, -- Format: "2025-11" (processing month)
  uploaded_by TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),

  -- Cole X Dates CSV fields (13 columns)
  first_name TEXT,
  last_name TEXT,
  mailing_address TEXT,
  mailing_city TEXT,
  mailing_state TEXT,
  mailing_zip TEXT,
  property_address TEXT,
  property_city TEXT,
  property_state TEXT,
  property_zip TEXT,
  home_value_estimate DECIMAL(12,2),
  purchase_date DATE,
  email TEXT,

  -- Processing status
  is_head_of_household BOOLEAN DEFAULT false,
  meets_value_criteria BOOLEAN DEFAULT false, -- <$900k (or >$900k for TX HNW)
  is_high_net_worth BOOLEAN DEFAULT false, -- >$900k homes in Texas
  parsed_purchase_date DATE, -- Extracted M, D, Y from purchase_date
  processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending', 'filtered_out', 'ready_for_verification', 'verified', 'failed')),
  filter_reason TEXT, -- Why contact was filtered out

  -- Audit
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Indexes for filtering
  CONSTRAINT valid_email CHECK (email IS NOT NULL AND email ~ '^[^@]+@[^@]+\.[^@]+$')
);

CREATE INDEX idx_raw_contacts_upload_batch ON public.raw_contacts(upload_batch_id);
CREATE INDEX idx_raw_contacts_workspace_month ON public.raw_contacts(workspace_name, month);
CREATE INDEX idx_raw_contacts_status ON public.raw_contacts(processing_status);
CREATE INDEX idx_raw_contacts_purchase_date ON public.raw_contacts(parsed_purchase_date);
CREATE INDEX idx_raw_contacts_zip ON public.raw_contacts(property_zip);

COMMENT ON TABLE public.raw_contacts IS 'Stores raw contact uploads from Cole X Dates CSV files before processing';
COMMENT ON COLUMN public.raw_contacts.upload_batch_id IS 'Groups all contacts from a single CSV upload';
COMMENT ON COLUMN public.raw_contacts.month IS 'Processing month (format: 2025-11) - determines renewal window calculation';
COMMENT ON COLUMN public.raw_contacts.is_high_net_worth IS 'Texas >$900k homes route to separate High Net Worth campaign';


-- =====================================================
-- 2. VERIFIED CONTACTS: Debounce-verified emails
-- =====================================================
CREATE TABLE IF NOT EXISTS public.verified_contacts (
  id BIGSERIAL PRIMARY KEY,
  raw_contact_id BIGINT REFERENCES public.raw_contacts(id) ON DELETE CASCADE,

  -- Contact info (denormalized for performance)
  workspace_name TEXT NOT NULL REFERENCES public.client_registry(workspace_name),
  month TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  email TEXT NOT NULL,
  property_address TEXT,
  property_city TEXT,
  property_state TEXT,
  property_zip TEXT,
  home_value_estimate DECIMAL(12,2),
  purchase_date DATE,

  -- Renewal window calculation
  purchase_day INTEGER, -- Day of month (1-31)
  renewal_start_date DATE, -- M+28 days
  renewal_end_date DATE, -- M+34 days
  week_bucket INTEGER CHECK (week_bucket BETWEEN 1 AND 4), -- 1: days 1-7, 2: days 8-14, 3: days 15-21, 4: days 22-end

  -- Debounce verification results
  debounce_status TEXT CHECK (debounce_status IN ('deliverable', 'undeliverable', 'risky', 'unknown', 'pending')),
  debounce_response JSONB, -- Full Debounce API response
  debounce_verified_at TIMESTAMPTZ,
  debounce_credits_used INTEGER DEFAULT 1,

  -- Campaign routing
  is_high_net_worth BOOLEAN DEFAULT false,
  target_campaign TEXT, -- "Evergreen" or "HNW Evergreen"

  -- Upload tracking
  is_uploaded BOOLEAN DEFAULT false,
  upload_batch_id UUID,
  uploaded_at TIMESTAMPTZ,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure no duplicate emails per workspace/month
  CONSTRAINT unique_verified_contact UNIQUE (workspace_name, month, email)
);

CREATE INDEX idx_verified_contacts_workspace_month ON public.verified_contacts(workspace_name, month);
CREATE INDEX idx_verified_contacts_week_bucket ON public.verified_contacts(week_bucket);
CREATE INDEX idx_verified_contacts_renewal_dates ON public.verified_contacts(renewal_start_date, renewal_end_date);
CREATE INDEX idx_verified_contacts_upload_status ON public.verified_contacts(is_uploaded, week_bucket);
CREATE INDEX idx_verified_contacts_debounce_status ON public.verified_contacts(debounce_status);
CREATE INDEX idx_verified_contacts_hnw ON public.verified_contacts(is_high_net_worth) WHERE is_high_net_worth = true;

COMMENT ON TABLE public.verified_contacts IS 'Email-verified contacts ready for weekly batch uploads to Email Bison';
COMMENT ON COLUMN public.verified_contacts.week_bucket IS 'Weekly batch assignment: 1 (days 1-7), 2 (8-14), 3 (15-21), 4 (22-end)';
COMMENT ON COLUMN public.verified_contacts.renewal_start_date IS 'M+28 days from purchase date';
COMMENT ON COLUMN public.verified_contacts.renewal_end_date IS 'M+34 days from purchase date';


-- =====================================================
-- 3. WEEKLY BATCHES: Track each Monday upload
-- =====================================================
CREATE TABLE IF NOT EXISTS public.weekly_batches (
  batch_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Batch metadata
  workspace_name TEXT NOT NULL REFERENCES public.client_registry(workspace_name),
  month TEXT NOT NULL, -- Processing month (e.g., "2025-11")
  week_number INTEGER NOT NULL CHECK (week_number BETWEEN 1 AND 4),
  week_bucket INTEGER NOT NULL CHECK (week_bucket BETWEEN 1 AND 4), -- Same as verified_contacts.week_bucket

  -- Schedule
  scheduled_upload_date DATE NOT NULL, -- The Monday this batch should be uploaded
  actual_upload_date DATE,

  -- Batch contents
  contact_count INTEGER DEFAULT 0,
  hnw_count INTEGER DEFAULT 0, -- High Net Worth contacts in batch
  csv_file_path TEXT, -- S3/storage path to generated CSV
  csv_generated_at TIMESTAMPTZ,

  -- Email Bison integration
  bison_upload_id TEXT, -- ID returned from Email Bison upload API
  bison_campaign_name TEXT, -- Campaign name after renaming
  bison_upload_status TEXT DEFAULT 'pending' CHECK (bison_upload_status IN ('pending', 'uploaded', 'added_to_campaign', 'failed')),
  bison_error_message TEXT,

  -- Slack approval workflow
  slack_notification_sent BOOLEAN DEFAULT false,
  slack_message_ts TEXT, -- Slack message timestamp for threading
  slack_approved_by TEXT,
  slack_approved_at TIMESTAMPTZ,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_weekly_batches_workspace_month ON public.weekly_batches(workspace_name, month);
CREATE INDEX idx_weekly_batches_schedule ON public.weekly_batches(scheduled_upload_date, bison_upload_status);
CREATE INDEX idx_weekly_batches_status ON public.weekly_batches(bison_upload_status);
CREATE INDEX idx_weekly_batches_slack_approval ON public.weekly_batches(slack_approved_at) WHERE slack_approved_at IS NOT NULL;

COMMENT ON TABLE public.weekly_batches IS 'Tracks each weekly batch upload to Email Bison (every Monday)';
COMMENT ON COLUMN public.weekly_batches.week_number IS 'Which Monday of the month (1-4)';
COMMENT ON COLUMN public.weekly_batches.week_bucket IS 'Which purchase day range: 1 (1-7), 2 (8-14), 3 (15-21), 4 (22-end)';
COMMENT ON COLUMN public.weekly_batches.scheduled_upload_date IS 'The Monday when this batch should be uploaded';

-- Add foreign key constraint to verified_contacts now that weekly_batches exists
ALTER TABLE public.verified_contacts
  ADD CONSTRAINT fk_verified_contacts_batch
  FOREIGN KEY (upload_batch_id) REFERENCES public.weekly_batches(batch_id) ON DELETE SET NULL;


-- =====================================================
-- 4. UPLOAD AUDIT LOG: Complete audit trail
-- =====================================================
CREATE TABLE IF NOT EXISTS public.upload_audit_log (
  id BIGSERIAL PRIMARY KEY,

  -- What was uploaded
  batch_id UUID REFERENCES public.weekly_batches(batch_id) ON DELETE CASCADE,
  workspace_name TEXT NOT NULL,
  month TEXT NOT NULL,

  -- Upload details
  action TEXT NOT NULL CHECK (action IN ('csv_upload', 'contact_verification', 'batch_generation', 'bison_upload', 'campaign_add', 'campaign_rename', 'slack_notification')),
  status TEXT NOT NULL CHECK (status IN ('success', 'partial_success', 'failed')),

  -- Results
  contacts_processed INTEGER DEFAULT 0,
  contacts_succeeded INTEGER DEFAULT 0,
  contacts_failed INTEGER DEFAULT 0,

  -- API responses
  api_endpoint TEXT, -- Email Bison or Debounce endpoint called
  api_request JSONB, -- Request payload
  api_response JSONB, -- Response payload
  error_details JSONB, -- Structured error info

  -- Metrics
  duration_ms INTEGER, -- How long the operation took
  credits_used INTEGER, -- Debounce credits consumed

  -- Audit
  performed_by TEXT DEFAULT 'system',
  performed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_upload_audit_batch ON public.upload_audit_log(batch_id);
CREATE INDEX idx_upload_audit_workspace_month ON public.upload_audit_log(workspace_name, month);
CREATE INDEX idx_upload_audit_action ON public.upload_audit_log(action);
CREATE INDEX idx_upload_audit_status ON public.upload_audit_log(status);
CREATE INDEX idx_upload_audit_date ON public.upload_audit_log(performed_at DESC);

COMMENT ON TABLE public.upload_audit_log IS 'Complete audit trail of all automated pipeline operations';
COMMENT ON COLUMN public.upload_audit_log.action IS 'Type of operation performed in the pipeline';


-- =====================================================
-- 5. DEBOUNCE USAGE TRACKING: Monitor API credits
-- =====================================================
CREATE TABLE IF NOT EXISTS public.debounce_usage (
  id BIGSERIAL PRIMARY KEY,

  -- Usage details
  month TEXT NOT NULL, -- Format: "2025-11"
  workspace_name TEXT,
  batch_id UUID REFERENCES public.weekly_batches(batch_id),

  -- Credits
  credits_used INTEGER NOT NULL DEFAULT 0,
  emails_verified INTEGER NOT NULL DEFAULT 0,
  deliverable_count INTEGER DEFAULT 0,
  undeliverable_count INTEGER DEFAULT 0,
  risky_count INTEGER DEFAULT 0,
  unknown_count INTEGER DEFAULT 0,

  -- Audit
  verified_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_debounce_usage_month ON public.debounce_usage(month);
CREATE INDEX idx_debounce_usage_workspace ON public.debounce_usage(workspace_name);
CREATE INDEX idx_debounce_usage_date ON public.debounce_usage(verified_at DESC);

COMMENT ON TABLE public.debounce_usage IS 'Tracks Debounce API credit usage for billing and monitoring';


-- =====================================================
-- 6. CLIENT CONTACT QUOTAS: Track monthly targets
-- =====================================================
-- Add columns to existing client_registry if needed
DO $$
BEGIN
  -- Add monthly_contact_target column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_registry'
    AND column_name = 'monthly_contact_target'
  ) THEN
    ALTER TABLE public.client_registry
    ADD COLUMN monthly_contact_target INTEGER DEFAULT 0;

    COMMENT ON COLUMN public.client_registry.monthly_contact_target IS 'Monthly contact quota: 15k for 100-lead tier, 30k for 200-lead tier';
  END IF;

  -- Add contact_tier column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_registry'
    AND column_name = 'contact_tier'
  ) THEN
    ALTER TABLE public.client_registry
    ADD COLUMN contact_tier TEXT CHECK (contact_tier IN ('100_leads', '200_leads', 'custom'));

    COMMENT ON COLUMN public.client_registry.contact_tier IS 'Lead generation tier: 100_leads (15k/mo), 200_leads (30k/mo), or custom';
  END IF;
END $$;


-- =====================================================
-- 7. RLS POLICIES: Security
-- =====================================================

-- raw_contacts
ALTER TABLE public.raw_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access raw_contacts"
  ON public.raw_contacts FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Authenticated read raw_contacts"
  ON public.raw_contacts FOR SELECT
  USING (auth.role() = 'authenticated');

-- verified_contacts
ALTER TABLE public.verified_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access verified_contacts"
  ON public.verified_contacts FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Authenticated read verified_contacts"
  ON public.verified_contacts FOR SELECT
  USING (auth.role() = 'authenticated');

-- weekly_batches
ALTER TABLE public.weekly_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access weekly_batches"
  ON public.weekly_batches FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Authenticated read weekly_batches"
  ON public.weekly_batches FOR SELECT
  USING (auth.role() = 'authenticated');

-- upload_audit_log
ALTER TABLE public.upload_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access upload_audit_log"
  ON public.upload_audit_log FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Authenticated read upload_audit_log"
  ON public.upload_audit_log FOR SELECT
  USING (auth.role() = 'authenticated');

-- debounce_usage
ALTER TABLE public.debounce_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access debounce_usage"
  ON public.debounce_usage FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Authenticated read debounce_usage"
  ON public.debounce_usage FOR SELECT
  USING (auth.role() = 'authenticated');


-- =====================================================
-- 8. TRIGGERS: Auto-update timestamps
-- =====================================================

-- Update verified_contacts.updated_at
CREATE OR REPLACE FUNCTION update_verified_contacts_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER verified_contacts_updated_at
  BEFORE UPDATE ON public.verified_contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_verified_contacts_timestamp();

-- Update weekly_batches.updated_at
CREATE OR REPLACE FUNCTION update_weekly_batches_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER weekly_batches_updated_at
  BEFORE UPDATE ON public.weekly_batches
  FOR EACH ROW
  EXECUTE FUNCTION update_weekly_batches_timestamp();


-- =====================================================
-- 9. VIEWS: Useful aggregations
-- =====================================================

-- Monthly upload progress dashboard
CREATE OR REPLACE VIEW public.monthly_contact_pipeline_summary AS
SELECT
  vc.workspace_name,
  vc.month,
  cr.display_name AS client_display_name,
  cr.monthly_contact_target,
  cr.contact_tier,

  -- Raw uploads
  COUNT(DISTINCT rc.upload_batch_id) AS upload_batch_count,
  COUNT(rc.id) AS raw_contacts_uploaded,

  -- Verification stats
  COUNT(vc.id) AS verified_contacts,
  COUNT(vc.id) FILTER (WHERE vc.debounce_status = 'deliverable') AS deliverable_count,
  COUNT(vc.id) FILTER (WHERE vc.debounce_status = 'undeliverable') AS undeliverable_count,
  COUNT(vc.id) FILTER (WHERE vc.debounce_status = 'risky') AS risky_count,

  -- Upload progress
  COUNT(vc.id) FILTER (WHERE vc.is_uploaded = true) AS contacts_uploaded,
  COUNT(vc.id) FILTER (WHERE vc.is_uploaded = false) AS contacts_pending,

  -- High Net Worth
  COUNT(vc.id) FILTER (WHERE vc.is_high_net_worth = true) AS hnw_contacts,

  -- Weekly batch tracking
  COUNT(DISTINCT wb.batch_id) AS batches_created,
  COUNT(DISTINCT wb.batch_id) FILTER (WHERE wb.bison_upload_status = 'added_to_campaign') AS batches_completed,

  -- Gap analysis
  CASE
    WHEN cr.monthly_contact_target > 0
    THEN cr.monthly_contact_target - COUNT(vc.id)
    ELSE 0
  END AS contacts_needed,

  CASE
    WHEN cr.monthly_contact_target > 0
    THEN ROUND((COUNT(vc.id)::DECIMAL / cr.monthly_contact_target) * 100, 1)
    ELSE 0
  END AS target_percentage

FROM public.verified_contacts vc
LEFT JOIN public.raw_contacts rc ON vc.raw_contact_id = rc.id
LEFT JOIN public.weekly_batches wb ON vc.upload_batch_id = wb.batch_id
LEFT JOIN public.client_registry cr ON vc.workspace_name = cr.workspace_name
GROUP BY vc.workspace_name, vc.month, cr.display_name, cr.monthly_contact_target, cr.contact_tier;

COMMENT ON VIEW public.monthly_contact_pipeline_summary IS 'Dashboard view showing contact pipeline progress by client/month';


-- Weekly batch status
CREATE OR REPLACE VIEW public.weekly_batch_status AS
SELECT
  wb.batch_id,
  wb.workspace_name,
  cr.display_name AS client_display_name,
  wb.month,
  wb.week_number,
  wb.scheduled_upload_date,
  wb.actual_upload_date,
  wb.contact_count,
  wb.hnw_count,
  wb.bison_upload_status,
  wb.bison_campaign_name,
  wb.slack_approved_by,
  wb.slack_approved_at,
  wb.created_at,

  -- Days until/since scheduled upload
  CASE
    WHEN wb.actual_upload_date IS NOT NULL THEN
      'Completed'
    WHEN CURRENT_DATE < wb.scheduled_upload_date THEN
      'Scheduled in ' || (wb.scheduled_upload_date - CURRENT_DATE) || ' days'
    WHEN CURRENT_DATE = wb.scheduled_upload_date THEN
      'Due Today'
    ELSE
      'Overdue by ' || (CURRENT_DATE - wb.scheduled_upload_date) || ' days'
  END AS upload_status_text

FROM public.weekly_batches wb
LEFT JOIN public.client_registry cr ON wb.workspace_name = cr.workspace_name
ORDER BY wb.scheduled_upload_date DESC, wb.workspace_name;

COMMENT ON VIEW public.weekly_batch_status IS 'Real-time status of all weekly batch uploads';


-- =====================================================
-- 10. SAMPLE DATA: For testing (commented out)
-- =====================================================

-- Uncomment to insert test data:
/*
INSERT INTO public.raw_contacts (
  client_name, workspace_name, month,
  first_name, last_name, email,
  property_address, property_city, property_state, property_zip,
  home_value_estimate, purchase_date
) VALUES
  ('Test Client', 'Test Client', '2025-11',
   'John', 'Doe', 'john.doe@example.com',
   '123 Main St', 'Austin', 'TX', '78701',
   450000.00, '2024-03-15'),
  ('Test Client', 'Test Client', '2025-11',
   'Jane', 'Smith', 'jane.smith@example.com',
   '456 Oak Ave', 'Dallas', 'TX', '75201',
   950000.00, '2024-03-22');
*/
