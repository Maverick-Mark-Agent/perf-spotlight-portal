/**
 * Check Reseller Statistics
 *
 * Compare email sent counts across all resellers to identify data issues
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
  console.log('📊 Checking reseller statistics...\n');

  // Fetch ALL accounts (limited to 10000 to avoid timeout)
  const { data: accounts, error } = await supabase
    .from('email_accounts_view')
    .select('reseller, email_provider, emails_sent_count, total_replied_count, status')
    .limit(10000);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  if (!accounts) {
    console.log('No accounts found');
    return;
  }

  // Group by reseller
  const resellerGroups: Record<string, {
    name: string;
    accounts: number;
    totalSent: number;
    totalReplies: number;
    connected: number;
  }> = {};

  accounts.forEach(acc => {
    const reseller = acc.reseller || 'Unknown';
    if (!resellerGroups[reseller]) {
      resellerGroups[reseller] = {
        name: reseller,
        accounts: 0,
        totalSent: 0,
        totalReplies: 0,
        connected: 0,
      };
    }
    resellerGroups[reseller].accounts++;
    resellerGroups[reseller].totalSent += acc.emails_sent_count || 0;
    resellerGroups[reseller].totalReplies += acc.total_replied_count || 0;
    if (acc.status === 'Connected') {
      resellerGroups[reseller].connected++;
    }
  });

  // Sort by total sent
  const sorted = Object.values(resellerGroups).sort((a, b) => b.totalSent - a.totalSent);

  console.log('='.repeat(100));
  console.log('RESELLER PERFORMANCE SUMMARY');
  console.log('='.repeat(100));
  console.log(sprintf('%-20s %10s %12s %12s %10s %10s',
    'Reseller', 'Accounts', 'Connected', 'Total Sent', 'Replies', 'Reply Rate'));
  console.log('='.repeat(100));

  sorted.forEach(reseller => {
    const replyRate = reseller.totalSent > 0
      ? ((reseller.totalReplies / reseller.totalSent) * 100).toFixed(2)
      : '0.00';

    console.log(sprintf('%-20s %10d %12d %12s %10s %9s%%',
      reseller.name.substring(0, 20),
      reseller.accounts,
      reseller.connected,
      reseller.totalSent.toLocaleString(),
      reseller.totalReplies.toLocaleString(),
      replyRate
    ));
  });

  console.log('='.repeat(100));
  console.log(`\nTotal accounts analyzed: ${accounts.length.toLocaleString()}`);
  console.log(`Total emails sent: ${sorted.reduce((sum, r) => sum + r.totalSent, 0).toLocaleString()}`);
  console.log(`Total replies: ${sorted.reduce((sum, r) => sum + r.totalReplies, 0).toLocaleString()}`);
}

// Simple sprintf implementation
function sprintf(format: string, ...args: any[]): string {
  let result = format;
  args.forEach(arg => {
    result = result.replace(/%(-)?(\d+)?([sd])/, (match, leftAlign, width, type) => {
      let str = type === 'd' ? arg.toString() : String(arg);
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
