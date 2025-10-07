# Phase 4: Secrets Management & Environment Setup

**Milestone:** Foundation
**Estimated Effort:** 3-4 hours
**Dependencies:** Phase 2 (dotenv installed)
**Blocks:** Phases 6-9 (connectors need credentials)

---

## Overview

Implement secure secrets management for credentials (Cole, Clay, Bison), API keys (Supabase, Slack), and environment configuration. Create validation to ensure all required secrets are present before running automation.

---

## Scope

### In Scope
- Secrets loader with validation
- Environment variable management
- Site credentials CRUD operations
- Credential rotation documentation
- Local development setup

### Out of Scope
- Cloud secret manager integration (AWS Secrets Manager, etc.) - future enhancement
- MFA/TOTP implementation - Phase 3 placeholder
- Credential encryption at rest - handled by Supabase

---

## Tasks

### Task 1: Create Secrets Loader

**File to create:** `src/lib/secrets.ts`

**Content:**
```typescript
import dotenv from 'dotenv';
import { logger } from './logger';

dotenv.config();

export interface Secrets {
  // Supabase
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  supabaseAnonKey: string;

  // Redis
  redisUrl: string;

  // Cole X Dates (multi-state)
  cole: {
    [state: string]: {
      username: string;
      password: string;
    };
  };

  // Clay
  clay: {
    email: string;
    password: string;
  };

  // Email Bison
  bison: {
    email: string;
    password: string;
  };

  // Slack
  slackWebhookUrl: string;

  // Environment
  nodeEnv: string;
  logLevel: string;
  headless: boolean;
  slowMo: number;
}

class SecretsManager {
  private secrets: Secrets | null = null;

  load(): Secrets {
    if (this.secrets) return this.secrets;

    logger.info('Loading secrets from environment');

    // Load Cole credentials dynamically by state
    const coleStates = ['NJ', 'TX', 'FL', 'CA']; // Add more as needed
    const cole: { [state: string]: { username: string; password: string } } = {};

    for (const state of coleStates) {
      const username = process.env[`COLE_${state}_USERNAME`];
      const password = process.env[`COLE_${state}_PASSWORD`];

      if (username && password) {
        cole[state] = { username, password };
      }
    }

    this.secrets = {
      supabaseUrl: this.required('SUPABASE_URL'),
      supabaseServiceRoleKey: this.required('SUPABASE_SERVICE_ROLE_KEY'),
      supabaseAnonKey: this.required('SUPABASE_ANON_KEY'),

      redisUrl: this.optional('REDIS_URL', 'redis://localhost:6379'),

      cole,

      clay: {
        email: this.required('CLAY_EMAIL'),
        password: this.required('CLAY_PASSWORD'),
      },

      bison: {
        email: this.required('BISON_EMAIL'),
        password: this.required('BISON_PASSWORD'),
      },

      slackWebhookUrl: this.required('SLACK_WEBHOOK_URL'),

      nodeEnv: this.optional('NODE_ENV', 'development'),
      logLevel: this.optional('LOG_LEVEL', 'info'),
      headless: process.env.HEADLESS !== 'false',
      slowMo: parseInt(this.optional('SLOW_MO', '0')),
    };

    this.validate();
    logger.info('Secrets loaded successfully', { statesConfigured: Object.keys(cole) });

    return this.secrets;
  }

  private required(key: string): string {
    const value = process.env[key];
    if (!value) {
      throw new Error(`Required environment variable ${key} is not set`);
    }
    return value;
  }

  private optional(key: string, defaultValue: string): string {
    return process.env[key] || defaultValue;
  }

  private validate(): void {
    if (!this.secrets) throw new Error('Secrets not loaded');

    // Validate URLs
    try {
      new URL(this.secrets.supabaseUrl);
      new URL(this.secrets.redisUrl);
      new URL(this.secrets.slackWebhookUrl);
    } catch (error) {
      throw new Error('Invalid URL in environment variables');
    }

    // Validate at least one Cole state configured
    if (Object.keys(this.secrets.cole).length === 0) {
      logger.warn('No Cole state credentials configured');
    }

    // Validate email formats
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.secrets.clay.email)) {
      throw new Error('Invalid CLAY_EMAIL format');
    }
    if (!emailRegex.test(this.secrets.bison.email)) {
      throw new Error('Invalid BISON_EMAIL format');
    }
  }

  getColeCredentials(state: string): { username: string; password: string } {
    if (!this.secrets) throw new Error('Secrets not loaded');

    const creds = this.secrets.cole[state];
    if (!creds) {
      throw new Error(`No Cole credentials configured for state: ${state}`);
    }

    return creds;
  }

  get(): Secrets {
    if (!this.secrets) {
      return this.load();
    }
    return this.secrets;
  }
}

export const secretsManager = new SecretsManager();
export const secrets = secretsManager.get();
```

**Acceptance:**
- [ ] SecretsManager class created
- [ ] Loads all required environment variables
- [ ] Validates URLs and email formats
- [ ] Supports multi-state Cole credentials
- [ ] Throws errors for missing required secrets
- [ ] Exports singleton instance

