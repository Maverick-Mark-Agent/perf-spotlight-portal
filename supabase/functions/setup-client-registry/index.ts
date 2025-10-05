import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import postgres from 'https://deno.land/x/postgresjs@v3.4.3/mod.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Build connection string from environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const dbHost = supabaseUrl?.replace('https://', '').replace('.supabase.co', '') + '.supabase.co';
    const dbUrl = `postgresql://postgres.gjqbbgrfhijescaouqkx:Maverick2024!@aws-0-us-west-1.pooler.supabase.com:5432/postgres`;

    console.log('Creating client_registry table...');

    const sql = postgres(dbUrl);

    // Create the table
    await sql`
      CREATE TABLE IF NOT EXISTS public.client_registry (
        workspace_id INTEGER PRIMARY KEY,
        workspace_name TEXT NOT NULL UNIQUE,
        display_name TEXT,
        is_active BOOLEAN DEFAULT true,
        billing_type TEXT NOT NULL CHECK (billing_type IN ('per_lead', 'retainer')),
        price_per_lead DECIMAL(10,2) DEFAULT 0.00,
        retainer_amount DECIMAL(10,2) DEFAULT 0.00,
        monthly_kpi_target INTEGER DEFAULT 0,
        airtable_record_id TEXT,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;

    // Create indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_client_registry_workspace_name ON public.client_registry(workspace_name)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_client_registry_active ON public.client_registry(is_active) WHERE is_active = true`;
    await sql`CREATE INDEX IF NOT EXISTS idx_client_registry_billing_type ON public.client_registry(billing_type)`;

    // Enable RLS
    await sql`ALTER TABLE public.client_registry ENABLE ROW LEVEL SECURITY`;

    // Create RLS policies
    await sql`
      CREATE POLICY IF NOT EXISTS "Allow public read access to client_registry"
        ON public.client_registry
        FOR SELECT
        USING (true)
    `;

    await sql.end();

    console.log('✅ client_registry table created successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'client_registry table created successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Setup error:', error);
    return new Response(
      JSON.stringify({ error: error.message, details: error.toString() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
