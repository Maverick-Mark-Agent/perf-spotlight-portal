// Sets up the daily-kpi-metrics-sync pg_cron job.
//
// Re-implemented 2026-05-18 to use a direct postgres connection
// (matches the working pattern in setup-pipeline-crons). The previous
// implementation used `supabase.rpc('exec_sql', ...)` which depends on
// a public.exec_sql function that doesn't exist on this project, so it
// always errored with PGRST202.
//
// Idempotent: drops any existing job with this name before re-creating.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import postgres from 'https://deno.land/x/postgresjs@v3.4.3/mod.js';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

const JOB_NAME = 'daily-kpi-metrics-sync';
// 2am CST = 7am UTC. Fires once a day after the calendar day has
// fully closed, so the snapshot reflects yesterday's complete totals.
const SCHEDULE = '0 7 * * *';
const FUNCTION_PATH = 'sync-daily-kpi-metrics';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const dbUrl = Deno.env.get('SUPABASE_DB_URL');
  if (!dbUrl) {
    return new Response(
      JSON.stringify({ error: 'SUPABASE_DB_URL not set' }),
      { status: 400, headers: corsHeaders },
    );
  }

  const sql = postgres(dbUrl, { max: 1, idle_timeout: 20, connect_timeout: 10 });

  try {
    // Drop any existing job with the same name so we don't end up with duplicates.
    await sql`
      SELECT cron.unschedule(${JOB_NAME})
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = ${JOB_NAME})
    `.catch(() => {});

    // Schedule the new job. SCHEDULE is a constant string, never user input.
    const command = `
      SELECT net.http_post(
        url := '${SUPABASE_URL}/functions/v1/${FUNCTION_PATH}',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ${SERVICE_KEY}',
          'x-triggered-by', 'cron'
        ),
        body := jsonb_build_object('scheduled', true, 'timestamp', now())
      ) AS request_id;
    `;

    const scheduled = await sql`
      SELECT cron.schedule(${JOB_NAME}, ${SCHEDULE}, ${command}) AS jobid
    `;

    const verify = await sql`
      SELECT jobid, jobname, schedule, active
      FROM cron.job
      WHERE jobname = ${JOB_NAME}
    `;

    await sql.end();

    return new Response(
      JSON.stringify({
        success: true,
        message: `Cron job ${JOB_NAME} scheduled at ${SCHEDULE} UTC (2am CST)`,
        scheduled_jobid: scheduled[0]?.jobid,
        job: verify[0],
      }),
      { headers: corsHeaders },
    );
  } catch (err: any) {
    await sql.end().catch(() => {});
    console.error('setup-cron-job error:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err?.message ?? String(err),
      }),
      { status: 500, headers: corsHeaders },
    );
  }
});
