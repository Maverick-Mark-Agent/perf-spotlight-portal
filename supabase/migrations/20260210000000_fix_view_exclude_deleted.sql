-- Fix: email_accounts_view should exclude soft-deleted accounts
-- The deleted_at column was added after the view was created

DROP MATERIALIZED VIEW IF EXISTS public.email_accounts_view;

CREATE MATERIALIZED VIEW public.email_accounts_view AS
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
WHERE deleted_at IS NULL
ORDER BY workspace_name, email_address;

-- Recreate indexes
CREATE UNIQUE INDEX idx_email_accounts_view_id ON email_accounts_view(id);
CREATE INDEX idx_email_accounts_view_workspace ON email_accounts_view(workspace_name);
CREATE INDEX idx_email_accounts_view_status ON email_accounts_view(status);
CREATE INDEX idx_email_accounts_view_provider ON email_accounts_view(email_provider);

ALTER MATERIALIZED VIEW public.email_accounts_view OWNER TO postgres;
