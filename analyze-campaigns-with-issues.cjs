#!/usr/bin/env node

/**
 * Campaign-by-Campaign Analysis with Specific Issues
 * Since workspaces don't have separate campaigns, analyze each campaign individually
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

async function analyzeCampaignsWithIssues() {
  console.log('📊 CAMPAIGN-BY-CAMPAIGN DETAILED ANALYSIS\n');
  console.log('Benchmarks: Reply Rate ≥1.25% = GOOD | Interested Rate ≥0.30% = GOOD\n');
  console.log('='.repeat(120));

  // Get all campaigns
  const campaignsResponse = await bisonRequest('/campaigns?per_page=2000');
  const allCampaigns = campaignsResponse.data || campaignsResponse;

  console.log(`\n✅ Found ${allCampaigns.length} total campaigns\n`);

  // Sort by most recently updated
  allCampaigns.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

  // Analyze each campaign
  for (const campaign of allCampaigns) {
    console.log('\n' + '='.repeat(120));
    console.log(`📊 CAMPAIGN: ${campaign.name}`);
    console.log('='.repeat(120));

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
    const unsubscribeRate = campaign.emails_sent > 0
      ? (campaign.unsubscribed / campaign.emails_sent) * 100
      : 0;

    console.log(`\nCampaign ID: ${campaign.id}`);
    console.log(`Status: ${campaign.status} | Type: ${campaign.type}`);
    console.log(`Created: ${campaign.created_at}`);
    console.log(`Updated: ${campaign.updated_at}`);
    console.log(`Days Since Update: ${Math.floor((Date.now() - new Date(campaign.updated_at)) / (1000 * 60 * 60 * 24))}`);

    console.log(`\n📈 VOLUME METRICS:`);
    console.log(`   Total Leads: ${campaign.total_leads.toLocaleString()}`);
    console.log(`   Leads Contacted: ${campaign.total_leads_contacted.toLocaleString()}`);
    console.log(`   Emails Sent: ${campaign.emails_sent.toLocaleString()}`);
    console.log(`   Completion: ${campaign.completion_percentage}%`);
    console.log(`   Daily Limits: ${campaign.max_emails_per_day} emails/day, ${campaign.max_new_leads_per_day} new leads/day`);

    console.log(`\n📊 PERFORMANCE METRICS:`);
    const replyStatus = replyRate >= 1.25 ? '✅ GOOD' : replyRate >= 1.0 ? '🟡 FAIR' : '🔴 POOR';
    const interestedStatus = interestedRate >= 0.30 ? '✅ GOOD' : interestedRate >= 0.20 ? '🟡 FAIR' : '🔴 POOR';
    const bounceStatus = bounceRate < 3 ? '✅ GOOD' : bounceRate < 5 ? '🟡 ELEVATED' : '🔴 CRITICAL';

    console.log(`   Reply Rate: ${replyRate.toFixed(2)}% (${campaign.unique_replies} unique, ${campaign.replied} total) ${replyStatus}`);
    console.log(`   Interested Rate: ${interestedRate.toFixed(2)}% (${campaign.interested} interested) ${interestedStatus}`);
    console.log(`   Open Rate: ${openRate.toFixed(2)}% (${campaign.unique_opens} unique, ${campaign.opened} total)`);
    console.log(`   Bounce Rate: ${bounceRate.toFixed(2)}% (${campaign.bounced} bounced) ${bounceStatus}`);
    console.log(`   Unsubscribe Rate: ${unsubscribeRate.toFixed(2)}% (${campaign.unsubscribed} unsubscribed)`);

    // Get sender emails for this campaign
    console.log(`\n📧 SENDER EMAILS:`);
    let senderEmails = [];
    let damagedSenders = [];
    let highBounceSenders = [];
    let activeSenders = [];

    try {
      const senderResponse = await bisonRequest(`/campaigns/${campaign.id}/sender-emails`);
      senderEmails = senderResponse.data || senderResponse;

      if (senderEmails.length === 0) {
        console.log(`   ⚠️  No sender emails assigned to this campaign`);
      } else {
        console.log(`   Total Assigned: ${senderEmails.length}`);

        // Analyze sender health
        activeSenders = senderEmails.filter(s => s.status === 'active' || s.status === 'Active');
        damagedSenders = senderEmails.filter(s => s.tags && s.tags.some(t => t.name.toLowerCase().includes('damaged')));
        highBounceSenders = senderEmails.filter(s => {
          const br = s.emails_sent_count > 0 ? (s.bounced_count / s.emails_sent_count) * 100 : 0;
          return br >= 5 && s.emails_sent_count > 50;
        });

        console.log(`   Active Status: ${activeSenders.length}/${senderEmails.length}`);
        console.log(`   Tagged "Damaged": ${damagedSenders.length}`);
        console.log(`   High Bounce (≥5%): ${highBounceSenders.length}`);

        // Calculate average sender metrics
        const sendersWithActivity = senderEmails.filter(s => s.emails_sent_count > 0);
        if (sendersWithActivity.length > 0) {
          const avgBounce = sendersWithActivity.reduce((sum, s) => {
            return sum + (s.emails_sent_count > 0 ? (s.bounced_count / s.emails_sent_count) * 100 : 0);
          }, 0) / sendersWithActivity.length;

          const avgReply = sendersWithActivity.reduce((sum, s) => {
            return sum + (s.total_leads_contacted_count > 0 ? (s.unique_replied_count / s.total_leads_contacted_count) * 100 : 0);
          }, 0) / sendersWithActivity.length;

          console.log(`   Avg Sender Bounce: ${avgBounce.toFixed(2)}%`);
          console.log(`   Avg Sender Reply: ${avgReply.toFixed(2)}%`);
        }
      }
    } catch (error) {
      console.log(`   Error fetching sender emails: ${error.message}`);
    }

    // Get sequence steps
    console.log(`\n📝 SEQUENCE:`);
    let sequenceSteps = [];
    try {
      const sequenceResponse = await bisonRequest(`/campaigns/${campaign.id}/sequence-steps`);
      sequenceSteps = sequenceResponse.data || sequenceResponse;

      if (sequenceSteps.length === 0) {
        console.log(`   ⚠️  No sequence steps configured`);
      } else {
        console.log(`   Total Steps: ${sequenceSteps.length}`);

        const stepsWithPersonalization = sequenceSteps.filter(s =>
          s.email_body && (s.email_body.includes('{{') || s.email_body.includes('{%'))
        ).length;

        const shortSteps = sequenceSteps.filter(s =>
          s.email_body && s.email_body.length < 200
        ).length;

        const stepsWithLinks = sequenceSteps.filter(s =>
          s.email_body && (s.email_body.includes('http') || s.email_body.includes('www.'))
        ).length;

        console.log(`   With Personalization: ${stepsWithPersonalization}/${sequenceSteps.length}`);
        console.log(`   With Links: ${stepsWithLinks}/${sequenceSteps.length}`);
        console.log(`   Short (<200 chars): ${shortSteps}`);
      }
    } catch (error) {
      console.log(`   Error fetching sequence: ${error.message}`);
    }

    // IDENTIFY SPECIFIC ISSUES
    console.log(`\n⚠️  SPECIFIC ISSUES:`);
    console.log('-'.repeat(120));

    const issues = [];

    // Issue 1: Campaign not started or barely sending
    if (campaign.emails_sent === 0 && campaign.status === 'active') {
      issues.push({
        severity: 'CRITICAL',
        issue: 'Campaign is active but has not sent any emails',
        root_cause: senderEmails.length === 0
          ? 'No sender emails assigned'
          : sequenceSteps.length === 0
            ? 'No sequence steps configured'
            : 'Unknown - check campaign settings',
        action: senderEmails.length === 0
          ? 'Assign sender emails to this campaign'
          : sequenceSteps.length === 0
            ? 'Create sequence steps'
            : 'Check campaign status and daily limits'
      });
    } else if (campaign.emails_sent > 0 && campaign.emails_sent < campaign.total_leads * 0.05 && campaign.status === 'active') {
      issues.push({
        severity: 'HIGH',
        issue: `Only ${campaign.emails_sent} emails sent for ${campaign.total_leads} leads (<5%)`,
        root_cause: `Sending extremely slowly - at current pace will take ${Math.ceil(campaign.total_leads / (campaign.emails_sent / Math.max(1, (Date.now() - new Date(campaign.created_at)) / (1000 * 60 * 60 * 24))))} days`,
        action: 'Check daily sending limits, verify sender emails are active, check for errors in campaign logs'
      });
    }

    // Issue 2: Reply rate below target
    if (replyRate < 1.25 && campaign.total_leads_contacted > 100) {
      const expectedReplies = Math.round(campaign.total_leads_contacted * 0.0125);
      const missingReplies = expectedReplies - campaign.unique_replies;

      issues.push({
        severity: replyRate < 0.8 ? 'CRITICAL' : 'HIGH',
        issue: `Reply rate ${replyRate.toFixed(2)}% is below 1.25% target`,
        root_cause: bounceRate >= 5
          ? 'High bounce rate suggests deliverability issues - emails likely going to spam'
          : openRate === 0
            ? 'Zero open rate suggests tracking issue OR emails in spam'
            : damagedSenders.length > senderEmails.length / 2
              ? 'More than half of sender emails are tagged as "Damaged"'
              : 'Likely targeting or sender reputation issues',
        action: bounceRate >= 5
          ? 'URGENT: Remove high-bounce sender emails, verify list quality'
          : openRate === 0
            ? 'Test deliverability - check spam placement and open tracking'
            : `Missing ${missingReplies} replies - review sender email health and list targeting`
      });
    }

    // Issue 3: Interested rate below target
    if (interestedRate < 0.30 && campaign.total_leads_contacted > 100) {
      const expectedInterested = Math.round(campaign.total_leads_contacted * 0.003);
      const missingInterested = expectedInterested - campaign.interested;

      issues.push({
        severity: interestedRate < 0.15 ? 'HIGH' : 'MEDIUM',
        issue: `Interested rate ${interestedRate.toFixed(2)}% is below 0.30% target`,
        root_cause: replyRate < 1.0
          ? 'Low overall engagement - reply rate also below target'
          : 'Getting replies but they are not marked as interested',
        action: replyRate < 1.0
          ? 'Fix reply rate issues first (deliverability/targeting)'
          : `Missing ${missingInterested} interested - review lead qualification criteria or manual reply review process`
      });
    }

    // Issue 4: Bounce rate issues
    if (bounceRate >= 5 && campaign.emails_sent > 100) {
      issues.push({
        severity: 'CRITICAL',
        issue: `Bounce rate ${bounceRate.toFixed(2)}% exceeds 5% critical threshold`,
        root_cause: highBounceSenders.length > 0
          ? `${highBounceSenders.length} sender email(s) have ≥5% bounce rate`
          : 'Email list quality is poor - many invalid emails',
        action: highBounceSenders.length > 0
          ? `URGENT: Remove these senders: ${highBounceSenders.map(s => s.email).slice(0, 3).join(', ')}`
          : 'URGENT: Pause campaign, clean/verify email list, replace sender emails'
      });
    } else if (bounceRate >= 3 && campaign.emails_sent > 100) {
      issues.push({
        severity: 'MEDIUM',
        issue: `Bounce rate ${bounceRate.toFixed(2)}% is elevated (target <3%)`,
        root_cause: 'Email list may need cleaning OR sender warmup incomplete',
        action: 'Monitor closely - if it reaches 5%, pause immediately. Review list quality.'
      });
    }

    // Issue 5: Zero open rate with significant volume
    if (openRate === 0 && campaign.emails_sent > 100) {
      issues.push({
        severity: 'CRITICAL',
        issue: `0% open rate with ${campaign.emails_sent.toLocaleString()} emails sent`,
        root_cause: bounceRate > 5
          ? 'High bounce rate suggests emails going to spam/invalid addresses'
          : 'Either open tracking is broken OR all emails landing in spam',
        action: 'TEST IMMEDIATELY: Send test emails to your inbox and check spam folder. Verify open tracking pixel is enabled.'
      });
    }

    // Issue 6: Damaged sender emails
    if (damagedSenders.length > 0) {
      issues.push({
        severity: 'HIGH',
        issue: `${damagedSenders.length} sender email(s) tagged as "Damaged"`,
        root_cause: 'These accounts have poor historical performance (high bounce/spam)',
        action: `Remove these senders: ${damagedSenders.map(s => s.email).slice(0, 3).join(', ')}${damagedSenders.length > 3 ? ` and ${damagedSenders.length - 3} more` : ''}`
      });
    }

    // Issue 7: Sender status issues
    const inactiveSenders = senderEmails.filter(s => s.status !== 'active' && s.status !== 'Active');
    if (inactiveSenders.length > 0 && campaign.status === 'active') {
      issues.push({
        severity: 'HIGH',
        issue: `${inactiveSenders.length}/${senderEmails.length} sender emails not in "Active" status`,
        root_cause: `Senders show as: ${[...new Set(inactiveSenders.map(s => s.status))].join(', ')}`,
        action: 'Re-authenticate sender emails or check Email Bison for connection issues'
      });
    }

    // Issue 8: No sequence steps
    if (sequenceSteps.length === 0 && campaign.status === 'active') {
      issues.push({
        severity: 'CRITICAL',
        issue: 'Campaign has no sequence steps configured',
        root_cause: 'Cannot send emails without a sequence',
        action: 'Create email sequence steps immediately'
      });
    }

    // Issue 9: Campaign is stale
    const daysSinceUpdate = (Date.now() - new Date(campaign.updated_at)) / (1000 * 60 * 60 * 24);
    if (daysSinceUpdate > 30 && campaign.status === 'active') {
      issues.push({
        severity: 'MEDIUM',
        issue: `Campaign not updated in ${Math.floor(daysSinceUpdate)} days`,
        root_cause: 'May have completed or been abandoned',
        action: 'Archive if no longer needed, or review why it stopped updating'
      });
    }

    // Issue 10: Low sender email count for volume
    if (senderEmails.length < 5 && campaign.total_leads > 1000 && campaign.status === 'active') {
      issues.push({
        severity: 'MEDIUM',
        issue: `Only ${senderEmails.length} sender emails for ${campaign.total_leads.toLocaleString()} leads`,
        root_cause: 'May need more sender capacity to scale safely',
        action: `Consider adding ${Math.min(10 - senderEmails.length, Math.ceil(campaign.total_leads / 500))} more warmed sender emails`
      });
    }

    // Display issues
    if (issues.length === 0) {
      console.log('\n✅ No significant issues detected!\n');
    } else {
      // Sort by severity
      issues.sort((a, b) => {
        const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      });

      issues.forEach((issue, i) => {
        console.log(`\n${i + 1}. [${issue.severity}] ${issue.issue}`);
        console.log(`   Root Cause: ${issue.root_cause}`);
        console.log(`   Action Required: ${issue.action}`);
      });

      console.log('');
    }

    // Performance Summary
    const performanceScore = (
      (replyRate >= 1.25 ? 25 : (replyRate / 1.25) * 25) +
      (interestedRate >= 0.30 ? 25 : (interestedRate / 0.30) * 25) +
      (bounceRate <= 3 ? 25 : Math.max(0, 25 - (bounceRate - 3) * 5)) +
      (campaign.completion_percentage >= 50 ? 25 : (campaign.completion_percentage / 50) * 25)
    );

    console.log(`\n📊 OVERALL PERFORMANCE SCORE: ${performanceScore.toFixed(0)}/100`);

    if (performanceScore >= 75) {
      console.log(`   ✅ HEALTHY - Campaign is performing well`);
    } else if (performanceScore >= 50) {
      console.log(`   🟡 NEEDS ATTENTION - Several issues to address`);
    } else {
      console.log(`   🔴 CRITICAL - Immediate action required`);
    }
  }

  // Save report
  const fs = require('fs');
  const report = {
    timestamp: new Date().toISOString(),
    totalCampaigns: allCampaigns.length,
    benchmarks: {
      replyRate: '≥1.25%',
      interestedRate: '≥0.30%',
      bounceRate: '<3% good, <5% acceptable'
    }
  };

  fs.writeFileSync('campaign-issues-report.json', JSON.stringify(report, null, 2));
  console.log('\n\n✅ Detailed report saved to: campaign-issues-report.json\n');
}

analyzeCampaignsWithIssues().catch(console.error);
