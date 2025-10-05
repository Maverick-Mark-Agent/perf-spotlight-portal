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

    console.log('Running revenue tables migration...');

    // Run the migration SQL
    const migrationSQL = `
      -- Create CLIENT PRICING TABLE
      CREATE TABLE IF NOT EXISTS public.client_pricing (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        workspace_name TEXT UNIQUE NOT NULL,
        billing_type TEXT NOT NULL CHECK (billing_type IN ('per_lead', 'retainer')),
        price_per_lead DECIMAL(10,2) DEFAULT 0,
        retainer_amount DECIMAL(10,2) DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_client_pricing_workspace ON public.client_pricing(workspace_name);
      CREATE INDEX IF NOT EXISTS idx_client_pricing_type ON public.client_pricing(billing_type);
      CREATE INDEX IF NOT EXISTS idx_client_pricing_active ON public.client_pricing(is_active);

      ALTER TABLE public.client_pricing ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS "Allow all operations on client_pricing" ON public.client_pricing;
      CREATE POLICY "Allow all operations on client_pricing" ON public.client_pricing FOR ALL USING (true) WITH CHECK (true);

      -- Create CLIENT COSTS TABLE
      CREATE TABLE IF NOT EXISTS public.client_costs (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        workspace_name TEXT NOT NULL,
        month_year TEXT NOT NULL,
        email_account_costs DECIMAL(10,2) DEFAULT 0,
        labor_costs DECIMAL(10,2) DEFAULT 0,
        other_costs DECIMAL(10,2) DEFAULT 0,
        total_costs DECIMAL(10,2) GENERATED ALWAYS AS (
          COALESCE(email_account_costs, 0) + COALESCE(labor_costs, 0) + COALESCE(other_costs, 0)
        ) STORED,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
        UNIQUE(workspace_name, month_year)
      );

      CREATE INDEX IF NOT EXISTS idx_client_costs_workspace ON public.client_costs(workspace_name);
      CREATE INDEX IF NOT EXISTS idx_client_costs_month ON public.client_costs(month_year);

      ALTER TABLE public.client_costs ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS "Allow all operations on client_costs" ON public.client_costs;
      CREATE POLICY "Allow all operations on client_costs" ON public.client_costs FOR ALL USING (true) WITH CHECK (true);

      -- Create MONTHLY REVENUE SNAPSHOTS TABLE
      CREATE TABLE IF NOT EXISTS public.monthly_revenue_snapshots (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        workspace_name TEXT NOT NULL,
        month_year TEXT NOT NULL,
        billable_leads INTEGER DEFAULT 0,
        revenue DECIMAL(10,2) DEFAULT 0,
        costs DECIMAL(10,2) DEFAULT 0,
        profit DECIMAL(10,2) DEFAULT 0,
        profit_margin_percentage DECIMAL(5,2) DEFAULT 0,
        snapshot_date DATE DEFAULT CURRENT_DATE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
        UNIQUE(workspace_name, month_year)
      );

      CREATE INDEX IF NOT EXISTS idx_revenue_snapshots_workspace ON public.monthly_revenue_snapshots(workspace_name);
      CREATE INDEX IF NOT EXISTS idx_revenue_snapshots_month ON public.monthly_revenue_snapshots(month_year);

      ALTER TABLE public.monthly_revenue_snapshots ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF NOT EXISTS "Allow all operations on monthly_revenue_snapshots" ON public.monthly_revenue_snapshots;
      CREATE POLICY "Allow all operations on monthly_revenue_snapshots" ON public.monthly_revenue_snapshots FOR ALL USING (true) WITH CHECK (true);
    `;

    const { error } = await supabase.rpc('exec_sql', { sql: migrationSQL });

    if (error) {
      // If rpc doesn't exist, try direct query
      const { error: directError } = await supabase.from('client_pricing').select('id').limit(1);

      if (directError && directError.message.includes('does not exist')) {
        // Tables don't exist, we need to create them via SQL
        console.error('Tables do not exist. Migration needs to be run manually.');
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Migration needs to be run manually via psql or Supabase dashboard',
            message: 'Please run the SQL from: supabase/migrations/20251005120000_create_revenue_tables.sql'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Revenue tables migration completed successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Migration error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
