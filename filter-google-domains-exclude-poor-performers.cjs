const fs = require('fs');

console.log('📋 Filtering Google Zapmail domains - excluding only poor performers...\n');

const csvContent = fs.readFileSync('./GOOGLE-ZAPMAIL-COMPLETE-SUMMARY.csv', 'utf8');
const lines = csvContent.split('\n');
const header = lines[0];

const goodDomains = [header];
const excludedDomains = [];

for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;

  const parts = line.split(',');
  if (parts.length < 11) continue;

  const domain = parts[0];
  const classification = parts[1];
  const totalSent = parseInt(parts[7]) || 0;
  const avgReplyRate = parseFloat(parts[9]) || 0;

  // KEEP domains that:
  // 1. Are classified as LOW_VOLUME (not enough data to judge - keep them all)
  // 2. Have good reply rate (>=0.4%)
  //
  // EXCLUDE domains that:
  // - Have significant volume AND poor reply rate (<0.4%)

  if (classification === 'LOW_VOLUME' || classification === 'NEVER_USED') {
    // Low volume or never used - keep it (hasn't been tested enough)
    goodDomains.push(line);
  } else if (avgReplyRate < 0.4) {
    // Has significant volume AND poor performance - exclude it
    excludedDomains.push({
      domain,
      classification,
      totalSent,
      avgReplyRate: avgReplyRate.toFixed(2)
    });
  } else {
    // Good performance - keep it
    goodDomains.push(line);
  }
}

// Write full data CSV
fs.writeFileSync('GOOGLE-DOMAINS-EXCLUDING-POOR-PERFORMERS.csv', goodDomains.join('\n'));

// Write list-only CSV
const listOnly = ['Domain'];
for (let i = 1; i < goodDomains.length; i++) {
  const domain = goodDomains[i].split(',')[0];
  if (domain) listOnly.push(domain);
}
fs.writeFileSync('GOOGLE-DOMAINS-EXCLUDING-POOR-PERFORMERS-LIST-ONLY.csv', listOnly.join('\n'));

console.log('✅ FILTERING COMPLETE\n');
console.log('='.repeat(70));
console.log(`Total Google domains kept: ${goodDomains.length - 1}`);
console.log(`Total Google domains excluded: ${excludedDomains.length}`);
console.log('');
console.log('📋 Excluded Google domains (poor performers with volume):');
excludedDomains.forEach(d => {
  console.log(`   - ${d.domain} (${d.classification}, ${d.totalSent} sent, ${d.avgReplyRate}% avg rate)`);
});
console.log('');
console.log('✅ Generated files:');
console.log('   - GOOGLE-DOMAINS-EXCLUDING-POOR-PERFORMERS.csv (full data)');
console.log('   - GOOGLE-DOMAINS-EXCLUDING-POOR-PERFORMERS-LIST-ONLY.csv (domain list)');
console.log('');
console.log('Strategy: Keep unused/low-volume domains (potential), exclude only proven poor performers');
