#!/usr/bin/env node

/**
 * Campaign Performance Analysis Script
 *
 * This script analyzes Email Bison campaign performance by:
 * 1. Fetching all campaigns and filtering for recent ones (January/February/March Renewals)
 * 2. Categorizing campaigns as high-performing vs low-performing
 * 3. Analyzing email account health for each campaign
 * 4. Reviewing sequence content and comparing differences
 * 5. Generating a comprehensive analysis report
 */

const BISON_API_BASE_URL = 'https://send.maverickmarketingllc.com/api';
const BISON_API_KEY = '101|6mXfEtJkLDF99HcmvOqlJcjlYaDyt9pGt9c6C7qJ56e6298b';

// Helper function to make API requests
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

// Fetch all campaigns
async function getAllCampaigns() {
  console.log('📊 Fetching all campaigns...\n');
  const campaigns = await bisonRequest('/campaigns?per_page=2000');
  return campaigns.data || campaigns;
}

// Fetch campaign details including sequence steps
async function getCampaignDetails(campaignId) {
  try {
    const details = await bisonRequest(`/campaigns/${campaignId}`);
    return details;
  } catch (error) {
    console.error(`Failed to fetch campaign details for ID ${campaignId}:`, error.message);
    return null;
  }
}

// Fetch sequence steps for a campaign
async function getSequenceSteps(campaignId) {
  try {
    const response = await bisonRequest(`/campaigns/${campaignId}/sequence-steps`);
    return response.data || response;
  } catch (error) {
    console.error(`Failed to fetch sequence steps for campaign ID ${campaignId}:`, error.message);
    return [];
  }
}

// Fetch sender emails for a campaign
async function getCampaignSenderEmails(campaignId) {
  try {
    const response = await bisonRequest(`/campaigns/${campaignId}/sender-emails`);
    return response.data || response;
  } catch (error) {
    console.error(`Failed to fetch sender emails for campaign ID ${campaignId}:`, error.message);
    return [];
  }
}

// Calculate campaign performance score
function calculatePerformanceScore(campaign) {
  const metrics = {
    openRate: campaign.total_leads_contacted > 0
      ? (campaign.unique_opens / campaign.total_leads_contacted) * 100
      : 0,
    replyRate: campaign.total_leads_contacted > 0
      ? (campaign.unique_replies / campaign.total_leads_contacted) * 100
      : 0,
    interestedRate: campaign.total_leads_contacted > 0
      ? (campaign.interested / campaign.total_leads_contacted) * 100
      : 0,
    bounceRate: campaign.emails_sent > 0
      ? (campaign.bounced / campaign.emails_sent) * 100
      : 0,
    unsubscribeRate: campaign.emails_sent > 0
      ? (campaign.unsubscribed / campaign.emails_sent) * 100
      : 0,
  };

  // Weighted performance score
  // Reply rate is most important, followed by interested rate, then open rate
  // Bounce and unsubscribe rates are negative indicators
  const score = (
    (metrics.replyRate * 4) +        // Weight: 4
    (metrics.interestedRate * 3) +   // Weight: 3
    (metrics.openRate * 2) -         // Weight: 2
    (metrics.bounceRate * 2) -       // Weight: -2
    (metrics.unsubscribeRate * 1)    // Weight: -1
  );

  return {
    score,
    metrics,
  };
}

// Filter campaigns for recent renewals
function filterRecentCampaigns(campaigns) {
  const targetKeywords = ['january', 'february', 'march', 'renewals'];
  const excludeKeywords = ['december', 'november', 'october'];

  const filtered = campaigns.filter(campaign => {
    const nameLower = campaign.name.toLowerCase();

    // Must contain at least one target keyword
    const hasTargetKeyword = targetKeywords.some(keyword => nameLower.includes(keyword));

    // Must not contain any exclude keywords
    const hasExcludeKeyword = excludeKeywords.some(keyword => nameLower.includes(keyword));

    return hasTargetKeyword && !hasExcludeKeyword;
  });

  // Sort by updated_at descending (most recent first)
  filtered.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

  return filtered;
}

