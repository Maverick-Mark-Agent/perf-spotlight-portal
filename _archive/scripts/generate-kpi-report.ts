#!/usr/bin/env tsx

/**
 * Generate KPI Report - Month-to-Date Totals
 *
 * This script generates a comprehensive report showing:
 * - Total interested leads per client
 * - October 2025 MTD leads
 * - All-time totals
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

interface ClientStats {
  workspace_name: string;
  total_leads: number;
  october_mtd: number;
  date_range: string;
}

async function main() {
  console.log('📊 KPI DASHBOARD - MONTH-TO-DATE REPORT');
  console.log('=' .repeat(80));
  console.log('\nGenerated:', new Date().toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    dateStyle: 'full',
    timeStyle: 'short'
  }));
  console.log('\n');

  // Get all active workspaces
  const { data: workspaces, error: wsError } = await supabase
    .from('client_registry')
    .select('workspace_name')
    .eq('is_active', true)
    .order('workspace_name');

  if (wsError || !workspaces) {
    console.error('❌ Failed to fetch workspaces:', wsError);
    process.exit(1);
  }

  const stats: ClientStats[] = [];

  // For each workspace, get total and October MTD counts
  for (const ws of workspaces) {
    const { workspace_name } = ws;

    // Get total interested leads
    const { count: totalCount } = await supabase
      .from('client_leads')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_name', workspace_name)
      .eq('interested', true);

    // Get October 2025 MTD leads (Oct 1 - today)
    const { count: octoberCount } = await supabase
      .from('client_leads')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_name', workspace_name)
      .eq('interested', true)
      .gte('date_received', '2025-10-01')
      .lt('date_received', '2025-11-01');

    // Get date range for October leads
    const { data: octoberLeads } = await supabase
      .from('client_leads')
      .select('date_received')
      .eq('workspace_name', workspace_name)
      .eq('interested', true)
      .gte('date_received', '2025-10-01')
      .lt('date_received', '2025-11-01')
      .order('date_received', { ascending: true });

    let dateRange = 'No leads';
    if (octoberLeads && octoberLeads.length > 0) {
      const firstDate = new Date(octoberLeads[0].date_received).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const lastDate = new Date(octoberLeads[octoberLeads.length - 1].date_received).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dateRange = `${firstDate} - ${lastDate}`;
    }

    stats.push({
      workspace_name,
      total_leads: totalCount || 0,
      october_mtd: octoberCount || 0,
      date_range: dateRange,
    });
  }

  // Sort by October MTD (descending)
  stats.sort((a, b) => b.october_mtd - a.october_mtd);

  // Display report
  console.log('┌─────────────────────────────────┬──────────────┬──────────────┬─────────────────────┐');
  console.log('│ Client                          │ October MTD  │ All-Time     │ October Date Range  │');
  console.log('├─────────────────────────────────┼──────────────┼──────────────┼─────────────────────┤');

  let totalOctober = 0;
  let totalAllTime = 0;

  for (const stat of stats) {
    const name = stat.workspace_name.padEnd(31);
    const octoberMtd = stat.october_mtd.toString().padStart(12);
    const allTime = stat.total_leads.toString().padStart(12);
    const dateRange = stat.date_range.padEnd(19);

    console.log(`│ ${name} │ ${octoberMtd} │ ${allTime} │ ${dateRange} │`);

    totalOctober += stat.october_mtd;
    totalAllTime += stat.total_leads;
  }

  console.log('├─────────────────────────────────┼──────────────┼──────────────┼─────────────────────┤');
  const totalLabel = 'TOTAL'.padEnd(31);
  const totalOct = totalOctober.toString().padStart(12);
  const totalAll = totalAllTime.toString().padStart(12);
  console.log(`│ ${totalLabel} │ ${totalOct} │ ${totalAll} │ ${' '.repeat(19)} │`);
  console.log('└─────────────────────────────────┴──────────────┴──────────────┴─────────────────────┘');

  console.log('\n');
  console.log('📌 NOTES:');
  console.log('   - October MTD: Interested leads from Oct 1-31, 2025');
  console.log('   - All-Time: Total interested leads in database');
  console.log('   - Data sourced from: client_leads table (Supabase)');
  console.log('   - Webhook active: Future leads captured in real-time');
  console.log('\n');

  // Export to JSON for programmatic use
  const reportData = {
    generated_at: new Date().toISOString(),
    summary: {
      total_clients: stats.length,
      total_october_mtd: totalOctober,
      total_all_time: totalAllTime,
    },
    clients: stats,
  };

  const fs = require('fs');
  const reportPath = '/tmp/kpi-report.json';
  fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
  console.log(`📄 Report exported to: ${reportPath}`);
  console.log('\n');
}

main().catch(console.error);
