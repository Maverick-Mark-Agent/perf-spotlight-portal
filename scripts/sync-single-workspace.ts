/**
 * Sync Single Workspace
 *
 * Manually syncs a specific workspace by calling Email Bison API directly
 * Bypasses the poll-sender-emails function to avoid batch processing issues
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;
const WORKSPACE_NAME = process.argv[2] || 'Jason Binyon';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const MAVERICK_BASE_URL = 'https://send.maverickmarketingllc.com/api';
const LONGRUN_BASE_URL = 'https://send.longrun.agency/api';

async function main() {
  console.log(`🔄 Syncing workspace: ${WORKSPACE_NAME}\n`);

  // Fetch workspace config
  const { data: workspace, error: wsError } = await supabase
    .from('client_registry')
    .select('*')
    .eq('workspace_name', WORKSPACE_NAME)
    .single();

  if (wsError || !workspace) {
    console.error(`❌ Workspace "${WORKSPACE_NAME}" not found in client_registry`);
    console.log('\n Available workspaces:');
    const { data: allWs } = await supabase
      .from('client_registry')
      .select('workspace_name')
      .eq('is_active', true)
      .order('workspace_name');
    allWs?.forEach(w => console.log(`   - ${w.workspace_name}`));
    return;
  }

  console.log(`✅ Found workspace: ${workspace.workspace_name}`);
  console.log(`   Workspace ID: ${workspace.bison_workspace_id}`);
  console.log(`   Instance: ${workspace.bison_instance}`);
  console.log(`   Has API key: ${!!workspace.bison_api_key}\n`);

  if (!workspace.bison_api_key) {
    console.error('❌ No API key configured for this workspace');
    return;
  }

  const baseUrl = workspace.bison_instance === 'Long Run' ? LONGRUN_BASE_URL : MAVERICK_BASE_URL;
  const apiKey = workspace.bison_api_key;

  console.log('📡 Fetching sender emails from Email Bison...\n');

  let allAccounts: any[] = [];
  let nextUrl = `${baseUrl}/sender-emails?per_page=1000`;
  let pageCount = 0;

  // Fetch all pages
  while (nextUrl) {
    pageCount++;
    process.stdout.write(`\r   Page ${pageCount}: Fetching...`);

    const response = await fetch(nextUrl, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`\n\n❌ API Error ${response.status}: ${errorText}`);
      return;
    }

    const data = await response.json();
    const accounts = data.data || [];

    if (accounts.length === 0) {
      process.stdout.write(` No accounts, stopping.\n`);
      break;
    }

    allAccounts.push(...accounts);
    process.stdout.write(` Got ${accounts.length} accounts (total: ${allAccounts.length})\n`);

    // Check for next page
    nextUrl = data.links?.next || null;

    if (!nextUrl && data.meta?.current_page < data.meta?.last_page) {
      nextUrl = `${baseUrl}/sender-emails?per_page=1000&page=${data.meta.current_page + 1}`;
    }
  }

  console.log(`\n✅ Fetched ${allAccounts.length} total accounts\n`);

  if (allAccounts.length === 0) {
    console.log('⚠️  No accounts to sync');
    return;
  }

  // Transform and upsert accounts
  console.log('💾 Upserting accounts to database...\n');

  const accountRecords = allAccounts.map(account => {
    const provider = account.tags?.find((t: any) =>
      ['Google', 'Outlook', 'Gmail', 'Microsoft'].some(p => t.name?.includes(p))
    )?.name || null;

    const reseller = account.tags?.find((t: any) =>
      ['Mailr', 'CheapInboxes', 'Zapmail', 'ScaledMail'].some(r => t.name?.includes(r))
    )?.name || null;

    const domain = account.email?.split('@')[1] || null;
    const replyRate = account.emails_sent_count > 0
      ? Math.round((account.unique_replied_count / account.emails_sent_count) * 100 * 100) / 100
      : 0;

    return {
      bison_account_id: account.id,
      email_address: account.email,
      workspace_name: workspace.workspace_name,
      workspace_id: workspace.bison_workspace_id,
      bison_instance: workspace.bison_instance === 'Long Run' ? 'longrun' : 'maverick',
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
      price: 0, // Will be calculated by pricing logic later
      price_source: 'calculated',
      pricing_needs_review: false,
      last_synced_at: new Date().toISOString(),
    };
  });

  // Upsert in batches of 100
  const batchSize = 100;
  let upserted = 0;

  for (let i = 0; i < accountRecords.length; i += batchSize) {
    const batch = accountRecords.slice(i, i + batchSize);

    const { error: upsertError } = await supabase
      .from('email_accounts_raw')
      .upsert(batch, {
        onConflict: 'bison_account_id,bison_instance',
        ignoreDuplicates: false,
      });

    if (upsertError) {
      console.error(`❌ Error upserting batch ${Math.floor(i / batchSize) + 1}:`, upsertError);
      continue;
    }

    upserted += batch.length;
    process.stdout.write(`\r   Upserted: ${upserted}/${accountRecords.length} accounts`);
  }

  console.log('\n\n✅ Database updated successfully!');

  // Refresh materialized view
  console.log('\n🔄 Refreshing materialized view...');
  const { error: viewError } = await supabase.rpc('refresh_email_accounts_view');

  if (viewError) {
    console.error('❌ Failed to refresh view:', viewError);
  } else {
    console.log('✅ Materialized view refreshed!');
  }

  // Verify the sync
  console.log('\n🔍 Verifying sync...');
  const { data: verifyAccounts, count } = await supabase
    .from('email_accounts_view')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_name', WORKSPACE_NAME);

  console.log(`   ${count} accounts now in view for ${WORKSPACE_NAME}`);

  // Check specific test account if Jason Binyon
  if (WORKSPACE_NAME === 'Jason Binyon') {
    const { data: jasonAccount } = await supabase
      .from('email_accounts_view')
      .select('email_address, emails_sent_count, total_replied_count, last_synced_at')
      .eq('email_address', 'jason@binyoninsuranceagency.com')
      .single();

    if (jasonAccount) {
      console.log('\n   Test account: jason@binyoninsuranceagency.com');
      console.log(`   Emails sent: ${jasonAccount.emails_sent_count}`);
      console.log(`   Replies: ${jasonAccount.total_replied_count}`);
      console.log(`   Last synced: ${jasonAccount.last_synced_at}`);
    }
  }

  console.log('\n✅ Sync complete!\n');
}

main().catch(console.error);
