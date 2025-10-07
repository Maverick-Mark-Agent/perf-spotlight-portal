import { secretsManager } from '@lib/secrets';

async function validateSecrets() {
  console.log('🔐 Validating secrets configuration...\n');

  try {
    const secrets = secretsManager.load();

    // Supabase
    console.log('✅ Supabase configuration:');
    console.log(`   URL: ${secrets.supabaseUrl}`);
    console.log(`   Service Role Key: ${secrets.supabaseServiceRoleKey.substring(0, 20)}...`);
    console.log(`   Anon Key: ${secrets.supabaseAnonKey.substring(0, 20)}...`);

    // Redis
    console.log('\n✅ Redis configuration:');
    console.log(`   URL: ${secrets.redisUrl}`);

    // Cole credentials
    console.log('\n✅ Cole X Dates credentials:');
    const coleStates = Object.keys(secrets.cole);
    if (coleStates.length === 0) {
      console.log('   ⚠️  No Cole state credentials configured');
    } else {
      for (const state of coleStates) {
        const creds = secrets.cole[state];
        console.log(`   ${state}: ${creds.username} / ${'*'.repeat(creds.password.length)}`);
      }
    }

    // Clay
    console.log('\n✅ Clay credentials:');
    console.log(`   Email: ${secrets.clay.email}`);
    console.log(`   Password: ${'*'.repeat(secrets.clay.password.length)}`);

    // Email Bison
    console.log('\n✅ Email Bison credentials:');
    console.log(`   Email: ${secrets.bison.email}`);
    console.log(`   Password: ${'*'.repeat(secrets.bison.password.length)}`);

    // Slack
    console.log('\n✅ Slack configuration:');
    console.log(`   Webhook URL: ${secrets.slackWebhookUrl.substring(0, 40)}...`);

    // Environment
    console.log('\n✅ Environment configuration:');
    console.log(`   NODE_ENV: ${secrets.nodeEnv}`);
    console.log(`   LOG_LEVEL: ${secrets.logLevel}`);
    console.log(`   HEADLESS: ${secrets.headless}`);
    console.log(`   SLOW_MO: ${secrets.slowMo}ms`);

    console.log('\n✅ All secrets validated successfully!\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Secrets validation failed:', error instanceof Error ? error.message : error);
    console.error('\nPlease check your .env file and ensure all required variables are set.\n');
    process.exit(1);
  }
}

validateSecrets();
