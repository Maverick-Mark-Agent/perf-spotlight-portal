// Temporary function to add Tommy as admin
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
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const userId = '09322929-6078-4b08-bd55-e3e1ff773028'
    const email = 'thomaschavez@maverickmarketingllc.com'

    console.log(`Adding admin access for ${email}...`)

    // Insert admin role
    const { data, error } = await supabase
      .from('user_workspace_access')
      .insert({
        user_id: userId,
        workspace_name: 'admin',
        role: 'admin',
      })
      .select()

    if (error) {
      console.error('Error:', error)
      throw error
    }

    console.log('Success:', data)

    return new Response(
      JSON.stringify({ success: true, data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
