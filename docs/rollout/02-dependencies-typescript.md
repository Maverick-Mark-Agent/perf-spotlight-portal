# Phase 2: Install Dependencies & Configure TypeScript

**Milestone:** Foundation
**Estimated Effort:** 2-3 hours
**Dependencies:** Phase 1 (stable schema)
**Blocks:** Phases 3-20 (all automation code)

---

## Overview

Install all required dependencies for browser automation, job scheduling, notifications, and data processing. Configure TypeScript with path aliases and generate Supabase types from the database schema.

---

## Scope

### In Scope
- Install Playwright, BullMQ, Redis client, Slack SDK, dotenv, csv-parse
- Configure TypeScript path aliases for clean imports
- Generate Supabase types from schema
- Set up ESLint rules for automation code
- Create basic npm scripts for automation tasks

### Out of Scope
- Writing actual automation code (that's phases 3+)
- Configuring Redis server (assumes Redis available)
- Setting up CI/CD (that's phase 17)

---

## Tasks

### Task 1: Install Core Dependencies

**Commands:**
```bash
npm install --save playwright @playwright/test bullmq ioredis @slack/webhook dotenv csv-parse zod
```

**Package purposes:**
- `playwright` - Browser automation for Cole, Clay, Bison
- `@playwright/test` - Testing framework for connectors
- `bullmq` - Job queue for orchestration
- `ioredis` - Redis client (required by BullMQ)
- `@slack/webhook` - Slack notifications
- `dotenv` - Load environment variables
- `csv-parse` - Parse CSV exports from Cole/Clay
- `zod` - Runtime validation for configs and data

**Acceptance:**
- [ ] All packages installed in `package.json`
- [ ] No peer dependency warnings
- [ ] `npm install` completes without errors

---

### Task 2: Install Playwright Browsers

**Commands:**
```bash
npx playwright install chromium
npx playwright install-deps  # Install system dependencies
```

**Actions:**
1. Install Chromium browser for headless automation
2. Install system libraries (fonts, codecs, etc.)
3. Verify installation works

**Test command:**
```bash
npx playwright --version
```

**Acceptance:**
- [ ] Chromium browser installed
- [ ] System dependencies installed
- [ ] Playwright version prints successfully

---

### Task 3: Install Development Dependencies

**Commands:**
```bash
npm install --save-dev @types/node tsx nodemon
```

**Package purposes:**
- `@types/node` - TypeScript types for Node.js APIs
- `tsx` - Fast TypeScript execution (alternative to ts-node)
- `nodemon` - Auto-restart for development

**Acceptance:**
- [ ] Dev dependencies installed
- [ ] TypeScript recognizes Node.js types (no import errors)

---

### Task 4: Configure TypeScript Path Aliases

**File to modify:** `tsconfig.json`

**Actions:**
1. Add path aliases for clean imports:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@agents/*": ["./src/agents/*"],
      "@connectors/*": ["./src/connectors/*"],
      "@pipeline/*": ["./src/pipeline/*"],
      "@orchestrator/*": ["./src/orchestrator/*"],
      "@workflows/*": ["./src/workflows/*"],
      "@lib/*": ["./src/lib/*"],
      "@types/*": ["./src/types/*"]
    }
  }
}
```

2. Ensure these directories will exist:
```bash
mkdir -p src/agents/browser
mkdir -p src/connectors
mkdir -p src/pipeline
mkdir -p src/orchestrator
mkdir -p src/workflows
mkdir -p src/lib
mkdir -p src/types
```

**Acceptance:**
- [ ] Path aliases configured in `tsconfig.json`
- [ ] Directories created
- [ ] Import like `import { logger } from '@lib/logger'` works (no errors)

---

### Task 5: Generate Supabase Types

**Commands:**
```bash
# Generate types from remote database
npx supabase gen types typescript --project-id $PROJECT_ID > src/types/supabase.ts

# Or from local database
npx supabase gen types typescript --local > src/types/supabase.ts
```

**Actions:**
1. Ensure Phase 1 migrations are applied
2. Generate TypeScript types for all tables
3. Verify types include `client_zipcodes`, `monthly_cleaned_leads`, `agent_runs`, etc.

**Example usage:**
```typescript
import { Database } from '@/types/supabase';

type ClientZipcode = Database['public']['Tables']['client_zipcodes']['Row'];
type AgentRun = Database['public']['Tables']['agent_runs']['Row'];
```

**Acceptance:**
- [ ] `src/types/supabase.ts` created
- [ ] File contains types for all tables from Phase 1
- [ ] No TypeScript errors when importing types

---

### Task 6: Create Environment Template

**File to create:** `.env.example`

**Content:**
```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key

# Redis (for BullMQ)
REDIS_URL=redis://localhost:6379

# Cole X Dates Credentials (per state)
COLE_NJ_USERNAME=your-nj-username
COLE_NJ_PASSWORD=your-nj-password
COLE_TX_USERNAME=your-tx-username
COLE_TX_PASSWORD=your-tx-password

# Clay
CLAY_EMAIL=your-clay-email
CLAY_PASSWORD=your-clay-password

# Email Bison
BISON_EMAIL=your-bison-email
BISON_PASSWORD=your-bison-password

# Slack
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Playwright
HEADLESS=true  # Set to false for debugging
SLOW_MO=0      # Milliseconds to slow down Playwright operations

# Environment
NODE_ENV=development
LOG_LEVEL=info  # debug, info, warn, error
```

**Actions:**
1. Create `.env.example` with all required variables
2. Add `.env` to `.gitignore` (if not already)
3. Copy to `.env` for local development

**Acceptance:**
- [ ] `.env.example` created with all required variables
- [ ] `.env` in `.gitignore`
- [ ] Local `.env` file created and populated

---

### Task 7: Add NPM Scripts for Automation

**File to modify:** `package.json`

**Actions:**
Add scripts section for automation tasks:
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",

    "agent:dev": "nodemon --watch 'src/**/*.ts' --exec tsx",
    "agent:run": "tsx",

    "types:generate": "supabase gen types typescript --local > src/types/supabase.ts",

    "test:connectors": "playwright test tests/connectors",
    "test:pipeline": "playwright test tests/pipeline",
    "test:all": "playwright test",

    "workflow:monthly": "tsx src/workflows/monthly.ts",
    "workflow:weekly": "tsx src/workflows/weekly.ts",

    "validate:migrations": "supabase db diff",
    "validate:types": "tsc --noEmit",
    "validate:all": "npm run validate:migrations && npm run validate:types"
  }
}
```

**Acceptance:**
- [ ] Scripts added to `package.json`
- [ ] `npm run validate:types` runs successfully
- [ ] Scripts ready for future phases

---

### Task 8: ESLint Configuration for Automation Code

**File to modify:** `eslint.config.js` (or create if missing)

**Actions:**
1. Add rules for automation code:
```javascript
export default [
  {
    files: ['src/agents/**/*.ts', 'src/connectors/**/*.ts', 'src/workflows/**/*.ts'],
    rules: {
      'no-console': 'off',  // Allow console logs in automation
      '@typescript-eslint/no-explicit-any': 'warn',  // Warn on 'any', don't error
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    }
  }
];
```

2. Ensure TypeScript files in automation folders follow consistent style

**Acceptance:**
- [ ] ESLint configured for automation code
- [ ] `npm run lint` runs without errors
- [ ] Console logs allowed in agent code

---

### Task 9: Create Basic Type Definitions

**File to create:** `src/types/agents.ts`

**Content:**
```typescript
import { Database } from './supabase';

