const fs = require('fs');

// Read the complete summary
const csvContent = fs.readFileSync('./EXCEL-ZAPMAIL-COMPLETE-SUMMARY.csv', 'utf8');
const lines = csvContent.split('\n');

// Extract header and data
const header = lines[0];
const dataLines = lines.slice(1);

// Filter domains with avg reply rate >= 0.4%
const goodDomains = [];
const excludedDomains = [];

dataLines.forEach(line => {
  if (!line.trim()) return;

  const parts = line.split(',');
  const domain = parts[0];
  const classification = parts[1];
  const avgReplyRate = parseFloat(parts[9]) || 0;

  if (avgReplyRate >= 0.4) {
    goodDomains.push(line);
  } else {
    excludedDomains.push({
      domain,
      classification,
      avgReplyRate
    });
  }
});

// Create CSV with domains that have >= 0.4% reply rate
const goodDomainsCSV = [header, ...goodDomains].join('\n');
fs.writeFileSync('DOMAINS-WITH-GOOD-REPLY-RATE.csv', goodDomainsCSV);

// Create simple list of just domain names (>= 0.4% reply rate)
const domainListOnly = goodDomains.map(line => {
  const parts = line.split(',');
  return parts[0]; // Just the domain name
}).filter(d => d && d !== '');

const domainListCSV = ['Domain', ...domainListOnly].join('\n');
fs.writeFileSync('DOMAINS-WITH-GOOD-REPLY-RATE-LIST-ONLY.csv', domainListCSV);

console.log('✅ Filtered domains by reply rate:\n');
console.log(`📊 Summary:`);
console.log(`   Total domains analyzed: ${dataLines.length - 1}`);
console.log(`   ✅ Domains with >=0.4% reply rate: ${goodDomains.length}`);
console.log(`   ❌ Domains excluded (<0.4% reply rate): ${excludedDomains.length}`);
console.log('');
console.log('📁 Generated files:');
console.log('   - DOMAINS-WITH-GOOD-REPLY-RATE.csv (full data, >=0.4% reply rate)');
console.log('   - DOMAINS-WITH-GOOD-REPLY-RATE-LIST-ONLY.csv (just domain names)');
console.log('');

if (excludedDomains.length > 0) {
  console.log(`❌ Excluded ${excludedDomains.length} domains with <0.4% avg reply rate:`);
  excludedDomains.slice(0, 20).forEach(d => {
    console.log(`   - ${d.domain} (${d.avgReplyRate.toFixed(2)}% avg rate, ${d.classification})`);
  });
  if (excludedDomains.length > 20) {
    console.log(`   ... and ${excludedDomains.length - 20} more`);
  }
}
