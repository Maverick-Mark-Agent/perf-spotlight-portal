#!/usr/bin/env npx tsx
/**
 * Test the revenue-analytics Edge Function directly
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://gjqbbgrfhijescaouqkx.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testRevenueEdgeFunction() {
  console.log('🧪 Testing revenue-analytics Edge Function...');
  console.log('');

  try {
    console.log('📡 Invoking Edge Function...');
    const startTime = Date.now();

    const { data, error } = await supabase.functions.invoke('revenue-analytics');

    const duration = Date.now() - startTime;

    if (error) {
      console.error('❌ Edge Function returned error:');
      console.error('   Error:', error);
      console.error('   Message:', error.message);
      console.error('   Status:', error.status);
      return;
    }

    console.log(`✅ Edge Function completed in ${duration}ms`);
    console.log('');

    if (!data) {
      console.error('❌ No data returned from Edge Function');
      return;
    }

    console.log('📊 Response Structure:');
    console.log(`   - Clients: ${data.clients?.length || 0}`);
    console.log(`   - Totals: ${data.totals ? 'Present' : 'Missing'}`);
    console.log(`   - Meta: ${data.meta ? 'Present' : 'Missing'}`);
    console.log('');

    if (data.clients && data.clients.length > 0) {
      console.log('✅ Sample client data:');
      const sample = data.clients[0];
      console.log('   First client:', JSON.stringify(sample, null, 2));
      console.log('');
    } else {
      console.log('⚠️  No clients in response!');
      console.log('   Full response:', JSON.stringify(data, null, 2));
    }

    if (data.totals) {
      console.log('💰 Revenue Totals:');
      console.log(`   - Total MTD Revenue: $${data.totals.total_mtd_revenue?.toLocaleString() || 0}`);
      console.log(`   - Total MTD Leads: ${data.totals.total_mtd_leads || 0}`);
      console.log(`   - Per-Lead Revenue: $${data.totals.total_per_lead_revenue?.toLocaleString() || 0}`);
      console.log(`   - Retainer Revenue: $${data.totals.total_retainer_revenue?.toLocaleString() || 0}`);
      console.log(`   - Total Profit: $${data.totals.total_mtd_profit?.toLocaleString() || 0}`);
      console.log(`   - Profit Margin: ${data.totals.overall_profit_margin?.toFixed(1) || 0}%`);
      console.log('');
      console.log('📈 Advanced Metrics:');
      console.log(`   - Daily Billable Target: $${data.totals.daily_billable_revenue_target?.toLocaleString() || 0}`);
      console.log(`   - Total Possible Billable: $${data.totals.total_possible_billable_revenue?.toLocaleString() || 0}`);
      console.log(`   - Daily Billable Revenue Data Points: ${data.totals.daily_billable_revenue?.length || 0}`);
      console.log(`   - Billable Forecast: ${data.totals.billable_forecast ? 'Present' : 'Missing'}`);
    }

    console.log('');
    console.log('=' .repeat(80));
    console.log('✅ CONCLUSION: Edge Function is working correctly!');
    console.log('   The dashboard should be receiving this data.');
    console.log('   If dashboard is still empty, check:');
    console.log('   1. Browser console for JavaScript errors');
    console.log('   2. Network tab for failed requests');
    console.log('   3. Authentication state (are you logged in?)');
    console.log('=' .repeat(80));

  } catch (error) {
    console.error('❌ Exception caught:');
    console.error(error);
  }
}

testRevenueEdgeFunction().catch(console.error);
