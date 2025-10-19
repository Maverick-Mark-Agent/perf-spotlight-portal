#!/usr/bin/env tsx

/**
 * Comprehensive Diagnostic: Email Bison vs Supabase vs Dashboard
 *
 * This script compares lead counts across all three sources to identify discrepancies
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0';

const MAVERICK_API_KEY = process.env.EMAIL_BISON_API_KEY;
const MAVERICK_BASE_URL = 'https://send.maverickmarketingllc.com/api';

const LONGRUN_API_KEY = '32|MiBV8URxMy8jnGZUq5SVBD5V0jaPbwKmtime9YXxca69e009';
const LONGRUN_BASE_URL = 'https://send.longrun.agency/api';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getEmailBisonCount(workspaceName: string, bisonWorkspaceId: number, instance: string): Promise<number> {
  const apiKey = instance === 'Maverick' ? MAVERICK_API_KEY : LONGRUN_API_KEY;
  const baseUrl = instance === 'Maverick' ? MAVERICK_BASE_URL : LONGRUN_BASE_URL;

  try {
    // Switch workspace
    await fetch(`${baseUrl}/workspaces/v1.1/switch-workspace`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ team_id: bisonWorkspaceId }),
    });

    await sleep(1500);

    // Get total interested count
    const response = await fetch(
      `${baseUrl}/replies?interested=1&per_page=1`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json',
        },
      }
    );

    const data = await response.json();
    return data.meta?.total || 0;
  } catch (error) {
    console.error(`Error fetching Bison count for ${workspaceName}:`, error);
    return -1;
  }
}

async function getSupabaseCount(workspaceName: string): Promise<number> {
  const { count } = await supabase
    .from('client_leads')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_name', workspaceName)
    .eq('interested', true);

  return count || 0;
}

async function getOctoberCount(workspaceName: string): Promise<number> {
  const { count } = await supabase
    .from('client_leads')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_name', workspaceName)
    .eq('interested', true)
    .gte('date_received', '2025-10-01')
    .lt('date_received', '2025-11-01');

  return count || 0;
}

async function main() {
  console.log('🔍 COMPREHENSIVE DIAGNOSTIC REPORT');
  console.log('=' .repeat(100));
  console.log('\n');

  // Get all active workspaces
  const { data: workspaces } = await supabase
    .from('client_registry')
    .select('workspace_name, bison_workspace_id, bison_instance')
    .eq('is_active', true)
    .order('workspace_name');

  if (!workspaces) {
    console.error('Failed to fetch workspaces');
    process.exit(1);
  }

  console.log('┌──────────────────────────────────┬──────────────┬──────────────┬──────────────┬────────────┐');
  console.log('│ Client                           │ Email Bison  │ Supabase DB  │ October MTD  │ Status     │');
  console.log('├──────────────────────────────────┼──────────────┼──────────────┼──────────────┼────────────┤');

  const results: any[] = [];

  for (const ws of workspaces) {
    const { workspace_name, bison_workspace_id, bison_instance } = ws;

    // Get counts from all sources
    const bisonCount = await getEmailBisonCount(workspace_name, bison_workspace_id, bison_instance);
    const supabaseCount = await getSupabaseCount(workspace_name);
    const octoberCount = await getOctoberCount(workspace_name);

    const status = bisonCount === supabaseCount ? '✅ Match' :
                   bisonCount < 0 ? '❌ Error' :
                   supabaseCount === 0 ? '⚠️  Empty' :
                   Math.abs(bisonCount - supabaseCount) <= 5 ? '⚠️  Close' :
                   '❌ Mismatch';

    const name = workspace_name.padEnd(32);
    const bison = (bisonCount < 0 ? 'ERROR' : bisonCount.toString()).padStart(12);
    const db = supabaseCount.toString().padStart(12);
    const oct = octoberCount.toString().padStart(12);
    const stat = status.padEnd(10);

    console.log(`│ ${name} │ ${bison} │ ${db} │ ${oct} │ ${stat} │`);

    results.push({
      workspace_name,
      bison_count: bisonCount,
      supabase_count: supabaseCount,
      october_mtd: octoberCount,
      status,
      discrepancy: bisonCount >= 0 ? bisonCount - supabaseCount : null,
    });

    // Small delay between clients
    await sleep(500);
  }

  console.log('└──────────────────────────────────┴──────────────┴──────────────┴──────────────┴────────────┘');

  // Summary
  const totalBison = results.reduce((sum, r) => sum + (r.bison_count >= 0 ? r.bison_count : 0), 0);
  const totalSupabase = results.reduce((sum, r) => sum + r.supabase_count, 0);
  const totalOctober = results.reduce((sum, r) => sum + r.october_mtd, 0);

  console.log('\n📊 SUMMARY:');
  console.log(`   Total Email Bison Leads:   ${totalBison}`);
  console.log(`   Total Supabase Leads:      ${totalSupabase}`);
  console.log(`   Total October MTD:         ${totalOctober}`);
  console.log(`   Discrepancy:               ${totalBison - totalSupabase}`);

  // Identify issues
  const mismatches = results.filter(r => r.status.includes('Mismatch'));
  const empties = results.filter(r => r.status.includes('Empty'));
  const errors = results.filter(r => r.status.includes('Error'));

  if (mismatches.length > 0) {
    console.log(`\n❌ MISMATCHES (${mismatches.length} clients):`);
    mismatches.forEach(r => {
      console.log(`   ${r.workspace_name}: Bison=${r.bison_count}, Supabase=${r.supabase_count} (diff: ${r.discrepancy})`);
    });
  }

  if (empties.length > 0) {
    console.log(`\n⚠️  EMPTY IN SUPABASE (${empties.length} clients):`);
    empties.forEach(r => {
      console.log(`   ${r.workspace_name}: ${r.bison_count} leads in Bison, 0 in Supabase`);
    });
  }

  if (errors.length > 0) {
    console.log(`\n❌ ERRORS (${errors.length} clients):`);
    errors.forEach(r => {
      console.log(`   ${r.workspace_name}: Failed to fetch from Email Bison`);
    });
  }

  console.log('\n');
}

main().catch(console.error);
