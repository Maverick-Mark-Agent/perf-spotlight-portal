import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gjqbbgrfhijescaouqkx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0';

const supabase = createClient(supabaseUrl, supabaseKey);

interface ClientCost {
  workspace_name: string;
  month_year: string;
  email_account_costs: number;
  labor_costs: number;
  other_costs: number;
  notes: string;
}

const exampleCosts: ClientCost[] = [
  // High Revenue Clients (Retainers + Top Per-Lead)
  { workspace_name: 'Shane Miller', month_year: '2025-10', email_account_costs: 200, labor_costs: 500, other_costs: 50, notes: 'Retainer - dedicated support' },
  { workspace_name: 'SMA Insurance', month_year: '2025-10', email_account_costs: 180, labor_costs: 600, other_costs: 40, notes: 'Retainer - 13 leads MTD' },
  { workspace_name: 'StreetSmart Commercial', month_year: '2025-10', email_account_costs: 150, labor_costs: 450, other_costs: 30, notes: 'Retainer - 20 leads MTD' },
  { workspace_name: 'Kirk Hodgson', month_year: '2025-10', email_account_costs: 150, labor_costs: 400, other_costs: 25, notes: 'Retainer - 7 leads MTD' },
  { workspace_name: 'StreetSmart Trucking', month_year: '2025-10', email_account_costs: 120, labor_costs: 350, other_costs: 20, notes: 'Retainer - low volume' },
  { workspace_name: 'David Amiri', month_year: '2025-10', email_account_costs: 180, labor_costs: 450, other_costs: 35, notes: 'Per-Lead - 32 leads MTD - High volume' },
  { workspace_name: 'Danny Schwartz', month_year: '2025-10', email_account_costs: 160, labor_costs: 400, other_costs: 30, notes: 'Per-Lead - 26 leads MTD' },
  { workspace_name: 'Devin Hodo', month_year: '2025-10', email_account_costs: 150, labor_costs: 380, other_costs: 28, notes: 'Per-Lead - 23 leads MTD' },

  // Medium Revenue Clients
  { workspace_name: 'Nick Sakha', month_year: '2025-10', email_account_costs: 140, labor_costs: 350, other_costs: 25, notes: 'Per-Lead - 19 leads MTD' },
  { workspace_name: 'Kim Wallace', month_year: '2025-10', email_account_costs: 150, labor_costs: 380, other_costs: 30, notes: 'Per-Lead - 21 leads MTD' },
  { workspace_name: 'Jason Binyon', month_year: '2025-10', email_account_costs: 140, labor_costs: 370, other_costs: 28, notes: 'Per-Lead - 21 leads MTD' },
  { workspace_name: 'John Roberts', month_year: '2025-10', email_account_costs: 120, labor_costs: 300, other_costs: 20, notes: 'Per-Lead - 12 leads MTD' },
  { workspace_name: 'Rob Russell', month_year: '2025-10', email_account_costs: 110, labor_costs: 280, other_costs: 18, notes: 'Per-Lead - 11 leads MTD' },

  // Lower Volume / New Clients
  { workspace_name: 'StreetSmart P&C', month_year: '2025-10', email_account_costs: 100, labor_costs: 250, other_costs: 15, notes: 'Per-Lead - 1 lead MTD - new client' },
  { workspace_name: 'Gregg Blanchard', month_year: '2025-10', email_account_costs: 80, labor_costs: 200, other_costs: 12, notes: 'Per-Lead - 0 leads MTD - new setup' },
  { workspace_name: 'Tony Schmitz', month_year: '2025-10', email_account_costs: 90, labor_costs: 220, other_costs: 15, notes: 'Per-Lead - 0 leads MTD - ramping up' },
  { workspace_name: 'Jeff Schroder', month_year: '2025-10', email_account_costs: 85, labor_costs: 210, other_costs: 13, notes: 'Retainer - 1 lead MTD' },

  // Inactive/Testing Accounts
  { workspace_name: 'Koppa Analytics', month_year: '2025-10', email_account_costs: 50, labor_costs: 100, other_costs: 5, notes: 'API error - minimal activity' },
  { workspace_name: 'Littlegiant', month_year: '2025-10', email_account_costs: 50, labor_costs: 100, other_costs: 5, notes: 'API error - minimal activity' },
  { workspace_name: 'Ozment Media', month_year: '2025-10', email_account_costs: 50, labor_costs: 100, other_costs: 5, notes: 'API error - minimal activity' },
  { workspace_name: 'Radiant Energy', month_year: '2025-10', email_account_costs: 50, labor_costs: 100, other_costs: 5, notes: 'API error - minimal activity' },
  { workspace_name: 'ATI', month_year: '2025-10', email_account_costs: 50, labor_costs: 100, other_costs: 5, notes: 'API error - minimal activity' },
  { workspace_name: 'Boring Book Keeping', month_year: '2025-10', email_account_costs: 50, labor_costs: 100, other_costs: 5, notes: 'API error - minimal activity' },
  { workspace_name: 'LongRun', month_year: '2025-10', email_account_costs: 50, labor_costs: 100, other_costs: 5, notes: 'API error - minimal activity' },

  // Internal / Special Accounts
  { workspace_name: 'Maverick In-house', month_year: '2025-10', email_account_costs: 0, labor_costs: 0, other_costs: 0, notes: 'Internal testing - no costs allocated' },
  { workspace_name: 'Workspark', month_year: '2025-10', email_account_costs: 75, labor_costs: 180, other_costs: 10, notes: 'Special client - reduced rates' },
];

