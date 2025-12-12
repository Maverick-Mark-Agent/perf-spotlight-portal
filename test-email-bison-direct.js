// Direct Email Bison API test to verify actual account count
// This bypasses Edge Function to see raw data from Email Bison

const MAVERICK_API_KEY = '101|6mXfEtJkLDF99HcmvOqlJcjlYaDyt9pGt9c6C7qJ56e6298b';
const MAVERICK_BASE_URL = 'https://send.maverickmarketingllc.com/api';

async function testDirectBisonAPI() {
  console.log('🔍 Direct Email Bison API Test\n');

  try {
    // Step 1: Fetch all workspaces
    console.log('📡 Fetching workspaces from Maverick...');
    const workspacesResponse = await fetch(`${MAVERICK_BASE_URL}/workspaces/v1.1`, {
      headers: {
        'Authorization': `Bearer ${MAVERICK_API_KEY}`,
        'Accept': 'application/json',
      },
    });

    if (!workspacesResponse.ok) {
      throw new Error(`Failed to fetch workspaces: ${workspacesResponse.status}`);
    }

    const workspacesData = await workspacesResponse.json();
    const workspaces = workspacesData.data || [];

    console.log(`✅ Fetched ${workspaces.length} workspaces\n`);

    // Step 2: Fetch accounts from each workspace
    let totalAccounts = 0;
    let totalUniqueEmails = new Set();
    const workspaceDetails = [];

    for (const workspace of workspaces) {
      console.log(`📁 Processing workspace: ${workspace.name} (ID: ${workspace.id})`);

      // Switch to workspace
      const switchResponse = await fetch(`${MAVERICK_BASE_URL}/workspaces/v1.1/switch-workspace`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${MAVERICK_API_KEY}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ team_id: workspace.id }),
      });

      if (!switchResponse.ok) {
        console.error(`   ❌ Failed to switch workspace: ${switchResponse.status}`);
        continue;
      }

      // Fetch all pages of sender emails
      let workspaceAccountCount = 0;
      let nextUrl = `${MAVERICK_BASE_URL}/sender-emails?per_page=15`;
      let pageCount = 0;

      while (nextUrl && pageCount < 100) {
        pageCount++;
        const response = await fetch(nextUrl, {
          headers: {
            'Authorization': `Bearer ${MAVERICK_API_KEY}`,
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          console.error(`   ❌ Failed to fetch page ${pageCount}: ${response.status}`);
          break;
        }

        const data = await response.json();
        const pageEmails = data.data || [];

        workspaceAccountCount += pageEmails.length;
        pageEmails.forEach(email => totalUniqueEmails.add(email.email));

        nextUrl = data.links?.next || null;

        // Small delay to avoid rate limiting
        if (nextUrl) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      totalAccounts += workspaceAccountCount;
      workspaceDetails.push({
        name: workspace.name,
        id: workspace.id,
        accountCount: workspaceAccountCount,
        pages: pageCount
      });

      console.log(`   ✅ ${workspaceAccountCount} accounts across ${pageCount} pages\n`);
    }

    // Summary
    console.log('\n==========================================');
    console.log('📊 SUMMARY');
    console.log('==========================================');
    console.log(`Total Workspaces: ${workspaces.length}`);
    console.log(`Total Account Records: ${totalAccounts}`);
    console.log(`Unique Email Addresses: ${totalUniqueEmails.size}`);
    console.log(`Duplicate Records: ${totalAccounts - totalUniqueEmails.size}`);
    console.log('==========================================\n');

    // Top workspaces by account count
    console.log('📈 Top 10 Workspaces by Account Count:');
    workspaceDetails
      .sort((a, b) => b.accountCount - a.accountCount)
      .slice(0, 10)
      .forEach((ws, i) => {
        console.log(`   ${i + 1}. ${ws.name}: ${ws.accountCount} accounts (${ws.pages} pages)`);
      });

    console.log('\n==========================================');
    console.log(`\n✅ ACTUAL UNIQUE ACCOUNTS IN EMAIL BISON: ${totalUniqueEmails.size}`);
    console.log(`📊 User expects: ~4,500 accounts`);
    console.log(`📊 Actual count: ${totalUniqueEmails.size} accounts`);

    const difference = Math.abs(4500 - totalUniqueEmails.size);
    console.log(`\n📊 Difference: ${difference} accounts (${((difference / 4500) * 100).toFixed(1)}%)`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

testDirectBisonAPI();
