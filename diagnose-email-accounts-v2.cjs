const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjgwOTE1NjcsImV4cCI6MjA0MzY2NzU2N30.FhD4gnkV_3fW4ZmcSzlDaBl-lxWLX2p2u-P5FwfwC6k';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log('🔍 COMPREHENSIVE EMAIL ACCOUNTS DIAGNOSTIC\n');
console.log('='.repeat(80));

async function diagnoseEmailAccounts() {
  try {
    // STEP 1: Check if table exists and get basic count
    console.log('\n📊 STEP 1: Basic Table Check');
    console.log('-'.repeat(80));

    const { count: basicCount, error: countError } = await supabase
      .from('sender_emails_cache')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ Error accessing sender_emails_cache:', countError.message);
      console.error('   This table may not exist or may not be accessible with anon key');
      return;
    }

    console.log('✅ Table accessible');
    console.log(`📈 Total records in sender_emails_cache: ${basicCount}`);

    // STEP 2: Get actual data with limit
    console.log('\n📊 STEP 2: Fetching Sample Data');
    console.log('-'.repeat(80));

    const { data: sampleRecords, error: sampleError } = await supabase
      .from('sender_emails_cache')
      .select('*')
      .limit(5);

    if (sampleError) {
      console.error('❌ Error fetching sample:', sampleError.message);
      return;
    }

    console.log(`Fetched ${sampleRecords.length} sample records`);

    if (sampleRecords.length > 0) {
      console.log('\n📋 Sample Record Structure:');
      const firstRecord = sampleRecords[0];
      Object.keys(firstRecord).forEach(key => {
        const value = firstRecord[key];
        const type = typeof value;
        const preview = type === 'string' && value.length > 50 ? value.substring(0, 50) + '...' : value;
        console.log(`  ${key}: ${type} = ${JSON.stringify(preview)}`);
      });
    }

    // STEP 3: Simulate the real-time service transformation
    console.log('\n📊 STEP 3: Simulating Real-Time Service Transformation');
    console.log('-'.repeat(80));

    // Fetch ALL data like the real service does
    const { data: allRecords, error: allError } = await supabase
      .from('sender_emails_cache')
      .select('*')
      .order('last_synced_at', { ascending: false })
      .limit(basicCount || 10000);

    if (allError) {
      console.error('❌ Error fetching all records:', allError.message);
      return;
    }

    console.log(`✅ Fetched ${allRecords.length} total records from database`);

    // STEP 4: Apply the transformation logic from fieldMappings
    console.log('\n📊 STEP 4: Applying Field Transformations');
    console.log('-'.repeat(80));

    const transformedData = allRecords.map(row => {
      // This mimics transformToEmailAccount from fieldMappings
      return {
        id: row.id || `${row.bison_instance_id}-${row.email_address}`,
        workspace_name: row.workspace_name,
        fields: {
          'Email': row.email_address,
          'Email Account': row.email_address,
          'Status': row.status,
          'Client': [row.workspace_name],
          'Client Name (from Client)': [row.workspace_name],
          'Workspace': row.workspace_name,
          'Account Name': row.account_name,
          'Tag - Email Provider': row.email_provider,
          'Tag - Reseller': row.reseller,
          'Account Type': row.account_type,
          'Price': row.price || 0,
          'Daily Limit': row.daily_limit || 0,
          'Total Sent': row.total_sent || 0,
          'Reply Rate Per Account %': row.reply_rate || 0,
        }
      };
    });

    console.log(`✅ Transformed ${transformedData.length} records`);

    // STEP 5: Apply deduplication logic from realtimeDataService
    console.log('\n📊 STEP 5: Applying Deduplication Logic');
    console.log('-'.repeat(80));

    const deduplicatedData = [];
    const seenEmailWorkspace = new Set();

    for (const account of transformedData) {
      const email = account.fields['Email'] || account.fields['Email Account'];
      const workspace = account.fields['Client Name (from Client)']?.[0] || account.workspace_name;
      const key = `${email}|${workspace}`;

      if (email && !seenEmailWorkspace.has(key)) {
        seenEmailWorkspace.add(key);
        deduplicatedData.push(account);
      }
    }

    const duplicateCount = transformedData.length - deduplicatedData.length;
    console.log(`✅ Removed ${duplicateCount} duplicates (same email+workspace, different instance)`);
    console.log(`✅ Final count: ${deduplicatedData.length} unique accounts`);

    // STEP 6: Calculate dashboard metrics (matching EmailAccountsPage logic)
    console.log('\n📊 STEP 6: Calculating Dashboard Metrics');
    console.log('-'.repeat(80));

    const totalAccounts = deduplicatedData.length;

    // Count unique clients
    const uniqueClients = new Set(
      deduplicatedData.map(account => {
        const clientField = account.fields['Client'];
        return clientField && clientField.length > 0 ? clientField[0] : 'Unknown';
      })
    ).size;

    const avgAccountsPerClient = uniqueClients > 0 ? (totalAccounts / uniqueClients).toFixed(1) : '0';

    // Count connected vs disconnected
    const connectedCount = deduplicatedData.filter(account => account.fields['Status'] === 'Connected').length;
    const disconnectedCount = totalAccounts - connectedCount;

    // Calculate price metrics
    const totalPrice = deduplicatedData.reduce((sum, account) => {
      const price = parseFloat(account.fields['Price']) || 0;
      return sum + price;
    }, 0);

    const avgCostPerClient = uniqueClients > 0 ? (totalPrice / uniqueClients).toFixed(2) : '0';

    console.log('📊 Dashboard Stats (What should be displayed):');
    console.log(`  • Total Accounts: ${totalAccounts}`);
    console.log(`  • Unique Clients: ${uniqueClients}`);
    console.log(`  • Avg per Client: ${avgAccountsPerClient}`);
    console.log(`  • Connected: ${connectedCount}`);
    console.log(`  • Disconnected: ${disconnectedCount}`);
    console.log(`  • Total Price: $${totalPrice.toFixed(2)}`);
    console.log(`  • Avg Cost per Client: $${avgCostPerClient}`);

    // STEP 7: Show top clients by account count
    console.log('\n📊 STEP 7: Top 15 Clients by Account Count');
    console.log('-'.repeat(80));

    const clientCounts = {};
    deduplicatedData.forEach(account => {
      const client = account.fields['Client']?.[0] || 'Unknown';
      clientCounts[client] = (clientCounts[client] || 0) + 1;
    });

    const sortedClients = Object.entries(clientCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);

    sortedClients.forEach(([client, count], index) => {
      console.log(`  ${(index + 1).toString().padStart(2)}. ${client.padEnd(40)} ${count} accounts`);
    });

    // STEP 8: Check for specific test cases
    console.log('\n📊 STEP 8: Specific Test Cases');
    console.log('-'.repeat(80));

    // Check Shane Miller specifically (mentioned in git history)
    const shaneMiller = deduplicatedData.filter(account =>
      account.fields['Client']?.[0] === 'Shane Miller'
    );
    console.log(`Shane Miller accounts: ${shaneMiller.length}`);

    // Check for any obvious data quality issues
    const noEmailCount = deduplicatedData.filter(a => !a.fields['Email'] && !a.fields['Email Account']).length;
    const noWorkspaceCount = deduplicatedData.filter(a => !a.fields['Workspace']).length;
    const noStatusCount = deduplicatedData.filter(a => !a.fields['Status']).length;

    console.log('\n⚠️  Data Quality Issues:');
    console.log(`  • Missing email: ${noEmailCount}`);
    console.log(`  • Missing workspace: ${noWorkspaceCount}`);
    console.log(`  • Missing status: ${noStatusCount}`);

    // STEP 9: Summary & Recommendations
    console.log('\n' + '='.repeat(80));
    console.log('📋 DIAGNOSTIC SUMMARY');
    console.log('='.repeat(80));
    console.log(`\n✅ Data Flow Working Correctly:`);
    console.log(`   1. Database has ${basicCount} raw records`);
    console.log(`   2. Transformation produces ${transformedData.length} records`);
    console.log(`   3. Deduplication produces ${deduplicatedData.length} unique accounts`);
    console.log(`   4. Dashboard should show:`);
    console.log(`      - Total: ${totalAccounts}`);
    console.log(`      - Avg per Client: ${avgAccountsPerClient}`);
    console.log(`\n📊 If dashboard shows different numbers, check:`);
    console.log(`   1. Browser cache - clear and hard reload`);
    console.log(`   2. Service worker cache`);
    console.log(`   3. Context state initialization`);
    console.log(`   4. Network tab to see actual API responses`);

  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error.message);
    console.error(error);
  }
}

diagnoseEmailAccounts();