// Analyze campaign health
async function analyzeCampaignHealth(campaign) {
  console.log(`\n🔍 Analyzing campaign: ${campaign.name}`);

  // Get campaign details
  const details = await getCampaignDetails(campaign.id);
  const sequenceSteps = await getSequenceSteps(campaign.id);
  const senderEmails = await getCampaignSenderEmails(campaign.id);

  // Calculate performance
  const { score, metrics } = calculatePerformanceScore(campaign);

  // Analyze sender email health
  const senderEmailHealth = senderEmails.map(sender => {
    const senderMetrics = {
      replyRate: sender.total_leads_contacted_count > 0
        ? (sender.unique_replied_count / sender.total_leads_contacted_count) * 100
        : 0,
      openRate: sender.total_leads_contacted_count > 0
        ? (sender.unique_opened_count / sender.total_leads_contacted_count) * 100
        : 0,
      bounceRate: sender.emails_sent_count > 0
        ? (sender.bounced_count / sender.emails_sent_count) * 100
        : 0,
      interestedRate: sender.total_leads_contacted_count > 0
        ? (sender.interested_leads_count / sender.total_leads_contacted_count) * 100
        : 0,
    };

    const health = senderMetrics.bounceRate < 5 && senderMetrics.replyRate > 1
      ? 'good'
      : senderMetrics.bounceRate >= 10 || senderMetrics.replyRate < 0.5
        ? 'poor'
        : 'fair';

    return {
      email: sender.email,
      status: sender.status,
      health,
      metrics: senderMetrics,
      tags: sender.tags.map(t => t.name),
      emailsSent: sender.emails_sent_count,
      leadsContacted: sender.total_leads_contacted_count,
    };
  });

  // Analyze sequence content
  const sequenceAnalysis = sequenceSteps.map(step => ({
    stepNumber: step.order,
    subject: step.email_subject,
    bodyLength: step.email_body ? step.email_body.length : 0,
    hasPersonalization: step.email_body ?
      (step.email_body.includes('{{') || step.email_body.includes('{%')) : false,
  }));

  return {
    id: campaign.id,
    name: campaign.name,
    status: campaign.status,
    type: campaign.type,
    createdAt: campaign.created_at,
    updatedAt: campaign.updated_at,
    performanceScore: score,
    metrics,
    stats: {
      totalLeads: campaign.total_leads,
      leadsContacted: campaign.total_leads_contacted,
      emailsSent: campaign.emails_sent,
      completionPercentage: campaign.completion_percentage,
    },
    senderEmails: senderEmailHealth,
    sequence: sequenceAnalysis,
    issues: identifyIssues(campaign, senderEmailHealth, sequenceAnalysis),
  };
}

