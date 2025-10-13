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

// Processing limits (to prevent timeouts)
const MAX_FUNCTION_RUNTIME_MS = 9 * 60 * 1000 // 9 minutes (Edge Function has 10min limit)
const WORKSPACE_BATCH_DELAY_MS = 100 // Small delay between workspaces to avoid rate limits
const PARALLEL_WORKSPACE_COUNT = 3 // Process 3 workspaces simultaneously to speed up sync

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Generate unique job ID
  const jobId = crypto.randomUUID()
  console.log(`🆔 Starting job ${jobId}`)

  // Start background processing (don't await!)
  processInBackground(jobId).catch(err => {
    console.error(`❌ Background job ${jobId} failed:`, err)
  })

  // Return immediately (< 1 second) to avoid gateway timeout
  return new Response(
    JSON.stringify({
      success: true,
      job_id: jobId,
      status: 'accepted',
      message: 'Email sync started in background. Check polling_job_status table for progress.',
      estimated_duration_minutes: 3
    }),
    {
      status: 202, // 202 Accepted
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  )
})

// Background processing function
async function processInBackground(jobId: string) {
  const startTime = Date.now()

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log('🔄 Starting email account polling for all workspaces...')

    // Create job status record
    const { data: jobStatus, error: jobStatusError } = await supabase
      .from('polling_job_status')
      .insert({
        id: jobId,
        job_name: 'poll-sender-emails',
        status: 'running',
        started_at: new Date().toISOString()
      })
      .select()
      .single()

    if (jobStatusError) {
      console.warn('⚠️ Failed to create job status record:', jobStatusError.message)
    } else {
      console.log('📊 Created job status record:', jobId)
    }

    // Fetch all active workspaces
    const { data: workspaces, error: workspacesError } = await supabase
      .from('client_registry')
      .select('workspace_name, bison_workspace_id, bison_instance, bison_api_key')
      .eq('is_active', true)

    if (workspacesError) throw workspacesError

    console.log(`Found ${workspaces.length} active workspaces to sync`)

    const results = []
    let totalAccountsSynced = 0
    let workspacesProcessed = 0
    let workspacesSkipped = 0

    // Helper function to process a single workspace
    const processWorkspace = async (workspace: any) => {
      try {
        const workspaceStart = Date.now()

        // Determine API credentials
        const baseUrl = workspace.bison_instance === 'Long Run' ? LONGRUN_BASE_URL : MAVERICK_BASE_URL
        const apiKey = workspace.bison_api_key || (
          workspace.bison_instance === 'Long Run' ? LONG_RUN_BISON_API_KEY : MAVERICK_BISON_API_KEY
        )
        const isWorkspaceSpecificKey = !!workspace.bison_api_key

        console.log(`Processing ${workspace.workspace_name} (${workspace.bison_instance}, ${isWorkspaceSpecificKey ? 'workspace-specific key' : 'global key'})`)

        // Only switch workspace if using global API key
        // Workspace-specific API keys are already scoped to the correct workspace
        if (!isWorkspaceSpecificKey) {
          console.log(`Switching to workspace ${workspace.bison_workspace_id}...`)
          const switchResponse = await fetch(`${baseUrl}/workspaces/v1.1/switch-workspace`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ team_id: workspace.bison_workspace_id })
          })

          if (!switchResponse.ok) {
            throw new Error(`Workspace switch failed: ${switchResponse.status}`)
          }
        }

        // Fetch ALL sender emails first (needed for accurate pricing calculations)
        let allWorkspaceAccounts = []
        let accountsFetched = 0
        // NOTE: API returns max 15 accounts per page regardless of per_page parameter
        // Requesting 1000 to minimize roundtrips, but expect ~15 per response
        let nextUrl = `${baseUrl}/sender-emails?per_page=1000`

        // Step 1: Fetch all accounts for this workspace
        console.log(`Fetching all accounts for ${workspace.workspace_name}...`)
        let pageCount = 0
        while (nextUrl) {
          pageCount++
          console.log(`  Fetching page ${pageCount}`)

          const response = await fetch(nextUrl, {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Accept': 'application/json'
            }
          })

          if (!response.ok) {
            const errorText = await response.text()
            console.error(`  API Error ${response.status}: ${errorText}`)
            throw new Error(`Failed to fetch sender emails: ${response.status} - ${errorText}`)
          }

          const data = await response.json()
          console.log(`  Page ${pageCount}: Retrieved ${data.data?.length || 0} accounts, Total so far: ${allWorkspaceAccounts.length + (data.data?.length || 0)}`)

          const accounts = data.data || []
          if (accounts.length === 0) {
            console.warn(`  Page ${pageCount}: No accounts returned, stopping pagination`)
            break
          }

          allWorkspaceAccounts.push(...accounts)

          // Check for next page
          nextUrl = data.links?.next || null
          if (!nextUrl) {
            console.log(`  Pagination complete: No more pages`)
          }
        }

        console.log(`✓ Found ${allWorkspaceAccounts.length} total accounts for ${workspace.workspace_name} (${pageCount} pages)`)

        if (allWorkspaceAccounts.length === 0) {
          console.warn(`⚠️ ${workspace.workspace_name}: No accounts to sync, skipping database upsert`)
        } else {
          console.log(`Starting batch upsert for ${allWorkspaceAccounts.length} accounts...`)
        }

        // Step 2: Prepare all account records for batch upsert (with pricing)
        const accountRecords = allWorkspaceAccounts.map(account => {
          // Extract provider and reseller from tags
          const provider = extractProvider(account.tags)
          const reseller = extractReseller(account.tags)
          const domain = account.email?.split('@')[1] || null

          // Calculate pricing with ALL workspace accounts for accurate domain counts
          const pricing = calculatePricing(provider, reseller, domain, allWorkspaceAccounts)

          return {
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

            // Pricing (calculated)
            price: pricing.price,
            volume_per_account: pricing.dailySendingLimit,

            // Tags
            tags: account.tags || [],

            // Timestamps
            last_synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        })

        // Step 3: Batch upsert all accounts at once (much faster!)
        if (accountRecords.length > 0) {
          const { error: batchError, count } = await supabase
            .from('sender_emails_cache')
            .upsert(accountRecords, {
              onConflict: 'email_address,workspace_name',
              count: 'exact'
            })

          if (batchError) {
            console.error(`  ❌ Batch upsert error: ${batchError.message}`)
            accountsFetched = 0
          } else {
            accountsFetched = accountRecords.length
            console.log(`✓ Batch upsert complete: ${accountsFetched} accounts successfully synced`)
          }
        }

        const workspaceDuration = Date.now() - workspaceStart

        console.log(`✅ ${workspace.workspace_name}: ${accountsFetched} accounts (${workspaceDuration}ms)`)

        return {
          workspace: workspace.workspace_name,
          instance: workspace.bison_instance,
          accounts_synced: accountsFetched,
          duration_ms: workspaceDuration,
          success: true
        }
      } catch (error) {
        console.error(`❌ Failed to sync ${workspace.workspace_name}:`, error)
        return {
          workspace: workspace.workspace_name,
          instance: workspace.bison_instance,
          accounts_synced: 0,
          error: error.message,
          success: false
        }
      }
    }

    // Process workspaces in parallel batches
    for (let i = 0; i < workspaces.length; i += PARALLEL_WORKSPACE_COUNT) {
      // Check if we're approaching function timeout
      const elapsedTime = Date.now() - startTime
      if (elapsedTime > MAX_FUNCTION_RUNTIME_MS) {
        console.warn(`⚠️ Approaching function timeout (${elapsedTime}ms), stopping early`)
        workspacesSkipped = workspaces.length - workspacesProcessed
        break
      }

      // Get batch of workspaces to process in parallel
      const batch = workspaces.slice(i, i + PARALLEL_WORKSPACE_COUNT)
      console.log(`Processing batch ${Math.floor(i / PARALLEL_WORKSPACE_COUNT) + 1}: ${batch.map(w => w.workspace_name).join(', ')}`)

      // Process batch in parallel
      const batchResults = await Promise.all(batch.map(processWorkspace))

      // Aggregate results
      for (const result of batchResults) {
        results.push(result)
        totalAccountsSynced += result.accounts_synced
        workspacesProcessed++
      }

      // Small delay between batches to avoid rate limiting
      if (i + PARALLEL_WORKSPACE_COUNT < workspaces.length) {
        await new Promise(resolve => setTimeout(resolve, WORKSPACE_BATCH_DELAY_MS))
      }
    }

    const totalDuration = Date.now() - startTime
    const finalStatus = workspacesSkipped > 0 ? 'partial' : 'completed'

    console.log(`✅ Poll complete: ${totalAccountsSynced} accounts synced across ${workspacesProcessed}/${workspaces.length} workspaces in ${totalDuration}ms`)
    if (workspacesSkipped > 0) {
      console.warn(`⚠️ Skipped ${workspacesSkipped} workspaces due to timeout - run again to complete`)
    }

    // Update job status record
    await supabase
      .from('polling_job_status')
      .update({
        status: finalStatus,
        completed_at: new Date().toISOString(),
        total_workspaces: workspaces.length,
        workspaces_processed: workspacesProcessed,
        workspaces_skipped: workspacesSkipped,
        total_accounts_synced: totalAccountsSynced,
        duration_ms: totalDuration,
        warnings: workspacesSkipped > 0 ? [`Skipped ${workspacesSkipped} workspaces due to timeout`] : []
      })
      .eq('id', jobId)

    console.log('📊 Background job completed successfully!')

  } catch (error) {
    console.error('❌ Background job error:', error)

    // Update job status to failed
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    await supabase
      .from('polling_job_status')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: error.message,
        duration_ms: Date.now() - startTime
      })
      .eq('id', jobId)
      .catch(err => console.error('Failed to update job status:', err))

    throw error // Re-throw to ensure error is logged
  }
}

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

