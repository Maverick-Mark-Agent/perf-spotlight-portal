-- Agent Automation Tables for Home Insurance Campaign Workflow
-- Created: 2025-10-05

-- ============================================
-- 1. AGENT RUNS - Track all automation executions
-- ============================================
CREATE TABLE IF NOT EXISTS public.agent_runs (
  run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow TEXT NOT NULL, -- 'cole_pull', 'clay_format', 'bison_upload', 'evergreen_update', 'full_pipeline'
  client_id INTEGER REFERENCES public.client_registry(workspace_id),
  site TEXT, -- 'cole', 'clay', 'bison'
  status TEXT NOT NULL DEFAULT 'running', -- 'running', 'success', 'failed', 'partial'
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  metrics JSONB, -- {records_pulled, records_cleaned, records_uploaded, duration_ms, etc}
  trace_url TEXT, -- Playwright trace file URL
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agent_runs_workflow ON public.agent_runs(workflow);
CREATE INDEX idx_agent_runs_client_id ON public.agent_runs(client_id);
CREATE INDEX idx_agent_runs_status ON public.agent_runs(status);
CREATE INDEX idx_agent_runs_started_at ON public.agent_runs(started_at DESC);

-- ============================================
-- 2. LEAD SOURCES - Configuration for automated data pulls
-- ============================================
CREATE TABLE IF NOT EXISTS public.lead_sources (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES public.client_registry(workspace_id) ON DELETE CASCADE,
  site TEXT NOT NULL, -- 'cole', 'clay', 'other'
  params JSONB NOT NULL, -- {states: ['NJ', 'NY'], zips: [...], filters: {...}}
  schedule_cron TEXT, -- '0 9 15 * *' for 15th of month at 9am
  active BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lead_sources_client_id ON public.lead_sources(client_id);
CREATE INDEX idx_lead_sources_active ON public.lead_sources(active);
CREATE INDEX idx_lead_sources_next_run ON public.lead_sources(next_run_at) WHERE active = true;

-- ============================================
-- 3. RAW LEADS - Unprocessed data from source sites
-- ============================================
CREATE TABLE IF NOT EXISTS public.raw_leads (
  id BIGSERIAL PRIMARY KEY,
  lead_source_id INTEGER REFERENCES public.lead_sources(id) ON DELETE SET NULL,
  agent_run_id UUID REFERENCES public.agent_runs(run_id) ON DELETE SET NULL,
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload_json JSONB NOT NULL,
  hash TEXT NOT NULL, -- SHA256 of normalized payload for deduplication
  source_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_raw_leads_source_id ON public.raw_leads(lead_source_id);
CREATE INDEX idx_raw_leads_hash ON public.raw_leads(hash);
CREATE INDEX idx_raw_leads_scraped_at ON public.raw_leads(scraped_at DESC);
CREATE UNIQUE INDEX idx_raw_leads_unique_hash ON public.raw_leads(lead_source_id, hash);

-- ============================================
-- 4. CLEANED LEADS - Normalized and validated leads
-- ============================================
CREATE TABLE IF NOT EXISTS public.cleaned_leads (
  id BIGSERIAL PRIMARY KEY,
  raw_lead_id BIGINT REFERENCES public.raw_leads(id) ON DELETE CASCADE,
  agent_run_id UUID REFERENCES public.agent_runs(run_id) ON DELETE SET NULL,

  -- Normalized fields
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  address_1 TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  dob DATE,
  purchase_date DATE,
  purchase_day INTEGER, -- Day of month for renewal window filtering
  home_value NUMERIC(12,2),
  income NUMERIC(12,2),
  head_household BOOLEAN,

  -- Derived fields
  readable_purchase_date TEXT, -- "August 3rd"
  renewal_date DATE, -- Calculated from purchase_date

  -- Email validation
  email_valid BOOLEAN,
  email_validation_provider TEXT, -- 'debounce', 'zerobounce', etc
  first_safe_to_send_email TEXT, -- From Debounce

  -- Deduplication
  dedupe_key TEXT NOT NULL, -- Hash of email+address for dedup

  -- Validation
  validation_status TEXT DEFAULT 'pending', -- 'pending', 'valid', 'invalid'
  validation_errors JSONB, -- [{field: 'email', error: 'Invalid format'}]

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cleaned_leads_raw_lead_id ON public.cleaned_leads(raw_lead_id);
CREATE INDEX idx_cleaned_leads_email ON public.cleaned_leads(email);
CREATE INDEX idx_cleaned_leads_dedupe_key ON public.cleaned_leads(dedupe_key);
CREATE INDEX idx_cleaned_leads_purchase_day ON public.cleaned_leads(purchase_day);
CREATE INDEX idx_cleaned_leads_renewal_date ON public.cleaned_leads(renewal_date);
CREATE INDEX idx_cleaned_leads_validation_status ON public.cleaned_leads(validation_status);
CREATE UNIQUE INDEX idx_cleaned_leads_unique_dedupe ON public.cleaned_leads(dedupe_key);

-- ============================================
-- 5. CLIENT LEAD BATCHES - Weekly upload batches
-- ============================================
CREATE TABLE IF NOT EXISTS public.client_lead_batches (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES public.client_registry(workspace_id) ON DELETE CASCADE,
  month TEXT NOT NULL, -- 'YYYY-MM' format
  week_window_start DATE NOT NULL,
  week_window_end DATE NOT NULL,

  count_raw INTEGER DEFAULT 0,
  count_cleaned INTEGER DEFAULT 0,
  count_uploaded INTEGER DEFAULT 0,
  upload_target INTEGER NOT NULL, -- 15000 or 30000 based on package

  status TEXT DEFAULT 'pending', -- 'pending', 'ready', 'uploaded', 'failed'
  uploaded_at TIMESTAMPTZ,
  bison_list_name TEXT, -- Name of the list in Email Bison

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_batches_client_id ON public.client_lead_batches(client_id);
CREATE INDEX idx_batches_month ON public.client_lead_batches(month);
CREATE INDEX idx_batches_status ON public.client_lead_batches(status);
CREATE INDEX idx_batches_week_window ON public.client_lead_batches(week_window_start, week_window_end);

-- ============================================
-- 6. SITE CREDENTIALS - Secure credential storage
-- ============================================
CREATE TABLE IF NOT EXISTS public.site_credentials (
  id SERIAL PRIMARY KEY,
  site TEXT NOT NULL, -- 'cole', 'clay', 'bison'
  username TEXT NOT NULL,
  secret_ref TEXT NOT NULL, -- Reference to secret manager (e.g., env var name)
  state_coverage TEXT[], -- For Cole: ['NJ', 'NY', ...]
  mfa_type TEXT, -- 'totp', 'sms', 'email', null
  last_verified_at TIMESTAMPTZ,

  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_site_credentials_site ON public.site_credentials(site);
CREATE INDEX idx_site_credentials_username ON public.site_credentials(username);
CREATE UNIQUE INDEX idx_site_credentials_unique ON public.site_credentials(site, username);

-- ============================================
-- 7. AGENT ERRORS - Detailed error tracking
-- ============================================
CREATE TABLE IF NOT EXISTS public.agent_errors (
  id BIGSERIAL PRIMARY KEY,
  run_id UUID REFERENCES public.agent_runs(run_id) ON DELETE CASCADE,
  step TEXT NOT NULL, -- 'login', 'query_build', 'export', 'upload', etc
  error_type TEXT NOT NULL, -- 'timeout', 'selector_not_found', 'captcha', 'validation', etc
  message TEXT NOT NULL,
  stack_trace TEXT,
  screenshot_url TEXT,
  trace_url TEXT, -- Playwright trace
  context JSONB, -- Additional context data

  retry_count INTEGER DEFAULT 0,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agent_errors_run_id ON public.agent_errors(run_id);
CREATE INDEX idx_agent_errors_step ON public.agent_errors(step);
CREATE INDEX idx_agent_errors_type ON public.agent_errors(error_type);
CREATE INDEX idx_agent_errors_resolved ON public.agent_errors(resolved);

-- ============================================
-- 8. BATCH LEAD ASSIGNMENTS - Links leads to batches
-- ============================================
CREATE TABLE IF NOT EXISTS public.batch_lead_assignments (
  id BIGSERIAL PRIMARY KEY,
  batch_id INTEGER REFERENCES public.client_lead_batches(id) ON DELETE CASCADE,
  cleaned_lead_id BIGINT REFERENCES public.cleaned_leads(id) ON DELETE CASCADE,

  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  uploaded_to_bison BOOLEAN DEFAULT false,
  uploaded_at TIMESTAMPTZ
);

CREATE INDEX idx_batch_assignments_batch ON public.batch_lead_assignments(batch_id);
CREATE INDEX idx_batch_assignments_lead ON public.batch_lead_assignments(cleaned_lead_id);
CREATE UNIQUE INDEX idx_batch_assignments_unique ON public.batch_lead_assignments(batch_id, cleaned_lead_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on agent automation tables
ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cleaned_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_lead_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batch_lead_assignments ENABLE ROW LEVEL SECURITY;

-- Service role has full access to agent automation tables
CREATE POLICY "Service role full access agent_runs" ON public.agent_runs FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access lead_sources" ON public.lead_sources FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access raw_leads" ON public.raw_leads FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access cleaned_leads" ON public.cleaned_leads FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access client_lead_batches" ON public.client_lead_batches FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access site_credentials" ON public.site_credentials FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access agent_errors" ON public.agent_errors FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access batch_lead_assignments" ON public.batch_lead_assignments FOR ALL USING (auth.role() = 'service_role');

-- Authenticated users can read agent runs and errors (for dashboard display)
CREATE POLICY "Authenticated read agent_runs" ON public.agent_runs FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated read client_lead_batches" ON public.client_lead_batches FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated read agent_errors" ON public.agent_errors FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_agent_runs_updated_at BEFORE UPDATE ON public.agent_runs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lead_sources_updated_at BEFORE UPDATE ON public.lead_sources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cleaned_leads_updated_at BEFORE UPDATE ON public.cleaned_leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_client_lead_batches_updated_at BEFORE UPDATE ON public.client_lead_batches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_site_credentials_updated_at BEFORE UPDATE ON public.site_credentials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate renewal date from purchase date
CREATE OR REPLACE FUNCTION calculate_renewal_date(purchase_date DATE)
RETURNS DATE AS $$
BEGIN
  -- Renewal date is 1 year from purchase date
  RETURN purchase_date + INTERVAL '1 year';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get readable date format
CREATE OR REPLACE FUNCTION get_readable_date(date_val DATE)
RETURNS TEXT AS $$
BEGIN
  -- Format: "August 3rd"
  RETURN TO_CHAR(date_val, 'FMMonth') || ' ' ||
         TO_CHAR(date_val, 'FMDD') ||
         CASE
           WHEN TO_CHAR(date_val, 'DD') IN ('01', '21', '31') THEN 'st'
           WHEN TO_CHAR(date_val, 'DD') IN ('02', '22') THEN 'nd'
           WHEN TO_CHAR(date_val, 'DD') IN ('03', '23') THEN 'rd'
           ELSE 'th'
         END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON TABLE public.agent_runs IS 'Tracks all automation workflow executions with metrics and traces';
COMMENT ON TABLE public.lead_sources IS 'Configuration for automated lead pulls from external sites';
COMMENT ON TABLE public.raw_leads IS 'Unprocessed leads scraped from source sites';
COMMENT ON TABLE public.cleaned_leads IS 'Normalized, validated, and deduplicated leads ready for upload';
COMMENT ON TABLE public.client_lead_batches IS 'Weekly batches of leads prepared for Email Bison uploads';
COMMENT ON TABLE public.site_credentials IS 'Secure storage of credentials for external sites (references to secrets)';
COMMENT ON TABLE public.agent_errors IS 'Detailed error tracking with screenshots and traces for debugging';
COMMENT ON TABLE public.batch_lead_assignments IS 'Links cleaned leads to their respective batches for upload tracking';