// Identify potential issues
function identifyIssues(campaign, senderEmailHealth, sequenceAnalysis) {
  const issues = [];

  // Check campaign metrics
  const { metrics } = calculatePerformanceScore(campaign);

  if (metrics.replyRate < 1) {
    issues.push({
      severity: 'high',
      type: 'low_reply_rate',
      message: `Very low reply rate: ${metrics.replyRate.toFixed(2)}% (target: >1%)`,
    });
  }

  if (metrics.openRate < 30) {
    issues.push({
      severity: 'high',
      type: 'low_open_rate',
      message: `Low open rate: ${metrics.openRate.toFixed(2)}% (target: >30%)`,
    });
  }

  if (metrics.bounceRate > 5) {
    issues.push({
      severity: 'critical',
      type: 'high_bounce_rate',
      message: `High bounce rate: ${metrics.bounceRate.toFixed(2)}% (threshold: <5%)`,
    });
  }

  if (metrics.interestedRate < 0.5) {
    issues.push({
      severity: 'medium',
      type: 'low_interested_rate',
      message: `Low interested rate: ${metrics.interestedRate.toFixed(2)}% (target: >0.5%)`,
    });
  }

  // Check sender email health
  const poorSenders = senderEmailHealth.filter(s => s.health === 'poor');
  if (poorSenders.length > 0) {
    issues.push({
      severity: 'high',
      type: 'poor_sender_health',
      message: `${poorSenders.length} sender email(s) with poor health`,
      details: poorSenders.map(s => `${s.email}: ${s.metrics.bounceRate.toFixed(2)}% bounce, ${s.metrics.replyRate.toFixed(2)}% reply`),
    });
  }

  // Check if campaign has enough sender emails
  if (senderEmailHealth.length < 3 && campaign.total_leads > 100) {
    issues.push({
      severity: 'medium',
      type: 'insufficient_sender_emails',
      message: `Only ${senderEmailHealth.length} sender email(s) for ${campaign.total_leads} leads`,
    });
  }

  // Check sequence content
  if (sequenceAnalysis.length === 0) {
    issues.push({
      severity: 'critical',
      type: 'no_sequence',
      message: 'Campaign has no sequence steps',
    });
  } else {
    const stepsWithoutPersonalization = sequenceAnalysis.filter(s => !s.hasPersonalization);
    if (stepsWithoutPersonalization.length > 0) {
      issues.push({
        severity: 'low',
        type: 'no_personalization',
        message: `${stepsWithoutPersonalization.length} sequence step(s) without personalization`,
      });
    }

    const shortSteps = sequenceAnalysis.filter(s => s.bodyLength < 200);
    if (shortSteps.length > 0) {
      issues.push({
        severity: 'low',
        type: 'short_email_body',
        message: `${shortSteps.length} sequence step(s) with very short body (<200 chars)`,
      });
    }
  }

  // Check campaign activity
  const daysSinceUpdate = (Date.now() - new Date(campaign.updated_at)) / (1000 * 60 * 60 * 24);
  if (daysSinceUpdate > 7 && campaign.status === 'active') {
    issues.push({
      severity: 'medium',
      type: 'stale_campaign',
      message: `Campaign hasn't been updated in ${daysSinceUpdate.toFixed(0)} days`,
    });
  }

  return issues;
}

// Generate comparison report
function generateComparisonReport(highPerformers, lowPerformers) {
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 CAMPAIGN PERFORMANCE COMPARISON REPORT');
  console.log('='.repeat(80));

  // Calculate averages for high performers
  const avgHighPerformer = calculateAverageMetrics(highPerformers);
  const avgLowPerformer = calculateAverageMetrics(lowPerformers);

  console.log('\n🏆 HIGH PERFORMERS AVERAGE:');
  console.log(`   Reply Rate: ${avgHighPerformer.replyRate.toFixed(2)}%`);
  console.log(`   Open Rate: ${avgHighPerformer.openRate.toFixed(2)}%`);
  console.log(`   Interested Rate: ${avgHighPerformer.interestedRate.toFixed(2)}%`);
  console.log(`   Bounce Rate: ${avgHighPerformer.bounceRate.toFixed(2)}%`);
  console.log(`   Avg Sender Emails: ${avgHighPerformer.avgSenderEmails.toFixed(1)}`);
  console.log(`   Avg Sequence Steps: ${avgHighPerformer.avgSequenceSteps.toFixed(1)}`);

  console.log('\n📉 LOW PERFORMERS AVERAGE:');
  console.log(`   Reply Rate: ${avgLowPerformer.replyRate.toFixed(2)}%`);
  console.log(`   Open Rate: ${avgLowPerformer.openRate.toFixed(2)}%`);
  console.log(`   Interested Rate: ${avgLowPerformer.interestedRate.toFixed(2)}%`);
  console.log(`   Bounce Rate: ${avgLowPerformer.bounceRate.toFixed(2)}%`);
  console.log(`   Avg Sender Emails: ${avgLowPerformer.avgSenderEmails.toFixed(1)}`);
  console.log(`   Avg Sequence Steps: ${avgLowPerformer.avgSequenceSteps.toFixed(1)}`);

  console.log('\n📈 KEY DIFFERENCES:');
  console.log(`   Reply Rate Difference: ${(avgHighPerformer.replyRate - avgLowPerformer.replyRate).toFixed(2)}%`);
  console.log(`   Open Rate Difference: ${(avgHighPerformer.openRate - avgLowPerformer.openRate).toFixed(2)}%`);
  console.log(`   Bounce Rate Difference: ${(avgHighPerformer.bounceRate - avgLowPerformer.bounceRate).toFixed(2)}%`);
  console.log(`   Sender Email Difference: ${(avgHighPerformer.avgSenderEmails - avgLowPerformer.avgSenderEmails).toFixed(1)}`);

  // Identify common patterns
  console.log('\n🔍 COMMON PATTERNS IN HIGH PERFORMERS:');
  analyzeCommonPatterns(highPerformers);

  console.log('\n⚠️  COMMON ISSUES IN LOW PERFORMERS:');
  analyzeCommonIssues(lowPerformers);
}

