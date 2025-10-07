-- Setup daily cron job to sync metrics from Email Bison
-- This runs at 3 AM UTC every day

-- Create the cron job (will error if already exists, which is fine)
SELECT cron.schedule(
  'sync-all-metrics-daily',
  '0 3 * * *', -- 3 AM UTC daily
  $$
  SELECT
    net.http_post(
      url := 'https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/sync-all-metrics',
      headers := jsonb_build_object(
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0',
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- Verify it was created
SELECT jobname, schedule, active
FROM cron.job
WHERE jobname = 'sync-all-metrics-daily';

COMMENT ON EXTENSION pg_cron IS 'Daily sync of Email Bison metrics to Supabase at 3 AM UTC';
