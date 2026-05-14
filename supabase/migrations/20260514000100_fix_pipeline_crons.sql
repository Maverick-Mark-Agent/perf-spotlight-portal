-- Recreate both pipeline cron jobs with hardcoded URLs.
--
-- The original migration (20260428000300) used current_setting('app.settings.*')
-- which requires those settings to be pre-configured. If they're not set the
-- cron job silently fails to schedule. This migration uses hardcoded URLs
-- so the crons are guaranteed to fire.
--
-- process-auto-reply-queue  → every 5 min
-- reconcile-sent-replies    → every 2 min (was never scheduled; added here)

-- Ensure pg_cron and pg_net are available
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ── process-auto-reply-queue ─────────────────────────────────────────────────
SELECT cron.unschedule('process-auto-reply-queue')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-auto-reply-queue');

SELECT cron.schedule(
  'process-auto-reply-queue',
  '*/5 * * * *',
  $$
    SELECT net.http_post(
      url     := 'https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/process-auto-reply-queue',
      headers := '{"Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzYxNzUzMCwiZXhwIjoyMDczMTkzNTMwfQ.71oGb_Jv5SWpF6XU1k8Ug77CqMVH_k1it35eYYAqg3Q","Content-Type":"application/json","x-triggered-by":"cron"}'::jsonb,
      body    := '{}'::jsonb
    ) AS request_id;
  $$
);

-- ── reconcile-sent-replies ───────────────────────────────────────────────────
SELECT cron.unschedule('reconcile-sent-replies')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reconcile-sent-replies');

SELECT cron.schedule(
  'reconcile-sent-replies',
  '*/2 * * * *',
  $$
    SELECT net.http_post(
      url     := 'https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/reconcile-sent-replies',
      headers := '{"Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzYxNzUzMCwiZXhwIjoyMDczMTkzNTMwfQ.71oGb_Jv5SWpF6XU1k8Ug77CqMVH_k1it35eYYAqg3Q","Content-Type":"application/json","x-triggered-by":"cron"}'::jsonb,
      body    := '{}'::jsonb
    ) AS request_id;
  $$
);

-- Verify both jobs exist
DO $$
DECLARE jc INT;
BEGIN
  SELECT COUNT(*) INTO jc
    FROM cron.job
   WHERE jobname IN ('process-auto-reply-queue', 'reconcile-sent-replies');
  IF jc = 2 THEN
    RAISE NOTICE '✅ Both pipeline cron jobs active.';
  ELSE
    RAISE WARNING '⚠️  Expected 2 cron jobs, got %. Check cron.job table.', jc;
  END IF;
END $$;
