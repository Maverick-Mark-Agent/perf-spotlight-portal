#!/usr/bin/env tsx

/**
 * Backfill All Client Leads from Email Bison
 *
 * This script fetches ALL interested replies for each active workspace
 * and inserts them into the Supabase client_leads table.
 *
 * Key features:
 * - Sequential processing (one workspace at a time)
 * - Proper delays to avoid race conditions
 * - Pagination to get ALL replies
 * - Conflict handling (ON CONFLICT DO UPDATE)
 * - Progress reporting
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0';

const MAVERICK_API_KEY = '77|AqozJcNT8l2m52CRyvQyEEmLKa49ofuZRjK98aio8a3feb5d';
const MAVERICK_BASE_URL = 'https://send.maverickmarketingllc.com/api';

const LONGRUN_API_KEY = '32|MiBV8URxMy8jnGZUq5SVBD5V0jaPbwKmtime9YXxca69e009';
const LONGRUN_BASE_URL = 'https://send.longrun.agency/api';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

interface Workspace {
  workspace_name: string;
  bison_workspace_id: number;
  bison_instance: string;
}

interface Reply {
  id: number;
  uuid: string;
  from_email_address: string;
  from_name: string;
  date_received: string;
  lead_id: number;
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function switchWorkspace(
  bisonWorkspaceId: number,
  apiKey: string,
  baseUrl: string
): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/workspaces/v1.1/switch-workspace`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ team_id: bisonWorkspaceId }),
    });

    if (!response.ok) {
      console.error(`Failed to switch workspace: ${response.status}`);
      return false;
    }

    // Wait for workspace switch to fully propagate
    await sleep(2000);
    return true;
  } catch (error) {
    console.error('Error switching workspace:', error);
    return false;
  }
}

async function fetchAllInterestedReplies(
  apiKey: string,
  baseUrl: string
): Promise<Reply[]> {
  const allReplies: Reply[] = [];
  let page = 1;
  let hasMore = true;
  const perPage = 100;

  while (hasMore) {
    try {
      const response = await fetch(
        `${baseUrl}/replies?interested=1&per_page=${perPage}&page=${page}`,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) {
        console.error(`Failed to fetch replies page ${page}: ${response.status}`);
        break;
      }

      const data = await response.json();
      const replies = data.data || [];
      allReplies.push(...replies);

      console.log(`  Page ${page}: ${replies.length} replies`);

      if (page >= data.meta.last_page) {
        hasMore = false;
      } else {
        page++;
        await sleep(200); // Small delay between pages
      }
    } catch (error) {
      console.error(`Error fetching page ${page}:`, error);
      break;
    }
  }

  return allReplies;
}

async function insertLeads(workspaceName: string, replies: Reply[]) {
  if (replies.length === 0) {
    console.log(`  No leads to insert for ${workspaceName}`);
    return { inserted: 0, updated: 0, errors: 0 };
  }

  const leadsToInsert = replies.map(reply => {
    const nameParts = (reply.from_name || '').split(' ');
    const firstName = nameParts[0] || null;
    const lastName = nameParts.slice(1).join(' ') || null;

    return {
      airtable_id: `bison_reply_${reply.id}`,
      workspace_name: workspaceName,
      lead_email: reply.from_email_address || 'unknown@email.com',
      first_name: firstName,
      last_name: lastName,
      date_received: reply.date_received,
      interested: true,
      pipeline_stage: 'new',
      bison_reply_id: reply.id,
      bison_reply_uuid: reply.uuid || null,
      bison_lead_id: reply.lead_id?.toString() || null,
    };
  });

  // Process in batches of 100 to avoid timeout
  const BATCH_SIZE = 100;
  let totalInserted = 0;
  let totalErrors = 0;

  for (let i = 0; i < leadsToInsert.length; i += BATCH_SIZE) {
    const batch = leadsToInsert.slice(i, i + BATCH_SIZE);

    try {
      const { error } = await supabase
        .from('client_leads')
        .upsert(batch, {
          onConflict: 'airtable_id',
          ignoreDuplicates: false,
        });

      if (error) {
        console.error(`  ⚠️  Batch ${Math.floor(i / BATCH_SIZE) + 1} error:`, error.message);
        totalErrors += batch.length;
      } else {
        totalInserted += batch.length;
      }

      // Small delay between batches
      if (i + BATCH_SIZE < leadsToInsert.length) {
        await sleep(100);
      }
    } catch (error) {
      console.error(`  ❌ Exception in batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error);
      totalErrors += batch.length;
    }
  }

  console.log(`  ✅ Upserted ${totalInserted} leads (${totalErrors} errors)`);
  return { inserted: totalInserted, updated: 0, errors: totalErrors };
}

async function processWorkspace(workspace: Workspace): Promise<number> {
  const { workspace_name, bison_workspace_id, bison_instance } = workspace;

  const apiKey = bison_instance === 'Maverick' ? MAVERICK_API_KEY : LONGRUN_API_KEY;
  const baseUrl = bison_instance === 'Maverick' ? MAVERICK_BASE_URL : LONGRUN_BASE_URL;

  console.log(`\n📊 Processing: ${workspace_name} (${bison_instance} - ID: ${bison_workspace_id})`);

  // Step 1: Switch workspace
  const switched = await switchWorkspace(bison_workspace_id, apiKey, baseUrl);
  if (!switched) {
    console.log(`  ⚠️  Failed to switch workspace - SKIPPING`);
    return 0;
  }

  // Step 2: Fetch all interested replies
  console.log(`  Fetching all interested replies...`);
  const replies = await fetchAllInterestedReplies(apiKey, baseUrl);
  console.log(`  Found ${replies.length} total interested replies`);

  // Step 3: Insert into Supabase
  const result = await insertLeads(workspace_name, replies);

  return replies.length;
}

async function main() {
  console.log('🚀 Starting Client Leads Backfill\n');
  console.log('=' .repeat(60));

  // Fetch all active workspaces
  const { data: workspaces, error } = await supabase
    .from('client_registry')
    .select('workspace_name, bison_workspace_id, bison_instance')
    .eq('is_active', true)
    .order('workspace_name');

  if (error || !workspaces) {
    console.error('❌ Failed to fetch workspaces:', error);
    process.exit(1);
  }

  console.log(`Found ${workspaces.length} active workspaces\n`);

  const results: Record<string, number> = {};
  let totalLeads = 0;

  // Process each workspace sequentially
  for (let i = 0; i < workspaces.length; i++) {
    const workspace = workspaces[i];
    console.log(`[${i + 1}/${workspaces.length}]`);

    const count = await processWorkspace(workspace as Workspace);
    results[workspace.workspace_name] = count;
    totalLeads += count;

    // Delay between workspaces to avoid race conditions
    if (i < workspaces.length - 1) {
      console.log(`  ⏳ Waiting 3 seconds before next workspace...`);
      await sleep(3000);
    }
  }

  // Summary report
  console.log('\n' + '=' .repeat(60));
  console.log('📋 BACKFILL SUMMARY REPORT');
  console.log('=' .repeat(60));
  console.log('\nLeads per Workspace:');

  Object.entries(results)
    .sort(([, a], [, b]) => b - a)
    .forEach(([name, count]) => {
      console.log(`  ${name.padEnd(30)} ${count.toString().padStart(6)} leads`);
    });

  console.log('\n' + '-' .repeat(60));
  console.log(`Total Leads Backfilled: ${totalLeads}`);
  console.log('=' .repeat(60));
  console.log('\n✅ Backfill complete!\n');
}

main().catch(console.error);
