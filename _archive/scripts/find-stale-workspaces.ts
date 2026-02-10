/**
 * Find Workspaces with Stale Data
 *
 * Identifies workspaces that haven't been synced recently
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
  console.log('🔍 Finding workspaces with stale sync data...\n');

  // Get all accounts and group by workspace + last_synced_at
  const { data: accounts } = await supabase
    .from('email_accounts_raw')
    .select('workspace_name, last_synced_at')
    .order('workspace_name')
    .limit(10000);

  if (!accounts) {
    console.log('No accounts found');
    return;
  }

  // Group by workspace
  const workspaceGroups: Record<string, {
    mostRecent: Date;
    accountCount: number;
  }> = {};

  accounts.forEach(acc => {
    const ws = acc.workspace_name;
    const syncTime = new Date(acc.last_synced_at);

    if (!workspaceGroups[ws]) {
      workspaceGroups[ws] = {
        mostRecent: syncTime,
        accountCount: 0,
      };
    }

    workspaceGroups[ws].accountCount++;
    if (syncTime > workspaceGroups[ws].mostRecent) {
      workspaceGroups[ws].mostRecent = syncTime;
    }
  });

  // Sort by most recent sync (oldest first)
  const sorted = Object.entries(workspaceGroups)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => a.mostRecent.getTime() - b.mostRecent.getTime());

  console.log('='.repeat(100));
  console.log('WORKSPACE SYNC STATUS (sorted by oldest sync first)');
  console.log('='.repeat(100));
  console.log(sprintf('%-30s %12s %20s %15s',
    'Workspace', 'Accounts', 'Last Synced', 'Days Ago'));
  console.log('='.repeat(100));

  const now = new Date();
  sorted.forEach(ws => {
    const daysAgo = (now.getTime() - ws.mostRecent.getTime()) / (1000 * 60 * 60 * 24);
    const status = daysAgo > 1 ? '⚠️ STALE' : '✅';

    console.log(sprintf('%-30s %12d %20s %10.1f days %s',
      ws.name.substring(0, 30),
      ws.accountCount,
      ws.mostRecent.toISOString().substring(0, 19),
      daysAgo,
      status
    ));
  });

  console.log('='.repeat(100));

  // Summary
  const staleWorkspaces = sorted.filter(ws => {
    const daysAgo = (now.getTime() - ws.mostRecent.getTime()) / (1000 * 60 * 60 * 24);
    return daysAgo > 1;
  });

  if (staleWorkspaces.length > 0) {
    console.log(`\n⚠️  Found ${staleWorkspaces.length} workspaces with stale data (>1 day old):`);
    staleWorkspaces.forEach(ws => {
      const daysAgo = (now.getTime() - ws.mostRecent.getTime()) / (1000 * 60 * 60 * 24);
      console.log(`   - ${ws.name}: ${daysAgo.toFixed(1)} days ago`);
    });

    console.log('\n💡 These workspaces may need manual sync or have sync errors.');
  } else {
    console.log('\n✅ All workspaces are up to date!');
  }
}

// Simple sprintf implementation
function sprintf(format: string, ...args: any[]): string {
  let result = format;
  args.forEach(arg => {
    result = result.replace(/%(-)?(\d+)?(\.\d+)?([sdfi])/, (match, leftAlign, width, precision, type) => {
      let str: string;
      if (type === 'd' || type === 'i') {
        str = Math.floor(Number(arg)).toString();
      } else if (type === 'f') {
        const p = precision ? parseInt(precision.substring(1)) : 2;
        str = Number(arg).toFixed(p);
      } else {
        str = String(arg);
      }

      if (width) {
        const w = parseInt(width);
        if (leftAlign) {
          str = str.padEnd(w, ' ');
        } else {
          str = str.padStart(w, ' ');
        }
      }
      return str;
    });
  });
  return result;
}

main().catch(console.error);
