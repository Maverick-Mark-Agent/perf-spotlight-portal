#!/usr/bin/env node

/**
 * Investigate Castle Agency November 2025 data
 * User says there were no campaigns in November, but data shows 38,715 emails
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0';

async function main() {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    console.log('🔍 Investigating Castle Agency November 2025 data discrepancy\n');
    console.log('User states: NO campaigns ran in November 2025');
    console.log('Database shows: 38,715 emails sent in November 2025\n');
    console.log('='.repeat(80));

    // Check if there are other workspaces with the same November data
    console.log('\n📊 Checking if other workspaces have IDENTICAL November data...\n');

    const { data: novMetrics, error: novError } = await supabase
      .from('client_metrics')
      .select('workspace_name, metric_date, emails_sent_mtd, positive_replies_mtd')
      .gte('metric_date', '2025-11-01')
      .lte('metric_date', '2025-11-30')
      .eq('metric_type', 'mtd')
      .order('metric_date', { ascending: false });

    if (novError) throw novError;

    // Group by workspace and find latest for each
    const workspaceNovData = new Map();
    novMetrics.forEach(m => {
      if (!workspaceNovData.has(m.workspace_name) ||
          workspaceNovData.get(m.workspace_name).metric_date < m.metric_date) {
        workspaceNovData.set(m.workspace_name, m);
      }
    });

    // Find workspaces with 38,715 emails in November
    const matching38715 = Array.from(workspaceNovData.values())
      .filter(m => m.emails_sent_mtd === 38715);

    console.log(`Workspaces with EXACTLY 38,715 emails in November 2025:`);
    console.log('-'.repeat(80));
    matching38715.forEach(m => {
      console.log(`  ${m.workspace_name.padEnd(30)} | Date: ${m.metric_date} | Emails: ${m.emails_sent_mtd} | Replies: ${m.positive_replies_mtd}`);
    });

    if (matching38715.length > 1) {
      console.log('\n⚠️  DUPLICATE DATA DETECTED!');
      console.log(`Multiple workspaces have identical November data (38,715 emails).`);
      console.log(`This suggests data may have been incorrectly copied or associated.\n`);
    }

    // Check Castle Agency's actual email accounts
    console.log('\n' + '='.repeat(80));
    console.log('📧 Checking Castle Agency email accounts in sender_emails_cache...\n');

    const { data: accounts, error: accountsError } = await supabase
      .from('sender_emails_cache')
      .select('email_address, workspace_name, emails_sent_count, total_replied_count, last_synced_at')
      .eq('workspace_name', 'Castle Agency')
      .order('emails_sent_count', { ascending: false });

    if (accountsError) throw accountsError;

    console.log(`Found ${accounts.length} email accounts for Castle Agency:\n`);

    if (accounts.length > 0) {
      console.log('Top 10 accounts by volume:');
      console.log('-'.repeat(80));
      accounts.slice(0, 10).forEach(acc => {
        console.log(`  ${acc.email_address.padEnd(40)} | Sent: ${(acc.emails_sent_count || 0).toString().padStart(6)} | Last synced: ${acc.last_synced_at}`);
      });

      const totalFromAccounts = accounts.reduce((sum, acc) => sum + (acc.emails_sent_count || 0), 0);
      console.log('-'.repeat(80));
      console.log(`Total emails from all accounts: ${totalFromAccounts.toLocaleString()}`);
      console.log(`\nNovember MTD shows: 38,715 emails`);
      console.log(`Account totals show: ${totalFromAccounts.toLocaleString()} emails (all-time)`);
    } else {
      console.log('⚠️  No email accounts found for Castle Agency!');
    }

    // Show ALL Castle Agency November records (not just latest)
    console.log('\n' + '='.repeat(80));
    console.log('📅 ALL Castle Agency records for November 2025:\n');

    const castleNov = novMetrics.filter(m => m.workspace_name === 'Castle Agency');
    console.log('-'.repeat(80));
    castleNov.forEach(m => {
      console.log(`  ${m.metric_date} | Emails: ${m.emails_sent_mtd} | Replies: ${m.positive_replies_mtd}`);
    });

    // Check what other months Castle Agency has data for
    console.log('\n' + '='.repeat(80));
    console.log('📊 Castle Agency activity across ALL months:\n');

    const { data: allCastle, error: allCastleError } = await supabase
      .from('client_metrics')
      .select('metric_date, emails_sent_mtd, positive_replies_mtd')
      .eq('workspace_name', 'Castle Agency')
      .eq('metric_type', 'mtd')
      .order('metric_date', { ascending: true });

    if (allCastleError) throw allCastleError;

    const monthMap = new Map();
    allCastle.forEach(m => {
      const month = m.metric_date.substring(0, 7);
      if (!monthMap.has(month) || monthMap.get(month).metric_date < m.metric_date) {
        monthMap.set(month, m);
      }
    });

    console.log('Latest MTD per month (ALL TIME):');
    console.log('-'.repeat(80));
    Array.from(monthMap.entries()).sort().forEach(([month, m]) => {
      const highlight = month === '2025-11' ? ' ⚠️  DISPUTED' : '';
      console.log(`  ${month} (${m.metric_date}): ${m.emails_sent_mtd} emails, ${m.positive_replies_mtd} replies${highlight}`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('🎯 CONCLUSION:\n');
    console.log('If Castle Agency truly had NO campaigns in November 2025,');
    console.log('then the 38,715 email count is incorrect data in the database.');
    console.log('\nPossible causes:');
    console.log('  1. Data was copied from another workspace');
    console.log('  2. Incorrect workspace association during data sync');
    console.log('  3. Historical data that should have been deleted\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
