import { BrowserController, AuthManager, ErrorHandler } from '@agents/browser';
import { secrets } from '@lib/secrets';
import { logger } from '@lib/logger';
import { AuthenticationError, SelectorNotFoundError } from '@lib/errors';
import { parse } from 'csv-parse/sync';
import fs from 'fs/promises';
import { coleSelectors } from '../config/connectors/cole-selectors';

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
  usernameInput: coleSelectors.login.usernameInput,
  passwordInput: coleSelectors.login.passwordInput,
  submitButton: coleSelectors.login.submitButton,
  successIndicator: coleSelectors.login.successIndicator,

  // Query building
  stateDropdown: coleSelectors.query.stateDropdown,
  listTypeRadio: coleSelectors.query.listTypeRadio,
  zipInput: coleSelectors.query.zipInput,
  fieldCheckboxes: coleSelectors.query.fieldCheckboxes,

  // Results
  resultCount: coleSelectors.results.resultCount,
  selectAllCheckbox: coleSelectors.results.selectAllCheckbox,
  downloadButton: coleSelectors.results.downloadButton,
  exportFormatRadio: coleSelectors.results.exportFormatRadio,
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
