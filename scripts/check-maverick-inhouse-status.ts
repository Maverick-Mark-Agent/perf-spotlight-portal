/**
 * Check Maverick In-house workspace status in database
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://gjqbbgrfhijescaouqkx.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzYxNzUzMCwiZXhwIjoyMDczMTkzNTMwfQ.71oGb_Jv5SWpF6XU1k8Ug77CqMVH_k1it35eYYAqg3Q'
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkMaverickInhouse() {
  console.log('🔍 Checking Maverick In-house Workspace Status')
  console.log('='.repeat(50) + '\n')

  // 1. Check client_registry
  console.log('📋 1. CLIENT_REGISTRY STATUS:')
  const { data: registry, error: regError } = await supabase
    .from('client_registry')
    .select('*')
    .ilike('workspace_name', '%maverick%')

  if (regError) {
    console.log('Error:', regError.message)
  } else if (!registry || registry.length === 0) {
    console.log('❌ No Maverick workspace found in client_registry!')
  } else {
    for (const ws of registry) {
      console.log(`\n  Workspace: "${ws.workspace_name}"`)
      console.log(`  Display Name: ${ws.display_name}`)
      console.log(`  Workspace ID: ${ws.bison_workspace_id}`)
      console.log(`  Is Active: ${ws.is_active}`)
      console.log(`  Bison Instance: ${ws.bison_instance}`)
      console.log(`  Has API Key: ${ws.bison_api_key ? 'Yes' : 'No (using super admin)'}`)
      console.log(`  Client Type: ${ws.client_type}`)
    }
  }

  // 2. Check email_accounts_raw count
  console.log('\n\n📊 2. EMAIL_ACCOUNTS_RAW COUNT:')
  const { count: rawCount, error: rawError } = await supabase
    .from('email_accounts_raw')
    .select('*', { count: 'exact', head: true })
    .ilike('workspace_name', '%maverick%')

  if (rawError) {
    console.log('Error:', rawError.message)
  } else {
    console.log(`  Maverick accounts in email_accounts_raw: ${rawCount}`)
  }

  // 3. Check email_accounts_view count
  console.log('\n📊 3. EMAIL_ACCOUNTS_VIEW COUNT:')
  const { count: viewCount, error: viewError } = await supabase
    .from('email_accounts_view')
    .select('*', { count: 'exact', head: true })
    .ilike('workspace_name', '%maverick%')

  if (viewError) {
    console.log('Error:', viewError.message)
  } else {
    console.log(`  Maverick accounts in email_accounts_view: ${viewCount}`)
  }

  // 4. Check recent sync jobs
  console.log('\n\n🔄 4. RECENT SYNC JOBS:')
  const { data: syncJobs, error: syncError } = await supabase
    .from('email_sync_jobs')
    .select('*')
    .ilike('workspace_name', '%maverick%')
    .order('created_at', { ascending: false })
    .limit(5)

  if (syncError) {
    console.log('Error:', syncError.message)
  } else if (!syncJobs || syncJobs.length === 0) {
    console.log('  No recent sync jobs found for Maverick workspace')
  } else {
    for (const job of syncJobs) {
      console.log(`\n  Job ID: ${job.id}`)
      console.log(`  Status: ${job.status}`)
      console.log(`  Accounts Synced: ${job.accounts_synced || 0}`)
      console.log(`  Created: ${job.created_at}`)
      console.log(`  Completed: ${job.completed_at || 'Still running'}`)
      if (job.error_message) {
        console.log(`  Error: ${job.error_message}`)
      }
    }
  }

  // 5. Sample of accounts in raw table
  console.log('\n\n📧 5. SAMPLE ACCOUNTS (first 5):')
  const { data: sampleAccounts } = await supabase
    .from('email_accounts_raw')
    .select('email, status, workspace_name')
    .ilike('workspace_name', '%maverick%')
    .limit(5)

  if (sampleAccounts && sampleAccounts.length > 0) {
    for (const acc of sampleAccounts) {
      console.log(`  ${acc.email} - ${acc.status} (${acc.workspace_name})`)
    }
  } else {
    console.log('  No accounts found')
  }

  console.log('\n\n' + '='.repeat(50))
  console.log('Done!')
}

checkMaverickInhouse().catch(console.error)
