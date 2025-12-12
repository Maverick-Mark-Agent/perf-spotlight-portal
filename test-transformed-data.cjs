const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0';

const supabase = createClient(supabaseUrl, anonKey);

// Simulate the transform function
function transformToEmailAccount(dbRow) {
  return {
    id: dbRow.id,
    email: dbRow.email_address,
    email_address: dbRow.email_address,
    workspace_name: dbRow.workspace_name,
    status: dbRow.status,
    provider: dbRow.email_provider || undefined,
    email_provider: dbRow.email_provider,
    reseller: dbRow.reseller,
    emails_sent_count: dbRow.emails_sent_count || 0,
    total_replied_count: dbRow.total_replied_count || 0,
    unique_replied_count: dbRow.unique_replied_count || 0,
    bounced_count: dbRow.bounced_count || 0,
    unsubscribed_count: dbRow.unsubscribed_count || 0,
    reply_rate_percentage: dbRow.reply_rate_percentage || 0,
    last_synced_at: dbRow.last_synced_at,
  };
}

async function testTransformedData() {
  console.log('🔍 Testing transformed data structure...\n');

  // Query from the VIEW that the app actually uses
  const { data, error } = await supabase
    .from('email_accounts_view')
    .select('*')
    .limit(5);

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  console.log('📦 Raw data from email_accounts_view:');
  data.forEach((row, i) => {
    console.log(`\n${i + 1}. Raw DB row:`);
    console.log(`   email_address: ${row.email_address}`);
    console.log(`   email_provider: ${row.email_provider || 'NULL'}`);
    console.log(`   reseller: ${row.reseller || 'NULL'}`);
    console.log(`   workspace_name: ${row.workspace_name}`);

    const transformed = transformToEmailAccount(row);
    console.log(`\n   After transform:`);
    console.log(`   email_provider: ${transformed.email_provider || 'NULL'}`);
    console.log(`   reseller: ${transformed.reseller || 'NULL'}`);
  });
}

testTransformedData();
