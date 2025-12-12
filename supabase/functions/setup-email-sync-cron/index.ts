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
    console.log('🔧 Setting up email accounts sync cron job...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // First, unschedule any existing email sync jobs
    console.log('📝 Removing old email sync cron jobs...');

    const oldJobNames = [
      'sync-email-accounts-every-30min',
      'email-accounts-sync',
      'sync-sender-emails'
    ];

    for (const jobName of oldJobNames) {
      try {
        await supabase.rpc('exec', {
          sql: `SELECT cron.unschedule('${jobName}') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = '${jobName}');`
        });
        console.log(`   ✓ Removed: ${jobName}`);
      } catch (err) {
        console.log(`   - ${jobName} not found (ok)`);
      }
    }

    // Schedule new job to run every 30 minutes
    console.log('\n📅 Scheduling new email sync cron job (every 30 minutes)...');

    const { data: scheduleData, error: scheduleError } = await supabase.rpc('exec', {
      sql: `
        SELECT cron.schedule(
          'email-accounts-sync-30min',
          '*/30 * * * *',
          $$
            SELECT
              net.http_post(
                url := 'https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/poll-sender-emails',
                headers := jsonb_build_object(
                  'Content-Type', 'application/json',
                  'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
                ),
                body := jsonb_build_object('scheduled', true, 'timestamp', now())
              ) as request_id;
          $$
        );
      `
    });

    if (scheduleError) {
      console.error('❌ Error scheduling job:', scheduleError);
      throw scheduleError;
    }

    console.log('✅ Job scheduled successfully');

    // Verify the job was created
    console.log('\n🔍 Verifying cron job...');
    const { data: verifyData, error: verifyError } = await supabase.rpc('exec', {
      sql: `
        SELECT jobid, schedule, command, active, jobname
        FROM cron.job
        WHERE jobname = 'email-accounts-sync-30min';
      `
    });

    if (verifyError) {
      console.error('❌ Error verifying job:', verifyError);
      throw verifyError;
    }

    console.log('✅ Job verified:', verifyData);

    // Trigger immediate sync
    console.log('\n🚀 Triggering immediate sync...');
    const { data: triggerData, error: triggerError } = await supabase.functions.invoke('poll-sender-emails', {
      body: { manual: true }
    });

    if (triggerError) {
      console.log('⚠️  Could not trigger immediate sync:', triggerError.message);
    } else {
      console.log('✅ Immediate sync triggered');
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Email accounts sync cron job setup successfully',
      job: verifyData,
      schedule: '*/30 * * * * (every 30 minutes)',
      immediate_sync: triggerError ? 'failed' : 'triggered',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error:', error);
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
