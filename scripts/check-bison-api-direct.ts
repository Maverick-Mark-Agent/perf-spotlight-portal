// Check what the Bison API actually returns for Workspark workspace

const LONG_RUN_BISON_API_KEY = 'sbp_765c83453a7d30be808b30e47cc230e0e9686015'; // This should be replaced with actual key from env
const LONGRUN_BASE_URL = 'https://send.longrun.agency/api';

async function checkBisonAPI() {
  console.log('=== Checking Bison API for Workspark (Workspace ID: 14) ===\n');

  try {
    // First, switch to workspace 14 (Workspark)
    console.log('Switching to workspace 14...');
    const switchResponse = await fetch(`${LONGRUN_BASE_URL}/workspaces/v1.1/switch-workspace`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LONG_RUN_BISON_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ team_id: 14 })
    });

    if (!switchResponse.ok) {
      const errorText = await switchResponse.text();
      console.error(`Workspace switch failed: ${switchResponse.status} - ${errorText}`);
      return;
    }

    console.log('✓ Switched to workspace 14\n');

    // Now fetch sender emails
    console.log('Fetching sender emails from Bison API...');
    const response = await fetch(`${LONGRUN_BASE_URL}/sender-emails?per_page=100`, {
      headers: {
        'Authorization': `Bearer ${LONG_RUN_BISON_API_KEY}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API Error ${response.status}: ${errorText}`);
      return;
    }

    const data = await response.json();
    const accounts = data.data || [];

    console.log(`Found ${accounts.length} accounts in first page\n`);

    // Show first 5 accounts
    console.log('First 5 accounts:');
    accounts.slice(0, 5).forEach((account: any, idx: number) => {
      console.log(`\n${idx + 1}. ${account.email}`);
      console.log(`   Name: ${account.name}`);
      console.log(`   Status: ${account.status}`);
      console.log(`   Tags: ${account.tags?.map((t: any) => t.name).join(', ') || 'none'}`);
    });

    // Check if there are any empowerworkspark.com emails
    const empowerEmails = accounts.filter((acc: any) =>
      acc.email?.includes('empowerworkspark.com')
    );

    console.log(`\n=== Found ${empowerEmails.length} @empowerworkspark.com emails ===`);
    if (empowerEmails.length > 0) {
      empowerEmails.forEach((acc: any) => {
        console.log(`  - ${acc.email} (${acc.name})`);
      });
    }

    // Check if there are any lesley.redman emails
    const lesleyEmails = accounts.filter((acc: any) =>
      acc.email?.includes('lesley.redman')
    );

    console.log(`\n=== Found ${lesleyEmails.length} lesley.redman emails ===`);
    if (lesleyEmails.length > 0) {
      lesleyEmails.forEach((acc: any) => {
        console.log(`  - ${acc.email} (${acc.name})`);
      });
    }

    // Check for radiant energy domains
    const radiantEmails = accounts.filter((acc: any) =>
      acc.email?.includes('radiantenergy')
    );

    console.log(`\n=== Found ${radiantEmails.length} radiantenergy emails ===`);
    if (radiantEmails.length > 0) {
      console.log('Sample radiantenergy emails:');
      radiantEmails.slice(0, 3).forEach((acc: any) => {
        console.log(`  - ${acc.email} (${acc.name})`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

checkBisonAPI().catch(console.error);
