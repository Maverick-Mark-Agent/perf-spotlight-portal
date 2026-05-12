import { createClient } from '@supabase/supabase-js';

const BISON_API_BASE_URL = 'https://send.maverickmarketingllc.com/api';
const BISON_API_KEY = '101|6mXfEtJkLDF99HcmvOqlJcjlYaDyt9pGt9c6C7qJ56e6298b';

const supabaseUrl = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function bisonRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
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
    throw new Error(`Email Bison API error: ${response.status}`);
  }

  const data = await response.json();
  return data.data || data;
}

async function analyzeAllWorkspaces() {
  console.log('🏢 WORKSPACE-BY-WORKSPACE CAMPAIGN ANALYSIS');
  console.log('Benchmarks: Reply Rate ≥1.25% = GOOD | Interested Rate ≥0.30% = GOOD\n');
  console.log('='.repeat(120));

  // Get all clients with their Bison workspace mappings
  const { data: clients, error } = await supabase
    .from('client_registry')
    .select('workspace_name, bison_workspace_id')
    .not('bison_workspace_id', 'is', null)
    .order('workspace_name');

  if (error) {
    console.error('Error fetching clients:', error);
    return;
  }

  if (!clients || clients.length === 0) {
    console.log('\n⚠️  No clients with Bison workspace mappings found in database');
    return;
  }

  console.log(`\n✅ Found ${clients.length} clients with Email Bison workspaces\n`);

  // Get all campaigns from Email Bison
  const allCampaignsResponse = await bisonRequest('/campaigns?per_page=2000');
  const allCampaigns = allCampaignsResponse.data || allCampaignsResponse;

  // Get all sender emails
  const allSendersResponse = await bisonRequest('/sender-emails?per_page=2000');
  const allSenders = allSendersResponse.data || allSendersResponse;

  // Get workspace data from database to map campaigns to workspaces
  const { data: senderCache, error: cacheError } = await supabase
    .from('sender_emails_cache')
    .select('bison_workspace_id, workspace_name, email_address');

  if (cacheError) {
    console.error('Error fetching sender cache:', cacheError);
  }

  // Map email addresses to workspace
  const emailToWorkspace = new Map();
  senderCache?.forEach(row => {
    emailToWorkspace.set(row.email_address, {
      workspaceId: row.bison_workspace_id,
      workspaceName: row.workspace_name
    });
  });

  // Analyze each client's workspace
  for (const client of clients) {
    console.log('\n' + '='.repeat(120));
    console.log(`🏢 CLIENT: ${client.workspace_name}`);
    console.log('='.repeat(120));
    console.log(`Bison Workspace ID: ${client.bison_workspace_id}`);

    // Get sender emails for this workspace from cache
    const workspaceSenders = senderCache?.filter(s => s.bison_workspace_id === client.bison_workspace_id) || [];
    const workspaceSenderEmails = workspaceSenders.map(s => s.email_address);

    console.log(`\nSender Emails in Database: ${workspaceSenders.length}`);

    if (workspaceSenders.length === 0) {
      console.log('\n⚠️  No sender emails found for this workspace in database');
      console.log('   This workspace may not have campaigns yet');
      continue;
    }

    // Find campaigns that use these sender emails
    const workspaceCampaigns = [];

    for (const campaign of allCampaigns) {
      try {
        const campaignSenders = await bisonRequest(`/campaigns/${campaign.id}/sender-emails`);
        const senders = campaignSenders.data || campaignSenders;

        // Check if any sender in this campaign belongs to this workspace
        const hasWorkspaceSender = senders.some((s: any) => workspaceSenderEmails.includes(s.email));

        if (hasWorkspaceSender) {
          workspaceCampaigns.push(campaign);
        }
      } catch (error) {
        // Skip campaigns we can't access
      }
    }

    console.log(`Campaigns: ${workspaceCampaigns.length}`);

    if (workspaceCampaigns.length === 0) {
      console.log('\n📊 STATUS: No active campaigns found for this workspace');
      continue;
    }

    // Analyze campaigns
    console.log('\n' + '-'.repeat(120));
    console.log('📊 CAMPAIGNS');
    console.log('-'.repeat(120));

    // Focus on recently updated campaigns
    const recentCampaigns = workspaceCampaigns.filter((c: any) => {
      const daysSinceUpdate = (Date.now() - new Date(c.updated_at).getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceUpdate <= 30;
    }).sort((a: any, b: any) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    if (recentCampaigns.length === 0) {
      console.log('\nNo campaigns updated in the last 30 days');
      continue;
    }

    console.log(`\nShowing ${recentCampaigns.length} recently active campaigns (last 30 days):\n`);

    let totalSent = 0;
    let totalContacted = 0;
    let totalReplies = 0;
    let totalInterested = 0;
    let totalBounced = 0;

    recentCampaigns.forEach((campaign: any, i: number) => {
      const replyRate = campaign.total_leads_contacted > 0
        ? (campaign.unique_replies / campaign.total_leads_contacted) * 100
        : 0;
      const interestedRate = campaign.total_leads_contacted > 0
        ? (campaign.interested / campaign.total_leads_contacted) * 100
        : 0;
      const bounceRate = campaign.emails_sent > 0
        ? (campaign.bounced / campaign.emails_sent) * 100
        : 0;

      const replyStatus = replyRate >= 1.25 ? '✅' : replyRate >= 1.0 ? '🟡' : '🔴';
      const interestedStatus = interestedRate >= 0.30 ? '✅' : interestedRate >= 0.20 ? '🟡' : '🔴';

      console.log(`${i + 1}. ${campaign.name}`);
      console.log(`   Status: ${campaign.status} | Updated: ${new Date(campaign.updated_at).toISOString().split('T')[0]}`);
      console.log(`   Sent: ${campaign.emails_sent.toLocaleString()} | Contacted: ${campaign.total_leads_contacted.toLocaleString()}`);
      console.log(`   ${replyStatus} Reply: ${replyRate.toFixed(2)}% (${campaign.unique_replies}) | ${interestedStatus} Interested: ${interestedRate.toFixed(2)}% (${campaign.interested})`);
      console.log(`   Bounce: ${bounceRate.toFixed(2)}% (${campaign.bounced})`);
      console.log('');

      totalSent += campaign.emails_sent;
      totalContacted += campaign.total_leads_contacted;
      totalReplies += campaign.unique_replies;
      totalInterested += campaign.interested;
      totalBounced += campaign.bounced;
    });

    // Workspace aggregates
    const workspaceReplyRate = totalContacted > 0 ? (totalReplies / totalContacted) * 100 : 0;
    const workspaceInterestedRate = totalContacted > 0 ? (totalInterested / totalContacted) * 100 : 0;
    const workspaceBounceRate = totalSent > 0 ? (totalBounced / totalSent) * 100 : 0;

    console.log('WORKSPACE AGGREGATE METRICS:');
    console.log(`   Total Sent: ${totalSent.toLocaleString()}`);
    console.log(`   Total Contacted: ${totalContacted.toLocaleString()}`);
    console.log(`   Reply Rate: ${workspaceReplyRate.toFixed(2)}% ${workspaceReplyRate >= 1.25 ? '✅ GOOD' : '🔴 BELOW TARGET'}`);
    console.log(`   Interested Rate: ${workspaceInterestedRate.toFixed(2)}% ${workspaceInterestedRate >= 0.30 ? '✅ GOOD' : '🔴 BELOW TARGET'}`);
    console.log(`   Bounce Rate: ${workspaceBounceRate.toFixed(2)}% ${workspaceBounceRate < 5 ? '✅' : '⚠️  HIGH'}`);

    // Identify issues
    console.log('\n' + '-'.repeat(120));
    console.log('⚠️  SPECIFIC ISSUES');
    console.log('-'.repeat(120));

    const issues = [];

    if (workspaceReplyRate < 1.25 && totalContacted > 100) {
      const expectedReplies = Math.round(totalContacted * 0.0125);
      const missingReplies = expectedReplies - totalReplies;
      issues.push({
        severity: 'HIGH',
        issue: `Reply rate ${workspaceReplyRate.toFixed(2)}% is below 1.25% target`,
        impact: `Missing ${missingReplies} replies based on volume`,
        action: 'Review sender email health, check spam placement, verify list quality'
      });
    }

    if (workspaceInterestedRate < 0.30 && totalContacted > 100) {
      const expectedInterested = Math.round(totalContacted * 0.003);
      const missingInterested = expectedInterested - totalInterested;
      issues.push({
        severity: 'MEDIUM',
        issue: `Interested rate ${workspaceInterestedRate.toFixed(2)}% is below 0.30% target`,
        impact: `Missing ${missingInterested} interested leads`,
        action: 'Review lead targeting criteria and ICP alignment'
      });
    }

    if (workspaceBounceRate >= 5) {
      issues.push({
        severity: 'CRITICAL',
        issue: `Bounce rate ${workspaceBounceRate.toFixed(2)}% exceeds 5% critical threshold`,
        impact: `${totalBounced} bounces damaging sender reputation`,
        action: 'URGENT: Pause campaigns, clean email list, replace high-bounce sender emails'
      });
    } else if (workspaceBounceRate >= 3) {
      issues.push({
        severity: 'MEDIUM',
        issue: `Bounce rate ${workspaceBounceRate.toFixed(2)}% is elevated (target <3%)`,
        impact: 'Sender reputation at risk',
        action: 'Monitor closely, review list quality'
      });
    }

    if (issues.length === 0) {
      console.log('\n✅ No significant issues detected - workspace is healthy!\n');
    } else {
      issues.sort((a, b) => {
        const severityOrder: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      });

      issues.forEach((issue, i) => {
        console.log(`\n${i + 1}. [${issue.severity}] ${issue.issue}`);
        console.log(`   Impact: ${issue.impact}`);
        console.log(`   Action: ${issue.action}`);
      });

      console.log('');
    }
  }

  console.log('\n' + '='.repeat(120));
  console.log('✅ ANALYSIS COMPLETE');
  console.log('='.repeat(120));
}

analyzeAllWorkspaces().catch(console.error);
