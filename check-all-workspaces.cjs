const MAVERICK_API_KEY = '101|6mXfEtJkLDF99HcmvOqlJcjlYaDyt9pGt9c6C7qJ56e6298b';
const BASE_URL = 'https://send.maverickmarketingllc.com/api';

const CLIENTS = [
  'Tactical Hr', 'Jason Park Kansas', 'Jason Park Oklahoma', 'Jason Park Missouri',
  'Stratlend Mortgage Advisors', 'Heidi Rowan Agency', 'Frank Delemos Agency',
  'Brian Weatherman Agency', 'Eric Jeglum Agency', 'Gregg 2',
];

async function check() {
  const res = await fetch(`${BASE_URL}/workspaces/v1.1`, {
    headers: { 'Authorization': `Bearer ${MAVERICK_API_KEY}`, 'Accept': 'application/json' }
  });
  const data = await res.json();
  const workspaces = data.data || data;

  console.log('All Bison workspaces:');
  workspaces.forEach(w => console.log(`  id=${w.id}  "${w.name}"`));

  console.log('\n=== Matching our clients ===');
  CLIENTS.forEach(client => {
    // fuzzy match
    const match = workspaces.find(w => 
      w.name?.toLowerCase().includes(client.toLowerCase()) ||
      client.toLowerCase().includes(w.name?.toLowerCase())
    );
    if (match) console.log(`✅ "${client}" → id=${match.id} name="${match.name}"`);
    else console.log(`❌ "${client}" → NO MATCH`);
  });
}

check().catch(console.error);