function calculateAverageMetrics(campaigns) {
  if (campaigns.length === 0) return {};

  const sum = campaigns.reduce((acc, campaign) => {
    acc.replyRate += campaign.metrics.replyRate;
    acc.openRate += campaign.metrics.openRate;
    acc.interestedRate += campaign.metrics.interestedRate;
    acc.bounceRate += campaign.metrics.bounceRate;
    acc.senderEmails += campaign.senderEmails.length;
    acc.sequenceSteps += campaign.sequence.length;
    return acc;
  }, {
    replyRate: 0,
    openRate: 0,
    interestedRate: 0,
    bounceRate: 0,
    senderEmails: 0,
    sequenceSteps: 0,
  });

  return {
    replyRate: sum.replyRate / campaigns.length,
    openRate: sum.openRate / campaigns.length,
    interestedRate: sum.interestedRate / campaigns.length,
    bounceRate: sum.bounceRate / campaigns.length,
    avgSenderEmails: sum.senderEmails / campaigns.length,
    avgSequenceSteps: sum.sequenceSteps / campaigns.length,
  };
}

function analyzeCommonPatterns(campaigns) {
  // Analyze sender email health
  const healthySenderPercentage = campaigns.reduce((acc, c) => {
    const healthySenders = c.senderEmails.filter(s => s.health === 'good').length;
    const total = c.senderEmails.length;
    return acc + (total > 0 ? (healthySenders / total) * 100 : 0);
  }, 0) / campaigns.length;

  console.log(`   - ${healthySenderPercentage.toFixed(1)}% of sender emails are in good health`);

  // Analyze personalization
  const personalizationUsage = campaigns.reduce((acc, c) => {
    const personalizedSteps = c.sequence.filter(s => s.hasPersonalization).length;
    const total = c.sequence.length;
    return acc + (total > 0 ? (personalizedSteps / total) * 100 : 0);
  }, 0) / campaigns.length;

  console.log(`   - ${personalizationUsage.toFixed(1)}% of sequence steps use personalization`);

  // Analyze active campaigns
  const activeCampaigns = campaigns.filter(c => c.status === 'active').length;
  console.log(`   - ${activeCampaigns} out of ${campaigns.length} campaigns are active`);
}

function analyzeCommonIssues(campaigns) {
  // Count issue types
  const issueCounts = {};
  campaigns.forEach(campaign => {
    campaign.issues.forEach(issue => {
      issueCounts[issue.type] = (issueCounts[issue.type] || 0) + 1;
    });
  });

  // Sort by frequency
  const sortedIssues = Object.entries(issueCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5); // Top 5 issues

  sortedIssues.forEach(([type, count]) => {
    console.log(`   - ${type.replace(/_/g, ' ').toUpperCase()}: ${count} campaigns affected`);
  });
}

