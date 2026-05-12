const fs = require('fs');

// Read the complete summary
const csvContent = fs.readFileSync('./EXCEL-ZAPMAIL-COMPLETE-SUMMARY.csv', 'utf8');
const lines = csvContent.split('\n');

// Extract header and data
const header = lines[0];
const dataLines = lines.slice(1);

// Filter out BURNT domains
const nonBurntDomains = [];
const burntDomains = new Set();

dataLines.forEach(line => {
  if (!line.trim()) return;

  const parts = line.split(',');
  const domain = parts[0];
  const classification = parts[1];

  if (classification === 'ALL_BURNT') {
    burntDomains.add(domain);
  } else {
    nonBurntDomains.push(line);
  }
});

// Create CSV with all non-burnt domains
const nonBurntCSV = [header, ...nonBurntDomains].join('\n');
fs.writeFileSync('NON-BURNT-DOMAINS.csv', nonBurntCSV);

// Create simple list of just domain names (excluding burnt)
const domainListOnly = nonBurntDomains.map(line => {
  const parts = line.split(',');
  return parts[0]; // Just the domain name
}).filter(d => d && d !== '');

const domainListCSV = ['Domain', ...domainListOnly].join('\n');
fs.writeFileSync('NON-BURNT-DOMAINS-LIST-ONLY.csv', domainListCSV);

console.log('✅ Created filtered domain lists:\n');
console.log(`📊 Summary:`);
console.log(`   Total domains from Excel: ${dataLines.length - 1}`); // -1 for empty line
console.log(`   Burnt domains removed: ${burntDomains.size}`);
console.log(`   Non-burnt domains: ${nonBurntDomains.length}`);
console.log('');
console.log('📁 Generated files:');
console.log('   - NON-BURNT-DOMAINS.csv (full data, excluding 11 burnt domains)');
console.log('   - NON-BURNT-DOMAINS-LIST-ONLY.csv (just domain names)');
console.log('');
console.log('🔥 Removed burnt domains:');
Array.from(burntDomains).forEach(d => console.log(`   - ${d}`));
