import { BrowserController, AuthManager, ErrorHandler } from '@agents/browser';
import { secrets } from '@lib/secrets';
import { logger } from '@lib/logger';
import { parse } from 'csv-parse/sync';
import fs from 'fs/promises';

export interface ClayImportParams {
  clientName: string;
  month: string;
  csvPath: string;
  tableName?: string;
}

export interface ClayFormula {
  name: string;
  description: string;
  insertAfterColumn: string;
}

export interface ClayFilter {
  column: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'less_than' | 'greater_than' | 'is_empty' | 'not_empty';
  value?: string | number;
}

export interface ClayExportParams {
  filters?: ClayFilter[];
  outputPath: string;
}

const SELECTORS = {
  // Login
  emailInput: 'input[name="email"]',
  passwordInput: 'input[name="password"]',
  loginButton: 'button[type="submit"]',
  successIndicator: '.workspace-nav, .folder-tree',

  // Navigation
  folderLink: (name: string) => `a:has-text("${name}")`,
  newButton: 'button:has-text("New")',
  newFolderOption: '[role="menuitem"]:has-text("Folder")',
  newWorkbookOption: '[role="menuitem"]:has-text("Workbook")',

  // Import
  addButton: 'button:has-text("Add")',
  importCSVOption: '[role="menuitem"]:has-text("Import from CSV")',
  fileInput: 'input[type="file"]',
  delimiterSelect: 'select[name="delimiter"]',
  addToCurrentTable: 'input[value="add"]',
  continueButton: 'button:has-text("Continue")',
  saveAndRunButton: 'button:has-text("Save and run rows")',

  // Formulas
  columnHeader: (name: string) => `th:has-text("${name}")`,
  insertColumnRight: 'button:has-text("Insert 1 column right")',
  formulaOption: '[role="menuitem"]:has-text("Formula")',
  formulaDescriptionInput: 'textarea[placeholder*="Describe"]',
  generateFormulaButton: 'button:has-text("Generate Formula")',
  saveButton: 'button:has-text("Save")',

  // Enrichment
  addEnrichmentButton: 'button:has-text("Add enrichment")',
  searchEnrichment: 'input[placeholder*="Search"]',
  debounceOption: '[role="option"]:has-text("Debounce")',
  validateEmailOption: '[role="option"]:has-text("Validate Email")',
  columnMappingInput: 'input[placeholder*="column"]',
  firstSafeToSendToggle: 'input[name="first_safe_to_send_email"]',

  // Filters
  filtersButton: 'button:has-text("Filters")',
  addFilterButton: 'button:has-text("Add filter")',
  filterColumn: 'select[name="filter_column"]',
  filterOperator: 'select[name="filter_operator"]',
  filterValue: 'input[name="filter_value"]',

  // Export
  actionsButton: 'button:has-text("Actions")',
  exportOption: '[role="menuitem"]:has-text("Export")',
  downloadCSVButton: 'button:has-text("Download CSV")',
};

export class ClayConnector {
  private browser: BrowserController;
  private authManager: AuthManager;
  private errorHandler: ErrorHandler;
  private baseUrl = 'https://clay.com';
  private currentTableRowCount = 0;

  constructor() {
    this.browser = new BrowserController({ headless: secrets.headless, slowMo: secrets.slowMo });
    this.errorHandler = new ErrorHandler(this.browser);
  }

  async connect(): Promise<void> {
    logger.info('Connecting to Clay');

    await this.browser.launch();
    await this.browser.navigate(`${this.baseUrl}/login`);

    const page = this.browser.getPage();
    this.authManager = new AuthManager(page);

    await this.authManager.login(
      { username: secrets.clay.email, password: secrets.clay.password },
      {
        usernameInput: SELECTORS.emailInput,
        passwordInput: SELECTORS.passwordInput,
        submitButton: SELECTORS.loginButton,
        successIndicator: SELECTORS.successIndicator,
      }
    );

    logger.info('Successfully connected to Clay');
  }

  async createWorkbook(clientName: string, month: string): Promise<void> {
    logger.info('Creating Clay workbook', { clientName, month });

    const page = this.browser.getPage();

    // Navigate to B2C folder
    await page.click(SELECTORS.folderLink('B2C'));
    await page.waitForTimeout(1000);

    // Navigate to client folder
    await page.click(SELECTORS.folderLink(clientName));
    await page.waitForTimeout(1000);

    // Create month folder if needed
    await page.click(SELECTORS.newButton);
    await page.click(SELECTORS.newFolderOption);
    await page.fill('input[placeholder="Folder name"]', month);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    // Create workbook in month folder
    await page.click(SELECTORS.folderLink(month));
    await page.waitForTimeout(1000);
    await page.click(SELECTORS.newButton);
    await page.click(SELECTORS.newWorkbookOption);
    await page.waitForTimeout(2000);

    logger.info('Workbook created successfully');
  }

