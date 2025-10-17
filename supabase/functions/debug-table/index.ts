// Debug the user_workspace_access table
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Check table exists
    const tableCheck = await supabaseAdmin.rpc('exec_sql', {
      sql_query: `
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'user_workspace_access'
        );
      `
    })

    // Check RLS status
    const rlsCheck = await supabaseAdmin.rpc('exec_sql', {
      sql_query: `
        SELECT relrowsecurity
        FROM pg_class
        WHERE relname = 'user_workspace_access';
      `
    })

    // Count rows
    const { count } = await supabaseAdmin
      .from('user_workspace_access')
      .select('*', { count: 'exact', head: true })

    // Get all rows
    const { data: allRows } = await supabaseAdmin
      .from('user_workspace_access')
      .select('*')

    return new Response(
      JSON.stringify({
        tableExists: tableCheck,
        rlsStatus: rlsCheck,
        rowCount: count,
        allData: allRows
      }, null, 2),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message, stack: error.stack }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
