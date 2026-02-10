/**
 * Sync ALL accounts for Maverick In-house workspace
 * Uses extended timeouts to handle 1626+ accounts
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://gjqbbgrfhijescaouqkx.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzYxNzUzMCwiZXhwIjoyMDczMTkzNTMwfQ.71oGb_Jv5SWpF6XU1k8Ug77CqMVH_k1it35eYYAqg3Q'
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const MAVERICK_BASE_URL = 'https://send.maverickmarketingllc.com/api'
const MAVERICK_API_KEY = '77|AqozJcNT8l2m52CRyvQyEEmLKa49ofuZRjK98aio8a3feb5d'
const PAGE_SIZE = 100 // Use larger page size for faster sync

async function syncMaverickInhouse() {
  console.log('🔄 Starting Full Sync for Maverick In-house')
  console.log('='.repeat(50))

  // Get workspace info
  const { data: workspace, error: wsError } = await supabase
    .from('client_registry')
    .select('*')
    .eq('workspace_name', 'Maverick In-house')
    .single()

  if (wsError || !workspace) {
    console.error('❌ Could not find Maverick In-house workspace:', wsError?.message)
    return
  }

  console.log(`\n📋 Workspace Info:`)
  console.log(`  Name: ${workspace.workspace_name}`)
  console.log(`  Bison Workspace ID: ${workspace.bison_workspace_id}`)
  console.log(`  Has specific API key: ${workspace.bison_api_key ? 'Yes' : 'No'}`)

  const apiKey = workspace.bison_api_key || MAVERICK_API_KEY

  // Switch to the workspace if using global API key
  if (!workspace.bison_api_key) {
    console.log(`\n🔀 Switching to workspace ${workspace.bison_workspace_id}...`)
    const switchResponse = await fetch(`${MAVERICK_BASE_URL}/workspaces/v1.1/switch-workspace`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ team_id: workspace.bison_workspace_id })
    })

    if (!switchResponse.ok) {
      const errorText = await switchResponse.text()
      console.error('❌ Failed to switch workspace:', switchResponse.status, errorText)
      return
    }
    console.log('✅ Workspace switched successfully')
  }

  // Fetch all accounts with pagination
  console.log(`\n📧 Fetching ALL accounts from Email Bison API...`)

  let allAccounts: any[] = []
  let nextUrl: string | null = `${MAVERICK_BASE_URL}/sender-emails?per_page=${PAGE_SIZE}`
  let pageCount = 0

  while (nextUrl) {
    pageCount++
    console.log(`  Fetching page ${pageCount}...`)

    const response = await fetch(nextUrl, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ API Error on page ${pageCount}:`, response.status, errorText)
      break
    }

    const data = await response.json()
    const accounts = data.data || []

    allAccounts.push(...accounts)
    console.log(`  Page ${pageCount}: ${accounts.length} accounts (total: ${allAccounts.length})`)

    // Check for next page
    nextUrl = data.links?.next || null

    if (!nextUrl && data.meta && data.meta.current_page < data.meta.last_page) {
      nextUrl = `${MAVERICK_BASE_URL}/sender-emails?per_page=${PAGE_SIZE}&page=${data.meta.current_page + 1}`
    }
  }

  console.log(`\n✅ Fetched ${allAccounts.length} accounts total from ${pageCount} pages`)

  if (allAccounts.length === 0) {
    console.log('❌ No accounts found!')
    return
  }

  // Transform accounts for database
  console.log('\n💾 Preparing accounts for database insert...')

  const domainCounts = new Map<string, number>()
  for (const acc of allAccounts) {
    const domain = acc.email?.split('@')[1]
    if (domain) {
      domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1)
    }
  }

  const records = allAccounts.map((account: any) => {
    const domain = account.email?.split('@')[1] || null
    const provider = extractProvider(account.tags)
    const reseller = extractReseller(account.tags)
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
      price: calculatePrice(provider, reseller, domain, domainCounts),
      price_source: 'calculated',
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null
    }
  })

  // Mark old accounts as deleted first
  console.log('\n🗑️ Marking old accounts as potentially deleted...')
  const { error: markError } = await supabase
    .from('email_accounts_raw')
    .update({ deleted_at: new Date().toISOString() })
    .eq('workspace_id', workspace.bison_workspace_id)
    .eq('bison_instance', 'maverick')
    .is('deleted_at', null)

  if (markError) {
    console.warn('⚠️ Warning marking old accounts:', markError.message)
  }

  // Upsert in batches
  console.log('\n💾 Upserting accounts to database...')
  const BATCH_SIZE = 500
  let insertedCount = 0

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE)
    const { error: upsertError } = await supabase
      .from('email_accounts_raw')
      .upsert(batch, {
        onConflict: 'bison_account_id,bison_instance,workspace_id'
      })

    if (upsertError) {
      console.error(`❌ Error upserting batch ${Math.floor(i/BATCH_SIZE) + 1}:`, upsertError.message)
    } else {
      insertedCount += batch.length
      console.log(`  Batch ${Math.floor(i/BATCH_SIZE) + 1}: ${insertedCount}/${records.length} accounts`)
    }
  }

  // Refresh materialized views
  console.log('\n🔄 Refreshing materialized views...')

  const { error: viewError } = await supabase.rpc('refresh_email_accounts_view')
  if (viewError) {
    console.error('❌ Error refreshing email_accounts_view:', viewError.message)
  } else {
    console.log('✅ email_accounts_view refreshed')
  }

  const { error: hiError } = await supabase.rpc('refresh_home_insurance_view')
  if (hiError) {
    console.error('❌ Error refreshing home_insurance_view:', hiError.message)
  } else {
    console.log('✅ home_insurance_view refreshed')
  }

  // Verify final count
  console.log('\n📊 Verifying final count...')
  const { count, error: countError } = await supabase
    .from('email_accounts_raw')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_name', 'Maverick In-house')
    .is('deleted_at', null)

  if (countError) {
    console.error('Error getting count:', countError.message)
  } else {
    console.log(`\n✅ COMPLETE: ${count} accounts now in database for Maverick In-house`)

    if (count === allAccounts.length) {
      console.log('🎉 All accounts synced successfully!')
    } else {
      console.log(`⚠️ Expected ${allAccounts.length}, got ${count} - some may have failed`)
    }
  }
}

// Helper functions
function extractProvider(tags: any[]): string | null {
  if (!tags || !Array.isArray(tags)) return null
  const providerTags = ['Gmail', 'Outlook', 'Microsoft', 'Google', 'Yahoo', 'iCloud', 'AOL']
  const found = tags.find(tag => providerTags.includes(tag.name))
  return found?.name || null
}

function extractReseller(tags: any[]): string | null {
  if (!tags || !Array.isArray(tags)) return null
  const resellerTags = ['CheapInboxes', 'Zapmail', 'ScaledMail', 'Mailr', 'Inbox', 'Reseller']
  const found = tags.find(tag => resellerTags.some(r => tag.name?.includes(r)))
  return found?.name || null
}

function calculatePrice(provider: string | null, reseller: string | null, domain: string | null, domainCounts: Map<string, number>): number {
  const providerLower = provider?.toLowerCase() || ''
  const resellerLower = reseller?.toLowerCase() || ''
  const mailboxesOnDomain = domain ? (domainCounts.get(domain) || 1) : 1

  if (resellerLower.includes('cheapinboxes')) return 3.00
  if (resellerLower === 'zapmail') return 3.00
  if (resellerLower === 'mailr') return 0.91
  if (resellerLower === 'scaledmail' && mailboxesOnDomain > 0) return 50 / mailboxesOnDomain
  if (providerLower === 'google' || providerLower === 'gmail') return 3.00

  return 0
}

syncMaverickInhouse().catch(console.error)
