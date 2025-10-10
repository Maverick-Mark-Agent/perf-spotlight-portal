import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Email Bison API credentials
const MAVERICK_BISON_API_KEY = Deno.env.get('MAVERICK_BISON_API_KEY')!
const LONG_RUN_BISON_API_KEY = Deno.env.get('LONG_RUN_BISON_API_KEY')!
const MAVERICK_BASE_URL = 'https://send.maverickmarketingllc.com/api'
const LONGRUN_BASE_URL = 'https://send.longrun.agency/api'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const startTime = Date.now()

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log('🔄 Starting email account polling for all workspaces...')

    // Fetch all active workspaces
    const { data: workspaces, error: workspacesError } = await supabase
      .from('client_registry')
      .select('workspace_name, bison_workspace_id, bison_instance, bison_api_key')
      .eq('is_active', true)

    if (workspacesError) throw workspacesError

    console.log(`Found ${workspaces.length} active workspaces to sync`)

    const results = []
    let totalAccountsSynced = 0

    // Process each workspace
    for (const workspace of workspaces) {
      try {
        const workspaceStart = Date.now()

        // Determine API credentials
        const baseUrl = workspace.bison_instance === 'Long Run' ? LONGRUN_BASE_URL : MAVERICK_BASE_URL
        const apiKey = workspace.bison_api_key || (
          workspace.bison_instance === 'Long Run' ? LONG_RUN_BISON_API_KEY : MAVERICK_BISON_API_KEY
        )

        console.log(`Processing ${workspace.workspace_name} (${workspace.bison_instance})`)

        // Switch to workspace context
        await fetch(`${baseUrl}/workspaces/v1.1/switch-workspace`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ team_id: workspace.bison_workspace_id })
        })

        // Fetch sender emails with pagination
        let accountsFetched = 0
        let nextUrl = `${baseUrl}/sender-emails?per_page=100`

        while (nextUrl) {
          const response = await fetch(nextUrl, {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Accept': 'application/json'
            }
          })

          if (!response.ok) {
            throw new Error(`Failed to fetch sender emails: ${response.status}`)
          }

          const data = await response.json()
          const accounts = data.data || []

          // Upsert each account to sender_emails_cache
          for (const account of accounts) {
            // Extract provider and reseller from tags
            const provider = extractProvider(account.tags)
            const reseller = extractReseller(account.tags)
            const domain = account.email?.split('@')[1] || null

            const { error: upsertError } = await supabase
              .from('sender_emails_cache')
              .upsert({
                email_address: account.email,
                account_name: account.name,
                workspace_name: workspace.workspace_name,
                bison_workspace_id: workspace.bison_workspace_id,
                bison_instance: workspace.bison_instance,

                // Performance metrics
                emails_sent_count: account.emails_sent_count || 0,
                total_replied_count: account.total_replied_count || 0,
                unique_replied_count: account.unique_replied_count || 0,
                bounced_count: account.bounced_count || 0,
                unsubscribed_count: account.unsubscribed_count || 0,
                interested_leads_count: account.interested_leads_count || 0,
                total_leads_contacted_count: account.total_leads_contacted_count || 0,

                // Status
                status: account.status || 'Not connected',
                daily_limit: account.daily_limit || 0,
                account_type: account.type,

                // Provider info
                email_provider: provider,
                reseller: reseller,
                domain: domain,

                // Tags
                tags: account.tags || [],

                // Timestamps
                last_synced_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }, {
                onConflict: 'email_address,workspace_name'
              })

            if (upsertError) {
              console.error(`Error upserting account ${account.email}:`, upsertError)
            } else {
              accountsFetched++
            }
          }

          // Check for next page
          nextUrl = data.links?.next || null
        }

        const workspaceDuration = Date.now() - workspaceStart
        totalAccountsSynced += accountsFetched

        results.push({
          workspace: workspace.workspace_name,
          instance: workspace.bison_instance,
          accounts_synced: accountsFetched,
          duration_ms: workspaceDuration,
          success: true
        })

        console.log(`✅ ${workspace.workspace_name}: ${accountsFetched} accounts (${workspaceDuration}ms)`)

      } catch (error) {
        console.error(`❌ Failed to sync ${workspace.workspace_name}:`, error)
        results.push({
          workspace: workspace.workspace_name,
          instance: workspace.bison_instance,
          accounts_synced: 0,
          error: error.message,
          success: false
        })
      }
    }

    const totalDuration = Date.now() - startTime

    console.log(`✅ Poll complete: ${totalAccountsSynced} accounts synced across ${workspaces.length} workspaces in ${totalDuration}ms`)

    return new Response(
      JSON.stringify({
        success: true,
        total_workspaces: workspaces.length,
        total_accounts_synced: totalAccountsSynced,
        duration_ms: totalDuration,
        results: results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Polling error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// Helper function to extract email provider from tags
function extractProvider(tags: any[]): string | null {
  if (!tags || !Array.isArray(tags)) return null

  const providerTags = ['Gmail', 'Outlook', 'Microsoft', 'Google', 'Yahoo', 'iCloud', 'AOL']
  const found = tags.find(tag => providerTags.includes(tag.name))
  return found?.name || null
}

// Helper function to extract reseller from tags
function extractReseller(tags: any[]): string | null {
  if (!tags || !Array.isArray(tags)) return null

  const resellerTags = ['CheapInboxes', 'Zapmail', 'ScaledMail', 'Mailr', 'Inbox', 'Reseller']
  const found = tags.find(tag => resellerTags.some(r => tag.name?.includes(r)))
  return found?.name || null
}
