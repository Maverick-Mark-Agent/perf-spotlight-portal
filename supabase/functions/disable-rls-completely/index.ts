// TEMPORARY: Disable RLS completely to fix login
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

    console.log('Disabling RLS on user_workspace_access...')

    // Drop ALL policies
    await supabaseAdmin.rpc('exec_sql', {
      sql_query: `
        DROP POLICY IF EXISTS "Users can read their own workspace access" ON user_workspace_access;
        DROP POLICY IF EXISTS "Service role can do anything" ON user_workspace_access;
        DROP POLICY IF EXISTS "Enable read access for authenticated users" ON user_workspace_access;
      `
    })

    // Disable RLS completely
    await supabaseAdmin.rpc('exec_sql', {
      sql_query: `ALTER TABLE user_workspace_access DISABLE ROW LEVEL SECURITY;`
    })

    console.log('RLS disabled successfully')

    return new Response(
      JSON.stringify({
        success: true,
        message: 'RLS disabled on user_workspace_access. Login should work now.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message, details: error }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