// Main analysis function
async function analyzeCampaignPerformance() {
  try {
    // Step 1: Fetch all campaigns
    const allCampaigns = await getAllCampaigns();
    console.log(`✅ Fetched ${allCampaigns.length} total campaigns\n`);

    // Step 2: Filter for recent renewals
    const recentCampaigns = filterRecentCampaigns(allCampaigns);
    console.log(`✅ Filtered to ${recentCampaigns.length} recent renewal campaigns\n`);

    if (recentCampaigns.length === 0) {
      console.log('⚠️  No recent renewal campaigns found. Showing all campaigns...\n');
      // If no matches, show the 20 most recently updated campaigns
      const sortedByUpdate = [...allCampaigns].sort((a, b) =>
        new Date(b.updated_at) - new Date(a.updated_at)
      ).slice(0, 20);

      console.log('📋 20 Most Recently Updated Campaigns:');
      sortedByUpdate.forEach((c, i) => {
        console.log(`${i + 1}. ${c.name} (Updated: ${c.updated_at})`);
      });
      return;
    }

    console.log('📋 Recent Renewal Campaigns Found:');
    recentCampaigns.slice(0, 10).forEach((c, i) => {
      console.log(`${i + 1}. ${c.name} (Updated: ${c.updated_at})`);
    });

    // Step 3: Analyze each campaign
    console.log('\n' + '='.repeat(80));
    console.log('🔬 DETAILED CAMPAIGN ANALYSIS');
    console.log('='.repeat(80));

    const analyzedCampaigns = [];
    for (const campaign of recentCampaigns) {
      const analysis = await analyzeCampaignHealth(campaign);
      analyzedCampaigns.push(analysis);

      // Brief summary
      console.log(`   Performance Score: ${analysis.performanceScore.toFixed(2)}`);
      console.log(`   Reply Rate: ${analysis.metrics.replyRate.toFixed(2)}%`);
      console.log(`   Open Rate: ${analysis.metrics.openRate.toFixed(2)}%`);
      console.log(`   Bounce Rate: ${analysis.metrics.bounceRate.toFixed(2)}%`);
      console.log(`   Issues Found: ${analysis.issues.length}`);
      if (analysis.issues.length > 0) {
        console.log(`   Top Issue: ${analysis.issues[0].message}`);
      }
    }

    // Step 4: Categorize campaigns
    analyzedCampaigns.sort((a, b) => b.performanceScore - a.performanceScore);

    const median = analyzedCampaigns.length / 2;
    const highPerformers = analyzedCampaigns.slice(0, Math.ceil(median));
    const lowPerformers = analyzedCampaigns.slice(Math.ceil(median));

    // Step 5: Generate detailed reports
    console.log('\n\n' + '='.repeat(80));
    console.log('🏆 HIGH PERFORMING CAMPAIGNS');
    console.log('='.repeat(80));

    highPerformers.forEach((campaign, i) => {
      console.log(`\n${i + 1}. ${campaign.name}`);
      console.log(`   Performance Score: ${campaign.performanceScore.toFixed(2)}`);
      console.log(`   Reply Rate: ${campaign.metrics.replyRate.toFixed(2)}%`);
      console.log(`   Open Rate: ${campaign.metrics.openRate.toFixed(2)}%`);
      console.log(`   Interested Rate: ${campaign.metrics.interestedRate.toFixed(2)}%`);
      console.log(`   Sender Emails: ${campaign.senderEmails.length} (${campaign.senderEmails.filter(s => s.health === 'good').length} healthy)`);
      console.log(`   Sequence Steps: ${campaign.sequence.length}`);
    });

    console.log('\n\n' + '='.repeat(80));
    console.log('📉 LOW PERFORMING CAMPAIGNS');
    console.log('='.repeat(80));

    lowPerformers.forEach((campaign, i) => {
      console.log(`\n${i + 1}. ${campaign.name}`);
      console.log(`   Performance Score: ${campaign.performanceScore.toFixed(2)}`);
      console.log(`   Reply Rate: ${campaign.metrics.replyRate.toFixed(2)}%`);
      console.log(`   Open Rate: ${campaign.metrics.openRate.toFixed(2)}%`);
      console.log(`   Bounce Rate: ${campaign.metrics.bounceRate.toFixed(2)}%`);
      console.log(`   Issues (${campaign.issues.length}):`);
      campaign.issues.forEach(issue => {
        console.log(`      [${issue.severity.toUpperCase()}] ${issue.message}`);
        if (issue.details) {
          issue.details.forEach(detail => {
            console.log(`         - ${detail}`);
          });
        }
      });
      console.log(`   Sender Emails: ${campaign.senderEmails.length} (${campaign.senderEmails.filter(s => s.health === 'poor').length} poor health)`);
    });

    // Step 6: Generate comparison report
    generateComparisonReport(highPerformers, lowPerformers);

    // Step 7: Generate recommendations
    console.log('\n\n' + '='.repeat(80));
    console.log('💡 RECOMMENDATIONS');
    console.log('='.repeat(80));

    generateRecommendations(analyzedCampaigns, highPerformers, lowPerformers);

    // Save detailed report to JSON
    const fs = require('fs');
    const reportData = {
      timestamp: new Date().toISOString(),
      summary: {
        totalCampaigns: analyzedCampaigns.length,
        highPerformers: highPerformers.length,
        lowPerformers: lowPerformers.length,
        avgPerformanceScore: analyzedCampaigns.reduce((sum, c) => sum + c.performanceScore, 0) / analyzedCampaigns.length,
      },
      campaigns: analyzedCampaigns,
    };

    fs.writeFileSync('campaign-performance-analysis.json', JSON.stringify(reportData, null, 2));
    console.log('\n✅ Detailed report saved to: campaign-performance-analysis.json');

  } catch (error) {
    console.error('❌ Error during analysis:', error);
    throw error;
  }
}

