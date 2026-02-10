/**
 * Monitor Sync Job Progress
 * Tracks a sync job and verifies Jason Binyon is included
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;
const JOB_ID = process.argv[2] || '820e5448-de37-49c2-bbed-e8d5a002de07';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
  console.log(`📊 Monitoring sync job: ${JOB_ID}\n`);

  let attempts = 0;
  const maxAttempts = 60; // 5 minutes max

  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds

    const { data: job } = await supabase
      .from('polling_job_status')
      .select('*')
      .eq('id', JOB_ID)
      .single();

    if (job) {
      const progress = job.workspaces_processed || 0;
      const total = job.total_workspaces || 0;
      const percentage = total > 0 ? ((progress / total) * 100).toFixed(0) : '0';

      process.stdout.write(`\r   Progress: ${progress}/${total} workspaces (${percentage}%)    `);

      if (job.status === 'completed') {
        console.log('\n\n✅ Sync completed!');
        console.log(`   Workspaces processed: ${job.workspaces_processed}`);
        console.log(`   Total accounts synced: ${job.total_accounts_synced || 'N/A'}`);
        console.log(`   Duration: ${((job.duration_ms || 0) / 1000).toFixed(1)}s`);

        // Check if Jason Binyon was synced
        console.log('\n🔍 Checking Jason Binyon sync status...');

        const { data: jasonAccount } = await supabase
          .from('email_accounts_raw')
          .select('email_address, emails_sent_count, last_synced_at')
          .eq('workspace_name', 'Jason Binyon')
          .eq('email_address', 'jason@binyoninsuranceagency.com')
          .single();

        if (jasonAccount) {
          const syncTime = new Date(jasonAccount.last_synced_at);
          const now = new Date();
          const minutesAgo = (now.getTime() - syncTime.getTime()) / (1000 * 60);

          console.log(`   Email: ${jasonAccount.email_address}`);
          console.log(`   Emails sent: ${jasonAccount.emails_sent_count}`);
          console.log(`   Last synced: ${jasonAccount.last_synced_at}`);
          console.log(`   Time ago: ${minutesAgo.toFixed(1)} minutes`);

          if (minutesAgo < 5) {
            console.log('\n✅ SUCCESS! Jason Binyon was synced in this job!');
          } else {
            console.log('\n⚠️  Jason Binyon was NOT synced (still showing old data)');
          }
        }

        // Check expected account count
        const expectedAccounts = 4406 + 433; // Previous sync + Jason Binyon
        if (job.total_accounts_synced && job.total_accounts_synced >= expectedAccounts - 100) {
          console.log(`\n✅ Account count looks good! (${job.total_accounts_synced} synced, expected ~${expectedAccounts})`);
        } else {
          console.log(`\n⚠️  Account count lower than expected (${job.total_accounts_synced} synced, expected ~${expectedAccounts})`);
        }

        break;
      }

      if (job.status === 'failed') {
        console.log('\n\n❌ Sync failed!');
        console.log(`   Error: ${job.error_message}`);
        break;
      }
    }

    attempts++;
  }

  if (attempts >= maxAttempts) {
    console.log('\n\n⚠️  Sync is taking longer than expected.');
  }
}

main().catch(console.error);
