#!/usr/bin/env node

const fs = require('fs');

const content = fs.readFileSync('/Users/mac/Downloads/perf-spotlight-portal/burned-accounts-with-tags-new.csv', 'utf-8');
const lines = content.split('\n').filter(line => line.trim());

// Skip header
const data = lines.slice(1).map(line => {
  const match = line.match(/"([^"]*)","([^"]*)","([^"]*)","([^"]*)","([^"]*)","([^"]*)"/);
  if (!match) return null;
  return {
    email: match[1],
    company: match[2],
    provider: match[3],
    workspace: match[4],
    status: match[5],
    allTags: match[6]
  };
}).filter(Boolean);

const found = data.filter(d => d.company !== 'NOT_FOUND');

console.log('='.repeat(80));
console.log('BURNED ACCOUNTS BY CLIENT (WORKSPACE)');
console.log('='.repeat(80));

const byWorkspace = {};
found.forEach(d => {
  if (!byWorkspace[d.workspace]) {
    byWorkspace[d.workspace] = [];
  }
  byWorkspace[d.workspace].push(d);
});

const workspaceStats = Object.entries(byWorkspace)
  .map(([workspace, accounts]) => ({
    workspace,
    count: accounts.length,
    accounts
  }))
  .sort((a, b) => b.count - a.count);

workspaceStats.forEach(({ workspace, count, accounts }) => {
  console.log(`\n${workspace}: ${count} accounts`);

  const byCompany = {};
  accounts.forEach(a => {
    byCompany[a.company] = (byCompany[a.company] || 0) + 1;
  });

  Object.entries(byCompany).sort((a, b) => b[1] - a[1]).forEach(([company, cnt]) => {
    console.log(`  - ${company}: ${cnt}`);
  });
});

console.log('\n' + '='.repeat(80));
console.log('BURNED ACCOUNTS BY RESELLER (COMPANY TAG)');
console.log('='.repeat(80));

const byCompany = {};
found.forEach(d => {
  if (!byCompany[d.company]) {
    byCompany[d.company] = {
      total: 0,
      byProvider: {},
      byWorkspace: {}
    };
  }
  byCompany[d.company].total++;
  byCompany[d.company].byProvider[d.provider] = (byCompany[d.company].byProvider[d.provider] || 0) + 1;
  byCompany[d.company].byWorkspace[d.workspace] = (byCompany[d.company].byWorkspace[d.workspace] || 0) + 1;
});

Object.entries(byCompany).sort((a, b) => b[1].total - a[1].total).forEach(([company, stats]) => {
  console.log(`\n${company}: ${stats.total} accounts`);

  console.log('  By Provider:');
  Object.entries(stats.byProvider).sort((a, b) => b[1] - a[1]).forEach(([provider, count]) => {
    console.log(`    - ${provider}: ${count}`);
  });

  console.log('  Top 5 Clients:');
  Object.entries(stats.byWorkspace)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([workspace, count]) => {
      console.log(`    - ${workspace}: ${count}`);
    });
});

console.log('\n' + '='.repeat(80));
console.log('SUMMARY');
console.log('='.repeat(80));
console.log(`Total burned accounts found: ${found.length}`);
console.log(`Total unique clients affected: ${Object.keys(byWorkspace).length}`);
console.log(`Not found in system: ${data.length - found.length}`);