---

### Task 2: Update `.env.example`

**File to modify:** `.env.example` (created in Phase 2)

**Actions:**
Add comments and organize by category:

```bash
# ===========================================
# SUPABASE CONFIGURATION
# ===========================================
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
SUPABASE_ANON_KEY=your-anon-key-here

# ===========================================
# REDIS (for BullMQ job queue)
# ===========================================
REDIS_URL=redis://localhost:6379
# For production: redis://user:password@host:port

# ===========================================
# COLE X DATES CREDENTIALS (per state)
# ===========================================
# Note: Different states have different login portals
# Add credentials for each state your clients are licensed in

# New Jersey
COLE_NJ_USERNAME=your-nj-username
COLE_NJ_PASSWORD=your-nj-password

# Texas
COLE_TX_USERNAME=your-tx-username
COLE_TX_PASSWORD=your-tx-password

# Florida (add if needed)
# COLE_FL_USERNAME=your-fl-username
# COLE_FL_PASSWORD=your-fl-password

# California (add if needed)
# COLE_CA_USERNAME=your-ca-username
# COLE_CA_PASSWORD=your-ca-password

# ===========================================
# CLAY (data transformation platform)
# ===========================================
CLAY_EMAIL=your-clay-email@example.com
CLAY_PASSWORD=your-clay-password

# ===========================================
# EMAIL BISON (email campaign platform)
# ===========================================
BISON_EMAIL=your-bison-email@example.com
BISON_PASSWORD=your-bison-password

# ===========================================
# SLACK NOTIFICATIONS
# ===========================================
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
# Create webhook: https://api.slack.com/messaging/webhooks

# ===========================================
# PLAYWRIGHT / BROWSER AUTOMATION
# ===========================================
HEADLESS=true       # Set to false for debugging (shows browser window)
SLOW_MO=0           # Milliseconds to slow down operations (useful for debugging)

# ===========================================
# APPLICATION ENVIRONMENT
# ===========================================
NODE_ENV=development  # development | production | test
LOG_LEVEL=info        # debug | info | warn | error
```

**Acceptance:**
- [ ] `.env.example` updated with comments
- [ ] Organized by category
- [ ] Includes instructions for obtaining credentials
- [ ] Documents optional vs required variables

---

### Task 3: Create Site Credentials Seed Script

**File to create:** `scripts/seed-site-credentials.ts`

**Content:**
```typescript
import { createClient } from '@supabase/supabase-js';
import { secrets } from '@lib/secrets';
import { logger } from '@lib/logger';

const supabase = createClient(secrets.supabaseUrl, secrets.supabaseServiceRoleKey);

async function seedSiteCredentials() {
  logger.info('Seeding site credentials');

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
      logger.error('Failed to seed credential', { site: cred.site, error });
    } else {
      logger.info('Credential seeded', { site: cred.site, username: cred.username });
    }
  }

  logger.info('Site credentials seeded successfully');
}

seedSiteCredentials().catch((error) => {
  logger.error('Seed failed', { error });
  process.exit(1);
});
```

**Acceptance:**
- [ ] Seed script created
- [ ] Inserts credentials into `site_credentials` table
- [ ] Uses upsert to avoid duplicates
- [ ] Can run multiple times safely

---

### Task 4: Create Credential Rotation Runbook

**File to create:** `docs/runbooks/credential-rotation.md`

**Content:**
```markdown
# Credential Rotation Runbook

## Overview
Regular credential rotation improves security. This runbook covers rotating credentials for Cole, Clay, Bison, and API keys.

## Frequency
- **Production:** Rotate every 90 days
- **Staging/Dev:** Rotate every 180 days
- **Immediately:** After suspected compromise

## Process

### 1. Cole X Dates Credentials

**Steps:**
1. Log in to Cole X Dates portal for each state
2. Navigate to account settings
3. Change password (use password manager to generate strong password)
4. Update `.env` file: `COLE_{STATE}_PASSWORD=new-password`
5. Update `site_credentials` table: Run `npm run seed:credentials`
6. Test login: `npm run test:cole-login`
7. Document rotation in password management tool

**Rollback:**
- Keep old password for 24 hours in case of issues
- Update `.env` back to old password if automation fails

---

### 2. Clay Credentials

**Steps:**
1. Log in to Clay: https://clay.com
2. Settings → Change Password
3. Update `.env`: `CLAY_PASSWORD=new-password`
4. Run seed script: `npm run seed:credentials`
5. Test: `npm run test:clay-login`

---

### 3. Email Bison Credentials

**Steps:**
1. Log in to Email Bison
2. Account Settings → Security → Change Password
3. Update `.env`: `BISON_PASSWORD=new-password`
4. Run seed script
5. Test: `npm run test:bison-login`

---

### 4. Supabase API Keys

**Steps:**
1. Supabase Dashboard → Settings → API
2. Generate new service role key
3. Update `.env`: `SUPABASE_SERVICE_ROLE_KEY=new-key`
4. Update GitHub Actions secrets (if using CI/CD)
5. Test database connection: `npm run test:db`
6. Revoke old key after 24 hours

---

### 5. Slack Webhook URL

**Steps:**
1. Slack App Settings → Incoming Webhooks
2. Regenerate webhook URL
3. Update `.env`: `SLACK_WEBHOOK_URL=new-url`
4. Test: `npm run test:slack`

---

## Verification Checklist

After rotating credentials:
- [ ] All `.env` files updated (local, staging, production)
- [ ] GitHub Actions secrets updated
- [ ] `site_credentials` table updated
- [ ] Test scripts pass
- [ ] No automation failures in last 24 hours
- [ ] Old credentials revoked/disabled
- [ ] Password manager updated
- [ ] Team notified via Slack

## Emergency Response

If credentials are compromised:
1. **Immediately** change passwords on all platforms
2. Update `.env` and re-deploy
3. Review audit logs for suspicious activity
4. Report to Head of Fulfillment
5. Document incident in security log
```

