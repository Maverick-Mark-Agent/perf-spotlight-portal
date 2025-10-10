-- ============================================================================
-- API & WEBHOOK MANAGEMENT SYSTEM
-- Migration: Add comprehensive API key and webhook tracking to client_registry
-- ============================================================================
-- Purpose: Enable workspace-specific API key management and webhook configuration
--          directly within the Client Management Portal
--
-- Key Changes:
-- 1. Add API key metadata columns (status, usage tracking)
-- 2. Add webhook configuration columns (URL, secret, events, health)
-- 3. Add API health monitoring columns (call tracking, error rates)
-- 4. Create workspace_api_logs table (audit trail)
-- 5. Create workspace_webhook_events table (event processing)
-- 6. Add constraint: Active clients MUST have workspace API keys
-- ============================================================================

-- ============================================================================
-- PART 1: Extend client_registry with API & Webhook columns
-- ============================================================================

-- API Key Metadata
ALTER TABLE public.client_registry ADD COLUMN IF NOT EXISTS bison_api_key_name TEXT;
ALTER TABLE public.client_registry ADD COLUMN IF NOT EXISTS bison_api_key_created_at TIMESTAMPTZ;
ALTER TABLE public.client_registry ADD COLUMN IF NOT EXISTS bison_api_key_last_used_at TIMESTAMPTZ;
ALTER TABLE public.client_registry ADD COLUMN IF NOT EXISTS bison_api_key_status TEXT CHECK (bison_api_key_status IN ('active', 'inactive', 'revoked', 'expired')) DEFAULT 'active';

-- Webhook Configuration
ALTER TABLE public.client_registry ADD COLUMN IF NOT EXISTS bison_webhook_url TEXT;
ALTER TABLE public.client_registry ADD COLUMN IF NOT EXISTS bison_webhook_secret TEXT;
ALTER TABLE public.client_registry ADD COLUMN IF NOT EXISTS bison_webhook_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.client_registry ADD COLUMN IF NOT EXISTS bison_webhook_events TEXT[];
ALTER TABLE public.client_registry ADD COLUMN IF NOT EXISTS bison_webhook_last_received_at TIMESTAMPTZ;
ALTER TABLE public.client_registry ADD COLUMN IF NOT EXISTS bison_webhook_health TEXT CHECK (bison_webhook_health IN ('healthy', 'degraded', 'failing', 'disabled')) DEFAULT 'disabled';

-- API Health Metrics (auto-updated by Edge Functions)
ALTER TABLE public.client_registry ADD COLUMN IF NOT EXISTS api_last_successful_call_at TIMESTAMPTZ;
ALTER TABLE public.client_registry ADD COLUMN IF NOT EXISTS api_last_failed_call_at TIMESTAMPTZ;
ALTER TABLE public.client_registry ADD COLUMN IF NOT EXISTS api_consecutive_failures INTEGER DEFAULT 0;
ALTER TABLE public.client_registry ADD COLUMN IF NOT EXISTS api_calls_today INTEGER DEFAULT 0;
ALTER TABLE public.client_registry ADD COLUMN IF NOT EXISTS api_errors_today INTEGER DEFAULT 0;
ALTER TABLE public.client_registry ADD COLUMN IF NOT EXISTS api_health_status TEXT CHECK (api_health_status IN ('healthy', 'degraded', 'failing', 'no_key')) DEFAULT 'no_key';

-- API Notes
ALTER TABLE public.client_registry ADD COLUMN IF NOT EXISTS api_notes TEXT;

-- Add comments for documentation
COMMENT ON COLUMN public.client_registry.bison_api_key IS 'Workspace-specific API key (not super admin key)';
COMMENT ON COLUMN public.client_registry.bison_api_key_name IS 'Human-readable name for the API key';
COMMENT ON COLUMN public.client_registry.bison_api_key_status IS 'Status: active, inactive, revoked, or expired';
COMMENT ON COLUMN public.client_registry.bison_webhook_url IS 'Webhook endpoint URL for this workspace';
COMMENT ON COLUMN public.client_registry.bison_webhook_events IS 'Array of event types to receive (e.g., lead.interested, email.sent)';
COMMENT ON COLUMN public.client_registry.api_health_status IS 'Real-time API health: healthy, degraded, failing, or no_key';
COMMENT ON COLUMN public.client_registry.api_consecutive_failures IS 'Consecutive API failures (auto-reset on success)';