// Helper function to calculate pricing (copied from hybrid-email-accounts-v2)
function calculatePricing(provider: string | null, reseller: string | null, domain: string | null, allAccounts: any[]): { price: number, dailySendingLimit: number } {
  const providerLower = provider?.toLowerCase() || ''
  const resellerLower = reseller?.toLowerCase() || ''

  // Calculate domain counts for ScaledMail and Mailr
  const domainCounts = new Map<string, number>()
  allAccounts.forEach((acc: any) => {
    const accDomain = acc.email?.split('@')[1]
    if (accDomain) {
      domainCounts.set(accDomain, (domainCounts.get(accDomain) || 0) + 1)
    }
  })

  const mailboxesOnDomain = domain ? (domainCounts.get(domain) || 1) : 1

  // Calculate price
  let price = 0
  if (resellerLower.includes('cheapinboxes')) {
    price = 3.00
  } else if (resellerLower === 'zapmail') {
    price = 3.00
  } else if (resellerLower === 'mailr') {
    price = 0.91
  } else if (resellerLower === 'scaledmail' && mailboxesOnDomain > 0) {
    price = 50 / mailboxesOnDomain
  } else if (providerLower === 'google' || providerLower === 'gmail') {
    price = 3.00
  }

  // Calculate daily sending limit
  let dailySendingLimit = 0
  if (resellerLower === 'mailr' && mailboxesOnDomain > 0) {
    dailySendingLimit = Math.floor(495 / mailboxesOnDomain)
  } else if (resellerLower === 'scaledmail') {
    if (mailboxesOnDomain >= 49) {
      dailySendingLimit = 5
    } else if (mailboxesOnDomain >= 25) {
      dailySendingLimit = 8
    } else if (mailboxesOnDomain > 0) {
      dailySendingLimit = 5
    }
  } else if (providerLower === 'google' || providerLower === 'gmail' || providerLower === 'microsoft' || providerLower === 'outlook') {
    dailySendingLimit = 20
  }

  return { price, dailySendingLimit }
}
