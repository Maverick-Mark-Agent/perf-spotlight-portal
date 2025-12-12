#!/usr/bin/env node

/**
 * Compare Test 1 vs Test 2, excluding untagged Rob Russell accounts
 */

const fs = require('fs');

// Parse CSV helper
function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());

  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const match = lines[i].match(/"([^"]*)","([^"]*)","([^"]*)","([^"]*)","([^"]*)","([^"]*)"/);
    if (match) {
      data.push({
        email: match[1],
        company: match[2],
        provider: match[3],
        workspace: match[4],
        status: match[5],
        allTags: match[6]
      });
    }
  }
  return data;
}

const test1Data = parseCSV('/Users/mac/Downloads/perf-spotlight-portal/burned-accounts-with-tags.csv');
const test2Data = parseCSV('/Users/mac/Downloads/perf-spotlight-portal/burned-accounts-with-tags-new.csv');

// Exclude untagged accounts from Test 2
const test2Filtered = test2Data.filter(d => d.company !== 'N/A' && d.company !== 'NOT_FOUND');
const test1Filtered = test1Data.filter(d => d.company !== 'N/A' && d.company !== 'NOT_FOUND');

console.log('='.repeat(80));
console.log('TEST COMPARISON (EXCLUDING UNTAGGED ACCOUNTS)');
console.log('='.repeat(80));

console.log('\nTOTAL BURNED ACCOUNTS:');
console.log(`  Test 1 (Nov 13-14): ${test1Filtered.length} tagged accounts`);
console.log(`  Test 2 (Nov 16): ${test2Filtered.length} tagged accounts`);
console.log(`  Difference: ${test2Filtered.length - test1Filtered.length >= 0 ? '+' : ''}${test2Filtered.length - test1Filtered.length} accounts`);

// By workspace
function groupByWorkspace(data) {
  const groups = {};
  data.forEach(d => {
    if (!groups[d.workspace]) groups[d.workspace] = [];
    groups[d.workspace].push(d);
  });
  return groups;
}

const test1ByWorkspace = groupByWorkspace(test1Filtered);
const test2ByWorkspace = groupByWorkspace(test2Filtered);

console.log('\n' + '='.repeat(80));
console.log('BY CLIENT (WORKSPACE)');
console.log('='.repeat(80));

const allClients = new Set([...Object.keys(test1ByWorkspace), ...Object.keys(test2ByWorkspace)]);
const clientComparison = [];

allClients.forEach(client => {
  const test1Count = test1ByWorkspace[client]?.length || 0;
  const test2Count = test2ByWorkspace[client]?.length || 0;
  const diff = test2Count - test1Count;
  const pctChange = test1Count > 0 ? ((diff / test1Count) * 100).toFixed(0) : 'N/A';

  clientComparison.push({
    client,
    test1: test1Count,
    test2: test2Count,
    diff,
    pctChange
  });
});

// Sort by absolute difference
clientComparison.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

console.log('\nClient                  Test 1    Test 2    Change    % Change');
console.log('-'.repeat(80));
clientComparison.forEach(c => {
  const sign = c.diff >= 0 ? '+' : '';
  const pct = c.pctChange !== 'N/A' ? `${sign}${c.pctChange}%` : 'NEW';
  console.log(`${c.client.padEnd(23)} ${String(c.test1).padStart(5)}     ${String(c.test2).padStart(5)}     ${(sign + c.diff).padStart(6)}    ${pct.padStart(8)}`);
});

// By reseller
function groupByCompany(data) {
  const groups = {};
  data.forEach(d => {
    if (!groups[d.company]) groups[d.company] = [];
    groups[d.company].push(d);
  });
  return groups;
}

const test1ByCompany = groupByCompany(test1Filtered);
const test2ByCompany = groupByCompany(test2Filtered);

console.log('\n' + '='.repeat(80));
console.log('BY RESELLER (COMPANY TAG)');
console.log('='.repeat(80));

const allCompanies = new Set([...Object.keys(test1ByCompany), ...Object.keys(test2ByCompany)]);
const companyComparison = [];

allCompanies.forEach(company => {
  const test1Count = test1ByCompany[company]?.length || 0;
  const test2Count = test2ByCompany[company]?.length || 0;
  const diff = test2Count - test1Count;
  const pctChange = test1Count > 0 ? ((diff / test1Count) * 100).toFixed(0) : 'N/A';

  companyComparison.push({
    company,
    test1: test1Count,
    test2: test2Count,
    diff,
    pctChange
  });
});

companyComparison.sort((a, b) => b.test2 - a.test2);

console.log('\nReseller                Test 1    Test 2    Change    % Change');
console.log('-'.repeat(80));
companyComparison.forEach(c => {
  const sign = c.diff >= 0 ? '+' : '';
  const pct = c.pctChange !== 'N/A' ? `${sign}${c.pctChange}%` : 'NEW';
  console.log(`${c.company.padEnd(23)} ${String(c.test1).padStart(5)}     ${String(c.test2).padStart(5)}     ${(sign + c.diff).padStart(6)}    ${pct.padStart(8)}`);
});

// Most significant changes
console.log('\n' + '='.repeat(80));
console.log('MOST SIGNIFICANT CLIENT CHANGES');
console.log('='.repeat(80));

const significantChanges = clientComparison
  .filter(c => Math.abs(c.diff) > 5 || (c.pctChange !== 'N/A' && Math.abs(parseInt(c.pctChange)) > 50))
  .slice(0, 10);

significantChanges.forEach(c => {
  const sign = c.diff >= 0 ? '+' : '';
  const pct = c.pctChange !== 'N/A' ? ` (${sign}${c.pctChange}%)` : ' (NEW)';

  console.log(`\n${c.client}: ${c.test1} → ${c.test2} (${sign}${c.diff})${pct}`);

  // Show reseller breakdown for this client
  const test1Client = test1ByWorkspace[c.client] || [];
  const test2Client = test2ByWorkspace[c.client] || [];

  const test1Companies = {};
  test1Client.forEach(d => {
    test1Companies[d.company] = (test1Companies[d.company] || 0) + 1;
  });

  const test2Companies = {};
  test2Client.forEach(d => {
    test2Companies[d.company] = (test2Companies[d.company] || 0) + 1;
  });

  console.log('  Test 1 breakdown:');
  Object.entries(test1Companies).sort((a, b) => b[1] - a[1]).forEach(([company, count]) => {
    console.log(`    - ${company}: ${count}`);
  });

  console.log('  Test 2 breakdown:');
  Object.entries(test2Companies).sort((a, b) => b[1] - a[1]).forEach(([company, count]) => {
    console.log(`    - ${company}: ${count}`);
  });
});

console.log('\n' + '='.repeat(80));
console.log('SUMMARY');
console.log('='.repeat(80));
console.log(`Test 1 total (tagged): ${test1Filtered.length} accounts`);
console.log(`Test 2 total (tagged): ${test2Filtered.length} accounts`);
console.log(`Difference: ${test2Filtered.length - test1Filtered.length >= 0 ? '+' : ''}${test2Filtered.length - test1Filtered.length} accounts`);
console.log(`\nNote: Excluded ${test2Data.length - test2Filtered.length} untagged accounts from Test 2`);
