const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0';

const supabase = createClient(supabaseUrl, anonKey);

async function checkAllAccounts() {
  // Get all email addresses from CSV
  const csvContent = fs.readFileSync('./email_accounts_with_tags.csv', 'utf8');
  const lines = csvContent.split('\n').slice(1);

  const csvEmails = [];
  lines.forEach(line => {
    if (!line.trim()) return;
    const match = line.match(/"([^"]+)","([^"]+)","([^"]+)"/);
    if (match) {
      const [, email, provider, reseller] = match;
      if (reseller === 'Zapmail') {
        csvEmails.push(email);
      }
    }
  });

  console.log(`📋 Found ${csvEmails.length} Zapmail accounts in CSV\n`);

  // Now check each account in the database
  console.log('🔍 Checking each account in Supabase database...\n');

  const results = [];

  for (const email of csvEmails) {
    const { data, error } = await supabase
      .from('sender_emails_cache')
      .select('email_address, emails_sent_count, total_replied_count, reply_rate_percentage, workspace_name, status, reseller, tags')
      .eq('email_address', email)
      .single();

    if (error) {
      // Account not found or error
      results.push({
        email,
        found: false,
        sent: 0,
        replied: 0,
        replyRate: 0,
        workspace: 'Not in DB',
        status: 'NOT FOUND',
        reseller: 'N/A',
        tags: []
      });
    } else {
      results.push({
        email: data.email_address,
        found: true,
        sent: data.emails_sent_count || 0,
        replied: data.total_replied_count || 0,
        replyRate: data.reply_rate_percentage || 0,
        workspace: data.workspace_name || 'Unknown',
        status: data.status || 'Unknown',
        reseller: data.reseller || 'Unknown',
        tags: data.tags || []
      });
    }
  }

  // Analysis
  const foundInDB = results.filter(r => r.found);
  const notFoundInDB = results.filter(r => !r.found);
  const withActivity = results.filter(r => r.sent > 0);
  const neverUsed = results.filter(r => r.found && r.sent === 0);
  const burnt = results.filter(r => r.sent >= 50 && r.replyRate < 0.4);
  const healthy = results.filter(r => r.sent >= 50 && r.replyRate >= 0.4);

  console.log('=' .repeat(70));
  console.log('📊 COMPREHENSIVE ANALYSIS');
  console.log('='.repeat(70));
  console.log(`\nTotal Zapmail accounts in CSV: ${csvEmails.length}`);
  console.log(`  ✅ Found in database: ${foundInDB.length}`);
  console.log(`  ❌ Not found in database: ${notFoundInDB.length}`);
  console.log(`\nActivity breakdown:`);
  console.log(`  📧 Accounts with send activity (>0 sent): ${withActivity.length}`);
  console.log(`  ⚠️  Accounts never used (0 sent): ${neverUsed.length}`);
  console.log(`\nHealth breakdown (50+ emails sent):`);
  console.log(`  🔥 BURNT (<0.4% reply rate): ${burnt.length}`);
  console.log(`  ✅ HEALTHY (>=0.4% reply rate): ${healthy.length}`);

  // Show top 10 accounts with most activity
  console.log(`\n📈 Top 10 accounts by email volume:`);
  const topAccounts = results
    .filter(r => r.sent > 0)
    .sort((a, b) => b.sent - a.sent)
    .slice(0, 10);

  topAccounts.forEach((acc, i) => {
    const status = acc.sent >= 50 && acc.replyRate < 0.4 ? '🔥 BURNT' :
                   acc.sent >= 50 && acc.replyRate >= 0.4 ? '✅ HEALTHY' :
                   '⚠️  LOW VOLUME';
    console.log(`  ${i + 1}. ${acc.email}`);
    console.log(`     ${acc.sent} sent, ${acc.replied} replied (${acc.replyRate.toFixed(2)}%) - ${status}`);
    console.log(`     Workspace: ${acc.workspace}`);
  });

  // Generate detailed CSV
  const csv = [
    'Email,Found in DB,Workspace,Emails Sent,Replies,Reply Rate %,Status,Reseller,Tags'
  ];

  results.forEach(r => {
    csv.push([
      r.email,
      r.found ? 'YES' : 'NO',
      r.workspace,
      r.sent,
      r.replied,
      r.replyRate.toFixed(2),
      r.status,
      r.reseller,
      Array.isArray(r.tags) ? r.tags.join(';') : ''
    ].join(','));
  });

  fs.writeFileSync('zapmail-accounts-detailed-check.csv', csv.join('\n'));
  console.log(`\n✅ Generated: zapmail-accounts-detailed-check.csv\n`);
}

checkAllAccounts().catch(console.error);
