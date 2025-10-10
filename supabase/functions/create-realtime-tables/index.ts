import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log('Creating real-time infrastructure tables...')

    const results = []

    // 1. Create sender_emails_cache table
    console.log('Creating sender_emails_cache table...')
    const { error: error1 } = await supabase.rpc('run_sql', {
      query: `
        CREATE TABLE IF NOT EXISTS public.sender_emails_cache (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          email_address text NOT NULL,
          account_name text,
          workspace_name text NOT NULL,
          bison_workspace_id integer NOT NULL,
          bison_instance text NOT NULL,
          emails_sent_count integer DEFAULT 0,
          total_replied_count integer DEFAULT 0,
          unique_replied_count integer DEFAULT 0,
          bounced_count integer DEFAULT 0,
          unsubscribed_count integer DEFAULT 0,
          interested_leads_count integer DEFAULT 0,
          total_leads_contacted_count integer DEFAULT 0,
          reply_rate_percentage decimal(5,2) GENERATED ALWAYS AS (
            CASE WHEN emails_sent_count > 0
            THEN ROUND((unique_replied_count::decimal / emails_sent_count::decimal) * 100, 2)
            ELSE 0 END
          ) STORED,
          status text NOT NULL CHECK (status IN ('Connected', 'Disconnected', 'Failed', 'Not connected')),
          daily_limit integer DEFAULT 0,
          account_type text,
          email_provider text,
          reseller text,
          domain text,
          price decimal(10,2),
          volume_per_account integer,
          tags jsonb DEFAULT '[]'::jsonb,
          last_synced_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
          created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
          updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
          UNIQUE(email_address, workspace_name)
        );
      `
    })

    results.push({ table: 'sender_emails_cache', success: !error1, error: error1?.message })

    // 2. Create indexes for sender_emails_cache
    console.log('Creating indexes for sender_emails_cache...')
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_sender_emails_cache_workspace ON public.sender_emails_cache(workspace_name)',
      'CREATE INDEX IF NOT EXISTS idx_sender_emails_cache_provider ON public.sender_emails_cache(email_provider)',
      'CREATE INDEX IF NOT EXISTS idx_sender_emails_cache_status ON public.sender_emails_cache(status)',
      'CREATE INDEX IF NOT EXISTS idx_sender_emails_cache_reply_rate ON public.sender_emails_cache(reply_rate_percentage DESC)',
      'CREATE INDEX IF NOT EXISTS idx_sender_emails_cache_last_synced ON public.sender_emails_cache(last_synced_at DESC)'
    ]

    for (const indexSql of indexes) {
      await supabase.rpc('run_sql', { query: indexSql })
    }

    // 3. Enable RLS and create policy
    console.log('Setting up RLS for sender_emails_cache...')
    await supabase.rpc('run_sql', {
      query: `ALTER TABLE public.sender_emails_cache ENABLE ROW LEVEL SECURITY;`
    })

    await supabase.rpc('run_sql', {
      query: `
        DO $$ BEGIN
          CREATE POLICY "Allow all operations on sender_emails_cache"
            ON public.sender_emails_cache
            FOR ALL
            USING (true)
            WITH CHECK (true);
        EXCEPTION
          WHEN duplicate_object THEN NULL;
        END $$;
      `
    })

    // 4. Create webhook_delivery_log table
    console.log('Creating webhook_delivery_log table...')
    const { error: error2 } = await supabase.rpc('run_sql', {
      query: `
        CREATE TABLE IF NOT EXISTS public.webhook_delivery_log (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          event_type text NOT NULL,
          workspace_name text,
          payload jsonb NOT NULL,
          processing_time_ms integer,
          success boolean NOT NULL DEFAULT false,
          error_message text,
          created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
        );
      `
    })

    results.push({ table: 'webhook_delivery_log', success: !error2, error: error2?.message })

    // 5. Create indexes for webhook_delivery_log
    await supabase.rpc('run_sql', {
      query: `
        CREATE INDEX IF NOT EXISTS idx_webhook_log_event_type ON public.webhook_delivery_log(event_type);
        CREATE INDEX IF NOT EXISTS idx_webhook_log_created_at ON public.webhook_delivery_log(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_webhook_log_success ON public.webhook_delivery_log(success);
      `
    })

    // 6. Enable RLS for webhook_delivery_log
    await supabase.rpc('run_sql', {
      query: `ALTER TABLE public.webhook_delivery_log ENABLE ROW LEVEL SECURITY;`
    })

    await supabase.rpc('run_sql', {
      query: `
        DO $$ BEGIN
          CREATE POLICY "Allow all operations on webhook_delivery_log"
            ON public.webhook_delivery_log
            FOR ALL
            USING (true)
            WITH CHECK (true);
        EXCEPTION
          WHEN duplicate_object THEN NULL;
        END $$;
      `
    })

    // 7. Create webhook_health table
    console.log('Creating webhook_health table...')
    const { error: error3 } = await supabase.rpc('run_sql', {
      query: `
        CREATE TABLE IF NOT EXISTS public.webhook_health (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          workspace_name text UNIQUE NOT NULL,
          last_webhook_at timestamp with time zone,
          webhook_count_24h integer DEFAULT 0,
          success_rate_24h decimal(5,2) DEFAULT 100.00,
          is_healthy boolean DEFAULT true,
          last_error_message text,
          updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
          created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
        );
      `
    })

    results.push({ table: 'webhook_health', success: !error3, error: error3?.message })

    // 8. Enable RLS for webhook_health
    await supabase.rpc('run_sql', {
      query: `ALTER TABLE public.webhook_health ENABLE ROW LEVEL SECURITY;`
    })

    await supabase.rpc('run_sql', {
      query: `
        DO $$ BEGIN
          CREATE POLICY "Allow all operations on webhook_health"
            ON public.webhook_health
            FOR ALL
            USING (true)
            WITH CHECK (true);
        EXCEPTION
          WHEN duplicate_object THEN NULL;
        END $$;
      `
    })

    // 9. Create provider_performance_history table
    console.log('Creating provider_performance_history table...')
    const { error: error4 } = await supabase.rpc('run_sql', {
      query: `
        CREATE TABLE IF NOT EXISTS public.provider_performance_history (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          email_provider text NOT NULL,
          bison_instance text NOT NULL,
          total_accounts integer NOT NULL DEFAULT 0,
          active_accounts integer NOT NULL DEFAULT 0,
          total_sent integer NOT NULL DEFAULT 0,
          total_replies integer NOT NULL DEFAULT 0,
          unique_replies integer NOT NULL DEFAULT 0,
          total_bounces integer NOT NULL DEFAULT 0,
          avg_reply_rate decimal(5,2) NOT NULL DEFAULT 0,
          avg_emails_per_account decimal(10,2) DEFAULT 0,
          total_daily_limit integer DEFAULT 0,
          total_volume_capacity integer DEFAULT 0,
          utilization_percentage decimal(5,2) DEFAULT 0,
          snapshot_date date NOT NULL,
          created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
          UNIQUE(email_provider, bison_instance, snapshot_date)
        );
      `
    })

    results.push({ table: 'provider_performance_history', success: !error4, error: error4?.message })

    // 10. Enable RLS for provider_performance_history
    await supabase.rpc('run_sql', {
      query: `ALTER TABLE public.provider_performance_history ENABLE ROW LEVEL SECURITY;`
    })

    await supabase.rpc('run_sql', {
      query: `
        DO $$ BEGIN
          CREATE POLICY "Allow all operations on provider_performance_history"
            ON public.provider_performance_history
            FOR ALL
            USING (true)
            WITH CHECK (true);
        EXCEPTION
          WHEN duplicate_object THEN NULL;
        END $$;
      `
    })

    console.log('All tables created successfully!')

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Real-time infrastructure tables created',
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
