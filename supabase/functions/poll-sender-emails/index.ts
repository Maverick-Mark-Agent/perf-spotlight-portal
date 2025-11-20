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
  let lockReleaseTimer: number | undefined // ✅ FIX: Declare at function scope so finally block can access it

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log('🔄 Starting email account polling for all workspaces...')

    // ✅ CONCURRENCY CONTROL: Try to acquire advisory lock
    // This prevents multiple sync jobs from running simultaneously
    const SYNC_LOCK_ID = 123456789 // Unique integer for poll-sender-emails job
    console.log('🔒 Attempting to acquire advisory lock...')

    const { data: lockAcquired, error: lockError } = await supabase
      .rpc('try_advisory_lock', { lock_id: SYNC_LOCK_ID })

    if (lockError) {
      console.error('❌ Failed to check advisory lock:', lockError.message)
      throw new Error(`Lock check failed: ${lockError.message}`)
    }

    if (!lockAcquired) {
      console.warn('⚠️  Another sync is already running. Exiting gracefully.')
      console.warn('⚠️  Lock ID:', SYNC_LOCK_ID)
      console.warn('⚠️  This is normal if a sync was recently triggered from another source.')
      return // Exit without creating job status - another sync is handling it
    }

    console.log('✅ Advisory lock acquired successfully')

    // 🔧 CRASH PROTECTION: Schedule preemptive lock release before edge function timeout
    // Edge functions timeout at 10 minutes - release lock at 9 minutes as safety net
    // This ensures lock is released even if function crashes without executing finally block
    lockReleaseTimer = setTimeout(async () => {
      console.warn('⚠️  Function approaching 9-minute mark, releasing lock preemptively')
      try {
        await supabase.rpc('release_advisory_lock', { lock_id: SYNC_LOCK_ID })
        console.log('🔓 Preemptive lock release successful')
      } catch (err) {
        console.error('❌ Preemptive lock release failed:', err)
      }
    }, 9 * 60 * 1000) // 9 minutes

    // Fetch all active workspaces first (to know total count)
    const { data: workspaces, error: workspacesError } = await supabase
      .from('client_registry')
      .select('workspace_name, bison_workspace_id, bison_instance, bison_api_key')
      .eq('is_active', true)

    if (workspacesError) throw workspacesError

    console.log(`Found ${workspaces.length} active workspaces to sync`)

    // Create job status record
    const { data: jobStatus, error: jobStatusError } = await supabase
      .from('polling_job_status')
      .insert({
        id: jobId,
        job_name: 'poll-sender-emails',
        status: 'running',
        total_workspaces: workspaces.length,
        started_at: new Date().toISOString()
      })
      .select()
      .single()

    if (jobStatusError) {
      console.warn('⚠️ Failed to create job status record:', jobStatusError.message)
    } else {
      console.log('📊 Created job status record:', jobId)
    }

    // Create sync progress record for real-time tracking
    const { data: progressRecord, error: progressError } = await supabase
      .from('sync_progress')
      .insert({
        job_id: jobId,
        job_name: 'poll-sender-emails',
        total_workspaces: workspaces.length,
        workspaces_completed: 0,
        total_accounts: 0,
        status: 'running'
      })
      .select()
      .single()

    if (progressError) {
      console.warn('⚠️ Failed to create progress record:', progressError.message)
    } else {
      console.log('📈 Created progress tracking record:', progressRecord.id)
    }

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

          // Calculate reply rate
          const replyRate = account.emails_sent_count > 0
            ? Math.round((account.unique_replied_count / account.emails_sent_count) * 100 * 100) / 100
            : 0

          return {
            // ✅ TWO-TABLE ARCHITECTURE: Write to email_accounts_raw (staging table)
            bison_account_id: account.id,  // Email Bison sender_email.id
            email_address: account.email,
            workspace_name: workspace.workspace_name,
            workspace_id: workspace.bison_workspace_id,
            bison_instance: workspace.bison_instance === 'Long Run' ? 'longrun' : 'maverick',

            // Account status
            status: account.status || 'Not connected',
            account_type: account.type,

            // Performance metrics (from Email Bison API)
            emails_sent_count: account.emails_sent_count || 0,
            total_replied_count: account.total_replied_count || 0,
            unique_replied_count: account.unique_replied_count || 0,
            bounced_count: account.bounced_count || 0,
            unsubscribed_count: account.unsubscribed_count || 0,
            interested_leads_count: account.interested_leads_count || 0,
            total_opened_count: account.total_opened_count || 0,
            unique_opened_count: account.unique_opened_count || 0,
            total_leads_contacted_count: account.total_leads_contacted_count || 0,

            // Configuration
            daily_limit: account.daily_limit || 0,
            warmup_enabled: account.warmup_enabled || false,

            // Calculated fields
            reply_rate_percentage: replyRate,

            // Tags/categorization
            email_provider: provider,
            reseller: reseller,
            domain: domain,

            // Pricing (calculated)
            price: pricing.price,
            price_source: 'calculated',
            pricing_needs_review: pricing.price === 0 && provider !== null,

            // Metadata
            notes: null,

            // Timestamps
            last_synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            deleted_at: null  // ✅ Clear deleted_at for active accounts (in case they were re-added)
          }
        })

        // Step 3: Batch upsert to email_accounts_raw (staging table)
        if (accountRecords.length > 0) {
          const { error: batchError, count } = await supabase
            .from('email_accounts_raw')  // ✅ CHANGED: Use staging table
            .upsert(accountRecords, {
              onConflict: 'bison_account_id,bison_instance',  // ✅ CHANGED: Use correct unique constraint
              count: 'exact'
            })

          if (batchError) {
            console.error(`  ❌ Batch upsert error: ${batchError.message}`)
            accountsFetched = 0
          } else {
            accountsFetched = accountRecords.length
            console.log(`✓ Batch upsert to email_accounts_raw complete: ${accountsFetched} accounts`)
          }
        }

        // Step 4: Mark deleted accounts (accounts in DB but not in current Bison response)
        // This implements soft-delete to preserve historical data while showing accurate counts
        const currentBisonIds = allWorkspaceAccounts.map(acc => acc.id)
        const instance = workspace.bison_instance === 'Long Run' ? 'longrun' : 'maverick'

        if (currentBisonIds.length > 0) {
          console.log(`Checking for deleted accounts in ${workspace.workspace_name}...`)
          const { data: deletedAccounts, error: deleteError } = await supabase
            .from('email_accounts_raw')
            .update({ deleted_at: new Date().toISOString() })
            .eq('workspace_id', workspace.bison_workspace_id)
            .eq('bison_instance', instance)
            .not('bison_account_id', 'in', `(${currentBisonIds.join(',')})`)
            .is('deleted_at', null)  // Only mark previously active accounts
            .select('bison_account_id')

          if (deleteError) {
            console.error(`  ⚠️ Failed to mark deleted accounts: ${deleteError.message}`)
          } else if (deletedAccounts && deletedAccounts.length > 0) {
            console.log(`  ✓ Marked ${deletedAccounts.length} accounts as deleted`)
          } else {
            console.log(`  ✓ No deleted accounts found`)
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

      // ✅ Update progress after each batch for real-time tracking
      if (progressRecord) {
        const { error: progressError } = await supabase
          .from('sync_progress')
          .update({
            workspaces_completed: workspacesProcessed,
            current_workspace: batchResults[batchResults.length - 1]?.workspace || null,
            total_accounts: totalAccountsSynced,
            updated_at: new Date().toISOString()
          })
          .eq('id', progressRecord.id)

        if (progressError) {
          console.warn('⚠️ Failed to update progress:', progressError.message)
        } else {
          console.log(`📈 Progress updated: ${workspacesProcessed}/${workspaces.length} workspaces, ${totalAccountsSynced} accounts`)
        }
      }

      // Small delay between batches to avoid rate limiting
      if (i + PARALLEL_WORKSPACE_COUNT < workspaces.length) {
        await new Promise(resolve => setTimeout(resolve, WORKSPACE_BATCH_DELAY_MS))
      }
    }

    console.log('🔍 DEBUG: Workspace loop completed, calculating summary...')
    const totalDuration = Date.now() - startTime
    console.log(`🔍 DEBUG: Total duration = ${totalDuration}ms`)

    const failedCount = results.filter(r => !r.success).length
    console.log(`🔍 DEBUG: Failed count = ${failedCount}`)

    const finalStatus = workspacesSkipped > 0 ? 'partial' : (failedCount > 0 ? 'completed_with_errors' : 'completed')
    console.log(`🔍 DEBUG: Final status = ${finalStatus}`)

    console.log(`✅ Poll complete: ${totalAccountsSynced} accounts synced across ${workspacesProcessed}/${workspaces.length} workspaces in ${totalDuration}ms`)
    if (workspacesSkipped > 0) {
      console.warn(`⚠️ Skipped ${workspacesSkipped} workspaces due to timeout - run again to complete`)
    }
    if (failedCount > 0) {
      console.warn(`⚠️ ${failedCount} workspaces failed to sync`)
    }

    console.log('🔍 DEBUG: About to update progress for post-processing...')
    // ✅ Update progress to show post-processing phase
    if (progressRecord) {
      console.log(`🔍 DEBUG: progressRecord.id = ${progressRecord.id}`)
      const { error: viewProgressError } = await supabase
        .from('sync_progress')
        .update({
          current_workspace: 'Refreshing materialized views...',
          updated_at: new Date().toISOString()
        })
        .eq('id', progressRecord.id)

      if (viewProgressError) {
        console.warn('⚠️ Failed to update progress for view refresh:', viewProgressError.message)
      } else {
        console.log('🔍 DEBUG: Progress update completed successfully')
      }
    } else {
      console.log('🔍 DEBUG: No progressRecord, skipping')
    }
    console.log('🔍 DEBUG: Moving to view refresh...')

    // ✅ Refresh materialized view (critical for two-table architecture!)
    // Always refresh, even if partial - users should see updated data
    // ⚠️ TIMEOUT PROTECTION: View refresh can hang indefinitely if database locks are held
    const VIEW_REFRESH_TIMEOUT_MS = 30000 // 30 seconds
    console.log('🔄 Refreshing materialized view email_accounts_view...')
    const viewRefreshStart = Date.now()
    try {
      const refreshPromise = supabase.rpc('refresh_email_accounts_view')
      const timeoutPromise = new Promise<{ error: Error }>((_, reject) =>
        setTimeout(() => reject(new Error('View refresh exceeded 30 second timeout')), VIEW_REFRESH_TIMEOUT_MS)
      )

      const { error: viewError } = await Promise.race([refreshPromise, timeoutPromise])
      const viewRefreshDuration = Date.now() - viewRefreshStart

      if (viewError) {
        console.error(`❌ Failed to refresh materialized view after ${viewRefreshDuration}ms:`, viewError.message)
      } else {
        console.log(`✅ Materialized view refreshed successfully in ${viewRefreshDuration}ms - frontend will see fresh data!`)
      }
    } catch (viewErr: any) {
      const viewRefreshDuration = Date.now() - viewRefreshStart
      console.error(`❌ Error refreshing view after ${viewRefreshDuration}ms:`, viewErr.message || viewErr)
      // Continue execution - stale view is better than stuck sync
    }

    // ✅ Refresh Home Insurance view (filtered subset of main view)
    // ⚠️ TIMEOUT PROTECTION: Same timeout as main view
    console.log('🔄 Refreshing Home Insurance materialized view...')
    const hiViewRefreshStart = Date.now()
    try {
      const hiRefreshPromise = supabase.rpc('refresh_home_insurance_view')
      const hiTimeoutPromise = new Promise<{ error: Error }>((_, reject) =>
        setTimeout(() => reject(new Error('Home Insurance view refresh exceeded 30 second timeout')), VIEW_REFRESH_TIMEOUT_MS)
      )

      const { error: hiViewError } = await Promise.race([hiRefreshPromise, hiTimeoutPromise])
      const hiViewRefreshDuration = Date.now() - hiViewRefreshStart

      if (hiViewError) {
        console.error(`❌ Failed to refresh Home Insurance view after ${hiViewRefreshDuration}ms:`, hiViewError.message)
      } else {
        console.log(`✅ Home Insurance view refreshed successfully in ${hiViewRefreshDuration}ms`)
      }
    } catch (hiViewErr: any) {
      const hiViewRefreshDuration = Date.now() - hiViewRefreshStart
      console.error(`❌ Error refreshing Home Insurance view after ${hiViewRefreshDuration}ms:`, hiViewErr.message || hiViewErr)
      // Continue execution - stale view is better than stuck sync
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

    // ✅ Update progress record to completed
    if (progressRecord?.id) {
      console.log(`📊 Marking sync progress as completed (ID: ${progressRecord.id})`)
      const { error: completeError } = await supabase
        .from('sync_progress')
        .update({
          status: 'completed', // Always mark as 'completed' (sync_progress only accepts: 'running', 'completed', 'failed')
          completed_at: new Date().toISOString(),
          workspaces_completed: workspacesProcessed,
          total_accounts: totalAccountsSynced
        })
        .eq('id', progressRecord.id)

      if (completeError) {
        console.error('❌ CRITICAL: Failed to mark progress as completed:', completeError)
      } else {
        console.log('✅ Successfully marked sync progress as completed!')
      }
    } else {
      console.warn('⚠️ No progressRecord.id available - cannot mark as completed')
    }

    console.log('📊 Background job completed successfully!')

  } catch (error) {
    console.error('❌ Background job error:', error)

    // Update job status to failed
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { error: jobUpdateError } = await supabase
      .from('polling_job_status')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: error.message,
        duration_ms: Date.now() - startTime
      })
      .eq('id', jobId)

    if (jobUpdateError) {
      console.error('Failed to update job status:', jobUpdateError.message)
    }

    // ✅ Update progress record to failed
    const { error: failedProgressError } = await supabase
      .from('sync_progress')
      .update({
        status: 'failed',
        error_message: error.message,
        completed_at: new Date().toISOString()
      })
      .eq('job_id', jobId)

    if (failedProgressError) {
      console.warn('⚠️ Failed to mark progress as failed:', failedProgressError.message)
    }

    throw error // Re-throw to ensure error is logged
  } finally {
    // 🔧 Clear the preemptive lock release timer (function completed normally)
    if (lockReleaseTimer !== undefined) {
      clearTimeout(lockReleaseTimer)
    }

    // ✅ ALWAYS release advisory lock (even if function crashes)
    // This prevents permanent locks that would block all future syncs
    const SYNC_LOCK_ID = 123456789
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      )

      const { data: lockReleased, error: releaseError } = await supabase
        .rpc('release_advisory_lock', { lock_id: SYNC_LOCK_ID })

      if (releaseError) {
        console.warn('⚠️  Failed to release advisory lock:', releaseError.message)
      } else if (lockReleased) {
        console.log('🔓 Advisory lock released successfully')
      } else {
        console.warn('⚠️  Lock was not held by this session (may have been released already)')
      }
    } catch (err) {
      console.warn('⚠️  Exception while releasing lock:', err.message)
    }
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