// Supabase table types
export type AgentRun = Database['public']['Tables']['agent_runs']['Row'];
export type AgentRunInsert = Database['public']['Tables']['agent_runs']['Insert'];
export type ClientZipcode = Database['public']['Tables']['client_zipcodes']['Row'];
export type MonthlyCleanedLead = Database['public']['Tables']['monthly_cleaned_leads']['Row'];
export type RawLead = Database['public']['Tables']['raw_leads']['Row'];
export type CleanedLead = Database['public']['Tables']['cleaned_leads']['Row'];

// Agent types
export type WorkflowType = 'cole_pull' | 'clay_format' | 'bison_upload' | 'evergreen_update' | 'full_pipeline';
export type RunStatus = 'running' | 'success' | 'failed' | 'partial';
export type ErrorType = 'AUTH' | 'CAPTCHA' | 'SELECTOR_MISS' | 'NETWORK' | 'TIMEOUT' | 'VALIDATION' | 'UPLOAD';

// Config types
export interface ClientConfig {
  id: number;
  name: string;
  workspace: string;
  states: string[];
  zips: string[];
  packageTier: 100 | 200;  // replies/month
  targetCount: number;      // 15000 or 30000
  filters?: {
    homeValueMax?: number;
    purchaseYearMin?: number;
    yearsAtAddressMin?: number;
  };
}

// Lead types
export interface LeadData {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  address1: string;
  city: string;
  state: string;
  zip: string;
  dob?: string;
  purchaseDate: string;
  homeValue: number;
  income?: number;
  headHousehold?: boolean;
}

// Browser types
export interface BrowserOptions {
  headless: boolean;
  slowMo: number;
  timeout: number;
}

// Connector types
export interface ConnectorResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  recordCount?: number;
}
```

**Acceptance:**
- [ ] `src/types/agents.ts` created
- [ ] Types import without errors
- [ ] Can use types in future phases

---

## Definition of Done

- [ ] All dependencies installed (`playwright`, `bullmq`, `ioredis`, `@slack/webhook`, etc.)
- [ ] Playwright Chromium browser installed
- [ ] TypeScript path aliases configured in `tsconfig.json`
- [ ] Required directories created (`agents/`, `connectors/`, `pipeline/`, etc.)
- [ ] Supabase types generated (`src/types/supabase.ts`)
- [ ] `.env.example` created with all required variables
- [ ] `.env` file created locally
- [ ] NPM scripts added for automation tasks
- [ ] ESLint configured for automation code
- [ ] Basic type definitions created (`src/types/agents.ts`)
- [ ] `npm run validate:types` passes

---

## Validation Commands

```bash
# Verify dependencies installed
npm list playwright bullmq ioredis @slack/webhook dotenv csv-parse

# Check Playwright installation
npx playwright --version

# Generate Supabase types
npm run types:generate

# Validate TypeScript configuration
npm run validate:types

# Lint code
npm run lint

# Test directory structure exists
ls -la src/agents src/connectors src/pipeline src/orchestrator src/workflows src/lib src/types
```

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Playwright browser download fails | Use `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=0`, check disk space |
| Redis not available locally | Use Docker: `docker run -d -p 6379:6379 redis:alpine` |
| Type generation fails | Ensure Phase 1 migrations applied, check Supabase CLI version |
| Path aliases don't work in Vite | Update `vite.config.ts` to include path resolution |

---

## Files Created/Modified

**Created:**
- `.env.example`
- `src/types/supabase.ts`
- `src/types/agents.ts`
- Directories: `src/agents/`, `src/connectors/`, `src/pipeline/`, etc.

**Modified:**
- `package.json` (dependencies + scripts)
- `tsconfig.json` (path aliases)
- `eslint.config.js` (automation rules)

---

## Next Phase

**Phase 3:** Core Browser Automation Infrastructure
- Requires Phase 2 complete (dependencies installed)
- Will create BrowserController, AuthManager, ErrorHandler
