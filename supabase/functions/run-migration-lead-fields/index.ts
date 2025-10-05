import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Running migration to add Email Bison lead fields...');

    // Run the migration SQL
    const migrationSQL = `
      -- Add title and company fields
      ALTER TABLE public.client_leads
      ADD COLUMN IF NOT EXISTS title TEXT,
      ADD COLUMN IF NOT EXISTS company TEXT;

      -- Add JSON fields for dynamic data
      ALTER TABLE public.client_leads
      ADD COLUMN IF NOT EXISTS custom_variables JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb;

      -- Add lead status from Email Bison
      ALTER TABLE public.client_leads
      ADD COLUMN IF NOT EXISTS lead_status TEXT;

      -- Add campaign data for tracking
      ALTER TABLE public.client_leads
      ADD COLUMN IF NOT EXISTS lead_campaign_data JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS overall_stats JSONB;

      -- Create indexes for new fields
      CREATE INDEX IF NOT EXISTS idx_client_leads_company
        ON public.client_leads(company)
        WHERE company IS NOT NULL;

      CREATE INDEX IF NOT EXISTS idx_client_leads_title
        ON public.client_leads(title)
        WHERE title IS NOT NULL;

      CREATE INDEX IF NOT EXISTS idx_client_leads_status
        ON public.client_leads(lead_status);

      -- Create GIN indexes for JSON fields (faster JSONB queries)
      CREATE INDEX IF NOT EXISTS idx_client_leads_custom_vars
        ON public.client_leads USING GIN (custom_variables);

      CREATE INDEX IF NOT EXISTS idx_client_leads_tags
        ON public.client_leads USING GIN (tags);
    `;

    const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL });

    if (error) {
      // Try executing each statement separately if batch fails
      console.log('Batch execution failed, trying individual statements...');

      const statements = [
        "ALTER TABLE public.client_leads ADD COLUMN IF NOT EXISTS title TEXT",
        "ALTER TABLE public.client_leads ADD COLUMN IF NOT EXISTS company TEXT",
        "ALTER TABLE public.client_leads ADD COLUMN IF NOT EXISTS custom_variables JSONB DEFAULT '[]'::jsonb",
        "ALTER TABLE public.client_leads ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb",
        "ALTER TABLE public.client_leads ADD COLUMN IF NOT EXISTS lead_status TEXT",
        "ALTER TABLE public.client_leads ADD COLUMN IF NOT EXISTS lead_campaign_data JSONB DEFAULT '[]'::jsonb",
        "ALTER TABLE public.client_leads ADD COLUMN IF NOT EXISTS overall_stats JSONB",
        "CREATE INDEX IF NOT EXISTS idx_client_leads_company ON public.client_leads(company) WHERE company IS NOT NULL",
        "CREATE INDEX IF NOT EXISTS idx_client_leads_title ON public.client_leads(title) WHERE title IS NOT NULL",
        "CREATE INDEX IF NOT EXISTS idx_client_leads_status ON public.client_leads(lead_status)",
        "CREATE INDEX IF NOT EXISTS idx_client_leads_custom_vars ON public.client_leads USING GIN (custom_variables)",
        "CREATE INDEX IF NOT EXISTS idx_client_leads_tags ON public.client_leads USING GIN (tags)",
      ];

      const results = [];
      for (const stmt of statements) {
        try {
          await supabase.rpc('exec_sql', { sql: stmt });
          results.push({ statement: stmt, success: true });
        } catch (err) {
          results.push({ statement: stmt, success: false, error: err });
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Migration completed with individual statements',
          results,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Migration completed successfully',
        data,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error running migration:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
