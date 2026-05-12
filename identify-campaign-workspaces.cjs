#!/usr/bin/env node

/**
 * Identify which workspace each campaign belongs to
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

async function identifyCampaignWorkspaces() {
  console.log('🔍 IDENTIFYING CAMPAIGN WORKSPACES\n');

  // Get all workspaces
  const workspaces = await bisonRequest('/workspaces/v1.1');
  console.log(`Found ${workspaces.length} workspaces:\n`);

  const workspaceMap = {};
  workspaces.forEach(w => {
    workspaceMap[w.id] = w.name;
    console.log(`  ${w.id}: ${w.name}`);
  });

  // Get all campaigns
  const campaignsResponse = await bisonRequest('/campaigns?per_page=2000');
  const allCampaigns = campaignsResponse.data || campaignsResponse;

  console.log(`\n\nFound ${allCampaigns.length} campaigns\n`);
  console.log('='.repeat(120));

  // Check each campaign for workspace info
  for (const campaign of allCampaigns) {
    console.log(`\n📊 ${campaign.name}`);
    console.log(`Campaign ID: ${campaign.id}`);
    console.log(`Status: ${campaign.status}`);

    // Try to get full campaign details which might have workspace info
    try {
      const details = await bisonRequest(`/campaigns/${campaign.id}`);
      console.log('\nFull Campaign Details:');
      console.log(JSON.stringify(details, null, 2));
    } catch (error) {
      console.log(`Error fetching details: ${error.message}`);
    }

    console.log('\n' + '-'.repeat(120));
  }
}

identifyCampaignWorkspaces().catch(console.error);
