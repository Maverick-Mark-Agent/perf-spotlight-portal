// Force add admin - bypasses RLS using service role
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

    // Use service role client which bypasses RLS
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    const userId = '09322929-6078-4b08-bd55-e3e1ff773028'
    const email = 'thomaschavez@maverickmarketingllc.com'

    console.log(`Force adding admin access for ${email} (${userId})...`)

    // Delete any existing entries first
    const { error: deleteError } = await supabaseAdmin
      .from('user_workspace_access')
      .delete()
      .eq('user_id', userId)

    if (deleteError) {
      console.log('Delete error (may be ok if no rows):', deleteError)
    }

    // Insert admin role using service role (bypasses RLS)
    const { data, error } = await supabaseAdmin
      .from('user_workspace_access')
      .insert({
        user_id: userId,
        workspace_name: 'admin',
        role: 'admin',
      })
      .select()

    if (error) {
      console.error('Insert error:', error)
      throw error
    }

    console.log('Success! Admin role added:', data)

    // Verify
    const { data: verify } = await supabaseAdmin
      .from('user_workspace_access')
      .select('*')
      .eq('user_id', userId)

    console.log('Verification - all access entries:', verify)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Admin access added successfully',
        data,
        verification: verify
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
