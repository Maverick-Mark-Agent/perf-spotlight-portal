#!/usr/bin/env node

/**
 * Detailed analysis of ALL campaigns to understand baseline performance
 */

const BISON_API_BASE_URL = 'https://send.maverickmarketingllc.com/api';
const BISON_API_KEY = '101|6mXfEtJkLDF99HcmvOqlJcjlYaDyt9pGt9c6C7qJ56e6298b';

async function bisonRequest(endpoint, options = {}) {
  const url = `${BISON_API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${BISON_API_KEY}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.text();
    console.error(`API Error (${response.status}):`, errorData);
    throw new Error(`Email Bison API error: ${response.status}`);
  }

  const data = await response.json();
  return data.data || data;
}

async function analyzeAllCampaigns() {
  console.log('📊 Fetching ALL campaigns for baseline analysis...\n');

  const campaigns = await bisonRequest('/campaigns?per_page=2000');
  const allCampaigns = campaigns.data || campaigns;

  console.log(`✅ Total Campaigns: ${allCampaigns.length}\n`);

  // Sort by updated_at
  allCampaigns.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

  console.log('=' .repeat(120));
  console.log('ALL CAMPAIGNS OVERVIEW (sorted by most recently updated)');
  console.log('='.repeat(120));
  console.log(
    'Name'.padEnd(60) +
    'Status'.padEnd(12) +
    'Reply%'.padEnd(10) +
    'Open%'.padEnd(10) +
    'Bounce%'.padEnd(10) +
    'Sent'.padEnd(10) +
    'Updated'
  );
  console.log('-'.repeat(120));

  allCampaigns.forEach(c => {
    const replyRate = c.total_leads_contacted > 0
      ? ((c.unique_replies / c.total_leads_contacted) * 100).toFixed(2)
      : '0.00';
    const openRate = c.total_leads_contacted > 0
      ? ((c.unique_opens / c.total_leads_contacted) * 100).toFixed(2)
      : '0.00';
    const bounceRate = c.emails_sent > 0
      ? ((c.bounced / c.emails_sent) * 100).toFixed(2)
      : '0.00';

    const updatedDate = new Date(c.updated_at).toISOString().split('T')[0];

    console.log(
      c.name.substring(0, 58).padEnd(60) +
      c.status.padEnd(12) +
      `${replyRate}%`.padEnd(10) +
      `${openRate}%`.padEnd(10) +
      `${bounceRate}%`.padEnd(10) +
      c.emails_sent.toString().padEnd(10) +
      updatedDate
    );
  });

  // Identify January/February/March campaigns
  console.log('\n\n' + '='.repeat(120));
  console.log('RECENT RENEWAL CAMPAIGNS (January/February/March)');
  console.log('='.repeat(120));

  const recentCampaigns = allCampaigns.filter(c => {
    const name = c.name.toLowerCase();
    return (name.includes('january') || name.includes('february') || name.includes('march')) &&
           !name.includes('december');
  });

  console.log(`Found ${recentCampaigns.length} recent renewal campaigns:\n`);

  recentCampaigns.forEach((c, i) => {
    const replyRate = c.total_leads_contacted > 0
      ? ((c.unique_replies / c.total_leads_contacted) * 100).toFixed(2)
      : '0.00';
    const openRate = c.total_leads_contacted > 0
      ? ((c.unique_opens / c.total_leads_contacted) * 100).toFixed(2)
      : '0.00';
    const bounceRate = c.emails_sent > 0
      ? ((c.bounced / c.emails_sent) * 100).toFixed(2)
      : '0.00';
    const interestedRate = c.total_leads_contacted > 0
      ? ((c.interested / c.total_leads_contacted) * 100).toFixed(2)
      : '0.00';

    console.log(`${i + 1}. ${c.name}`);
    console.log(`   Status: ${c.status}`);
    console.log(`   Created: ${c.created_at}`);
    console.log(`   Updated: ${c.updated_at}`);
    console.log(`   Emails Sent: ${c.emails_sent.toLocaleString()}`);
    console.log(`   Total Leads: ${c.total_leads.toLocaleString()}`);
    console.log(`   Leads Contacted: ${c.total_leads_contacted.toLocaleString()}`);
    console.log(`   Completion: ${c.completion_percentage}%`);
    console.log(`   Metrics:`);
    console.log(`      Reply Rate: ${replyRate}% (${c.unique_replies} unique / ${c.replied} total)`);
    console.log(`      Open Rate: ${openRate}% (${c.unique_opens} unique / ${c.opened} total)`);
    console.log(`      Bounce Rate: ${bounceRate}% (${c.bounced} bounced)`);
    console.log(`      Interested Rate: ${interestedRate}% (${c.interested} interested)`);
    console.log(`      Unsubscribed: ${c.unsubscribed}`);
    console.log('');
  });

  // Calculate benchmark from all active campaigns with significant volume
  console.log('\n' + '='.repeat(120));
  console.log('BENCHMARK METRICS (from campaigns with >100 emails sent)');
  console.log('='.repeat(120));

  const benchmarkCampaigns = allCampaigns.filter(c => c.emails_sent > 100);

  if (benchmarkCampaigns.length > 0) {
    const avgReply = benchmarkCampaigns.reduce((sum, c) => {
      return sum + (c.total_leads_contacted > 0 ? (c.unique_replies / c.total_leads_contacted) * 100 : 0);
    }, 0) / benchmarkCampaigns.length;

    const avgOpen = benchmarkCampaigns.reduce((sum, c) => {
      return sum + (c.total_leads_contacted > 0 ? (c.unique_opens / c.total_leads_contacted) * 100 : 0);
    }, 0) / benchmarkCampaigns.length;

    const avgBounce = benchmarkCampaigns.reduce((sum, c) => {
      return sum + (c.emails_sent > 0 ? (c.bounced / c.emails_sent) * 100 : 0);
    }, 0) / benchmarkCampaigns.length;

    const avgInterested = benchmarkCampaigns.reduce((sum, c) => {
      return sum + (c.total_leads_contacted > 0 ? (c.interested / c.total_leads_contacted) * 100 : 0);
    }, 0) / benchmarkCampaigns.length;

    console.log(`\nBased on ${benchmarkCampaigns.length} campaigns with >100 emails sent:`);
    console.log(`   Average Reply Rate: ${avgReply.toFixed(2)}%`);
    console.log(`   Average Open Rate: ${avgOpen.toFixed(2)}%`);
    console.log(`   Average Bounce Rate: ${avgBounce.toFixed(2)}%`);
    console.log(`   Average Interested Rate: ${avgInterested.toFixed(2)}%`);

    // Compare recent campaigns against benchmark
    console.log('\n\n' + '='.repeat(120));
    console.log('RECENT CAMPAIGNS VS BENCHMARK');
    console.log('='.repeat(120));

    recentCampaigns.forEach(c => {
      if (c.emails_sent === 0) {
        console.log(`\n❌ ${c.name}: NO EMAILS SENT YET - Campaign may not have started`);
        return;
      }

      const replyRate = c.total_leads_contacted > 0
        ? (c.unique_replies / c.total_leads_contacted) * 100
        : 0;
      const openRate = c.total_leads_contacted > 0
        ? (c.unique_opens / c.total_leads_contacted) * 100
        : 0;
      const bounceRate = c.emails_sent > 0
        ? (c.bounced / c.emails_sent) * 100
        : 0;

      console.log(`\n${c.name}:`);
      console.log(`   Reply Rate: ${replyRate.toFixed(2)}% ${replyRate < avgReply ? '⚠️  BELOW' : '✅ ABOVE'} benchmark (${avgReply.toFixed(2)}%)`);
      console.log(`   Open Rate: ${openRate.toFixed(2)}% ${openRate < avgOpen ? '⚠️  BELOW' : '✅ ABOVE'} benchmark (${avgOpen.toFixed(2)}%)`);
      console.log(`   Bounce Rate: ${bounceRate.toFixed(2)}% ${bounceRate > avgBounce ? '⚠️  ABOVE' : '✅ BELOW'} benchmark (${avgBounce.toFixed(2)}%)`);

      // Diagnosis
      if (openRate === 0 && c.emails_sent > 0) {
        console.log(`   🔴 CRITICAL: 0% open rate with ${c.emails_sent} emails sent suggests tracking issue or emails going to spam`);
      }
      if (replyRate < 0.5 && c.emails_sent > 100) {
        console.log(`   🟡 WARNING: Very low reply rate - check email copy quality and targeting`);
      }
      if (bounceRate > 5) {
        console.log(`   🔴 CRITICAL: High bounce rate - sender emails may need warming or list quality is poor`);
      }
    });
  }

  // Save full report
  const fs = require('fs');
  const report = {
    timestamp: new Date().toISOString(),
    totalCampaigns: allCampaigns.length,
    recentRenewalCampaigns: recentCampaigns.length,
    allCampaigns: allCampaigns.map(c => ({
      id: c.id,
      name: c.name,
      status: c.status,
      type: c.type,
      created_at: c.created_at,
      updated_at: c.updated_at,
      emails_sent: c.emails_sent,
      total_leads: c.total_leads,
      total_leads_contacted: c.total_leads_contacted,
      completion_percentage: c.completion_percentage,
      metrics: {
        opened: c.opened,
        unique_opens: c.unique_opens,
        replied: c.replied,
        unique_replies: c.unique_replies,
        bounced: c.bounced,
        unsubscribed: c.unsubscribed,
        interested: c.interested,
      },
    })),
  };

  fs.writeFileSync('all-campaigns-baseline-report.json', JSON.stringify(report, null, 2));
  console.log('\n\n✅ Full report saved to: all-campaigns-baseline-report.json');
}

analyzeAllCampaigns().catch(console.error);
