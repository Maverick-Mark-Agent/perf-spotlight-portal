-- =====================================================
-- Schedule Email Account Polling with pg_cron
-- Purpose: Auto-refresh email account data every 5 minutes
-- =====================================================

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Grant usage on cron schema to postgres
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Create the cron job to poll sender emails every 5 minutes
SELECT cron.schedule(
  'poll-sender-emails-every-5-min',
  '*/5 * * * *', -- Every 5 minutes
  $$
  SELECT
    net.http_post(
      url := 'https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/poll-sender-emails',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0'
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);

-- Verify the cron job was created
SELECT jobid, jobname, schedule, active, database
FROM cron.job
WHERE jobname = 'poll-sender-emails-every-5-min';
