const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const supabaseUrl = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0';

const supabase = createClient(supabaseUrl, anonKey);

async function forceSyncNow() {
  console.log('🚀 FORCING EMAIL SYNC NOW...\n');
  console.log('════════════════════════════════════════════════════════════\n');

  // Instead of calling Edge Function, let's directly fetch from Email Bison API
  // and update the database ourselves

  const BISON_API_KEY = '101|6mXfEtJkLDF99HcmvOqlJcjlYaDyt9pGt9c6C7qJ56e6298b';

  console.log('Step 1: Fetching workspaces from Email Bison API...\n');

  try {
    // First get all workspaces
    const workspacesResponse = await axios.get('https://send.maverickmarketingllc.com/api/workspaces/v1.1', {
      headers: {
        'Authorization': `Bearer ${BISON_API_KEY}`,
        'Accept': 'application/json'
      }
    });

    const workspaces = workspacesResponse.data.data || [];
    console.log(`✅ Fetched ${workspaces.length} workspaces\n`);

    console.log('Step 2: Fetching sender emails from each workspace...');
    console.log('   This may take 2-3 minutes for all workspaces...\n');

    let accounts = [];

    // Fetch sender emails from each workspace
    for (const workspace of workspaces) {
      console.log(`   Processing: ${workspace.name}...`);

      try {
        // Switch to workspace
        await axios.post('https://send.maverickmarketingllc.com/api/workspaces/v1.1/switch-workspace',
          { workspace_id: workspace.id },
          {
            headers: {
              'Authorization': `Bearer ${BISON_API_KEY}`,
              'Content-Type': 'application/json'
            }
          }
        );

        // Fetch sender emails for this workspace
        const emailsResponse = await axios.get('https://send.maverickmarketingllc.com/api/sender-emails/v1.1?per_page=1000', {
          headers: {
            'Authorization': `Bearer ${BISON_API_KEY}`,
            'Accept': 'application/json'
          }
        });

        const workspaceEmails = emailsResponse.data.data || [];
        workspaceEmails.forEach(email => {
          email.workspace_name = workspace.name;
        });
        accounts = accounts.concat(workspaceEmails);
        console.log(`      ✓ ${workspaceEmails.length} accounts (total: ${accounts.length})`);
      } catch (workspaceError) {
        console.error(`      ✗ Failed to fetch ${workspace.name}: ${workspaceError.message}`);
      }
    }

    console.log(`\n✅ Fetched ${accounts.length} total email accounts\n`);

    console.log('Step 3: Updating database with fresh data...');
    console.log('   This will take 2-3 minutes to process all accounts...\n');

    // Process in batches of 100
    const batchSize = 100;
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < accounts.length; i += batchSize) {
      const batch = accounts.slice(i, i + batchSize);
      const now = new Date().toISOString();

      // Prepare batch upsert data
      const upsertData = batch.map(account => ({
        email_address: account.email_address,
        workspace_name: account.workspace?.name || 'Unknown',
        emails_sent_count: parseInt(account.emails_sent_count) || 0,
        total_replied_count: parseInt(account.total_replied_count) || 0,
        total_connected_count: parseInt(account.total_connected_count) || 0,
        total_interested_count: parseInt(account.total_interested_count) || 0,
        total_not_interested_count: parseInt(account.total_not_interested_count) || 0,
        total_do_not_contact_count: parseInt(account.total_do_not_contact_count) || 0,
        total_unsubscribed_count: parseInt(account.total_unsubscribed_count) || 0,
        total_email_bounced_count: parseInt(account.total_email_bounced_count) || 0,
        total_wrong_person_count: parseInt(account.total_wrong_person_count) || 0,
        disconnected_count: parseInt(account.disconnected_count) || 0,
        is_disconnected: account.is_disconnected === 1,
        last_synced_at: now
      }));

      const { error } = await supabase
        .from('sender_emails_cache')
        .upsert(upsertData, {
          onConflict: 'email_address',
          ignoreDuplicates: false
        });

      if (error) {
        console.error(`   ❌ Batch ${Math.floor(i/batchSize) + 1} error:`, error.message);
        errorCount += batch.length;
      } else {
        successCount += batch.length;
        const progress = Math.round((i + batch.length) / accounts.length * 100);
        console.log(`   ✅ Progress: ${progress}% (${successCount}/${accounts.length} accounts)`);
      }
    }

    console.log('\n════════════════════════════════════════════════════════════');
    console.log(`✅ SYNC COMPLETE!`);
    console.log('════════════════════════════════════════════════════════════\n');
    console.log(`   Successfully updated: ${successCount} accounts`);
    console.log(`   Errors: ${errorCount} accounts\n`);

    console.log('Step 3: Refreshing materialized view...\n');

    const { error: refreshError } = await supabase.rpc('refresh_email_accounts_view');

    if (refreshError) {
      console.log('   ⚠️  Could not refresh materialized view (may need service role)');
      console.log('   But the cache data is fresh!\n');
    } else {
      console.log('   ✅ Materialized view refreshed!\n');
    }

    console.log('════════════════════════════════════════════════════════════');
    console.log('🎉 ALL DONE!');
    console.log('════════════════════════════════════════════════════════════\n');
    console.log('📋 NEXT STEPS:\n');
    console.log('1. Go to: https://www.maverickmarketingllc.com/email-accounts');
    console.log('2. Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)');
    console.log('3. Check "Last synced" shows recent time');
    console.log('4. Look for burnt mailbox alert\n');
    console.log('════════════════════════════════════════════════════════════\n');

  } catch (err) {
    console.error('\n❌ ERROR:', err.message);
    console.error('Stack:', err.stack);
  }
}

forceSyncNow();