**Acceptance:**
- [ ] Runbook created with step-by-step instructions
- [ ] Covers all credential types
- [ ] Includes rollback procedures
- [ ] Documents emergency response

---

### Task 5: Create Validation Script

**File to create:** `scripts/validate-secrets.ts`

**Content:**
```typescript
import { secretsManager } from '@lib/secrets';
import { logger } from '@lib/logger';

function validateSecrets() {
  console.log('🔍 Validating environment secrets...\n');

  try {
    const secrets = secretsManager.load();

    console.log('✅ Supabase Configuration');
    console.log(`   URL: ${secrets.supabaseUrl}`);
    console.log(`   Service Role Key: ${secrets.supabaseServiceRoleKey.substring(0, 20)}...`);

    console.log('\n✅ Redis Configuration');
    console.log(`   URL: ${secrets.redisUrl}`);

    console.log('\n✅ Cole X Dates');
    Object.entries(secrets.cole).forEach(([state, creds]) => {
      console.log(`   ${state}: ${creds.username}`);
    });

    console.log('\n✅ Clay');
    console.log(`   Email: ${secrets.clay.email}`);

    console.log('\n✅ Email Bison');
    console.log(`   Email: ${secrets.bison.email}`);

    console.log('\n✅ Slack');
    console.log(`   Webhook: ${secrets.slackWebhookUrl.substring(0, 40)}...`);

    console.log('\n✅ Environment');
    console.log(`   Node Env: ${secrets.nodeEnv}`);
    console.log(`   Log Level: ${secrets.logLevel}`);
    console.log(`   Headless: ${secrets.headless}`);

    console.log('\n✅ All secrets validated successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Secret validation failed:');
    console.error(`   ${error}`);
    console.error('\nPlease check your .env file and ensure all required variables are set.');
    console.error('See .env.example for reference.\n');
    process.exit(1);
  }
}

validateSecrets();
```

**Acceptance:**
- [ ] Validation script created
- [ ] Prints all configured secrets (sanitized)
- [ ] Exits with error code 1 if validation fails
- [ ] Provides helpful error messages

---

### Task 6: Add NPM Scripts

**File to modify:** `package.json`

**Actions:**
Add scripts for secret management:
```json
{
  "scripts": {
    "validate:secrets": "tsx scripts/validate-secrets.ts",
    "seed:credentials": "tsx scripts/seed-site-credentials.ts"
  }
}
```

**Acceptance:**
- [ ] Scripts added to package.json
- [ ] `npm run validate:secrets` works
- [ ] `npm run seed:credentials` works

---

## Definition of Done

- [ ] Secrets manager created with validation
- [ ] Supports multi-state Cole credentials
- [ ] `.env.example` updated with comments and categories
- [ ] Site credentials seed script created
- [ ] Credential rotation runbook documented
- [ ] Validation script created and tested
- [ ] NPM scripts added for secret management
- [ ] All required secrets load without errors
- [ ] Email and URL formats validated

---

## Validation Commands

```bash
# Validate all secrets
npm run validate:secrets

# Seed credentials to database
npm run seed:credentials

# Check .env file exists
test -f .env && echo "✅ .env exists" || echo "❌ .env missing"

# Type check
npm run validate:types
```

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Secrets leaked in git | Ensure `.env` in `.gitignore`, use pre-commit hooks |
| Missing required secrets | Validation script fails fast with clear errors |
| Credentials expire/rotate | Document rotation process, set calendar reminders |
| Multi-environment confusion | Use separate `.env.staging`, `.env.production` files |

---

## Files Created

- `src/lib/secrets.ts`
- `scripts/seed-site-credentials.ts`
- `scripts/validate-secrets.ts`
- `docs/runbooks/credential-rotation.md`

**Modified:**
- `.env.example`
- `package.json`

---

## Next Phase

**Phase 5:** Error Handling & Logging Framework
- Parallel to Phase 4 (can work independently)
- Used by all connectors and workflows
