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

    console.log('Creating polling_job_status table...')

    // Execute the SQL directly
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        -- Create table
        CREATE TABLE IF NOT EXISTS public.polling_job_status (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          job_name text NOT NULL,
          started_at timestamptz NOT NULL DEFAULT now(),
          completed_at timestamptz,
          status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'partial', 'failed')),
          total_workspaces integer NOT NULL DEFAULT 0,
          workspaces_processed integer NOT NULL DEFAULT 0,
          workspaces_skipped integer NOT NULL DEFAULT 0,
          total_accounts_synced integer NOT NULL DEFAULT 0,
          duration_ms integer,
          error_message text,
          warnings text[],
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        );

        -- Create indexes
        CREATE INDEX IF NOT EXISTS idx_polling_job_status_job_name ON public.polling_job_status(job_name);
        CREATE INDEX IF NOT EXISTS idx_polling_job_status_started_at ON public.polling_job_status(started_at DESC);
        CREATE INDEX IF NOT EXISTS idx_polling_job_status_status ON public.polling_job_status(status);

        -- Enable RLS
        ALTER TABLE public.polling_job_status ENABLE ROW LEVEL SECURITY;

        -- Drop existing policies
        DROP POLICY IF EXISTS "Service role full access on polling_job_status" ON public.polling_job_status;
        DROP POLICY IF EXISTS "Public read access on polling_job_status" ON public.polling_job_status;

        -- Create policies
        CREATE POLICY "Service role full access on polling_job_status"
        ON public.polling_job_status FOR ALL TO service_role USING (true) WITH CHECK (true);

        CREATE POLICY "Public read access on polling_job_status"
        ON public.polling_job_status FOR SELECT TO anon USING (true);
      `
    })

    if (error) {
      console.error('Error creating table:', error)
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Table created successfully!')

    return new Response(
      JSON.stringify({ success: true, message: 'polling_job_status table created' }),
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
