import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get count before deletion
    const { count: beforeCount } = await supabase
      .from('client_leads')
      .select('*', { count: 'exact', head: true });

    console.log(`Deleting ${beforeCount} leads from client_leads table...`);

    // Delete all leads
    const { error } = await supabase
      .from('client_leads')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Match all UUIDs

    if (error) throw error;

    // Verify deletion
    const { count: afterCount } = await supabase
      .from('client_leads')
      .select('*', { count: 'exact', head: true });

    return new Response(
      JSON.stringify({
        success: true,
        deleted: beforeCount,
        remaining: afterCount,
        message: `Successfully deleted ${beforeCount} leads`,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