function generateRecommendations(allCampaigns, highPerformers, lowPerformers) {
  const recommendations = [];

  // Analyze common issues in low performers
  const allIssues = lowPerformers.flatMap(c => c.issues);
  const criticalIssues = allIssues.filter(i => i.severity === 'critical');
  const highIssues = allIssues.filter(i => i.severity === 'high');

  if (criticalIssues.length > 0) {
    recommendations.push({
      priority: 'CRITICAL',
      action: 'Fix campaigns with no sequence steps or extremely high bounce rates immediately',
      affectedCampaigns: criticalIssues.length,
    });
  }

  if (highIssues.length > 0) {
    const lowReplyIssues = highIssues.filter(i => i.type === 'low_reply_rate');
    if (lowReplyIssues.length > 0) {
      recommendations.push({
        priority: 'HIGH',
        action: 'Improve email copy and targeting for campaigns with <1% reply rate',
        affectedCampaigns: lowReplyIssues.length,
      });
    }

    const poorSenderIssues = highIssues.filter(i => i.type === 'poor_sender_health');
    if (poorSenderIssues.length > 0) {
      recommendations.push({
        priority: 'HIGH',
        action: 'Replace or warm up sender emails with poor health (high bounce, low reply)',
        affectedCampaigns: poorSenderIssues.length,
      });
    }
  }

  // Compare high vs low performers
  const avgHigh = calculateAverageMetrics(highPerformers);
  const avgLow = calculateAverageMetrics(lowPerformers);

  if (avgHigh.avgSenderEmails > avgLow.avgSenderEmails * 1.5) {
    recommendations.push({
      priority: 'MEDIUM',
      action: `Increase sender emails for low performers (high performers avg ${avgHigh.avgSenderEmails.toFixed(1)} vs ${avgLow.avgSenderEmails.toFixed(1)})`,
    });
  }

  if (avgHigh.bounceRate < avgLow.bounceRate * 2) {
    recommendations.push({
      priority: 'HIGH',
      action: 'Focus on improving sender email health and list quality to reduce bounce rates',
    });
  }

  // Output recommendations
  recommendations.sort((a, b) => {
    const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  recommendations.forEach((rec, i) => {
    console.log(`\n${i + 1}. [${rec.priority}] ${rec.action}`);
    if (rec.affectedCampaigns) {
      console.log(`   Affected Campaigns: ${rec.affectedCampaigns}`);
    }
  });

  // Specific campaign recommendations
  console.log('\n\n📋 CAMPAIGN-SPECIFIC ACTIONS:');
  lowPerformers.slice(0, 5).forEach(campaign => {
    console.log(`\n${campaign.name}:`);
    const topIssues = campaign.issues.slice(0, 3);
    topIssues.forEach(issue => {
      console.log(`   - [${issue.severity.toUpperCase()}] ${issue.message}`);
    });

    // Suggest specific actions
    if (campaign.issues.some(i => i.type === 'high_bounce_rate')) {
      console.log(`   → ACTION: Pause campaign and review/replace sender emails`);
    }
    if (campaign.issues.some(i => i.type === 'low_reply_rate')) {
      console.log(`   → ACTION: A/B test new email copy based on high performers`);
    }
    if (campaign.issues.some(i => i.type === 'poor_sender_health')) {
      console.log(`   → ACTION: Remove poor-performing sender emails immediately`);
    }
  });
}

// Run the analysis
analyzeCampaignPerformance().catch(console.error);
