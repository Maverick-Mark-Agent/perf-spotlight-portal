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

    console.log('Adding Email Bison lead fields to client_leads table...');

    const statements = [
      { name: 'Add title', sql: "ALTER TABLE public.client_leads ADD COLUMN IF NOT EXISTS title TEXT" },
      { name: 'Add company', sql: "ALTER TABLE public.client_leads ADD COLUMN IF NOT EXISTS company TEXT" },
      { name: 'Add custom_variables', sql: "ALTER TABLE public.client_leads ADD COLUMN IF NOT EXISTS custom_variables JSONB DEFAULT '[]'::jsonb" },
      { name: 'Add tags', sql: "ALTER TABLE public.client_leads ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb" },
      { name: 'Add lead_status', sql: "ALTER TABLE public.client_leads ADD COLUMN IF NOT EXISTS lead_status TEXT" },
      { name: 'Add lead_campaign_data', sql: "ALTER TABLE public.client_leads ADD COLUMN IF NOT EXISTS lead_campaign_data JSONB DEFAULT '[]'::jsonb" },
      { name: 'Add overall_stats', sql: "ALTER TABLE public.client_leads ADD COLUMN IF NOT EXISTS overall_stats JSONB" },
    ];

    const results = [];

    for (const stmt of statements) {
      try {
        console.log(`Executing: ${stmt.name}`);
        const { error } = await supabase.from('client_leads').select('id').limit(0); // Test connection

        // Execute raw SQL using Supabase admin API
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
          },
          body: JSON.stringify({ query: stmt.sql }),
        });

        results.push({
          statement: stmt.name,
          success: response.ok,
          status: response.status
        });
      } catch (err) {
        results.push({
          statement: stmt.name,
          success: false,
          error: err instanceof Error ? err.message : String(err)
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Schema update completed',
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error:', error);
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
