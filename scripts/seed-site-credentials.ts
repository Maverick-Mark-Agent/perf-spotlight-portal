import { createClient } from '@supabase/supabase-js';
import { secrets } from '@lib/secrets';

const supabase = createClient(secrets.supabaseUrl, secrets.supabaseServiceRoleKey);

async function seedSiteCredentials() {
  console.log('🌱 Seeding site credentials...\n');

  const credentials = [
    // Cole credentials (per state)
    ...Object.entries(secrets.cole).map(([state, creds]) => ({
      site: 'cole',
      username: creds.username,
      secret_ref: `COLE_${state}_PASSWORD`,
      state_coverage: [state],
      mfa_type: null,
      notes: `Cole X Dates credentials for ${state}`,
    })),

    // Clay credentials
    {
      site: 'clay',
      username: secrets.clay.email,
      secret_ref: 'CLAY_PASSWORD',
      state_coverage: null,
      mfa_type: null,
      notes: 'Clay data transformation platform',
    },

    // Email Bison credentials
    {
      site: 'bison',
      username: secrets.bison.email,
      secret_ref: 'BISON_PASSWORD',
      state_coverage: null,
      mfa_type: null,
      notes: 'Email Bison campaign platform',
    },
  ];

  for (const cred of credentials) {
    const { error } = await supabase
      .from('site_credentials')
      .upsert(cred, { onConflict: 'site,username' });

    if (error) {
      console.error(`❌ Failed to seed credential for ${cred.site}:`, error.message);
    } else {
      console.log(`✅ Credential seeded: ${cred.site} (${cred.username})`);
    }
  }

  console.log('\n✅ Site credentials seeded successfully!\n');
}

seedSiteCredentials().catch((error) => {
  console.error('❌ Seed failed:', error.message);
  process.exit(1);
});
