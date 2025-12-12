// Deep analysis of duplicate email addresses in Infrastructure data
// This will help identify the root cause of the count discrepancy

const SUPABASE_URL = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0';

async function analyzeDuplicates() {
  console.log('🔍 Analyzing Duplicate Email Addresses...\n');

  try {
    console.log('📡 Fetching data from Edge Function...');
    const response = await fetch(`${SUPABASE_URL}/functions/v1/hybrid-email-accounts-v2`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const records = data.records || [];

    console.log(`✅ Fetched ${records.length} total records\n`);

    // Group records by email address
    const emailGroups = {};
    records.forEach((record, index) => {
      const email = record.fields['Email Account'];
      if (!emailGroups[email]) {
        emailGroups[email] = [];
      }
      emailGroups[email].push({
        index,
        id: record.id,
        workspace: record.fields['Workspace'],
        instance: record.fields['Bison Instance'],
        status: record.fields['Status'],
        dailyLimit: record.fields['Daily Limit'],
        totalSent: record.fields['Total Sent'],
        provider: record.fields['Tag - Email Provider'],
        reseller: record.fields['Tag - Reseller']
      });
    });

    // Find duplicates
    const duplicates = Object.entries(emailGroups).filter(([email, accounts]) => accounts.length > 1);

    console.log('📊 DUPLICATE ANALYSIS:');
    console.log('==========================================');
    console.log(`Total Email Addresses: ${Object.keys(emailGroups).length}`);
    console.log(`Duplicate Email Addresses: ${duplicates.length}`);
    console.log(`Total Duplicate Records: ${duplicates.reduce((sum, [_, accounts]) => sum + accounts.length, 0)}`);
    console.log(`Duplicate Records Count: ${duplicates.reduce((sum, [_, accounts]) => sum + (accounts.length - 1), 0)}`);
    console.log('==========================================\n');

    // Analyze top duplicates
    console.log('🔝 TOP 20 MOST DUPLICATED EMAILS:');
    duplicates
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 20)
      .forEach(([email, accounts]) => {
        console.log(`\n📧 ${email} (${accounts.length} instances)`);
        accounts.forEach((account, i) => {
          console.log(`   ${i + 1}. ${account.instance} - ${account.workspace} (${account.status}) [ID: ${account.id}]`);
        });
      });

    // Pattern analysis
    console.log('\n\n📈 DUPLICATE PATTERN ANALYSIS:');
    console.log('==========================================');

    // Check if duplicates are across different instances
    const crossInstanceDuplicates = duplicates.filter(([email, accounts]) => {
      const instances = new Set(accounts.map(a => a.instance));
      return instances.size > 1;
    });

    console.log(`\nCross-Instance Duplicates: ${crossInstanceDuplicates.length}`);
    if (crossInstanceDuplicates.length > 0) {
      console.log('Sample cross-instance duplicates:');
      crossInstanceDuplicates.slice(0, 5).forEach(([email, accounts]) => {
        console.log(`  ${email}: ${accounts.map(a => a.instance).join(', ')}`);
      });
    }

    // Check if duplicates are in the same workspace
    const sameWorkspaceDuplicates = duplicates.filter(([email, accounts]) => {
      const workspaces = new Set(accounts.map(a => a.workspace));
      return workspaces.size === 1;
    });

    console.log(`\nSame Workspace Duplicates: ${sameWorkspaceDuplicates.length}`);
    if (sameWorkspaceDuplicates.length > 0) {
      console.log('Sample same-workspace duplicates:');
      sameWorkspaceDuplicates.slice(0, 5).forEach(([email, accounts]) => {
        console.log(`  ${email}: ${accounts[0].workspace} (${accounts.length} copies)`);
      });
    }

    // Check if duplicates have different IDs
    const differentIdDuplicates = duplicates.filter(([email, accounts]) => {
      const ids = new Set(accounts.map(a => a.id));
      return ids.size > 1;
    });

    console.log(`\nDifferent ID Duplicates: ${differentIdDuplicates.length}`);
    console.log(`Same ID Duplicates: ${duplicates.length - differentIdDuplicates.length}`);

    // Recommendation
    console.log('\n\n💡 RECOMMENDATIONS:');
    console.log('==========================================');

    if (duplicates.length > 0) {
      const uniqueCount = Object.keys(emailGroups).length;
      const actualDuplicates = records.length - uniqueCount;

      console.log(`✅ Actual Unique Email Accounts: ${uniqueCount}`);
      console.log(`⚠️  Duplicate Records to Remove: ${actualDuplicates}`);
      console.log(`\n🔧 FIX: Add deduplication logic to the Edge Function or frontend`);
      console.log(`   Option 1: Deduplicate in Edge Function (hybrid-email-accounts-v2)`);
      console.log(`   Option 2: Deduplicate in frontend (EmailAccountsPage.tsx)`);
      console.log(`   Option 3: Use Map/Set to ensure unique email addresses`);

      if (sameWorkspaceDuplicates.length > 0) {
        console.log(`\n⚠️  Same workspace duplicates suggest Email Bison API pagination issue`);
        console.log(`   - Check if same accounts appear on multiple pages`);
      }

      if (crossInstanceDuplicates.length > 0) {
        console.log(`\n⚠️  Cross-instance duplicates suggest accounts exist in both Maverick and Long Run`);
        console.log(`   - This may be expected if accounts are synced between instances`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

analyzeDuplicates();
