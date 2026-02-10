import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Email Bison API credentials (Maverick only)
const MAVERICK_BISON_API_KEY = Deno.env.get('MAVERICK_BISON_API_KEY')!
const MAVERICK_BASE_URL = 'https://send.maverickmarketingllc.com/api'
const EMAIL_BISON_PAGE_SIZE = 15 // API returns max 15 accounts per page

// Processing limits (to prevent timeouts and EarlyDrop crashes)
const MAX_FUNCTION_RUNTIME_MS = 9 * 60 * 1000 // 9 minutes (Edge Function has 10min limit)
const WORKSPACE_TIMEOUT_MS = 180 * 1000 // 3 minutes max per workspace (allows large workspaces like Maverick In-house with 1600+ accounts)
const PARALLEL_WORKSPACE_COUNT = 1 // Must be 1 with shared API key (stateful workspace switching)
const PROGRESS_UPDATE_INTERVAL = 5 // Update progress every N workspaces (reduce DB writes)
const MAX_API_RETRIES = 3 // Retry failed API calls up to 3 times
const DEFAULT_BATCH_SIZE = 50 // Process all workspaces in a single invocation (chaining is unreliable)

// Helper function: Retry API calls with exponential backoff
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = MAX_API_RETRIES
): Promise<Response> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options)

      // Success - return immediately
      if (response.ok) return response

      // Client error (4xx) - don't retry
      if (response.status >= 400 && response.status < 500) {
        return response
      }

      // Server error (5xx) - retry with backoff
      if (attempt < maxRetries - 1) {
        const backoffMs = Math.pow(2, attempt) * 1000 // 1s, 2s, 4s
        console.warn(`  ⚠️  API error ${response.status}, retrying in ${backoffMs}ms... (attempt ${attempt + 1}/${maxRetries})`)
        await new Promise(resolve => setTimeout(resolve, backoffMs))
        continue
      }

      return response
    } catch (err: any) {
      lastError = err
      if (attempt < maxRetries - 1) {
        const backoffMs = Math.pow(2, attempt) * 1000
        console.warn(`  ⚠️  Network error, retrying in ${backoffMs}ms... (attempt ${attempt + 1}/${maxRetries})`)
        await new Promise(resolve => setTimeout(resolve, backoffMs))
      }
    }
  }

  throw lastError || new Error('Max retries exceeded')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Parse batch parameters from request body
  let batchOffset = 0
  let batchSize = DEFAULT_BATCH_SIZE
  let skipViewRefresh = false
  let parentJobId: string | null = null // For chained batches, reuse parent's job ID
  let isAutoChained = false // Flag to identify chained invocations

  try {
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}))
      batchOffset = body.batch_offset ?? 0
      batchSize = body.batch_size ?? DEFAULT_BATCH_SIZE
      skipViewRefresh = body.skip_view_refresh ?? false // Skip if another batch will run after
      parentJobId = body.job_id ?? null // Reuse job ID for chained batches
      isAutoChained = body.auto_chained ?? false
    }
  } catch {
    // Use defaults
  }

  // Generate unique job ID (or reuse parent's for chained batches)
  const jobId = parentJobId || crypto.randomUUID()
  const batchNumber = Math.floor(batchOffset / batchSize) + 1

  if (isAutoChained) {
    console.log(`🔗 Auto-chained batch ${batchNumber} starting (job_id: ${jobId}, batch_offset: ${batchOffset})`)
  } else {
    console.log(`🆔 Starting job ${jobId} (batch_offset: ${batchOffset}, batch_size: ${batchSize})`)
  }

  // ✅ CHANGED: Await the processing instead of running in background
  // Supabase Edge Functions don't support true background processing - they terminate
  // after the response is sent, causing "EarlyDrop" errors
  try {
    const result = await processInBackground(jobId, batchOffset, batchSize, skipViewRefresh, isAutoChained)

    return new Response(
      JSON.stringify({
        success: true,
        job_id: jobId,
        status: 'completed',
        message: 'Email sync completed successfully',
        ...result
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  } catch (err: any) {
    console.error(`❌ Job ${jobId} failed:`, err)
    return new Response(
      JSON.stringify({
        success: false,
        job_id: jobId,
        status: 'failed',
        error: err.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

// Background processing function
async function processInBackground(
  jobId: string,
  batchOffset: number = 0,
  batchSize: number = DEFAULT_BATCH_SIZE,
  skipViewRefresh: boolean = false,
  isAutoChained: boolean = false // True if this is an auto-chained batch (not the first batch)
) {
  const startTime = Date.now()
  let usingTableLock = false // Track which lock type we're using

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log('🔄 Starting email account polling for all workspaces...')

    // ✅ CONCURRENCY CONTROL: Try to acquire TABLE-BASED lock
    // Table-based locks are more reliable than advisory locks with connection pooling
    // If function crashes (EarlyDrop), the lock auto-expires after 10 minutes
    const SYNC_LOCK_ID = 'poll-sender-emails'
    console.log('🔒 Attempting to acquire table-based sync lock...')

    const { data: lockAcquired, error: lockError } = await supabase
      .rpc('try_sync_lock', { p_lock_id: SYNC_LOCK_ID, p_job_id: jobId, p_stale_threshold_minutes: 10 })

    if (lockError) {
      // Fallback to advisory lock if table-based lock not yet migrated
      console.warn('⚠️ Table-based lock not available, trying advisory lock...', lockError.message)
      const { data: advisoryLock, error: advisoryError } = await supabase
        .rpc('try_advisory_lock', { lock_id: 123456789 })

      if (advisoryError || !advisoryLock) {
        console.error('❌ Failed to acquire any lock')
        throw new Error(`Lock acquisition failed: ${advisoryError?.message || 'Lock held'}`)
      }
      console.log('✅ Advisory lock acquired (fallback)')
    } else if (!lockAcquired) {
      console.warn('⚠️  Another sync is already running. Exiting gracefully.')
      console.warn('⚠️  Lock will auto-expire if the other sync crashed.')
      return { message: 'Another sync is running', skipped: true }
    } else {
      console.log('✅ Table-based sync lock acquired successfully')
      usingTableLock = true
    }

    // No preemptive timeout needed - table-based locks auto-expire after 10 minutes of no heartbeat

    // Fetch all active workspaces first (to know total count)
    const { data: allWorkspaces, error: workspacesError } = await supabase
      .from('client_registry')
      .select('workspace_name, bison_workspace_id, bison_instance, bison_api_key')
      .eq('is_active', true)
      .order('workspace_name') // Consistent ordering for batching

    if (workspacesError) throw workspacesError

    const totalWorkspaces = allWorkspaces.length
    const workspaces = allWorkspaces.slice(batchOffset, batchOffset + batchSize)
    const hasMoreBatches = batchOffset + batchSize < totalWorkspaces

    const batchNumber = Math.floor(batchOffset / batchSize) + 1
    console.log(`📊 Batch ${batchNumber} info: Processing workspaces ${batchOffset + 1}-${batchOffset + workspaces.length} of ${totalWorkspaces} total`)
    console.log(`   Workspaces in this batch: ${workspaces.map(w => w.workspace_name).join(', ')}`)
    if (hasMoreBatches) {
      console.log(`   🔄 Auto-chaining enabled - next batch will start automatically`)
    }

    let progressRecord: any = null

    // For auto-chained batches, fetch existing records; for first batch, create new ones
    if (isAutoChained) {
      console.log(`🔗 Auto-chained batch - fetching existing progress record for job ${jobId}`)

      // Fetch existing progress record
      const { data: existingProgress, error: fetchError } = await supabase
        .from('sync_progress')
        .select()
        .eq('job_id', jobId)
        .single()

      if (fetchError) {
        console.warn('⚠️ Failed to fetch existing progress record:', fetchError.message)
      } else {
        progressRecord = existingProgress
        console.log(`📈 Using existing progress record: ${progressRecord.id}`)
      }

      // Update job status to show current batch
      const { error: updateJobError } = await supabase
        .from('polling_job_status')
        .update({
          warnings: [`Batch ${batchNumber}: workspaces ${batchOffset + 1}-${batchOffset + workspaces.length} of ${totalWorkspaces}`]
        })
        .eq('id', jobId)

      if (updateJobError) {
        console.warn('⚠️ Failed to update job status for chained batch:', updateJobError.message)
      }
    } else {
      // First batch - create new records
      // Create job status record
      const { data: jobStatus, error: jobStatusError } = await supabase
        .from('polling_job_status')
        .insert({
          id: jobId,
          job_name: 'poll-sender-emails',
          status: 'running',
          total_workspaces: totalWorkspaces, // Total across ALL batches
          started_at: new Date().toISOString(),
          warnings: [`Batch ${batchNumber}: workspaces ${batchOffset + 1}-${batchOffset + workspaces.length} of ${totalWorkspaces}`]
        })
        .select()
        .single()

      if (jobStatusError) {
        console.warn('⚠️ Failed to create job status record:', jobStatusError.message)
      } else {
        console.log('📊 Created job status record:', jobId)
      }

      // Create sync progress record for real-time tracking
      const { data: newProgressRecord, error: progressError } = await supabase
        .from('sync_progress')
        .insert({
          job_id: jobId,
          job_name: 'poll-sender-emails',
          total_workspaces: totalWorkspaces, // Total across ALL batches
          workspaces_completed: 0,
          total_accounts: 0,
          status: 'running'
        })
        .select()
        .single()

      if (progressError) {
        console.warn('⚠️ Failed to create progress record:', progressError.message)
      } else {
        progressRecord = newProgressRecord
        console.log('📈 Created progress tracking record:', progressRecord.id)
      }
    }

    const results = []
    let totalAccountsSynced = 0
    // For auto-chained batches, start from the cumulative count (batchOffset = previous batches' workspaces)
    let workspacesProcessed = isAutoChained ? batchOffset : 0
    let workspacesSkipped = 0

    // Helper function to process a single workspace
    const processWorkspace = async (workspace: any, abortSignal?: AbortSignal) => {
      try {
        const workspaceStart = Date.now()

        // Determine API credentials (Maverick only)
        const baseUrl = MAVERICK_BASE_URL
        const apiKey = workspace.bison_api_key || MAVERICK_BISON_API_KEY
        const isWorkspaceSpecificKey = !!workspace.bison_api_key

        console.log(`Processing ${workspace.workspace_name} (${isWorkspaceSpecificKey ? 'workspace-specific key' : 'global key'})`)

        // Only switch workspace if using global API key
        // Workspace-specific API keys are already scoped to the correct workspace
        if (!isWorkspaceSpecificKey) {
          console.log(`Switching to workspace ${workspace.bison_workspace_id}...`)
          const switchResponse = await fetchWithRetry(`${baseUrl}/workspaces/v1.1/switch-workspace`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ team_id: workspace.bison_workspace_id }),
            signal: abortSignal
          })

          if (!switchResponse.ok) {
            const errorText = await switchResponse.text()
            throw new Error(`Workspace switch failed: ${switchResponse.status} - ${errorText}`)
          }
        }

        // ✅ MEMORY-OPTIMIZED APPROACH: Process each page immediately instead of accumulating
        // This prevents memory exhaustion when processing 10,000+ accounts across all workspaces

        let accountsFetched = 0
        let nextUrl = `${baseUrl}/sender-emails?per_page=${EMAIL_BISON_PAGE_SIZE}`
        const MAX_PAGES = 200 // Safety limit to prevent infinite loops (allows up to 3,000 accounts per workspace)
        const UPSERT_BATCH_SIZE = 500 // Chunk large upserts to reduce memory pressure

        // Step 1: Fetch and process pages incrementally
        // We track fetched account IDs so we can mark truly-deleted accounts AFTER
        // successful pagination (not before — avoids data loss on timeout/failure)
        const domainCounts = new Map<string, number>()
        const fetchedAccountIds: number[] = [] // Track all IDs returned by the API

        console.log(`Fetching accounts for ${workspace.workspace_name}...`)
        let pageCount = 0
        while (nextUrl && pageCount < MAX_PAGES) {
          pageCount++

          const response = await fetchWithRetry(nextUrl, {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Accept': 'application/json'
            },
            signal: abortSignal
          })

          if (!response.ok) {
            const errorText = await response.text()
            console.error(`  API Error ${response.status}: ${errorText}`)
            throw new Error(`Failed to fetch sender emails: ${response.status} - ${errorText}`)
          }

          const data = await response.json()
          const accounts = data.data || []

          // Log progress with meta information if available
          const metaInfo = data.meta ? ` (page ${data.meta.current_page}/${data.meta.last_page})` : ''
          console.log(`  Page ${pageCount}${metaInfo}: ${accounts.length} accounts`)

          if (accounts.length === 0) {
            console.warn(`  Page ${pageCount}: No accounts returned, stopping pagination`)
            break
          }

          // Update domain counts (for pricing calculation) and track IDs
          for (const acc of accounts) {
            if (acc.id) fetchedAccountIds.push(acc.id)
            const accDomain = acc.email?.split('@')[1]
            if (accDomain) {
              domainCounts.set(accDomain, (domainCounts.get(accDomain) || 0) + 1)
            }
          }

          // Transform accounts for this page immediately
          const pageRecords = accounts.map((account: any) => {
            const provider = extractProvider(account.tags)
            const reseller = extractReseller(account.tags)
            const domain = account.email?.split('@')[1] || null
            const pricing = calculatePricing(provider, reseller, domain, domainCounts)
            const replyRate = account.emails_sent_count > 0
              ? Math.round((account.unique_replied_count / account.emails_sent_count) * 100 * 100) / 100
              : 0

            return {
              bison_account_id: account.id,
              email_address: account.email,
              workspace_name: workspace.workspace_name,
              workspace_id: workspace.bison_workspace_id,
              bison_instance: 'maverick',
              status: account.status || 'Not connected',
              account_type: account.type,
              emails_sent_count: account.emails_sent_count || 0,
              total_replied_count: account.total_replied_count || 0,
              unique_replied_count: account.unique_replied_count || 0,
              bounced_count: account.bounced_count || 0,
              unsubscribed_count: account.unsubscribed_count || 0,
              interested_leads_count: account.interested_leads_count || 0,
              total_opened_count: account.total_opened_count || 0,
              unique_opened_count: account.unique_opened_count || 0,
              total_leads_contacted_count: account.total_leads_contacted_count || 0,
              daily_limit: account.daily_limit || 0,
              warmup_enabled: account.warmup_enabled || false,
              reply_rate_percentage: replyRate,
              email_provider: provider,
              reseller: reseller,
              domain: domain,
              price: pricing.price,
              price_source: 'calculated',
              pricing_needs_review: pricing.price === 0 && provider !== null,
              notes: null,
              last_synced_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              deleted_at: null  // ✅ This "un-deletes" active accounts
            }
          })

          // Upsert this page immediately (chunked if large)
          for (let i = 0; i < pageRecords.length; i += UPSERT_BATCH_SIZE) {
            const batch = pageRecords.slice(i, i + UPSERT_BATCH_SIZE)
            const { error: batchError } = await supabase
              .from('email_accounts_raw')
              .upsert(batch, {
                onConflict: 'bison_account_id,bison_instance,workspace_id',
                count: 'exact'
              })

            if (batchError) {
              console.error(`  ❌ Batch upsert error: ${batchError.message}`)
            }
          }

          accountsFetched += accounts.length

          // Check for next page - use links.next first, then fallback to meta pagination
          nextUrl = data.links?.next || null

          if (!nextUrl && data.meta && data.meta.current_page < data.meta.last_page) {
            const nextPage = data.meta.current_page + 1
            nextUrl = `${baseUrl}/sender-emails?per_page=${EMAIL_BISON_PAGE_SIZE}&page=${nextPage}`
          }
        }

        if (pageCount >= MAX_PAGES) {
          console.warn(`  ⚠️ Reached MAX_PAGES limit (${MAX_PAGES}), stopping pagination`)
        }

        console.log(`✓ ${workspace.workspace_name}: ${accountsFetched} accounts synced (${pageCount} pages)`)

        // Step 2: AFTER successful pagination, mark accounts NOT returned by API as deleted
        // This is safe because we only delete after confirming what's active
        if (fetchedAccountIds.length > 0) {
          // Mark accounts that exist in DB but were NOT in API response as deleted
          // Process in chunks to avoid query size limits
          const CHUNK_SIZE = 500
          for (let c = 0; c < fetchedAccountIds.length; c += CHUNK_SIZE) {
            const chunk = fetchedAccountIds.slice(c, c + CHUNK_SIZE)
            // Un-delete any that were previously soft-deleted but came back
            await supabase
              .from('email_accounts_raw')
              .update({ deleted_at: null })
              .eq('workspace_id', workspace.bison_workspace_id)
              .eq('bison_instance', 'maverick')
              .in('bison_account_id', chunk)
              .not('deleted_at', 'is', null)
          }

          // Now mark accounts NOT in the fetched set as deleted
          // We use a different approach: fetch all active IDs for this workspace, diff in memory
          const { data: existingAccounts } = await supabase
            .from('email_accounts_raw')
            .select('bison_account_id')
            .eq('workspace_id', workspace.bison_workspace_id)
            .eq('bison_instance', 'maverick')
            .is('deleted_at', null)

          if (existingAccounts) {
            const fetchedSet = new Set(fetchedAccountIds)
            const toDelete = existingAccounts
              .map(a => a.bison_account_id)
              .filter(id => !fetchedSet.has(id))

            if (toDelete.length > 0) {
              console.log(`  🗑️ Soft-deleting ${toDelete.length} accounts no longer in API for ${workspace.workspace_name}`)
              for (let c = 0; c < toDelete.length; c += CHUNK_SIZE) {
                const chunk = toDelete.slice(c, c + CHUNK_SIZE)
                await supabase
                  .from('email_accounts_raw')
                  .update({ deleted_at: new Date().toISOString() })
                  .eq('workspace_id', workspace.bison_workspace_id)
                  .eq('bison_instance', 'maverick')
                  .in('bison_account_id', chunk)
              }
            }
          }
        } else {
          console.warn(`  ⚠️ No accounts fetched for ${workspace.workspace_name} — skipping deletion to avoid data loss`)
        }

        // Clear domain counts to help garbage collection
        domainCounts.clear()

        const workspaceDuration = Date.now() - workspaceStart

        console.log(`✅ ${workspace.workspace_name}: ${accountsFetched} accounts (${workspaceDuration}ms)`)

        return {
          workspace: workspace.workspace_name,
          accounts_synced: accountsFetched,
          duration_ms: workspaceDuration,
          success: true
        }
      } catch (error) {
        console.error(`❌ Failed to sync ${workspace.workspace_name}:`, error)
        return {
          workspace: workspace.workspace_name,
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

      // Process batch in parallel with per-workspace timeout protection
      const batchResults = await Promise.all(batch.map(async (workspace) => {
        // Create AbortController for this workspace to cancel hanging API calls
        const abortController = new AbortController()
        let timeoutId: number | undefined

        try {
          // Set timeout to abort the request if it takes too long
          timeoutId = setTimeout(() => {
            console.warn(`⏱️ ${workspace.workspace_name} exceeded ${WORKSPACE_TIMEOUT_MS}ms timeout, aborting...`)
            abortController.abort()
          }, WORKSPACE_TIMEOUT_MS)

          // Process workspace with abort signal
          const result = await processWorkspace(workspace, abortController.signal)
          clearTimeout(timeoutId)
          return result
        } catch (error) {
          // If timeout or error, return failed result
          if (timeoutId) clearTimeout(timeoutId)
          console.error(`❌ ${workspace.workspace_name} failed or timed out:`, error.message)
          return {
            workspace: workspace.workspace_name,
            accounts_synced: 0,
            error: error.message || 'Timeout or fetch aborted',
            success: false
          }
        }
      }))

      // Aggregate results
      for (const result of batchResults) {
        results.push(result)
        totalAccountsSynced += result.accounts_synced
        workspacesProcessed++
      }

      // ✅ Update progress every N workspaces (reduce DB writes)
      if (progressRecord && workspacesProcessed % PROGRESS_UPDATE_INTERVAL === 0) {
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

      // ✅ Update lock heartbeat to prevent stale lock detection
      if (usingTableLock && workspacesProcessed % PROGRESS_UPDATE_INTERVAL === 0) {
        await supabase.rpc('update_sync_heartbeat', { p_lock_id: 'poll-sender-emails', p_job_id: jobId })
      }
    }

    const totalDuration = Date.now() - startTime
    const failedCount = results.filter(r => !r.success).length
    // For intermediate batches with auto-chaining, mark as 'running' since more batches will follow
    // Only mark as completed/partial/failed on the final batch
    const finalStatus = hasMoreBatches
      ? 'running' // More batches to come
      : (workspacesSkipped > 0 ? 'partial' : (failedCount > 0 ? 'completed_with_errors' : 'completed'))

    const batchNumber = Math.floor(batchOffset / batchSize) + 1
    console.log(`✅ Batch ${batchNumber} complete: ${totalAccountsSynced} accounts synced across ${workspacesProcessed}/${totalWorkspaces} total workspaces in ${totalDuration}ms`)
    if (workspacesSkipped > 0) {
      console.warn(`⚠️ Skipped ${workspacesSkipped} workspaces due to timeout - run again to complete`)
    }
    if (failedCount > 0) {
      console.warn(`⚠️ ${failedCount} workspaces failed to sync`)
    }

    // ✅ Update progress to show post-processing phase
    if (progressRecord) {
      const { error: viewProgressError } = await supabase
        .from('sync_progress')
        .update({
          current_workspace: 'Refreshing materialized views...',
          updated_at: new Date().toISOString()
        })
        .eq('id', progressRecord.id)

      if (viewProgressError) {
        console.warn('⚠️ Failed to update progress for view refresh:', viewProgressError.message)
      }
    }

    // ✅ Refresh materialized view (critical for two-table architecture!)
    // Skip if more batches are coming - only refresh on the final batch
    if (skipViewRefresh) {
      console.log('⏭️  Skipping view refresh (more batches will follow)')
    } else {
      // ⚠️ TIMEOUT PROTECTION: View refresh can hang indefinitely if database locks are held
      // Increased from 30s to 60s to handle 11,000+ accounts without timing out
      const VIEW_REFRESH_TIMEOUT_MS = 60000 // 60 seconds
      console.log('🔄 Refreshing materialized view email_accounts_view...')
      const viewRefreshStart = Date.now()
      try {
        const refreshPromise = supabase.rpc('refresh_email_accounts_view')
        const timeoutPromise = new Promise<{ error: Error }>((_, reject) =>
          setTimeout(() => reject(new Error('View refresh exceeded 60 second timeout')), VIEW_REFRESH_TIMEOUT_MS)
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
    } // End of else block for skipViewRefresh

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

    // ✅ Update progress record
    if (progressRecord?.id) {
      if (hasMoreBatches) {
        // Intermediate batch - just update counts, don't mark as completed (next batch will continue)
        console.log(`📊 Updating progress for batch (more batches to follow) (ID: ${progressRecord.id})`)
        const { error: updateError } = await supabase
          .from('sync_progress')
          .update({
            workspaces_completed: workspacesProcessed,
            total_accounts: totalAccountsSynced,
            current_workspace: `Batch ${Math.floor(batchOffset / batchSize) + 1} complete, chaining to next...`,
            updated_at: new Date().toISOString()
          })
          .eq('id', progressRecord.id)

        if (updateError) {
          console.warn('⚠️ Failed to update progress for intermediate batch:', updateError.message)
        } else {
          console.log(`✅ Progress updated: ${workspacesProcessed}/${totalWorkspaces} workspaces`)
        }
      } else {
        // Final batch - mark as completed
        console.log(`📊 Marking sync progress as completed (ID: ${progressRecord.id})`)
        const { error: completeError } = await supabase
          .from('sync_progress')
          .update({
            status: 'completed',
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
      }
    } else {
      console.warn('⚠️ No progressRecord.id available - cannot update progress')
    }

    console.log('📊 Background job completed successfully!')

    // ✅ AUTO-CHAINING: If more batches remain, trigger the next batch automatically
    // ⚠️ CRITICAL: Release the lock BEFORE chaining to avoid lock contention
    let chainPromise: Promise<any> | null = null
    if (hasMoreBatches) {
      const nextBatchOffset = batchOffset + batchSize
      const isNextBatchLast = nextBatchOffset + batchSize >= totalWorkspaces

      console.log(`🔄 Auto-chaining: triggering batch ${Math.floor(nextBatchOffset / batchSize) + 1}`)
      console.log(`   Next offset: ${nextBatchOffset}, workspaces remaining: ${totalWorkspaces - nextBatchOffset}`)
      console.log(`   Will refresh view on next batch: ${isNextBatchLast}`)

      // ✅ RELEASE LOCK BEFORE CHAINING (prevents batch 2 from seeing "lock held" error)
      console.log('🔓 Releasing lock before auto-chaining...')
      try {
        if (usingTableLock) {
          const { data: lockReleased, error: releaseError } = await supabase
            .rpc('release_sync_lock', { p_lock_id: 'poll-sender-emails', p_job_id: jobId })

          if (releaseError) {
            console.warn('⚠️  Failed to release table lock before chaining:', releaseError.message)
          } else if (lockReleased) {
            console.log('✅ Lock released successfully before chaining')
            usingTableLock = false // Mark as released so finally block doesn't try again
          }
        }
      } catch (err: any) {
        console.warn('⚠️  Exception while releasing lock before chaining:', err.message)
      }

      // Fire-and-forget: invoke next batch asynchronously
      // Use EdgeRuntime.waitUntil to ensure the request is sent before this function returns
      chainPromise = supabase.functions.invoke('poll-sender-emails', {
        body: {
          batch_offset: nextBatchOffset,
          batch_size: batchSize,
          skip_view_refresh: !isNextBatchLast, // Only refresh on the final batch
          job_id: jobId, // Continue tracking same job
          auto_chained: true // Flag to identify chained invocations in logs
        }
      }).then(result => {
        if (result.error) {
          console.error('❌ Failed to auto-chain next batch:', result.error)
        } else {
          console.log('✅ Successfully triggered next batch')
        }
      }).catch(err => {
        console.error('❌ Error auto-chaining next batch:', err)
      })

      // If EdgeRuntime.waitUntil is available (Supabase Edge Functions), use it
      // This ensures the request is sent before this function returns
      if (typeof EdgeRuntime !== 'undefined' && (EdgeRuntime as any).waitUntil) {
        (EdgeRuntime as any).waitUntil(chainPromise)
      } else {
        // Fallback: wait for the chain call to complete
        console.log('⏳ EdgeRuntime.waitUntil not available, awaiting chain call...')
        await chainPromise
      }
    }

    // Return summary for the HTTP response
    return {
      total_workspaces_in_batch: workspaces.length,
      total_workspaces_overall: totalWorkspaces,
      workspaces_processed: workspacesProcessed,
      workspaces_skipped: workspacesSkipped,
      total_accounts_synced: totalAccountsSynced,
      duration_ms: totalDuration,
      batch_offset: batchOffset,
      batch_size: batchSize,
      has_more_batches: hasMoreBatches,
      next_batch_offset: hasMoreBatches ? batchOffset + batchSize : null,
      auto_chained_next: hasMoreBatches // Indicate if next batch was triggered
    }

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
    // ✅ ALWAYS release lock (table-based or advisory, depending on what was acquired)
    // Note: Lock may have been released early if auto-chaining was triggered
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      )

      if (usingTableLock) {
        // Release table-based lock (if not already released for chaining)
        console.log('🔓 Releasing lock in finally block...')
        const { data: lockReleased, error: releaseError } = await supabase
          .rpc('release_sync_lock', { p_lock_id: 'poll-sender-emails', p_job_id: jobId })

        if (releaseError) {
          console.warn('⚠️  Failed to release table lock:', releaseError.message)
        } else if (lockReleased) {
          console.log('🔓 Table-based lock released successfully')
        } else {
          console.log('ℹ️  Lock was already released (likely for auto-chaining)')
        }
      } else {
        // Release advisory lock (fallback)
        const { data: lockReleased, error: releaseError } = await supabase
          .rpc('release_advisory_lock', { lock_id: 123456789 })

        if (releaseError) {
          console.warn('⚠️  Failed to release advisory lock:', releaseError.message)
        } else if (lockReleased) {
          console.log('🔓 Advisory lock released successfully')
        } else {
          console.warn('⚠️  Lock was not held by this session')
        }
      }
    } catch (err: any) {
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

// Helper function to calculate pricing (optimized - receives pre-calculated domain counts)
function calculatePricing(
  provider: string | null,
  reseller: string | null,
  domain: string | null,
  domainCounts: Map<string, number>
): { price: number, dailySendingLimit: number } {
  const providerLower = provider?.toLowerCase() || ''
  const resellerLower = reseller?.toLowerCase() || ''

  // Use pre-calculated domain counts (fixes O(n²) complexity)
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
