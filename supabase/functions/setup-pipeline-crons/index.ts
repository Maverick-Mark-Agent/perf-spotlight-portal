// Sets up the two pg_cron jobs that drive the auto-reply pipeline.
// Uses postgresjs (same driver as check-cron-status) + SUPABASE_DB_URL secret.
//
// process-auto-reply-queue  → every 5 min
// reconcile-sent-replies    → every 2 min  (was never scheduled before this fix)
//
// Idempotent — safe to call multiple times.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import postgres from 'https://deno.land/x/postgresjs@v3.4.3/mod.js';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const dbUrl = Deno.env.get('SUPABASE_DB_URL');
  if (!dbUrl) {
    return new Response(JSON.stringify({
      success: false,
      error: 'SUPABASE_DB_URL secret not set — add it in Supabase Dashboard → Project Settings → Edge Functions → Secrets',
    }), { status: 400, headers: corsHeaders });
  }

  const sql = postgres(dbUrl, { max: 1, idle_timeout: 20, connect_timeout: 10 });

  try {
    const jobs = [
      { name: 'process-auto-reply-queue', schedule: '*/5 * * * *', fn: 'process-auto-reply-queue' },
      { name: 'reconcile-sent-replies',   schedule: '*/2 * * * *', fn: 'reconcile-sent-replies'   },
    ];

    const results: Record<string, any> = {};

    for (const job of jobs) {
      // Unschedule old version if it exists
      await sql`
        SELECT cron.unschedule(${job.name})
        WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = ${job.name})
      `.catch(() => {});

      const command = `SELECT net.http_post(url:='${SUPABASE_URL}/functions/v1/${job.fn}',headers:='{"Authorization":"Bearer ${SERVICE_KEY}","Content-Type":"application/json","x-triggered-by":"cron"}'::jsonb,body:='{}'::jsonb) AS request_id;`;

      const rows = await sql`SELECT cron.schedule(${job.name}, ${job.schedule}, ${command})`;
      results[job.name] = { ok: true, schedule: job.schedule, jobid: rows[0]?.schedule };
    }

    // Verify both jobs are in cron.job
    const verify = await sql`
      SELECT jobid, jobname, schedule, active
      FROM cron.job
      WHERE jobname = ANY(ARRAY['process-auto-reply-queue','reconcile-sent-replies'])
      ORDER BY jobname
    `;

    await sql.end();

    return new Response(JSON.stringify({
      success: true,
      results,
      jobs: verify,
    }), { headers: corsHeaders });

  } catch (e: any) {
    await sql.end().catch(() => {});
    return new Response(JSON.stringify({ success: false, error: e?.message || String(e) }), {
      status: 500, headers: corsHeaders,
    });
  }
});
