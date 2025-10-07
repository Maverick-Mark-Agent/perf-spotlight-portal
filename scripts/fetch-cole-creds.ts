async function fetchColeCredentials() {
  const AIRTABLE_API_KEY = 'patHeVyZPZSelZQiv.0b42c8d2a6197c847c5e85824a4b8ab09d985659f9e4ecd0703c308ff8fd1730';
  const BASE_ID = 'appSwMXeTLxbezMJz';
  const TABLE_NAME = 'Company Resources';

  const url = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
      },
    });

    const data = await response.json();

    console.log('\n📋 All Company Resources:\n');

    if (data.records) {
      data.records.forEach((record: any) => {
        console.log('---');
        console.log('Name:', record.fields.Name || 'N/A');
        console.log('Fields:', Object.keys(record.fields).join(', '));
        if (record.fields.Name?.toLowerCase().includes('cole')) {
          console.log('🎯 COLE RECORD FOUND!');
          console.log('Full data:', JSON.stringify(record.fields, null, 2));
        }
      });
    } else {
      console.log('Response:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error('Error fetching from Airtable:', error);
  }
}

fetchColeCredentials();
