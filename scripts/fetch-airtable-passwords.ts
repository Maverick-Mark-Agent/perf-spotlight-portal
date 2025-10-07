async function fetchAirtablePasswords() {
  const AIRTABLE_API_KEY = 'patHeVyZPZSelZQiv.0b42c8d2a6197c847c5e85824a4b8ab09d985659f9e4ecd0703c308ff8fd1730';

  // New base ID from the URL: appONMVSIf5czukkf
  const BASE_ID = 'appONMVSIf5czukkf';
  const TABLE_ID = 'tbl1TabezEneRjyVv';

  const url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
      },
    });

    const data = await response.json();

    if (data.error) {
      console.log('❌ Error:', data.error.message);
      return;
    }

    console.log('\n📋 Credentials Found:\n');

    if (data.records) {
      data.records.forEach((record: any, index: number) => {
        console.log(`\n--- Record ${index + 1} ---`);
        console.log('Fields:', JSON.stringify(record.fields, null, 2));
      });

      // Look for Cole, Clay, Bison credentials
      const coleRecord = data.records.find((r: any) =>
        r.fields.Service?.toLowerCase().includes('cole') ||
        r.fields.Name?.toLowerCase().includes('cole')
      );

      const clayRecord = data.records.find((r: any) =>
        r.fields.Service?.toLowerCase().includes('clay') ||
        r.fields.Name?.toLowerCase().includes('clay')
      );

      const bisonRecord = data.records.find((r: any) =>
        r.fields.Service?.toLowerCase().includes('bison') ||
        r.fields.Name?.toLowerCase().includes('bison')
      );

      console.log('\n\n🎯 Matching Credentials:\n');

      if (coleRecord) {
        console.log('Cole X Dates:', JSON.stringify(coleRecord.fields, null, 2));
      }

      if (clayRecord) {
        console.log('Clay:', JSON.stringify(clayRecord.fields, null, 2));
      }

      if (bisonRecord) {
        console.log('Email Bison:', JSON.stringify(bisonRecord.fields, null, 2));
      }

    } else {
      console.log('No records found');
      console.log('Response:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error('Error fetching from Airtable:', error);
  }
}

fetchAirtablePasswords();
