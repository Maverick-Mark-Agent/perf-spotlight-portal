-- pg_cron job: drive the process-auto-reply-queue worker every 5 minutes.
--
-- Apply this migration AFTER deploying the process-auto-reply-queue
-- Edge Function. The cron job will start firing immediately, but with
-- auto_reply_enabled=FALSE on every workspace the queue stays empty
-- (worker just returns "no due rows").
--
-- Pattern matches the existing email-cache cron job at
-- 20251010000001_setup_email_cache_cron.sql.

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Idempotent: drop any prior version of this job before scheduling.
SELECT cron.unschedule('process-auto-reply-queue')
WHERE jobid IN (
  SELECT jobid FROM cron.job WHERE jobname = 'process-auto-reply-queue'
);

-- Every 5 minutes. Worker is bounded to MAX_ROWS_PER_RUN=20 per invocation,
-- so worst-case throughput is 240 rows/hour (well above any real workspace).
SELECT cron.schedule(
  'process-auto-reply-queue',
  '*/5 * * * *',
  $$
  SELECT
    net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/process-auto-reply-queue',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
        'Content-Type', 'application/json',
        'x-triggered-by', 'cron'
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- ─────────────────────────────────────────────────────────────────────────
-- sync-bison-schedules nightly cron: refresh per-workspace timezones
-- from Bison campaign schedules at 04:00 UTC. Cheap (only updates rows
-- whose timezone actually changed).
-- ─────────────────────────────────────────────────────────────────────────

SELECT cron.unschedule('sync-bison-schedules-nightly')
WHERE jobid IN (
  SELECT jobid FROM cron.job WHERE jobname = 'sync-bison-schedules-nightly'
);

SELECT cron.schedule(
  'sync-bison-schedules-nightly',
  '0 4 * * *',                                              -- daily at 04:00 UTC
  $$
  SELECT
    net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/sync-bison-schedules',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
        'Content-Type', 'application/json',
        'x-triggered-by', 'cron'
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- ─────────────────────────────────────────────────────────────────────────
-- Manual triggers (for testing without waiting for the next tick)
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.trigger_auto_reply_queue_worker()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE response jsonb;
BEGIN
  SELECT content::jsonb INTO response
  FROM net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/process-auto-reply-queue',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json',
      'x-triggered-by', 'manual'
    ),
    body := '{}'::jsonb
  );
  RETURN response;
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION public.trigger_auto_reply_queue_worker() IS
  'Fire the auto-reply queue worker on demand. Useful for testing without waiting 5 min for the next cron tick.';

CREATE OR REPLACE FUNCTION public.trigger_sync_bison_schedules(p_workspace_name TEXT DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  response jsonb;
  body jsonb;
BEGIN
  body := CASE
    WHEN p_workspace_name IS NULL THEN '{}'::jsonb
    ELSE jsonb_build_object('workspace_name', p_workspace_name)
  END;

  SELECT content::jsonb INTO response
  FROM net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/sync-bison-schedules',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json',
      'x-triggered-by', 'manual'
    ),
    body := body
  );
  RETURN response;
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION public.trigger_sync_bison_schedules(TEXT) IS
  'Refresh per-workspace timezones from Bison. Pass a workspace_name to sync just one, or NULL for all.';

-- ─────────────────────────────────────────────────────────────────────────
-- Verification
-- ─────────────────────────────────────────────────────────────────────────
--   SELECT jobid, jobname, schedule, active
--     FROM cron.job
--    WHERE jobname IN ('process-auto-reply-queue', 'sync-bison-schedules-nightly');
--
--   SELECT public.trigger_auto_reply_queue_worker();
--   SELECT public.trigger_sync_bison_schedules();
--   SELECT public.trigger_sync_bison_schedules('leblanc_agency');

DO $$
DECLARE jc INT;
BEGIN
  SELECT COUNT(*) INTO jc
    FROM cron.job
   WHERE jobname IN ('process-auto-reply-queue', 'sync-bison-schedules-nightly');
  IF jc = 2 THEN
    RAISE NOTICE '✅ Both auto-reply cron jobs scheduled.';
  ELSE
    RAISE WARNING '⚠️  Expected 2 cron jobs, got %', jc;
  END IF;
END $$;
