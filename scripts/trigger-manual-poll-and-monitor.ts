import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://gjqbbgrfhijescaouqkx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function triggerAndMonitor() {
  console.log('🚀 Triggering manual email sync job...\n');

  // Get before counts
  console.log('📊 Checking current database state...');
  const { count: beforeCount } = await supabase
    .from('sender_emails_cache')
    .select('*', { count: 'exact', head: true });

  console.log(`   Current accounts in database: ${beforeCount}\n`);

  // Trigger the polling job
  console.log('🔄 Triggering poll-sender-emails Edge Function...');
  const startTime = Date.now();

  try {
    const { data, error } = await supabase.functions.invoke('poll-sender-emails', {
      body: {}
    });

    const duration = Date.now() - startTime;

    if (error) {
      console.error(`\n❌ Edge Function returned error:`, error);
      return;
    }

    console.log(`\n✅ Edge Function completed in ${duration}ms`);
    console.log(`\n📊 Response:`);
    console.log(JSON.stringify(data, null, 2));

    // Wait a bit for database writes to complete
    console.log(`\n⏳ Waiting 3 seconds for database writes...`);
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check after counts
    console.log(`\n📊 Checking updated database state...`);
    const { count: afterCount } = await supabase
      .from('sender_emails_cache')
      .select('*', { count: 'exact', head: true });

    console.log(`   Accounts after sync: ${afterCount}`);
    console.log(`   New accounts added: ${afterCount! - beforeCount!}`);

    // Check specific missing workspaces
    console.log(`\n📊 Checking specific workspaces...`);
    const missingWorkspaces = [
      'Kim Wallace',
      'Jeff Schroder',
      'Kirk Hodgson',
      'John Roberts',
      'Rob Russell',
      'Nick Sakha',
      'SMA Insurance',
      'StreetSmart Commercial',
      'StreetSmart P&C',
      'StreetSmart Trucking',
      'Tony Schmitz',
      'Maverick In-house'
    ];

    for (const workspace of missingWorkspaces) {
      const { count } = await supabase
        .from('sender_emails_cache')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_name', workspace);

      const status = count && count > 0 ? '✅' : '❌';
      console.log(`   ${status} ${workspace}: ${count || 0} accounts`);
    }

    // Summary
    console.log(`\n${'='.repeat(80)}`);
    console.log('📊 SYNC SUMMARY');
    console.log('='.repeat(80));
    console.log(`Before: ${beforeCount} accounts`);
    console.log(`After: ${afterCount} accounts`);
    console.log(`Added: ${afterCount! - beforeCount!} accounts`);

    if (data) {
      console.log(`\nFrom Edge Function:`);
      console.log(`  Workspaces processed: ${data.workspaces_processed}/${data.total_workspaces}`);
      console.log(`  Accounts synced: ${data.total_accounts_synced}`);
      console.log(`  Duration: ${data.duration_ms}ms`);

      if (data.warning) {
        console.log(`  ⚠️  Warning: ${data.warning}`);
      }

      if (data.results) {
        console.log(`\n📋 Per-Workspace Results:`);
        data.results.forEach((result: any) => {
          const status = result.success ? '✅' : '❌';
          console.log(`  ${status} ${result.workspace}: ${result.accounts_synced} accounts (${result.duration_ms}ms)`);
          if (result.error) {
            console.log(`      Error: ${result.error}`);
          }
        });
      }
    }

  } catch (error) {
    console.error('\n❌ Error triggering function:', error);
  }
}

triggerAndMonitor().catch(console.error);
