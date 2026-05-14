// Sets up the two pg_cron jobs that drive the auto-reply pipeline.
// Uses Deno's postgres driver directly — no exec_sql RPC needed.
//
// process-auto-reply-queue  → every 5 min
// reconcile-sent-replies    → every 2 min  (was never scheduled before)
//
// Idempotent. Safe to call multiple times.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { Client } from 'https://deno.land/x/postgres@v0.17.0/mod.ts';

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const DB_URL        = Deno.env.get('SUPABASE_DB_URL');       // optional override
const PROJECT_REF   = SUPABASE_URL.match(/https:\/\/([^.]+)\./)?.[1] ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // Supabase exposes a direct postgres connection on port 5432 via the pooler.
  // Connection string format for Supabase project:
  //   postgresql://postgres.{ref}:{password}@aws-0-{region}.pooler.supabase.com:5432/postgres
  // We don't have the DB password here, but we CAN use the Management API
  // to run SQL if we have an access token.  Fall back to building cron jobs
  // via a stored procedure we create on-the-fly using net.http_post.

  const fnUrl = `${SUPABASE_URL}/functions/v1`;

  const jobs = [
    { name: 'process-auto-reply-queue', schedule: '*/5 * * * *', fn: 'process-auto-reply-queue' },
    { name: 'reconcile-sent-replies',   schedule: '*/2 * * * *', fn: 'reconcile-sent-replies'   },
  ];

  // We'll create/replace a plpgsql function that schedules both crons,
  // then invoke it via the REST API's rpc endpoint.
  // This bypasses the missing exec_sql RPC.

  const createFnSql = `
    CREATE OR REPLACE FUNCTION public.setup_pipeline_crons()
    RETURNS jsonb
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    DECLARE
      result jsonb := '[]'::jsonb;
      jid bigint;
    BEGIN
      -- process-auto-reply-queue (every 5 min)
      PERFORM cron.unschedule('process-auto-reply-queue')
        WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-auto-reply-queue');

      SELECT cron.schedule(
        'process-auto-reply-queue',
        '*/5 * * * *',
        $sql$
          SELECT net.http_post(
            url     := '${SUPABASE_URL}/functions/v1/process-auto-reply-queue',
            headers := '{"Authorization":"Bearer ${SERVICE_KEY}","Content-Type":"application/json","x-triggered-by":"cron"}'::jsonb,
            body    := '{}'::jsonb
          ) AS request_id;
        $sql$
      ) INTO jid;
      result := result || jsonb_build_object('process-auto-reply-queue', jid);

      -- reconcile-sent-replies (every 2 min)
      PERFORM cron.unschedule('reconcile-sent-replies')
        WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reconcile-sent-replies');

      SELECT cron.schedule(
        'reconcile-sent-replies',
        '*/2 * * * *',
        $sql$
          SELECT net.http_post(
            url     := '${SUPABASE_URL}/functions/v1/reconcile-sent-replies',
            headers := '{"Authorization":"Bearer ${SERVICE_KEY}","Content-Type":"application/json","x-triggered-by":"cron"}'::jsonb,
            body    := '{}'::jsonb
          ) AS request_id;
        $sql$
      ) INTO jid;
      result := result || jsonb_build_object('reconcile-sent-replies', jid);

      RETURN result;
    END;
    $$;
  `;

  // Step 1: Create the function via the existing trigger pattern —
  // use supabase-js which has service-role access to run RPC calls.
  // Since exec_sql doesn't exist, we POST raw SQL to the pg REST endpoint
  // using the Content-Profile: pg_catalog trick… actually we can't.
  //
  // Real solution: use pg connection via Supabase's direct DB endpoint.
  // Supabase projects expose postgres at db.{ref}.supabase.co:5432
  const dbHost = `db.${PROJECT_REF}.supabase.co`;

  // We need the DB password. It's stored as POSTGRES_PASSWORD env var on
  // the edge function runtime for Supabase-managed projects.
  const dbConnStr = Deno.env.get('DB_URL')
    ?? Deno.env.get('SUPABASE_DB_URL')
    ?? Deno.env.get('POSTGRES_PASSWORD');

  if (!dbConnStr) {
    return new Response(JSON.stringify({
      success: false,
      error: 'No DB_URL secret found. Add it in Supabase Dashboard → Project Settings → Edge Functions → Secrets.',
    }), { status: 400, headers: corsHeaders });
  }

  let client: Client | null = null;
  try {
    // DB_URL may be a plain password, a postgres:// URL, or a postgresql:// URL.
    // Supabase pooler format: postgresql://postgres.{ref}:{pw}@aws-0-{region}.pooler.supabase.com:6543/postgres
    // Direct format:          postgresql://postgres:{pw}@db.{ref}.supabase.co:5432/postgres
    let connStr: string;
    if (dbConnStr.startsWith('postgresql://') || dbConnStr.startsWith('postgres://')) {
      connStr = dbConnStr;
    } else {
      // Plain password — build direct connection string
      connStr = `postgresql://postgres:${encodeURIComponent(dbConnStr)}@${dbHost}:5432/postgres?sslmode=require`;
    }

    client = new Client(connStr);
    await client.connect();

    const results: Record<string, any> = {};

    for (const job of jobs) {
      // Unschedule old version
      await client.queryArray(
        `SELECT cron.unschedule($1) WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = $1)`,
        [job.name]
      ).catch(() => {});

      // Schedule fresh
      const schedRes = await client.queryArray(
        `SELECT cron.schedule($1, $2, $3)`,
        [
          job.name,
          job.schedule,
          `SELECT net.http_post(url:='${SUPABASE_URL}/functions/v1/${job.fn}',headers:='{"Authorization":"Bearer ${SERVICE_KEY}","Content-Type":"application/json","x-triggered-by":"cron"}'::jsonb,body:='{}'::jsonb) AS request_id;`,
        ]
      );
      results[job.name] = { ok: true, schedule: job.schedule, jobid: schedRes.rows[0]?.[0] };
    }

    // Verify
    const verify = await client.queryObject(
      `SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname = ANY($1) ORDER BY jobname`,
      [['process-auto-reply-queue', 'reconcile-sent-replies']]
    );

    return new Response(JSON.stringify({ success: true, results, jobs: verify.rows }), { headers: corsHeaders });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: e?.message || String(e) }), { status: 500, headers: corsHeaders });
  } finally {
    await client?.end().catch(() => {});
  }
});
