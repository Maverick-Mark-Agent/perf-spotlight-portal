# Phase 6: Cole X Dates Connector

**Milestone:** Data Pipeline
**Estimated Effort:** 8-10 hours
**Dependencies:** Phase 3 (Browser), Phase 4 (Secrets), Phase 5 (Logging)
**Blocks:** Phase 11 (PT1 - Cole Monthly Pulls)

---

## Overview

Build the Cole X Dates connector for automating homeowner data pulls. Handle multi-state logins, query building with ZIP codes and filters, automatic <10k chunking, and CSV download/parsing.

---

## Scope

### In Scope
- Multi-state login (NJ, TX, FL, CA with different credentials)
- Query builder (states, ZIPs, fields, filters)
- Automatic chunking for >10k results
- CSV download and parsing
- Error handling for auth, captcha, selector changes

### Out of Scope
- Manual data entry (automation only)
- Non-homeowner data types
- Data transformation (that's Phase 9)

---

## Tasks

### Task 1: Create Cole Connector Class

**File to create:** `src/connectors/cole.ts`

**Content:**
```typescript
import { BrowserController, AuthManager, ErrorHandler } from '@agents/browser';
import { secrets } from '@lib/secrets';
import { logger } from '@lib/logger';
import { AuthenticationError, SelectorNotFoundError } from '@lib/errors';
import { parse } from 'csv-parse/sync';
import fs from 'fs/promises';

export interface ColeQueryParams {
  state: string;
  zips: string[];
  fields: string[];
  filters?: {
    homeValueMax?: number;
    purchaseYearMin?: number;
    yearsAtAddressMin?: number;
  };
}

export interface ColeResult {
  records: Record<string, any>[];
  totalCount: number;
  chunks: number;
}

const SELECTORS = {
  // Login
  usernameInput: '#username',
  passwordInput: '#password',
  submitButton: 'button[type="submit"]',
  successIndicator: '.dashboard, .search-form',

  // Query building
  stateDropdown: '#state-select',
  listTypeRadio: 'input[value="emailing"]',
  zipInput: '#zip-codes',
  fieldCheckboxes: '.field-selector input[type="checkbox"]',

  // Results
  resultCount: '.result-count',
  selectAllCheckbox: '#select-all',
  downloadButton: '.download-csv',
  exportFormatRadio: 'input[value="csv"]',
};

export class ColeConnector {
  private browser: BrowserController;
  private authManager: AuthManager;
  private errorHandler: ErrorHandler;
  private baseUrl = 'https://coleinformation.com/products/cole-x-dates/';

  constructor() {
    this.browser = new BrowserController({ headless: secrets.headless, slowMo: secrets.slowMo });
    this.errorHandler = new ErrorHandler(this.browser);
  }

  async connect(state: string): Promise<void> {
    logger.info('Connecting to Cole X Dates', { state });

    await this.browser.launch();
    await this.browser.navigate(this.baseUrl);

    const page = this.browser.getPage();
    this.authManager = new AuthManager(page);

    // Get state-specific credentials
    const credentials = secrets.getColeCredentials(state);

    await this.authManager.login(
      credentials,
      {
        usernameInput: SELECTORS.usernameInput,
        passwordInput: SELECTORS.passwordInput,
        submitButton: SELECTORS.submitButton,
        successIndicator: SELECTORS.successIndicator,
      }
    );

    logger.info('Successfully connected to Cole', { state });
  }

  async queryData(params: ColeQueryParams): Promise<ColeResult> {
    logger.info('Querying Cole X Dates', { state: params.state, zipCount: params.zips.length });

    const page = this.browser.getPage();
    let allRecords: Record<string, any>[] = [];
    let chunks = 0;

    // Check if we need to chunk
    const estimatedCount = await this.estimateResultCount(params);

    if (estimatedCount > 10000) {
      logger.warn('Results exceed 10k, chunking required', { estimatedCount });
      const zipChunks = this.chunkZips(params.zips, estimatedCount);

      for (const zipChunk of zipChunks) {
        const chunkParams = { ...params, zips: zipChunk };
        const chunkRecords = await this.executeQuery(chunkParams);
        allRecords = allRecords.concat(chunkRecords);
        chunks++;
      }
    } else {
      allRecords = await this.executeQuery(params);
      chunks = 1;
    }

    return {
      records: allRecords,
      totalCount: allRecords.length,
      chunks,
    };
  }

  private async estimateResultCount(params: ColeQueryParams): Promise<number> {
    // Build query and check result count without downloading
    await this.buildQuery(params);

    const page = this.browser.getPage();
    const countText = await page.textContent(SELECTORS.resultCount);
    const match = countText?.match(/(\d+)\s+results/i);

    return match ? parseInt(match[1]) : 0;
  }

  private chunkZips(zips: string[], totalCount: number): string[][] {
    // Split ZIPs to keep each chunk under 10k
    const zipsPerChunk = Math.ceil((zips.length * 10000) / totalCount);
    const chunks: string[][] = [];

    for (let i = 0; i < zips.length; i += zipsPerChunk) {
      chunks.push(zips.slice(i, i + zipsPerChunk));
    }

    logger.info('Created ZIP chunks', { totalChunks: chunks.length, zipsPerChunk });
    return chunks;
  }

  private async buildQuery(params: ColeQueryParams): Promise<void> {
    const page = this.browser.getPage();

    // Navigate to new query
    await page.click('button:has-text("New Query")');
    await page.waitForTimeout(1000);

    // Select state
    await page.selectOption(SELECTORS.stateDropdown, params.state);

    // Select list type: Emailing
    await page.click(SELECTORS.listTypeRadio);

    // Enter ZIP codes
    const zipString = params.zips.join(',');
    await page.fill(SELECTORS.zipInput, zipString);

    // Select fields
    for (const field of params.fields) {
      const checkbox = await page.$(`input[name="${field}"]`);
      if (checkbox) {
        await checkbox.check();
      } else {
        logger.warn('Field not found', { field });
      }
    }

    // Apply filters
    if (params.filters?.homeValueMax) {
      await page.fill('#home-value-max', params.filters.homeValueMax.toString());
    }
    if (params.filters?.purchaseYearMin) {
      await page.fill('#purchase-year-min', params.filters.purchaseYearMin.toString());
    }

    // Submit query
    await page.click('button:has-text("Search")');
    await page.waitForSelector(SELECTORS.resultCount, { timeout: 30000 });
  }

  private async executeQuery(params: ColeQueryParams): Promise<Record<string, any>[]> {
    logger.info('Executing Cole query', { zipCount: params.zips.length });

    await this.buildQuery(params);
    const csvPath = await this.downloadResults();
    const records = await this.parseCSV(csvPath);

    logger.info('Query executed successfully', { recordCount: records.length });
    return records;
  }

  private async downloadResults(): Promise<string> {
    const page = this.browser.getPage();

    // Select all results
    await page.click(SELECTORS.selectAllCheckbox);

    // Click download
    await page.click('button:has-text("Download to Computer")');

    // Select CSV format
    await page.click(SELECTORS.exportFormatRadio);

    // Confirm download
    const downloadPromise = page.waitForEvent('download');
    await page.click('button:has-text("Export")');

    const download = await downloadPromise;
    const downloadPath = `downloads/cole-${Date.now()}.csv`;
    await download.saveAs(downloadPath);

    logger.info('CSV downloaded', { path: downloadPath });
    return downloadPath;
  }

  private async parseCSV(csvPath: string): Promise<Record<string, any>[]> {
    const csvContent = await fs.readFile(csvPath, 'utf-8');

    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    logger.info('CSV parsed', { recordCount: records.length });
    return records;
  }

  async disconnect(): Promise<void> {
    await this.browser.close();
    logger.info('Disconnected from Cole');
  }
}
```

**Acceptance:**
- [ ] ColeConnector class created
- [ ] Multi-state login support
- [ ] Query builder with fields and filters
- [ ] Automatic chunking for >10k results
- [ ] CSV download and parsing
- [ ] Error handling for selectors and auth

---

### Task 2: Create Required Fields Configuration

**File to create:** `src/connectors/cole-config.ts`

**Content:**
```typescript
export const COLE_REQUIRED_FIELDS = [
  'First_Name',
  'Last_Name',
  'Address_1',
  'City',
  'State',
  'Zip',
  'Cell_Phone_Number',
  'Email_Address',
  'Purchase_Date',
  'Home_Value',
  'Head_Household',
  'Income',
  'Date_of_Birth',
];

export const COLE_STATE_URLS: Record<string, string> = {
  NJ: 'https://coleinformation.com/nj',
  TX: 'https://coleinformation.com/tx',
  FL: 'https://coleinformation.com/fl',
  CA: 'https://coleinformation.com/ca',
};

export const COLE_MAX_RESULTS = 10000;
```

**Acceptance:**
- [ ] Required fields list matches SOP (13 fields)
- [ ] State-specific URLs configured
- [ ] Max results constant defined

---

### Task 3: Create Test Script

**File to create:** `tests/connectors/cole-test.ts`

**Content:**
```typescript
import { ColeConnector } from '@connectors/cole';
import { COLE_REQUIRED_FIELDS } from '@connectors/cole-config';
import { logger } from '@lib/logger';

async function testColeLogin() {
  const cole = new ColeConnector();

  try {
    await cole.connect('NJ');
    logger.info('✅ Cole login test passed');
    await cole.disconnect();
  } catch (error) {
    logger.error('❌ Cole login test failed', { error });
    throw error;
  }
}

async function testColeQuery() {
  const cole = new ColeConnector();

  try {
    await cole.connect('NJ');

    const result = await cole.queryData({
      state: 'NJ',
      zips: ['07030', '07031'], // Test with 2 ZIPs
      fields: COLE_REQUIRED_FIELDS,
    });

    logger.info('✅ Cole query test passed', {
      recordCount: result.totalCount,
      chunks: result.chunks
    });

    await cole.disconnect();
  } catch (error) {
    logger.error('❌ Cole query test failed', { error });
    throw error;
  }
}

async function runTests() {
  console.log('Running Cole connector tests...\n');

  await testColeLogin();
  await testColeQuery();

  console.log('\n✅ All Cole tests passed!');
}

runTests().catch((error) => {
  console.error('Tests failed:', error);
  process.exit(1);
});
```

**Acceptance:**
- [ ] Login test connects successfully
- [ ] Query test downloads and parses CSV
- [ ] Tests run with real credentials (headless=false for debugging)

---

### Task 4: Create Dry Run Script

**File to create:** `scripts/cole-dry-run.ts`

**Content:**
```typescript
import { ColeConnector } from '@connectors/cole';
import { COLE_REQUIRED_FIELDS } from '@connectors/cole-config';

async function dryRun() {
  const cole = new ColeConnector();

  console.log('🔍 Cole X Dates Dry Run\n');
  console.log('State: NJ');
  console.log('ZIPs: Test with 5 ZIPs');
  console.log('Fields:', COLE_REQUIRED_FIELDS.length, '\n');

  try {
    await cole.connect('NJ');

    const result = await cole.queryData({
      state: 'NJ',
      zips: ['07030', '07031', '07032', '07033', '07034'],
      fields: COLE_REQUIRED_FIELDS,
      filters: {
        homeValueMax: 900000,
      },
    });

    console.log('\n✅ Dry run complete!');
    console.log(`   Records: ${result.totalCount}`);
    console.log(`   Chunks: ${result.chunks}`);
    console.log(`   Sample record:`, result.records[0]);

    await cole.disconnect();
  } catch (error) {
    console.error('\n❌ Dry run failed:', error);
    await cole.disconnect();
    process.exit(1);
  }
}

dryRun();
```

**Acceptance:**
- [ ] Dry run script executes successfully
- [ ] Downloads real data from Cole
- [ ] Prints sample record for verification

---

### Task 5: Add NPM Scripts

**File to modify:** `package.json`

**Actions:**
```json
{
  "scripts": {
    "test:cole-login": "tsx tests/connectors/cole-test.ts",
    "test:cole-dry-run": "tsx scripts/cole-dry-run.ts"
  }
}
```

**Acceptance:**
- [ ] Scripts added
- [ ] `npm run test:cole-login` works
- [ ] `npm run test:cole-dry-run` works

---

## Definition of Done

- [ ] ColeConnector class created with all methods
- [ ] Multi-state login working (tested with NJ)
- [ ] Query builder creates correct Cole queries
- [ ] Automatic chunking implemented for >10k results
- [ ] CSV download and parsing working
- [ ] Required fields configuration defined
- [ ] Test scripts pass
- [ ] Dry run script downloads real data
- [ ] Error handling captures screenshots on failure
- [ ] No TypeScript errors

---

## Validation Commands

```bash
# Type check
npm run validate:types

# Test login only
npm run test:cole-login

# Full dry run with data download
npm run test:cole-dry-run

# Test with headless=false (see browser)
HEADLESS=false npm run test:cole-dry-run
```

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Cole UI changes break selectors | Use resilient selectors, multiple fallbacks, alert on failure |
| Login fails due to MFA | Implement MFA handling (TOTP), manual fallback |
| >10k chunking miscalculates | Test with high-volume ZIPs, conservative chunk sizing |
| Download fails/times out | Retry logic, increase timeout, verify download completion |
| CSV parsing errors | Validate CSV structure, handle malformed rows gracefully |

---

## Files Created

- `src/connectors/cole.ts`
- `src/connectors/cole-config.ts`
- `tests/connectors/cole-test.ts`
- `scripts/cole-dry-run.ts`

**Modified:**
- `package.json`

---

## Next Phase

**Phase 7:** Clay Connector
- Parallel to Phase 6 (can work independently)
- Needed for Phase 12 (PT2 - Clay Formatting)
