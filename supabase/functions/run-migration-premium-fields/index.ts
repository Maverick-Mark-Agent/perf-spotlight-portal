import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Run migration
    const { data, error } = await supabase.rpc('exec', {
      sql: `
        ALTER TABLE public.client_leads
          ADD COLUMN IF NOT EXISTS premium_amount DECIMAL(10,2),
          ADD COLUMN IF NOT EXISTS policy_type TEXT;

        CREATE INDEX IF NOT EXISTS idx_client_leads_premium
          ON public.client_leads(premium_amount) WHERE premium_amount IS NOT NULL;
      `
    })

    if (error) throw error

    return new Response(
      JSON.stringify({ success: true, message: 'Migration completed successfully' }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
