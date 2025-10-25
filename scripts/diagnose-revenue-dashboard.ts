#!/usr/bin/env npx tsx
/**
 * Diagnostic script to check why Revenue Dashboard has no data
 * Checks all data dependencies in order
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://gjqbbgrfhijescaouqkx.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function diagnoseRevenueDashboard() {
  console.log('🔍 REVENUE DASHBOARD DIAGNOSTIC CHECK');
  console.log('=' .repeat(80));
  console.log('');

  const today = new Date().toISOString().split('T')[0];
  const currentMonthYear = new Date().toISOString().slice(0, 7);

  // Step 1: Check client_registry (pricing data)
  console.log('1️⃣ Checking client_registry table (pricing & configuration)...');
  const { data: registryData, error: registryError } = await supabase
    .from('client_registry')
    .select('workspace_name, display_name, is_active, billing_type, price_per_lead, retainer_amount, monthly_kpi_target')
    .eq('is_active', true);

  if (registryError) {
    console.error('   ❌ ERROR:', registryError.message);
    return;
  }

  console.log(`   ✅ Found ${registryData?.length || 0} active clients in registry`);
  if (registryData && registryData.length > 0) {
    console.log('   📋 Sample clients:');
    registryData.slice(0, 3).forEach(client => {
      console.log(`      - ${client.display_name || client.workspace_name} (${client.billing_type}): $${client.price_per_lead || client.retainer_amount}`);
    });
  } else {
    console.log('   ⚠️  No active clients found in client_registry!');
    console.log('   💡 This could be the problem - dashboard needs active clients.');
  }
  console.log('');

  // Step 2: Check client_metrics (MTD lead data)
  console.log('2️⃣ Checking client_metrics table (MTD lead counts)...');
  console.log(`   📅 Looking for records with metric_date = '${today}' and metric_type = 'mtd'`);

  const { data: metricsData, error: metricsError } = await supabase
    .from('client_metrics')
    .select('workspace_name, positive_replies_mtd, metric_date, metric_type')
    .eq('metric_date', today)
    .eq('metric_type', 'mtd');

  if (metricsError) {
    console.error('   ❌ ERROR:', metricsError.message);
    return;
  }

  console.log(`   ${metricsData && metricsData.length > 0 ? '✅' : '❌'} Found ${metricsData?.length || 0} MTD metric records for today`);

  if (!metricsData || metricsData.length === 0) {
    console.log('   🚨 CRITICAL ISSUE: No MTD metrics found for today!');
    console.log('   💡 The Edge Function queries this table and will return empty if no data exists.');
    console.log('');
    console.log('   🔍 Let me check if there are ANY records in client_metrics...');

    const { data: anyMetrics, error: anyError } = await supabase
      .from('client_metrics')
      .select('workspace_name, metric_date, metric_type, positive_replies_mtd')
      .order('metric_date', { ascending: false })
      .limit(5);

    if (anyError) {
      console.error('   ❌ ERROR:', anyError.message);
    } else if (anyMetrics && anyMetrics.length > 0) {
      console.log(`   ✅ Found ${anyMetrics.length} recent metric records:`);
      anyMetrics.forEach(m => {
        console.log(`      - ${m.workspace_name}: ${m.positive_replies_mtd} leads (${m.metric_type}, ${m.metric_date})`);
      });
      console.log('');
      console.log('   💡 Solution: You need to run the daily sync job or trigger a manual refresh');
      console.log('      to populate today\'s MTD metrics.');
    } else {
      console.log('   ❌ Table is completely empty!');
      console.log('   💡 The daily sync cron job may not be running.');
    }
  } else {
    console.log('   📋 Sample metrics:');
    metricsData.slice(0, 3).forEach(metric => {
      console.log(`      - ${metric.workspace_name}: ${metric.positive_replies_mtd} leads`);
    });
  }
  console.log('');

  // Step 3: Check client_leads (for time-series data)
  console.log('3️⃣ Checking client_leads table (daily billable revenue data)...');
  const { data: leadsData, error: leadsError } = await supabase
    .from('client_leads')
    .select('workspace_name, date_received')
    .gte('date_received', `${currentMonthYear}-01`)
    .lte('date_received', `${currentMonthYear}-31`)
    .limit(10);

  if (leadsError) {
    console.error('   ❌ ERROR:', leadsError.message);
  } else {
    console.log(`   ${leadsData && leadsData.length > 0 ? '✅' : '⚠️'} Found ${leadsData?.length || 0} lead records for current month`);
    if (!leadsData || leadsData.length === 0) {
      console.log('   💡 No leads this month - time-series charts will be empty.');
    }
  }
  console.log('');

  // Step 4: Check sender_emails_cache (for cost calculation)
  console.log('4️⃣ Checking sender_emails_cache table (infrastructure costs)...');
  const { data: emailAccounts, error: emailError } = await supabase
    .from('sender_emails_cache')
    .select('workspace_name, status, price')
    .eq('status', 'Connected')
    .limit(10);

  if (emailError) {
    console.error('   ❌ ERROR:', emailError.message);
  } else {
    console.log(`   ✅ Found ${emailAccounts?.length || 0} connected email accounts`);
    if (emailAccounts && emailAccounts.length > 0) {
      const totalCost = emailAccounts.reduce((sum, acc) => sum + (parseFloat(acc.price) || 0), 0);
      console.log(`   💰 Total infrastructure cost: $${totalCost.toFixed(2)}`);
    }
  }
  console.log('');

  // Step 5: Summary
  console.log('=' .repeat(80));
  console.log('📊 DIAGNOSIS SUMMARY');
  console.log('=' .repeat(80));

  const hasClients = registryData && registryData.length > 0;
  const hasMetrics = metricsData && metricsData.length > 0;
  const hasLeads = leadsData && leadsData.length > 0;

  if (!hasClients) {
    console.log('❌ No active clients in client_registry');
    console.log('   → Add active clients to the registry first');
  }

  if (!hasMetrics) {
    console.log('❌ No MTD metrics for today in client_metrics');
    console.log('   → This is the PRIMARY ISSUE causing empty dashboard');
    console.log('   → Run the daily sync cron job: sync-daily-kpi-metrics');
    console.log('   → Or trigger webhook updates to populate metrics');
  }

  if (!hasLeads) {
    console.log('⚠️  No leads this month in client_leads');
    console.log('   → Time-series charts will be empty but dashboard should still show totals');
  }

  if (hasClients && hasMetrics && hasLeads) {
    console.log('✅ All data sources look healthy!');
    console.log('   → Dashboard should be showing data');
    console.log('   → If still empty, check browser console for errors');
  }

  console.log('');
  console.log('🔧 NEXT STEPS:');
  console.log('');
  if (!hasMetrics) {
    console.log('1. Check if daily sync cron job is scheduled:');
    console.log('   SELECT * FROM cron.job WHERE jobname = \'sync-daily-kpi-metrics\';');
    console.log('');
    console.log('2. Manually trigger the sync function:');
    console.log('   SELECT sync_daily_kpi_metrics();');
    console.log('');
    console.log('3. Or insert test data:');
    console.log(`   INSERT INTO client_metrics (workspace_name, metric_date, metric_type, positive_replies_mtd)`);
    console.log(`   VALUES ('Test Client', '${today}', 'mtd', 10);`);
  }
  console.log('');
}

diagnoseRevenueDashboard().catch(console.error);
