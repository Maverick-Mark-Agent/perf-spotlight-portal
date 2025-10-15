import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Setting up daily KPI sync cron job...');

    // First, unschedule any existing job with this name
    const { data: unscheduleData, error: unscheduleError } = await supabase.rpc('exec_sql', {
      sql: `SELECT cron.unschedule('daily-kpi-metrics-sync');`
    }).single();

    console.log('Unscheduled existing job (if any):', unscheduleData);

    // Schedule the new job
    const { data: scheduleData, error: scheduleError } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT cron.schedule(
          'daily-kpi-metrics-sync',
          '1 0 * * *',
          $$
            SELECT
              net.http_post(
                url := 'https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/sync-daily-kpi-metrics',
                headers := jsonb_build_object(
                  'Content-Type', 'application/json',
                  'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
                ),
                body := jsonb_build_object('scheduled', true, 'timestamp', now())
              ) as request_id;
          $$
        );
      `
    }).single();

    if (scheduleError) {
      console.error('Error scheduling job:', scheduleError);
      throw scheduleError;
    }

    console.log('Job scheduled successfully:', scheduleData);

    // Verify the job was created
    const { data: verifyData, error: verifyError } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT jobid, schedule, command, active, jobname
        FROM cron.job
        WHERE jobname = 'daily-kpi-metrics-sync';
      `
    }).single();

    if (verifyError) {
      console.error('Error verifying job:', verifyError);
      throw verifyError;
    }

    console.log('Job verification:', verifyData);

    return new Response(JSON.stringify({
      success: true,
      message: 'Daily KPI sync cron job setup successfully',
      job: verifyData,
      schedule: '1 0 * * * (12:01 AM daily)',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
