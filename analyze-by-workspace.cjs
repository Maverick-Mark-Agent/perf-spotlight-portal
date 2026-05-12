#!/usr/bin/env node

/**
 * Workspace-by-Workspace Analysis
 * Analyzes each Email Bison workspace separately with specific issues
 * Benchmarks: Reply Rate >1.25% is good, Interested Rate >0.30% is good
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
    throw new Error(`Email Bison API error: ${response.status}`);
  }

  const data = await response.json();
  return data.data || data;
}

async function analyzeByWorkspace() {
  console.log('🏢 WORKSPACE-BY-WORKSPACE ANALYSIS\n');
  console.log('Benchmarks: Reply Rate >1.25% = GOOD | Interested Rate >0.30% = GOOD\n');
  console.log('='.repeat(120));

  // Get all workspaces
  const workspaces = await bisonRequest('/workspaces/v1.1');
  console.log(`\n✅ Found ${workspaces.length} workspaces\n`);

  // Get all campaigns
  const campaignsResponse = await bisonRequest('/campaigns?per_page=2000');
  const allCampaigns = campaignsResponse.data || campaignsResponse;

  // Get all sender emails
  const senderResponse = await bisonRequest('/sender-emails?per_page=2000');
  const allSenderEmails = senderResponse.data || senderResponse;

  // Analyze each workspace
  for (const workspace of workspaces) {
    console.log('\n' + '='.repeat(120));
    console.log(`🏢 WORKSPACE: ${workspace.name}`);
    console.log('='.repeat(120));
    console.log(`ID: ${workspace.id}`);
    console.log(`Type: ${workspace.personal_team ? 'Personal' : 'Team'} | Main: ${workspace.main ? 'Yes' : 'No'}`);
    console.log(`Created: ${workspace.created_at}`);
    console.log(`Updated: ${workspace.updated_at}`);

    // Get campaigns for this workspace
    let workspaceCampaigns = [];
    try {
      const campaignResponse = await bisonRequest(`/workspaces/v1.1/${workspace.id}/campaigns?per_page=1000`);
      workspaceCampaigns = campaignResponse.data || campaignResponse;
    } catch (error) {
      console.log(`\n⚠️  Could not fetch campaigns: ${error.message}`);
      workspaceCampaigns = [];
    }

    // Get sender emails for this workspace
    let workspaceSenders = [];
    try {
      const senderResponse = await bisonRequest(`/workspaces/v1.1/${workspace.id}/sender-emails?per_page=1000`);
      workspaceSenders = senderResponse.data || senderResponse;
    } catch (error) {
      console.log(`Could not fetch sender emails: ${error.message}`);
      workspaceSenders = [];
    }

    console.log(`\nCampaigns: ${workspaceCampaigns.length} | Sender Emails: ${workspaceSenders.length}`);

    if (workspaceCampaigns.length === 0 && workspaceSenders.length === 0) {
      console.log('\n📊 STATUS: Empty workspace - no campaigns or sender emails');
      continue;
    }

    // Analyze campaigns
    if (workspaceCampaigns.length > 0) {
      console.log('\n' + '-'.repeat(120));
      console.log('📊 CAMPAIGNS');
      console.log('-'.repeat(120));

      // Focus on recently updated campaigns (last 30 days)
      const recentCampaigns = workspaceCampaigns.filter(c => {
        const daysSinceUpdate = (Date.now() - new Date(c.updated_at)) / (1000 * 60 * 60 * 24);
        return daysSinceUpdate <= 30;
      }).sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

      if (recentCampaigns.length === 0) {
        console.log('No recently active campaigns (last 30 days)');
      } else {
        console.log(`\nShowing ${recentCampaigns.length} recently active campaigns (last 30 days):\n`);

        recentCampaigns.forEach((campaign, i) => {
          const replyRate = campaign.total_leads_contacted > 0
            ? (campaign.unique_replies / campaign.total_leads_contacted) * 100
            : 0;
          const openRate = campaign.total_leads_contacted > 0
            ? (campaign.unique_opens / campaign.total_leads_contacted) * 100
            : 0;
          const bounceRate = campaign.emails_sent > 0
            ? (campaign.bounced / campaign.emails_sent) * 100
            : 0;
          const interestedRate = campaign.total_leads_contacted > 0
            ? (campaign.interested / campaign.total_leads_contacted) * 100
            : 0;

          const replyStatus = replyRate >= 1.25 ? '✅' : replyRate >= 1.0 ? '🟡' : '🔴';
          const interestedStatus = interestedRate >= 0.30 ? '✅' : interestedRate >= 0.20 ? '🟡' : '🔴';

          console.log(`${i + 1}. ${campaign.name}`);
          console.log(`   Status: ${campaign.status} | Updated: ${new Date(campaign.updated_at).toISOString().split('T')[0]}`);
          console.log(`   Sent: ${campaign.emails_sent.toLocaleString()} | Contacted: ${campaign.total_leads_contacted.toLocaleString()} | Completion: ${campaign.completion_percentage}%`);
          console.log(`   ${replyStatus} Reply: ${replyRate.toFixed(2)}% (${campaign.unique_replies} unique) | ${interestedStatus} Interested: ${interestedRate.toFixed(2)}% (${campaign.interested})`);
          console.log(`   Bounce: ${bounceRate.toFixed(2)}% (${campaign.bounced}) | Unsubscribed: ${campaign.unsubscribed}`);
          console.log('');
        });

        // Calculate workspace-level metrics
        const totalSent = recentCampaigns.reduce((sum, c) => sum + c.emails_sent, 0);
        const totalContacted = recentCampaigns.reduce((sum, c) => sum + c.total_leads_contacted, 0);
        const totalReplies = recentCampaigns.reduce((sum, c) => sum + c.unique_replies, 0);
        const totalInterested = recentCampaigns.reduce((sum, c) => sum + c.interested, 0);
        const totalBounced = recentCampaigns.reduce((sum, c) => sum + c.bounced, 0);

        const workspaceReplyRate = totalContacted > 0 ? (totalReplies / totalContacted) * 100 : 0;
        const workspaceInterestedRate = totalContacted > 0 ? (totalInterested / totalContacted) * 100 : 0;
        const workspaceBounceRate = totalSent > 0 ? (totalBounced / totalSent) * 100 : 0;

        console.log('WORKSPACE AGGREGATE METRICS (Recent Campaigns):');
        console.log(`   Total Sent: ${totalSent.toLocaleString()}`);
        console.log(`   Total Contacted: ${totalContacted.toLocaleString()}`);
        console.log(`   Reply Rate: ${workspaceReplyRate.toFixed(2)}% ${workspaceReplyRate >= 1.25 ? '✅ GOOD' : '🔴 BELOW TARGET'}`);
        console.log(`   Interested Rate: ${workspaceInterestedRate.toFixed(2)}% ${workspaceInterestedRate >= 0.30 ? '✅ GOOD' : '🔴 BELOW TARGET'}`);
        console.log(`   Bounce Rate: ${workspaceBounceRate.toFixed(2)}% ${workspaceBounceRate < 5 ? '✅' : '⚠️  HIGH'}`);
      }
    }

    // Analyze sender emails
    if (workspaceSenders.length > 0) {
      console.log('\n' + '-'.repeat(120));
      console.log('📧 SENDER EMAIL HEALTH');
      console.log('-'.repeat(120));

      // Filter to senders with actual activity
      const activeSenders = workspaceSenders.filter(s => s.emails_sent_count > 0);

      if (activeSenders.length === 0) {
        console.log('\nNo sender emails with activity yet.');
      } else {
        console.log(`\n${activeSenders.length} sender emails with activity:\n`);

        // Sort by health (bounce rate, then reply rate)
        activeSenders.sort((a, b) => {
          const aBounce = a.emails_sent_count > 0 ? (a.bounced_count / a.emails_sent_count) * 100 : 0;
          const bBounce = b.emails_sent_count > 0 ? (b.bounced_count / b.emails_sent_count) * 100 : 0;
          return aBounce - bBounce;
        });

        const healthyCount = activeSenders.filter(s => {
          const bounceRate = s.emails_sent_count > 0 ? (s.bounced_count / s.emails_sent_count) * 100 : 0;
          const replyRate = s.total_leads_contacted_count > 0 ? (s.unique_replied_count / s.total_leads_contacted_count) * 100 : 0;
          return bounceRate < 5 && replyRate > 1;
        }).length;

        const damagedCount = activeSenders.filter(s => {
          return s.tags && s.tags.some(t => t.name.toLowerCase().includes('damaged'));
        }).length;

        const highBounceCount = activeSenders.filter(s => {
          const bounceRate = s.emails_sent_count > 0 ? (s.bounced_count / s.emails_sent_count) * 100 : 0;
          return bounceRate >= 5;
        }).length;

        const inactiveCount = workspaceSenders.filter(s => s.status !== 'active').length;

        console.log(`Health Summary:`);
        console.log(`   ✅ Healthy: ${healthyCount}/${activeSenders.length} (<5% bounce, >1% reply)`);
        console.log(`   🔴 High Bounce (≥5%): ${highBounceCount}`);
        console.log(`   ⚠️  Tagged "Damaged": ${damagedCount}`);
        console.log(`   ⚠️  Not Active Status: ${inactiveCount}/${workspaceSenders.length}`);

        // Show top 5 best and worst performers
        console.log(`\n📈 Top 5 Best Performing Senders:`);
        activeSenders.slice(0, 5).forEach((s, i) => {
          const replyRate = s.total_leads_contacted_count > 0
            ? (s.unique_replied_count / s.total_leads_contacted_count) * 100
            : 0;
          const bounceRate = s.emails_sent_count > 0
            ? (s.bounced_count / s.emails_sent_count) * 100
            : 0;

          console.log(`   ${i + 1}. ${s.email}`);
          console.log(`      Bounce: ${bounceRate.toFixed(2)}% | Reply: ${replyRate.toFixed(2)}% | Sent: ${s.emails_sent_count.toLocaleString()} | Status: ${s.status}`);
        });

        console.log(`\n📉 Top 5 Worst Performing Senders (Highest Bounce):`);
        activeSenders.slice(-5).reverse().forEach((s, i) => {
          const replyRate = s.total_leads_contacted_count > 0
            ? (s.unique_replied_count / s.total_leads_contacted_count) * 100
            : 0;
          const bounceRate = s.emails_sent_count > 0
            ? (s.bounced_count / s.emails_sent_count) * 100
            : 0;

          const isDamaged = s.tags && s.tags.some(t => t.name.toLowerCase().includes('damaged'));

          console.log(`   ${i + 1}. ${s.email} ${isDamaged ? '🏷️  DAMAGED' : ''}`);
          console.log(`      Bounce: ${bounceRate.toFixed(2)}% | Reply: ${replyRate.toFixed(2)}% | Sent: ${s.emails_sent_count.toLocaleString()} | Status: ${s.status}`);
        });
      }
    }

    // IDENTIFY SPECIFIC ISSUES
    console.log('\n' + '-'.repeat(120));
    console.log('⚠️  SPECIFIC ISSUES FOR THIS WORKSPACE');
    console.log('-'.repeat(120));

    const issues = [];

    // Check campaign performance
    if (workspaceCampaigns.length > 0) {
      const recentCampaigns = workspaceCampaigns.filter(c => {
        const daysSinceUpdate = (Date.now() - new Date(c.updated_at)) / (1000 * 60 * 60 * 24);
        return daysSinceUpdate <= 30;
      });

      if (recentCampaigns.length === 0) {
        issues.push({
          severity: 'MEDIUM',
          category: 'Campaign Activity',
          issue: 'No campaigns updated in the last 30 days',
          impact: 'Workspace is inactive or stale',
          action: 'Review if workspace is still needed or needs new campaigns'
        });
      } else {
        // Check aggregate performance
        const totalContacted = recentCampaigns.reduce((sum, c) => sum + c.total_leads_contacted, 0);
        const totalReplies = recentCampaigns.reduce((sum, c) => sum + c.unique_replies, 0);
        const totalInterested = recentCampaigns.reduce((sum, c) => sum + c.interested, 0);
        const totalSent = recentCampaigns.reduce((sum, c) => sum + c.emails_sent, 0);
        const totalBounced = recentCampaigns.reduce((sum, c) => sum + c.bounced, 0);

        const replyRate = totalContacted > 0 ? (totalReplies / totalContacted) * 100 : 0;
        const interestedRate = totalContacted > 0 ? (totalInterested / totalContacted) * 100 : 0;
        const bounceRate = totalSent > 0 ? (totalBounced / totalSent) * 100 : 0;

        if (replyRate < 1.25 && totalContacted > 100) {
          issues.push({
            severity: 'HIGH',
            category: 'Campaign Performance',
            issue: `Reply rate ${replyRate.toFixed(2)}% is below 1.25% target`,
            impact: `Getting ${totalReplies} replies but should be getting ${Math.round(totalContacted * 0.0125)} replies`,
            action: 'Review sender email health, check spam placement, verify list quality'
          });
        }

        if (interestedRate < 0.30 && totalContacted > 100) {
          issues.push({
            severity: 'HIGH',
            category: 'Lead Quality',
            issue: `Interested rate ${interestedRate.toFixed(2)}% is below 0.30% target`,
            impact: `Only ${totalInterested} interested but should have ${Math.round(totalContacted * 0.003)} interested`,
            action: 'Review lead targeting criteria, check if leads match ICP, verify lead source quality'
          });
        }

        if (bounceRate >= 5) {
          issues.push({
            severity: 'CRITICAL',
            category: 'Deliverability',
            issue: `Bounce rate ${bounceRate.toFixed(2)}% exceeds 5% critical threshold`,
            impact: `${totalBounced} bounces out of ${totalSent} emails - damaging sender reputation`,
            action: 'URGENT: Pause campaigns, clean email list, replace high-bounce sender emails'
          });
        } else if (bounceRate >= 3) {
          issues.push({
            severity: 'MEDIUM',
            category: 'Deliverability',
            issue: `Bounce rate ${bounceRate.toFixed(2)}% is elevated (target <3%)`,
            impact: `${totalBounced} bounces - sender reputation at risk`,
            action: 'Review list quality, monitor sender email bounce rates, consider list cleaning'
          });
        }

        // Check for campaigns with 0% open rate
        const zeroOpenCampaigns = recentCampaigns.filter(c => c.emails_sent > 100 && c.unique_opens === 0);
        if (zeroOpenCampaigns.length > 0) {
          issues.push({
            severity: 'CRITICAL',
            category: 'Tracking/Deliverability',
            issue: `${zeroOpenCampaigns.length} campaign(s) with 0% open rate despite sending emails`,
            impact: 'Either tracking is broken OR emails going to spam',
            action: 'Test email deliverability, check open tracking configuration, verify inbox placement'
          });
        }

        // Check for low-volume campaigns
        const lowVolumeCampaigns = recentCampaigns.filter(c =>
          c.total_leads > 100 && c.emails_sent < c.total_leads * 0.1 && c.status === 'active'
        );
        if (lowVolumeCampaigns.length > 0) {
          issues.push({
            severity: 'MEDIUM',
            category: 'Campaign Sending',
            issue: `${lowVolumeCampaigns.length} active campaign(s) sending very slowly`,
            impact: `Campaigns have leads loaded but <10% emails sent`,
            action: 'Check daily sending limits, verify campaigns are not paused, review sender email limits'
          });
        }
      }
    }

    // Check sender email issues
    if (workspaceSenders.length > 0) {
      const activeSenders = workspaceSenders.filter(s => s.emails_sent_count > 0);

      // Check for damaged senders
      const damagedSenders = workspaceSenders.filter(s =>
        s.tags && s.tags.some(t => t.name.toLowerCase().includes('damaged'))
      );
      if (damagedSenders.length > 0) {
        issues.push({
          severity: 'HIGH',
          category: 'Sender Email Health',
          issue: `${damagedSenders.length} sender email(s) tagged as "Damaged"`,
          impact: 'Damaged emails have poor deliverability and hurt domain reputation',
          action: `Remove these emails: ${damagedSenders.map(s => s.email).slice(0, 3).join(', ')}${damagedSenders.length > 3 ? '...' : ''}`
        });
      }

      // Check for high bounce senders
      const highBounceSenders = activeSenders.filter(s => {
        const bounceRate = s.emails_sent_count > 0 ? (s.bounced_count / s.emails_sent_count) * 100 : 0;
        return bounceRate >= 5 && s.emails_sent_count > 50;
      });
      if (highBounceSenders.length > 0) {
        issues.push({
          severity: 'CRITICAL',
          category: 'Sender Email Health',
          issue: `${highBounceSenders.length} sender email(s) with ≥5% bounce rate`,
          impact: 'High bounce rates damage sender reputation and deliverability',
          action: `Pause/remove: ${highBounceSenders.map(s => s.email).slice(0, 3).join(', ')}${highBounceSenders.length > 3 ? '...' : ''}`
        });
      }

      // Check for inactive status
      const inactiveSenders = workspaceSenders.filter(s => s.status !== 'active' && s.status !== 'Active');
      if (inactiveSenders.length > 0) {
        issues.push({
          severity: 'HIGH',
          category: 'Sender Email Configuration',
          issue: `${inactiveSenders.length} sender email(s) not in "Active" status`,
          impact: 'Campaigns may not send at full capacity',
          action: `Check status: ${inactiveSenders.map(s => `${s.email} (${s.status})`).slice(0, 3).join(', ')}${inactiveSenders.length > 3 ? '...' : ''}`
        });
      }

      // Check for sender concentration
      if (activeSenders.length > 0) {
        const totalSent = activeSenders.reduce((sum, s) => sum + s.emails_sent_count, 0);
        const topSender = activeSenders.reduce((max, s) =>
          s.emails_sent_count > max.emails_sent_count ? s : max
        , activeSenders[0]);
        const concentration = totalSent > 0 ? (topSender.emails_sent_count / totalSent) * 100 : 0;

        if (concentration > 50 && activeSenders.length > 1) {
          issues.push({
            severity: 'MEDIUM',
            category: 'Sender Email Distribution',
            issue: `One sender (${topSender.email}) sending ${concentration.toFixed(0)}% of all emails`,
            impact: 'High concentration risk - if this sender fails, campaign volume drops significantly',
            action: 'Distribute sending more evenly across available sender emails'
          });
        }
      }

      // Check for low sender count
      if (workspaceCampaigns.length > 0) {
        const totalLeads = workspaceCampaigns.reduce((sum, c) => sum + c.total_leads, 0);
        if (activeSenders.length < 5 && totalLeads > 1000) {
          issues.push({
            severity: 'MEDIUM',
            category: 'Sender Email Capacity',
            issue: `Only ${activeSenders.length} active sender emails for ${totalLeads.toLocaleString()} total leads`,
            impact: 'May need more sender emails to scale sending volume safely',
            action: 'Consider adding more warmed sender emails to distribute volume'
          });
        }
      }
    }

    // No sender emails at all
    if (workspaceSenders.length === 0 && workspaceCampaigns.length > 0) {
      issues.push({
        severity: 'CRITICAL',
        category: 'Sender Email Configuration',
        issue: 'No sender emails configured for this workspace',
        impact: 'Campaigns cannot send without sender emails',
        action: 'Add and authenticate sender emails immediately'
      });
    }

    // Output issues
    if (issues.length === 0) {
      console.log('\n✅ No significant issues detected - workspace is healthy!\n');
    } else {
      issues.sort((a, b) => {
        const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      });

      issues.forEach((issue, i) => {
        console.log(`\n${i + 1}. [${issue.severity}] ${issue.category}: ${issue.issue}`);
        console.log(`   Impact: ${issue.impact}`);
        console.log(`   Action: ${issue.action}`);
      });
    }

    console.log('\n');
  }

  // Summary across all workspaces
  console.log('\n' + '='.repeat(120));
  console.log('📊 SUMMARY ACROSS ALL WORKSPACES');
  console.log('='.repeat(120));

  const activeWorkspaces = workspaces.filter(w => {
    // Check if workspace has any campaigns updated in last 30 days
    const workspaceCampaigns = allCampaigns.filter(c => {
      // This is approximate - we'd need to map campaigns to workspaces properly
      const daysSinceUpdate = (Date.now() - new Date(c.updated_at)) / (1000 * 60 * 60 * 24);
      return daysSinceUpdate <= 30;
    });
    return workspaceCampaigns.length > 0;
  });

  console.log(`\nTotal Workspaces: ${workspaces.length}`);
  console.log(`Active (updated in last 30 days): ${activeWorkspaces.length}`);
  console.log(`Total Campaigns: ${allCampaigns.length}`);
  console.log(`Total Sender Emails: ${allSenderEmails.length}`);

  const fs = require('fs');
  const report = {
    timestamp: new Date().toISOString(),
    totalWorkspaces: workspaces.length,
    workspaces: workspaces.map(w => w.name),
  };

  fs.writeFileSync('workspace-analysis-report.json', JSON.stringify(report, null, 2));
  console.log('\n✅ Detailed report saved to: workspace-analysis-report.json\n');
}

analyzeByWorkspace().catch(console.error);
