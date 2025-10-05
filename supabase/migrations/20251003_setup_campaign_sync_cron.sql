-- Enable pg_cron extension if not already enabled
create extension if not exists pg_cron;

-- Schedule campaign sync to run daily at 2 AM UTC
select cron.schedule(
  'daily-campaign-sync', -- job name
  '0 2 * * *',           -- cron expression: daily at 2 AM UTC
  $$
  select
    net.http_post(
      url:='https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/sync-campaigns-to-airtable',
      headers:=jsonb_build_object(
        'Content-Type','application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0'
      ),
      body:=jsonb_build_object()
    ) as request_id;
  $$
);

-- To view scheduled jobs:
-- select * from cron.job;

-- To manually unschedule:
-- select cron.unschedule('daily-campaign-sync');