async function populateClientCosts() {
  console.log('🚀 Starting client costs population for October 2025...\n');

  // First, delete existing October 2025 data
  const { error: deleteError } = await supabase
    .from('client_costs')
    .delete()
    .eq('month_year', '2025-10');

  if (deleteError) {
    console.error('❌ Error deleting existing data:', deleteError);
    return;
  }
  console.log('✅ Cleared existing October 2025 data\n');

  // Insert all client costs
  const { data, error } = await supabase
    .from('client_costs')
    .insert(exampleCosts)
    .select();

  if (error) {
    console.error('❌ Error inserting client costs:', error);
    return;
  }

  console.log(`✅ Successfully inserted ${data?.length || 0} client cost records\n`);

  // Fetch and display summary
  const { data: summary, error: summaryError } = await supabase
    .from('client_costs')
    .select('*')
    .eq('month_year', '2025-10');

  if (summaryError) {
    console.error('❌ Error fetching summary:', summaryError);
    return;
  }

  const totalEmailCosts = summary?.reduce((sum, row) => sum + parseFloat(row.email_account_costs), 0) || 0;
  const totalLaborCosts = summary?.reduce((sum, row) => sum + parseFloat(row.labor_costs), 0) || 0;
  const totalOtherCosts = summary?.reduce((sum, row) => sum + parseFloat(row.other_costs), 0) || 0;
  const totalCosts = summary?.reduce((sum, row) => sum + parseFloat(row.total_costs), 0) || 0;

  console.log('📊 SUMMARY FOR OCTOBER 2025:');
  console.log('─────────────────────────────');
  console.log(`Total Clients: ${summary?.length || 0}`);
  console.log(`Total Email Account Costs: $${totalEmailCosts.toFixed(2)}`);
  console.log(`Total Labor Costs: $${totalLaborCosts.toFixed(2)}`);
  console.log(`Total Other Costs: $${totalOtherCosts.toFixed(2)}`);
  console.log(`TOTAL MONTHLY COSTS: $${totalCosts.toFixed(2)}`);
  console.log(`Average Cost per Client: $${(totalCosts / (summary?.length || 1)).toFixed(2)}\n`);

  console.log('🔝 TOP 5 MOST EXPENSIVE CLIENTS:');
  console.log('─────────────────────────────');
  const sorted = [...(summary || [])].sort((a, b) => parseFloat(b.total_costs) - parseFloat(a.total_costs));
  sorted.slice(0, 5).forEach((client, idx) => {
    console.log(`${idx + 1}. ${client.workspace_name}: $${parseFloat(client.total_costs).toFixed(2)}`);
  });

  console.log('\n✅ Client costs populated successfully!');
  console.log('📈 Refresh your Revenue & Billing dashboard to see the updated costs');
}

populateClientCosts().catch(console.error);
