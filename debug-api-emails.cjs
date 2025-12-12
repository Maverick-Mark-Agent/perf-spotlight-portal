const EMAIL_BISON_API_KEY = '77|AqozJcNT8l2m52CRyvQyEEmLKa49ofuZRjK98aio8a3feb5d';

async function debug() {
  const response = await fetch('https://send.maverickmarketingllc.com/api/sender-emails?per_page=10', {
    headers: {
      'Authorization': `Bearer ${EMAIL_BISON_API_KEY}`,
      'Accept': 'application/json',
    }
  });

  const data = await response.json();
  const emails = data.data || data;

  console.log('Sample emails from this API key:\n');
  emails.forEach(e => {
    console.log(`Email: ${e.email}`);
    console.log(`  Name: ${e.name}`);
    console.log(`  Tags: ${e.tags?.map(t => t.name).join(', ') || 'none'}`);
    console.log();
  });
}

debug();