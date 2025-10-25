#!/usr/bin/env npx tsx
/**
 * Test that the validation fix works correctly
 */

import { validateRevenueClients } from '../src/lib/dataValidation';

// Sample data matching what the Edge Function returns (WITHOUT email fields)
const sampleData = [
  {
    workspace_name: "Test Client",
    billing_type: "per_lead",
    current_month_leads: 35,
    current_month_revenue: 875,
    current_month_costs: 450,
    current_month_profit: 425,
    profit_margin: 48.6,
    price_per_lead: 25,
    retainer_amount: null,
    monthly_kpi: 100,
    kpi_progress: 35,
    leads_remaining: 65,
    // NOTE: Email performance fields are MISSING (not returned by Edge Function)
    rank: 1,
  },
];

console.log('🧪 Testing validation with data missing email performance fields...\n');

const result = validateRevenueClients(sampleData);

console.log('Validation Result:');
console.log('  Success:', result.success);
console.log('  Data:', result.data ? `${result.data.length} clients` : 'null');
console.log('  Errors:', result.errors?.length || 0);
console.log('  Warnings:', result.warnings?.length || 0);
console.log('');

if (result.success) {
  console.log('✅ VALIDATION PASSED!');
  console.log('   The dashboard should now work correctly.');
  console.log('');
  console.log('   Sample validated client:');
  console.log('  ', JSON.stringify(result.data![0], null, 2));
} else {
  console.log('❌ VALIDATION FAILED!');
  console.log('   The dashboard will still show no data.');
  console.log('');
  console.log('   Errors:');
  result.errors?.forEach(err => {
    console.log(`   - Field: ${err.field}, Message: ${err.message}`);
  });
}

console.log('');
console.log('💡 Action Required:');
console.log('   1. Stop your dev server (Ctrl+C)');
console.log('   2. Restart it: npm run dev');
console.log('   3. Hard refresh browser: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)');
console.log('   4. Check the dashboard at /revenue-dashboard');