  async importCSV(params: ClayImportParams): Promise<void> {
    logger.info('Importing CSV to Clay', { csvPath: params.csvPath });

    const page = this.browser.getPage();
    const csvContent = await fs.readFile(params.csvPath, 'utf-8');
    const records = parse(csvContent, { columns: true });

    // Check if we need a new table (40k limit)
    if (this.currentTableRowCount + records.length > 40000) {
      logger.warn('Approaching 40k limit, creating new table');
      await page.click(SELECTORS.addButton);
      await page.waitForTimeout(500);
      this.currentTableRowCount = 0;
    }

    // Import CSV
    await page.click(SELECTORS.addButton);
    await page.click(SELECTORS.importCSVOption);

    // Upload file
    const fileInput = await page.$(SELECTORS.fileInput);
    await fileInput?.setInputFiles(params.csvPath);

    // Set delimiter to comma
    await page.selectOption(SELECTORS.delimiterSelect, 'comma');

    // Add to current table
    await page.click(SELECTORS.addToCurrentTable);
    await page.click(SELECTORS.continueButton);

    // Wait for import to process
    await page.waitForTimeout(2000);

    // Save and run
    await page.click(SELECTORS.saveAndRunButton);

    this.currentTableRowCount += records.length;
    logger.info('CSV imported successfully', { rowCount: records.length });
  }

  async addFormulaColumn(formula: ClayFormula): Promise<void> {
    logger.info('Adding formula column', { name: formula.name });

    const page = this.browser.getPage();

    // Right-click on column header
    await page.click(SELECTORS.columnHeader(formula.insertAfterColumn), { button: 'right' });
    await page.click(SELECTORS.insertColumnRight);

    // Select Formula option
    await page.click(SELECTORS.formulaOption);

    // Enter formula description
    await page.fill(SELECTORS.formulaDescriptionInput, formula.description);

    // Generate formula
    await page.click(SELECTORS.generateFormulaButton);
    await page.waitForTimeout(3000); // Wait for AI to generate

    // Save and run
    await page.click(SELECTORS.saveButton);
    await page.click(SELECTORS.saveAndRunButton);

    logger.info('Formula column added successfully');
  }

  async runDebounce(emailColumn: string): Promise<void> {
    logger.info('Running Debounce email validation');

    const page = this.browser.getPage();

    // Add enrichment
    await page.click(SELECTORS.addEnrichmentButton);

    // Search for Debounce
    await page.fill(SELECTORS.searchEnrichment, 'Debounce');
    await page.click(SELECTORS.debounceOption);
    await page.click(SELECTORS.validateEmailOption);

    // Map email column
    await page.fill(SELECTORS.columnMappingInput, `/${emailColumn}`);

    // Toggle "First Safe To Send Email"
    await page.check(SELECTORS.firstSafeToSendToggle);

    // Save
    await page.click(SELECTORS.continueButton);
    await page.click(SELECTORS.saveAndRunButton);

    logger.info('Debounce enrichment started, waiting for completion...');

    // Wait for enrichment to complete (poll status)
    await this.waitForEnrichmentCompletion();

    logger.info('Debounce enrichment completed');
  }

  private async waitForEnrichmentCompletion(timeoutMs = 3600000): Promise<void> {
    const page = this.browser.getPage();
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      // Check for completion indicator
      const isComplete = await page.isVisible('.enrichment-complete', { timeout: 5000 }).catch(() => false);

      if (isComplete) {
        return;
      }

      await page.waitForTimeout(30000); // Check every 30 seconds
    }

    throw new Error('Debounce enrichment timeout');
  }

  async applyFilters(filters: ClayFilter[]): Promise<void> {
    logger.info('Applying filters', { filterCount: filters.length });

    const page = this.browser.getPage();

    await page.click(SELECTORS.filtersButton);

    for (const filter of filters) {
      await page.click(SELECTORS.addFilterButton);
      await page.selectOption(SELECTORS.filterColumn, filter.column);
      await page.selectOption(SELECTORS.filterOperator, filter.operator);

      if (filter.value !== undefined) {
        await page.fill(SELECTORS.filterValue, filter.value.toString());
      }
    }

    logger.info('Filters applied successfully');
  }

  async exportCSV(params: ClayExportParams): Promise<string> {
    logger.info('Exporting CSV from Clay');

    const page = this.browser.getPage();

    if (params.filters) {
      await this.applyFilters(params.filters);
    }

    // Open actions menu
    await page.click(SELECTORS.actionsButton);
    await page.click(SELECTORS.exportOption);

    // Download CSV
    const downloadPromise = page.waitForEvent('download');
    await page.click(SELECTORS.downloadCSVButton);

    const download = await downloadPromise;
    await download.saveAs(params.outputPath);

    logger.info('CSV exported successfully', { path: params.outputPath });
    return params.outputPath;
  }

  async disconnect(): Promise<void> {
    await this.browser.close();
    logger.info('Disconnected from Clay');
  }
}
