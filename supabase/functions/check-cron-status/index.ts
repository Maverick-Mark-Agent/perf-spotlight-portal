import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.3/mod.js";

serve(async (req) => {
  try {
    // Get the connection string from environment
    const supabaseDbUrl = Deno.env.get("SUPABASE_DB_URL");

    if (!supabaseDbUrl) {
      return new Response(
        JSON.stringify({
          error: "Missing SUPABASE_DB_URL environment variable",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Create a direct postgres connection
    const sql = postgres(supabaseDbUrl, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
    });

    try {
      // Query 1: Check if daily-kpi-metrics-sync job exists and is active
      const cronJob = await sql`
        SELECT jobid, jobname, schedule, command, nodename, nodeport, database, username, active
        FROM cron.job
        WHERE jobname = 'daily-kpi-metrics-sync'
      `;

      // Query 2: Get the last 10 execution attempts
      const jobRuns = await sql`
        SELECT jrd.runid, jrd.jobid, j.jobname, jrd.job_pid, jrd.database,
               jrd.username, jrd.command, jrd.status, jrd.return_message,
               jrd.start_time, jrd.end_time
        FROM cron.job_run_details jrd
        JOIN cron.job j ON jrd.jobid = j.jobid
        WHERE j.jobname = 'daily-kpi-metrics-sync'
        ORDER BY jrd.start_time DESC
        LIMIT 10
      `;

      // Query 3: Verify pg_cron extension is enabled
      const extension = await sql`
        SELECT extname, extversion, extrelocatable
        FROM pg_extension
        WHERE extname = 'pg_cron'
      `;

      // Close the connection
      await sql.end();

      // Build the response
      const response = {
        timestamp: new Date().toISOString(),
        cron_extension: {
          enabled: extension.length > 0,
          data: extension,
        },
        cron_job: {
          exists: cronJob.length > 0,
          data: cronJob,
        },
        job_runs: {
          count: jobRuns.length,
          data: jobRuns,
        },
      };

      return new Response(JSON.stringify(response, null, 2), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (queryError) {
      await sql.end();
      throw queryError;
    }
  } catch (error) {
    console.error("Error checking cron status:", error);
    return new Response(
      JSON.stringify({
        error: error.message,
        stack: error.stack,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
