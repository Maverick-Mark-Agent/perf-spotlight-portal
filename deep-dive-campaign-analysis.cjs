#!/usr/bin/env node

/**
 * Deep dive analysis of January campaigns
 * Focus on sender emails, sequence content, and specific issues
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

async function deepDiveAnalysis() {
  console.log('🔬 DEEP DIVE ANALYSIS OF JANUARY CAMPAIGNS\n');
  console.log('='.repeat(120));

  // Get campaigns
  const campaigns = await bisonRequest('/campaigns?per_page=2000');
  const allCampaigns = campaigns.data || campaigns;

  const januaryCampaigns = allCampaigns.filter(c => {
    const name = c.name.toLowerCase();
    return name.includes('january') && !name.includes('december');
  });

  console.log(`Found ${januaryCampaigns.length} January campaigns\n`);

  for (const campaign of januaryCampaigns) {
    console.log('\n' + '='.repeat(120));
    console.log(`📊 CAMPAIGN: ${campaign.name}`);
    console.log('='.repeat(120));
    console.log(`ID: ${campaign.id}`);
    console.log(`Status: ${campaign.status}`);
    console.log(`Type: ${campaign.type}`);
    console.log(`Created: ${campaign.created_at}`);
    console.log(`Updated: ${campaign.updated_at}`);
    console.log(`\nOverall Stats:`);
    console.log(`   Total Leads: ${campaign.total_leads.toLocaleString()}`);
    console.log(`   Leads Contacted: ${campaign.total_leads_contacted.toLocaleString()}`);
    console.log(`   Emails Sent: ${campaign.emails_sent.toLocaleString()}`);
    console.log(`   Completion: ${campaign.completion_percentage}%`);
    console.log(`   Max Emails/Day: ${campaign.max_emails_per_day}`);
    console.log(`   Max New Leads/Day: ${campaign.max_new_leads_per_day}`);

    console.log(`\nPerformance Metrics:`);
    const replyRate = campaign.total_leads_contacted > 0
      ? ((campaign.unique_replies / campaign.total_leads_contacted) * 100).toFixed(2)
      : '0.00';
    const openRate = campaign.total_leads_contacted > 0
      ? ((campaign.unique_opens / campaign.total_leads_contacted) * 100).toFixed(2)
      : '0.00';
    const bounceRate = campaign.emails_sent > 0
      ? ((campaign.bounced / campaign.emails_sent) * 100).toFixed(2)
      : '0.00';

    console.log(`   Opens: ${campaign.opened} total, ${campaign.unique_opens} unique (${openRate}%)`);
    console.log(`   Replies: ${campaign.replied} total, ${campaign.unique_replies} unique (${replyRate}%)`);
    console.log(`   Bounced: ${campaign.bounced} (${bounceRate}%)`);
    console.log(`   Unsubscribed: ${campaign.unsubscribed}`);
    console.log(`   Interested: ${campaign.interested}`);

    // Get sender emails for this campaign
    console.log('\n📧 SENDER EMAILS:');
    console.log('-'.repeat(120));
    try {
      const senderResponse = await bisonRequest(`/campaigns/${campaign.id}/sender-emails`);
      const senderEmails = senderResponse.data || senderResponse;

      console.log(`Found ${senderEmails.length} sender emails\n`);

      if (senderEmails.length === 0) {
        console.log('⚠️  WARNING: No sender emails assigned to this campaign!');
      } else {
        // Sort by health (bounce rate and reply rate)
        senderEmails.forEach((sender, i) => {
          const senderReplyRate = sender.total_leads_contacted_count > 0
            ? ((sender.unique_replied_count / sender.total_leads_contacted_count) * 100).toFixed(2)
            : '0.00';
          const senderOpenRate = sender.total_leads_contacted_count > 0
            ? ((sender.unique_opened_count / sender.total_leads_contacted_count) * 100).toFixed(2)
            : '0.00';
          const senderBounceRate = sender.emails_sent_count > 0
            ? ((sender.bounced_count / sender.emails_sent_count) * 100).toFixed(2)
            : '0.00';

          const health = parseFloat(senderBounceRate) < 5 && parseFloat(senderReplyRate) > 1
            ? '✅ GOOD'
            : parseFloat(senderBounceRate) >= 10 || parseFloat(senderReplyRate) < 0.5
              ? '🔴 POOR'
              : '🟡 FAIR';

          console.log(`${i + 1}. ${sender.email} [${sender.status}] ${health}`);
          console.log(`   Sent: ${sender.emails_sent_count.toLocaleString()} | Contacted: ${sender.total_leads_contacted_count.toLocaleString()}`);
          console.log(`   Opens: ${senderOpenRate}% | Replies: ${senderReplyRate}% | Bounces: ${senderBounceRate}%`);
          console.log(`   Interested: ${sender.interested_leads_count} | Daily Limit: ${sender.daily_limit}`);

          if (sender.tags && sender.tags.length > 0) {
            console.log(`   Tags: ${sender.tags.map(t => t.name).join(', ')}`);
          }

          // Identify issues
          if (sender.status !== 'active') {
            console.log(`   ⚠️  ISSUE: Sender is ${sender.status}, not active`);
          }
          if (parseFloat(senderBounceRate) > 10) {
            console.log(`   🔴 CRITICAL: Very high bounce rate (${senderBounceRate}%) - may be burned`);
          } else if (parseFloat(senderBounceRate) > 5) {
            console.log(`   ⚠️  WARNING: High bounce rate (${senderBounceRate}%)`);
          }
          if (parseFloat(senderReplyRate) < 0.5 && sender.emails_sent_count > 100) {
            console.log(`   ⚠️  WARNING: Very low reply rate (${senderReplyRate}%)`);
          }
          if (sender.emails_sent_count === 0) {
            console.log(`   ℹ️  INFO: No emails sent yet from this sender`);
          }

          console.log('');
        });

        // Summary statistics
        const activeSenders = senderEmails.filter(s => s.status === 'active').length;
        const totalSent = senderEmails.reduce((sum, s) => sum + s.emails_sent_count, 0);
        const avgBounceRate = senderEmails.reduce((sum, s) => {
          return sum + (s.emails_sent_count > 0 ? (s.bounced_count / s.emails_sent_count) * 100 : 0);
        }, 0) / senderEmails.length;

        console.log('\nSender Email Summary:');
        console.log(`   Active Senders: ${activeSenders} / ${senderEmails.length}`);
        console.log(`   Total Emails from All Senders: ${totalSent.toLocaleString()}`);
        console.log(`   Average Bounce Rate: ${avgBounceRate.toFixed(2)}%`);
      }
    } catch (error) {
      console.error(`   Error fetching sender emails: ${error.message}`);
    }

    // Get sequence steps
    console.log('\n📝 SEQUENCE STEPS:');
    console.log('-'.repeat(120));
    try {
      const sequenceResponse = await bisonRequest(`/campaigns/${campaign.id}/sequence-steps`);
      const sequenceSteps = sequenceResponse.data || sequenceResponse;

      console.log(`Found ${sequenceSteps.length} sequence steps\n`);

      if (sequenceSteps.length === 0) {
        console.log('⚠️  WARNING: No sequence steps configured!');
      } else {
        sequenceSteps.forEach((step, i) => {
          console.log(`Step ${step.order || i + 1}: ${step.title || 'Untitled'}`);
          console.log(`   Subject: ${step.email_subject || 'N/A'}`);
          console.log(`   Wait Days: ${step.wait_in_days || 0}`);

          if (step.email_body) {
            const bodyLength = step.email_body.length;
            const hasPersonalization = step.email_body.includes('{{') || step.email_body.includes('{%');
            const hasLinks = step.email_body.includes('http') || step.email_body.includes('www.');

            console.log(`   Body Length: ${bodyLength} characters`);
            console.log(`   Personalization: ${hasPersonalization ? '✅ Yes' : '❌ No'}`);
            console.log(`   Links: ${hasLinks ? '✅ Yes' : '❌ No'}`);

            // Content quality checks
            if (bodyLength < 100) {
              console.log(`   ⚠️  WARNING: Very short email body (<100 chars)`);
            } else if (bodyLength < 200) {
              console.log(`   ℹ️  INFO: Short email body (<200 chars)`);
            }

            if (!hasPersonalization) {
              console.log(`   ℹ️  INFO: Consider adding personalization tokens`);
            }

            // Show first 200 characters
            console.log(`   Preview: ${step.email_body.substring(0, 200)}...`);
          } else {
            console.log(`   ⚠️  WARNING: No email body configured`);
          }

          console.log('');
        });
      }
    } catch (error) {
      console.error(`   Error fetching sequence steps: ${error.message}`);
    }

    // Diagnose main issues
    console.log('\n🔍 DIAGNOSIS:');
    console.log('-'.repeat(120));

    const issues = [];
    const recommendations = [];

    // Issue 1: No emails sent
    if (campaign.emails_sent === 0) {
      issues.push('Campaign has not sent any emails yet');
      recommendations.push('Check that campaign is started and sender emails are configured');
    }

    // Issue 2: Very low emails sent compared to leads
    if (campaign.emails_sent > 0 && campaign.emails_sent < campaign.total_leads * 0.1) {
      issues.push(`Only ${campaign.emails_sent} emails sent for ${campaign.total_leads} leads (${((campaign.emails_sent / campaign.total_leads) * 100).toFixed(1)}%)`);
      recommendations.push('Campaign may have just started or is sending very slowly');
    }

    // Issue 3: Zero open rate
    if (campaign.emails_sent > 100 && campaign.unique_opens === 0) {
      issues.push('CRITICAL: 0% open rate with significant emails sent');
      recommendations.push('Check open tracking configuration - tracking pixel may be missing or blocked');
      recommendations.push('Emails may be landing in spam - check sender reputation and inbox placement');
    }

    // Issue 4: Low reply rate
    const actualReplyRate = campaign.total_leads_contacted > 0
      ? (campaign.unique_replies / campaign.total_leads_contacted) * 100
      : 0;

    if (actualReplyRate < 1 && campaign.total_leads_contacted > 100) {
      issues.push(`Low reply rate: ${actualReplyRate.toFixed(2)}% (target >1%)`);
      recommendations.push('Review email copy quality and call-to-action');
      recommendations.push('Check targeting - ensure leads match ICP');
      recommendations.push('Compare with high-performing campaigns and test new variations');
    }

    // Issue 5: High bounce rate
    const actualBounceRate = campaign.emails_sent > 0
      ? (campaign.bounced / campaign.emails_sent) * 100
      : 0;

    if (actualBounceRate > 5) {
      issues.push(`High bounce rate: ${actualBounceRate.toFixed(2)}% (threshold <5%)`);
      recommendations.push('Verify email list quality - remove invalid emails');
      recommendations.push('Check sender email reputation and warming status');
      if (actualBounceRate > 10) {
        recommendations.push('URGENT: Pause campaign and investigate sender emails - may be burned');
      }
    }

    if (issues.length > 0) {
      console.log('❌ ISSUES FOUND:');
      issues.forEach((issue, i) => console.log(`   ${i + 1}. ${issue}`));
      console.log('\n💡 RECOMMENDATIONS:');
      recommendations.forEach((rec, i) => console.log(`   ${i + 1}. ${rec}`));
    } else {
      console.log('✅ No critical issues detected');
    }
  }

  // Compare January campaigns
  if (januaryCampaigns.length > 1) {
    console.log('\n\n' + '='.repeat(120));
    console.log('📊 JANUARY CAMPAIGNS COMPARISON');
    console.log('='.repeat(120));

    const comparison = januaryCampaigns.map(c => ({
      name: c.name,
      sent: c.emails_sent,
      leads: c.total_leads_contacted,
      replyRate: c.total_leads_contacted > 0
        ? ((c.unique_replies / c.total_leads_contacted) * 100).toFixed(2)
        : '0.00',
      bounceRate: c.emails_sent > 0
        ? ((c.bounced / c.emails_sent) * 100).toFixed(2)
        : '0.00',
      completion: c.completion_percentage,
    }));

    console.log('\nComparison Table:');
    console.log('-'.repeat(120));
    console.log(
      'Campaign'.padEnd(60) +
      'Sent'.padEnd(15) +
      'Contacted'.padEnd(15) +
      'Reply%'.padEnd(12) +
      'Bounce%'.padEnd(12) +
      'Complete%'
    );
    console.log('-'.repeat(120));

    comparison.forEach(c => {
      console.log(
        c.name.substring(0, 58).padEnd(60) +
        c.sent.toLocaleString().padEnd(15) +
        c.leads.toLocaleString().padEnd(15) +
        `${c.replyRate}%`.padEnd(12) +
        `${c.bounceRate}%`.padEnd(12) +
        `${c.completion}%`
      );
    });
  }

  // Save detailed report
  const fs = require('fs');
  const detailedReport = {
    timestamp: new Date().toISOString(),
    campaignsAnalyzed: januaryCampaigns.length,
    campaigns: januaryCampaigns.map(c => c.id),
  };

  fs.writeFileSync('january-campaigns-deep-dive.json', JSON.stringify(detailedReport, null, 2));
  console.log('\n\n✅ Detailed analysis saved to: january-campaigns-deep-dive.json');
}

deepDiveAnalysis().catch(console.error);