-- ============================================================================
-- PART 2: Create workspace_api_logs table (Audit Trail)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.workspace_api_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_name TEXT NOT NULL REFERENCES client_registry(workspace_name) ON DELETE CASCADE,

  -- API Call Details
  endpoint TEXT NOT NULL,                  -- e.g., "/sender-emails", "/campaigns"
  method TEXT NOT NULL DEFAULT 'GET',     -- HTTP method
  status_code INTEGER,                     -- HTTP status code (200, 401, 500, etc.)
  response_time_ms INTEGER,                -- Response time in milliseconds
  success BOOLEAN,                         -- true if 2xx status, false otherwise
  error_message TEXT,                      -- Error message if failed

  -- API Key Used (last 8 chars for security)
  api_key_suffix TEXT,                     -- e.g., "f1575525" (from "95|LISJUmFy...f1575525")

  -- Context
  edge_function TEXT,                      -- Which Edge Function made this call (e.g., "sync-email-accounts")
  triggered_by TEXT,                       -- How was it triggered: 'cron', 'manual', 'webhook'

  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Additional metadata (JSON for flexibility)
  metadata JSONB
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_workspace_api_logs_workspace_date
  ON public.workspace_api_logs(workspace_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workspace_api_logs_success
  ON public.workspace_api_logs(success)
  WHERE success = false; -- Fast lookup of errors only

CREATE INDEX IF NOT EXISTS idx_workspace_api_logs_created_at
  ON public.workspace_api_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workspace_api_logs_edge_function
  ON public.workspace_api_logs(edge_function);

-- Row Level Security
ALTER TABLE public.workspace_api_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to workspace_api_logs"
  ON public.workspace_api_logs
  FOR SELECT
  USING (true);

CREATE POLICY "Allow service role full access to workspace_api_logs"
  ON public.workspace_api_logs
  FOR ALL
  USING (auth.role() = 'service_role');

-- Comments
COMMENT ON TABLE public.workspace_api_logs IS 'Audit log of all Email Bison API calls made per workspace';
COMMENT ON COLUMN public.workspace_api_logs.api_key_suffix IS 'Last 8 characters of API key used (for security)';
COMMENT ON COLUMN public.workspace_api_logs.edge_function IS 'Which Supabase Edge Function made this API call';

-- ============================================================================
-- PART 3: Create workspace_webhook_events table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.workspace_webhook_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_name TEXT NOT NULL REFERENCES client_registry(workspace_name) ON DELETE CASCADE,

  -- Event Details
  event_type TEXT NOT NULL,                -- e.g., 'lead.interested', 'email.sent', 'email.bounced'
  event_data JSONB NOT NULL,               -- Full webhook payload from Email Bison

  -- Processing Status
  received_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  processed_at TIMESTAMPTZ,
  processing_status TEXT CHECK (processing_status IN ('pending', 'processed', 'failed')) DEFAULT 'pending',
  processing_error TEXT,
  retry_count INTEGER DEFAULT 0,

  -- Security & Metadata
  source_ip TEXT,
  signature_valid BOOLEAN,                 -- Whether webhook signature was valid
  user_agent TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_workspace_webhook_events_workspace_date
  ON public.workspace_webhook_events(workspace_name, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_workspace_webhook_events_pending
  ON public.workspace_webhook_events(processing_status)
  WHERE processing_status = 'pending'; -- Fast lookup of unprocessed events

CREATE INDEX IF NOT EXISTS idx_workspace_webhook_events_type
  ON public.workspace_webhook_events(event_type);

CREATE INDEX IF NOT EXISTS idx_workspace_webhook_events_received_at
  ON public.workspace_webhook_events(received_at DESC);

-- Row Level Security
ALTER TABLE public.workspace_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to workspace_webhook_events"
  ON public.workspace_webhook_events
  FOR SELECT
  USING (true);

CREATE POLICY "Allow service role full access to workspace_webhook_events"
  ON public.workspace_webhook_events
  FOR ALL
  USING (auth.role() = 'service_role');

-- Comments
COMMENT ON TABLE public.workspace_webhook_events IS 'Webhook events received from Email Bison per workspace';
COMMENT ON COLUMN public.workspace_webhook_events.event_type IS 'Type of webhook event (e.g., lead.interested, email.sent)';
COMMENT ON COLUMN public.workspace_webhook_events.signature_valid IS 'Whether the webhook signature was valid (security check)';

-- ============================================================================
-- PART 4: Constraint - Active clients MUST have API keys
-- ============================================================================

-- NOTE: We're NOT enforcing this constraint yet because Workspark doesn't have a key
-- Uncomment this after Workspark API key is generated

-- ALTER TABLE public.client_registry
--   DROP CONSTRAINT IF EXISTS active_clients_require_api_key;
--
-- ALTER TABLE public.client_registry
--   ADD CONSTRAINT active_clients_require_api_key
--   CHECK (
--     (is_active = false) OR
--     (is_active = true AND bison_api_key IS NOT NULL)
--   );
--
-- COMMENT ON CONSTRAINT active_clients_require_api_key ON public.client_registry IS
--   'All active clients must have workspace-specific API keys. No super admin fallback allowed.';

-- ============================================================================
-- PART 5: Helper Functions
-- ============================================================================

-- Function: Auto-delete old API logs (keep 90 days)
CREATE OR REPLACE FUNCTION delete_old_api_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM workspace_api_logs
  WHERE created_at < NOW() - INTERVAL '90 days';

  RAISE NOTICE 'Deleted API logs older than 90 days at %', NOW();
END;
$$;

COMMENT ON FUNCTION delete_old_api_logs() IS 'Delete API logs older than 90 days to keep storage costs low';

-- Function: Auto-delete old webhook events (keep 90 days)
CREATE OR REPLACE FUNCTION delete_old_webhook_events()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM workspace_webhook_events
  WHERE received_at < NOW() - INTERVAL '90 days';

  RAISE NOTICE 'Deleted webhook events older than 90 days at %', NOW();
END;
$$;

COMMENT ON FUNCTION delete_old_webhook_events() IS 'Delete webhook events older than 90 days';

-- Function: Reset daily API counters (call at midnight UTC)
CREATE OR REPLACE FUNCTION reset_daily_api_counters()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE client_registry
  SET
    api_calls_today = 0,
    api_errors_today = 0
  WHERE is_active = true;

  RAISE NOTICE 'Reset daily API counters at %', NOW();
END;
$$;

COMMENT ON FUNCTION reset_daily_api_counters() IS 'Reset api_calls_today and api_errors_today counters (run daily at midnight)';

-- Function: Update API health status based on metrics
CREATE OR REPLACE FUNCTION update_api_health_status()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Set to 'no_key' if missing API key
  UPDATE client_registry
  SET api_health_status = 'no_key'
  WHERE is_active = true AND bison_api_key IS NULL;

  -- Set to 'failing' if 3+ consecutive failures
  UPDATE client_registry
  SET api_health_status = 'failing'
  WHERE is_active = true
    AND bison_api_key IS NOT NULL
    AND api_consecutive_failures >= 3;

  -- Set to 'degraded' if 1-2 consecutive failures
  UPDATE client_registry
  SET api_health_status = 'degraded'
  WHERE is_active = true
    AND bison_api_key IS NOT NULL
    AND api_consecutive_failures BETWEEN 1 AND 2;

  -- Set to 'healthy' if no consecutive failures and recent successful call
  UPDATE client_registry
  SET api_health_status = 'healthy'
  WHERE is_active = true
    AND bison_api_key IS NOT NULL
    AND api_consecutive_failures = 0
    AND api_last_successful_call_at > NOW() - INTERVAL '1 hour';

  RAISE NOTICE 'Updated API health status at %', NOW();
END;
$$;

COMMENT ON FUNCTION update_api_health_status() IS 'Update api_health_status based on failure counts and recent activity';

-- ============================================================================
-- PART 6: Update existing active clients to set initial health status
-- ============================================================================

-- Set health status to 'healthy' for active clients with API keys and recent activity
UPDATE client_registry
SET api_health_status = 'healthy'
WHERE is_active = true
  AND bison_api_key IS NOT NULL;

-- Set health status to 'no_key' for Workspark (only active client without API key)
UPDATE client_registry
SET api_health_status = 'no_key'
WHERE is_active = true
  AND bison_api_key IS NULL;

-- ============================================================================
-- Migration Complete
-- ============================================================================

-- Verify migration results
DO $$
DECLARE
  active_count INTEGER;
  with_keys_count INTEGER;
  without_keys_count INTEGER;
  r RECORD;
BEGIN
  SELECT COUNT(*) INTO active_count FROM client_registry WHERE is_active = true;
  SELECT COUNT(*) INTO with_keys_count FROM client_registry WHERE is_active = true AND bison_api_key IS NOT NULL;
  SELECT COUNT(*) INTO without_keys_count FROM client_registry WHERE is_active = true AND bison_api_key IS NULL;

  RAISE NOTICE '=== API & Webhook Management Migration Complete ===';
  RAISE NOTICE 'Total active clients: %', active_count;
  RAISE NOTICE 'Active clients with API keys: %', with_keys_count;
  RAISE NOTICE 'Active clients WITHOUT API keys: %', without_keys_count;

  IF without_keys_count > 0 THEN
    RAISE NOTICE '⚠️  WARNING: % active client(s) missing API keys', without_keys_count;
    RAISE NOTICE '   Please generate workspace-specific API keys for these clients:';

    FOR r IN
      SELECT workspace_name, bison_instance
      FROM client_registry
      WHERE is_active = true AND bison_api_key IS NULL
    LOOP
      RAISE NOTICE '   - % (%)', r.workspace_name, r.bison_instance;
    END LOOP;
  END IF;

  RAISE NOTICE '=== Tables Created ===';
  RAISE NOTICE '✓ workspace_api_logs (audit trail)';
  RAISE NOTICE '✓ workspace_webhook_events (event processing)';
  RAISE NOTICE '=== Helper Functions Created ===';
  RAISE NOTICE '✓ delete_old_api_logs() - cleanup after 90 days';
  RAISE NOTICE '✓ delete_old_webhook_events() - cleanup after 90 days';
  RAISE NOTICE '✓ reset_daily_api_counters() - run daily at midnight';
  RAISE NOTICE '✓ update_api_health_status() - run every 15 minutes';
END $$;
