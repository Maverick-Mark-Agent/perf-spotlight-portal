import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CheckResult {
  migrationApplied: boolean;
  cronExtensionInstalled: boolean | null;
  cronSchemaExists: boolean | null;
  cronJobExists: boolean | null;
  cronJobDetails?: any;
  recentRuns?: any[];
  permissionLevel: string;
  errors: string[];
  recommendations: string[];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role key for admin access
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const result: CheckResult = {
      migrationApplied: false,
      cronExtensionInstalled: null,
      cronSchemaExists: null,
      cronJobExists: null,
      permissionLevel: "service_role",
      errors: [],
      recommendations: [],
    };

    console.log("Starting pg_cron status check...");

    // Helper to execute raw SQL
    const execSQL = async (query: string): Promise<any> => {
      const { data, error } = await supabaseAdmin.rpc("query", {
        query_text: query,
      });
      if (error) throw error;
      return data;
    };

    // 1. Check if pg_cron extension is installed
    console.log("1. Checking pg_cron extension...");
    try {
      const { data: extensions, error } = await supabaseAdmin
        .from("pg_extension")
        .select("extname, extversion")
        .eq("extname", "pg_cron")
        .single();

      if (error) {
        console.log("pg_cron extension check error:", error.message);
        // Try alternative query using information_schema
        const { data: extData, error: extError } = await supabaseAdmin.rpc(
          "query",
          {
            query_text:
              "SELECT extname, extversion FROM pg_extension WHERE extname = 'pg_cron'",
          }
        );

        if (extError) {
          result.errors.push(`Cannot check pg_cron extension: ${extError.message}`);
        } else if (extData && extData.length > 0) {
          result.cronExtensionInstalled = true;
          console.log("pg_cron extension found:", extData[0]);
        } else {
          result.cronExtensionInstalled = false;
          result.recommendations.push(
            "pg_cron extension is not installed - run migration 20251009235900"
          );
        }
      } else {
        result.cronExtensionInstalled = true;
        console.log("pg_cron extension found:", extensions);
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      result.errors.push(`Exception checking pg_cron extension: ${errorMsg}`);
      console.error("Exception:", errorMsg);
    }

    // 2. Check if cron schema exists
    console.log("2. Checking cron schema...");
    try {
      const { data, error } = await supabaseAdmin.rpc("query", {
        query_text:
          "SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'cron'",
      });

      if (error) {
        result.errors.push(`Cannot check cron schema: ${error.message}`);
      } else if (data && data.length > 0) {
        result.cronSchemaExists = true;
        console.log("cron schema exists");
      } else {
        result.cronSchemaExists = false;
        result.recommendations.push(
          "cron schema does not exist - pg_cron extension may not be properly installed"
        );
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      result.errors.push(`Exception checking cron schema: ${errorMsg}`);
      console.error("Exception:", errorMsg);
    }

    // 3. Check if the cron job exists
    console.log("3. Checking daily-kpi-metrics-sync job...");
    try {
      const { data, error } = await supabaseAdmin.rpc("query", {
        query_text: `
          SELECT
            jobid,
            schedule,
            command,
            nodename,
            nodeport,
            database,
            username,
            active,
            jobname
          FROM cron.job
          WHERE jobname = 'daily-kpi-metrics-sync'
        `,
      });

      if (error) {
        result.errors.push(`Cannot check cron job: ${error.message}`);
        console.log("cron job check error:", error.message);
      } else if (data && data.length > 0) {
        result.cronJobExists = true;
        result.cronJobDetails = data[0];
        result.migrationApplied = true; // If job exists, migration was applied
        console.log("daily-kpi-metrics-sync job found:", data[0]);
      } else {
        result.cronJobExists = false;
        result.recommendations.push(
          "daily-kpi-metrics-sync job not found - run migration 20251009235900"
        );
        console.log("daily-kpi-metrics-sync job not found");
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      result.errors.push(`Exception checking cron job: ${errorMsg}`);
      console.error("Exception:", errorMsg);
    }

    // 4. Check recent job runs
    console.log("4. Checking job execution history...");
    try {
      const { data, error } = await supabaseAdmin.rpc("query", {
        query_text: `
          SELECT
            run.jobid,
            run.runid,
            run.status,
            run.return_message,
            run.start_time,
            run.end_time,
            EXTRACT(EPOCH FROM (run.end_time - run.start_time)) AS duration_seconds
          FROM cron.job_run_details run
          JOIN cron.job j ON j.jobid = run.jobid
          WHERE j.jobname = 'daily-kpi-metrics-sync'
          ORDER BY run.start_time DESC
          LIMIT 5
        `,
      });

      if (error) {
        console.log("Job history check error:", error.message);
      } else if (data && data.length > 0) {
        result.recentRuns = data;
        console.log(`Found ${data.length} recent job runs`);
      } else {
        console.log("No job execution history found");
      }
    } catch (e) {
      console.log("Exception checking job history:", e);
    }

    // Generate final recommendations
    if (!result.cronExtensionInstalled) {
      result.recommendations.push(
        "CRITICAL: pg_cron extension is not installed. Run: CREATE EXTENSION IF NOT EXISTS pg_cron;"
      );
    }

    if (!result.cronSchemaExists && result.cronExtensionInstalled) {
      result.recommendations.push(
        "WARNING: pg_cron is installed but cron schema not found - this is unusual"
      );
    }

    if (!result.cronJobExists && result.cronExtensionInstalled && result.cronSchemaExists) {
      result.recommendations.push(
        "Migration 20251009235900 needs to be applied to create the daily-kpi-metrics-sync job"
      );
    }

    if (result.cronJobExists && (!result.recentRuns || result.recentRuns.length === 0)) {
      result.recommendations.push(
        "Job is scheduled but has not run yet (may be waiting for scheduled time: 12:01 AM daily)"
      );
    }

    if (result.migrationApplied && result.cronJobExists) {
      result.recommendations.push(
        "SUCCESS: pg_cron is properly configured and daily-kpi-metrics-sync job exists"
      );
    }

    return new Response(JSON.stringify(result, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Fatal error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
