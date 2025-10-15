-- Update email account polling schedule from every 5 minutes to midnight daily
-- This prevents Email Bison rate limiting and ensures complete, accurate data

-- Remove old cron job
SELECT cron.unschedule('poll-sender-emails-every-5-min');

-- Create new cron job to poll at midnight (12:00 AM) every day
SELECT cron.schedule(
  'poll-sender-emails-midnight-daily',
  '0 0 * * *', -- Midnight every day (cron format: minute hour day month weekday)
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
WHERE jobname = 'poll-sender-emails-midnight-daily';

-- Add comment
COMMENT ON TABLE public.sender_emails_cache IS 'Cached email account data from Email Bison. Synced daily at midnight via poll-sender-emails cron job.';
