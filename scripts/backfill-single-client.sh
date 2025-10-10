#!/bin/bash

# Backfill a single client's leads
# Usage: ./backfill-single-client.sh "Kim Wallace"

if [ -z "$1" ]; then
  echo "Usage: $0 <workspace_name>"
  exit 1
fi

WORKSPACE_NAME="$1"

echo "🚀 Backfilling leads for: $WORKSPACE_NAME"
echo "================================"

# Create a temporary TypeScript file for this specific workspace
cat > "/Users/tommychavez/Maverick Dashboard/perf-spotlight-portal/scripts/.backfill-temp-${WORKSPACE_NAME// /_}.ts" <<'EOFSCRIPT'
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0';

const MAVERICK_API_KEY = '77|AqozJcNT8l2m52CRyvQyEEmLKa49ofuZRjK98aio8a3feb5d';
const MAVERICK_BASE_URL = 'https://send.maverickmarketingllc.com/api';

const LONGRUN_API_KEY = '32|MiBV8URxMy8jnGZUq5SVBD5V0jaPbwKmtime9YXxca69e009';
const LONGRUN_BASE_URL = 'https://send.longrun.agency/api';

const TARGET_WORKSPACE = process.env.TARGET_WORKSPACE || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  // Get workspace details
  const { data: workspace, error } = await supabase
    .from('client_registry')
    .select('workspace_name, bison_workspace_id, bison_instance')
    .eq('workspace_name', TARGET_WORKSPACE)
    .single();

  if (error || !workspace) {
    console.error(`❌ Workspace not found: ${TARGET_WORKSPACE}`);
    process.exit(1);
  }

  const apiKey = workspace.bison_instance === 'Maverick' ? MAVERICK_API_KEY : LONGRUN_API_KEY;
  const baseUrl = workspace.bison_instance === 'Maverick' ? MAVERICK_BASE_URL : LONGRUN_BASE_URL;

  console.log(`📊 ${workspace.workspace_name} (${workspace.bison_instance} - ID: ${workspace.bison_workspace_id})`);

  // Switch workspace
  const switchResponse = await fetch(`${baseUrl}/workspaces/v1.1/switch-workspace`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ team_id: workspace.bison_workspace_id }),
  });

  if (!switchResponse.ok) {
    console.error(`❌ Failed to switch workspace`);
    process.exit(1);
  }

  await sleep(2000);

  // Fetch all interested replies
  console.log(`Fetching all interested replies...`);
  const allReplies: any[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await fetch(
      `${baseUrl}/replies?interested=1&per_page=100&page=${page}`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) break;

    const data = await response.json();
    const replies = data.data || [];
    allReplies.push(...replies);

    console.log(`  Page ${page}: ${replies.length} replies (Total: ${allReplies.length})`);

    if (page >= data.meta.last_page) {
      hasMore = false;
    } else {
      page++;
      await sleep(200);
    }
  }

  console.log(`Found ${allReplies.length} total interested replies`);

  // Deduplicate by email - keep most recent reply per email
  const repliesByEmail = new Map();
  for (const reply of allReplies) {
    const email = (reply.from_email_address || '').toLowerCase();
    const existing = repliesByEmail.get(email);

    // Keep the most recent reply (highest ID = newest)
    if (!existing || reply.id > existing.id) {
      repliesByEmail.set(email, reply);
    }
  }

  const uniqueReplies = Array.from(repliesByEmail.values());
  console.log(`Deduplicated to ${uniqueReplies.length} unique leads`);

  // Transform to insert format
  const leadsToInsert = uniqueReplies.map(reply => {
    const nameParts = (reply.from_name || '').split(' ');
    return {
      airtable_id: `bison_reply_${reply.id}`,
      workspace_name: workspace.workspace_name,
      lead_email: reply.from_email_address || 'unknown@email.com',
      first_name: nameParts[0] || null,
      last_name: nameParts.slice(1).join(' ') || null,
      date_received: reply.date_received,
      interested: true,
      pipeline_stage: 'new',
      bison_reply_id: reply.id,
      bison_reply_uuid: reply.uuid || null,
      bison_lead_id: reply.lead_id?.toString() || null,
    };
  });

  // Insert in batches
  const BATCH_SIZE = 100;
  let totalInserted = 0;
  let totalErrors = 0;

  for (let i = 0; i < leadsToInsert.length; i += BATCH_SIZE) {
    const batch = leadsToInsert.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    const { data, error } = await supabase
      .from('client_leads')
      .upsert(batch, {
        onConflict: 'airtable_id',
        ignoreDuplicates: false,
      })
      .select();

    if (error) {
      console.error(`  ❌ Batch ${batchNum} error:`, error.message);
      console.error(`  Error code:`, error.code);
      console.error(`  Error hint:`, error.hint);
      totalErrors += batch.length;
    } else {
      const inserted = data?.length || batch.length;
      totalInserted += inserted;
      console.log(`  ✅ Batch ${batchNum}: ${inserted} leads`);
    }

    await sleep(100);
  }

  console.log(`\nFinal: ${totalInserted} inserted, ${totalErrors} errors`);
  console.log(`✅ Completed backfill for ${workspace.workspace_name}`);
}

main().catch(console.error);
EOFSCRIPT

# Run the script with the workspace name as environment variable
cd "/Users/tommychavez/Maverick Dashboard/perf-spotlight-portal" && TARGET_WORKSPACE="$WORKSPACE_NAME" npx tsx "scripts/.backfill-temp-${WORKSPACE_NAME// /_}.ts"

# Clean up temp file
rm -f "/Users/tommychavez/Maverick Dashboard/perf-spotlight-portal/scripts/.backfill-temp-${WORKSPACE_NAME// /_}.ts"
