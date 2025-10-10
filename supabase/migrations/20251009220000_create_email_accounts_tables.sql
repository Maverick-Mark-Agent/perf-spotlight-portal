-- ============================================================================
-- EMAIL ACCOUNTS TWO-TABLE ARCHITECTURE
-- ============================================================================
-- Table 1: email_accounts_raw (backend sync - per workspace updates)
-- Table 2: email_accounts_view (frontend display - aggregated/materialized)
--
-- Created: 2025-10-09
-- Purpose: Separate backend sync from frontend display for performance
-- ============================================================================

-- ============================================================================
-- TABLE 1: email_accounts_raw (Backend Sync Table)
-- ============================================================================
-- This table receives incremental updates per workspace from Email Bison API
-- Updated by: sync-email-accounts Edge Function (called per workspace)
-- Update frequency: Every 5-15 minutes per workspace via cron

CREATE TABLE IF NOT EXISTS public.email_accounts_raw (
  -- Primary identification
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bison_account_id INTEGER UNIQUE NOT NULL, -- Email Bison sender_email.id
  email_address TEXT NOT NULL,

  -- Workspace/Client info
  workspace_name TEXT NOT NULL,
  workspace_id INTEGER NOT NULL,
  bison_instance TEXT NOT NULL CHECK (bison_instance IN ('maverick', 'longrun')),

  -- Account status
  status TEXT NOT NULL,
  account_type TEXT,

  -- Metrics (from Email Bison API)
  emails_sent_count INTEGER DEFAULT 0,
  total_replied_count INTEGER DEFAULT 0,
  unique_replied_count INTEGER DEFAULT 0,
  bounced_count INTEGER DEFAULT 0,
  unsubscribed_count INTEGER DEFAULT 0,
  interested_leads_count INTEGER DEFAULT 0,
  total_opened_count INTEGER DEFAULT 0,
  unique_opened_count INTEGER DEFAULT 0,
  total_leads_contacted_count INTEGER DEFAULT 0,

  -- Configuration
  daily_limit INTEGER DEFAULT 0,
  warmup_enabled BOOLEAN DEFAULT false,

  -- Calculated fields
  reply_rate_percentage DECIMAL(5,2) DEFAULT 0,

  -- Tags/categorization
  email_provider TEXT,
  reseller TEXT,
  domain TEXT,

  -- Pricing (from email_account_metadata or calculated)
  price DECIMAL(10,2) DEFAULT 0,
  price_source TEXT CHECK (price_source IN ('manual', 'calculated')),
  pricing_needs_review BOOLEAN DEFAULT false,

  -- Metadata
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  last_synced_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Indexes for fast lookups
  CONSTRAINT unique_bison_account UNIQUE (bison_account_id, bison_instance)
);

-- Indexes for email_accounts_raw
CREATE INDEX IF NOT EXISTS idx_email_accounts_raw_workspace ON email_accounts_raw(workspace_name);
CREATE INDEX IF NOT EXISTS idx_email_accounts_raw_email ON email_accounts_raw(email_address);
CREATE INDEX IF NOT EXISTS idx_email_accounts_raw_status ON email_accounts_raw(status);
CREATE INDEX IF NOT EXISTS idx_email_accounts_raw_instance ON email_accounts_raw(bison_instance);
CREATE INDEX IF NOT EXISTS idx_email_accounts_raw_synced ON email_accounts_raw(last_synced_at DESC);

-- Enable RLS
ALTER TABLE public.email_accounts_raw ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow all operations (internal admin dashboard)
CREATE POLICY "Allow all operations on email_accounts_raw"
  ON public.email_accounts_raw
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- TABLE 2: email_accounts_view (Frontend Display Table)
-- ============================================================================
-- This is a MATERIALIZED VIEW for fast frontend queries
-- Refreshed after email_accounts_raw sync completes
-- Updated by: refresh_email_accounts_view() function

CREATE MATERIALIZED VIEW IF NOT EXISTS public.email_accounts_view AS
SELECT
  id,
  bison_account_id,
  email_address,
  workspace_name,
  workspace_id,
  bison_instance,
  status,
  account_type,
  emails_sent_count,
  total_replied_count,
  unique_replied_count,
  bounced_count,
  unsubscribed_count,
  interested_leads_count,
  total_opened_count,
  unique_opened_count,
  total_leads_contacted_count,
  daily_limit,
  warmup_enabled,
  reply_rate_percentage,
  email_provider,
  reseller,
  domain,
  price,
  price_source,
  pricing_needs_review,
  notes,
  created_at,
  updated_at,
  last_synced_at
FROM email_accounts_raw
ORDER BY workspace_name, email_address;

-- Create indexes on materialized view for fast dashboard queries
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_accounts_view_id ON email_accounts_view(id);
CREATE INDEX IF NOT EXISTS idx_email_accounts_view_workspace ON email_accounts_view(workspace_name);
CREATE INDEX IF NOT EXISTS idx_email_accounts_view_status ON email_accounts_view(status);
CREATE INDEX IF NOT EXISTS idx_email_accounts_view_provider ON email_accounts_view(email_provider);

-- Enable RLS on materialized view
ALTER MATERIALIZED VIEW public.email_accounts_view OWNER TO postgres;

-- ============================================================================
-- FUNCTION: Refresh materialized view
-- ============================================================================
CREATE OR REPLACE FUNCTION public.refresh_email_accounts_view()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.email_accounts_view;
  RAISE NOTICE 'email_accounts_view refreshed at %', NOW();
END;
$$;

-- ============================================================================
-- TRIGGER: Auto-update updated_at timestamp
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_email_accounts_raw_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_email_accounts_raw_updated_at
  BEFORE UPDATE ON public.email_accounts_raw
  FOR EACH ROW
  EXECUTE FUNCTION public.update_email_accounts_raw_timestamp();

-- ============================================================================
-- COMMENTS for documentation
-- ============================================================================
COMMENT ON TABLE public.email_accounts_raw IS 'Backend sync table - receives per-workspace updates from Email Bison API';
COMMENT ON MATERIALIZED VIEW public.email_accounts_view IS 'Frontend display table - materialized view refreshed after backend sync completes';
COMMENT ON FUNCTION public.refresh_email_accounts_view IS 'Refreshes the materialized view for frontend display';
