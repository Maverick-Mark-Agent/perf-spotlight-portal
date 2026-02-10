import { BrowserController, AuthManager } from '@agents/browser';
import { secrets } from '@lib/secrets';
import { logger } from '@lib/logger';

export interface BisonImportParams {
  workspace: string;
  csvPath: string;
  listName: string;
  fieldMapping: Record<string, string>;
}

export interface BisonCampaign {
  id: string;
  title: string;
  contactCount: number;
}

export class BisonConnector {
  private browser: BrowserController;
  private authManager: AuthManager;
  private baseUrl = 'https://emailbison.com';

  constructor() {
    this.browser = new BrowserController({ headless: secrets.headless, slowMo: secrets.slowMo });
  }

  async connect(workspace: string): Promise<void> {
    logger.info('Connecting to Email Bison', { workspace });

    await this.browser.launch();
    await this.browser.navigate(`${this.baseUrl}/login`);

    const page = this.browser.getPage();
    this.authManager = new AuthManager(page);

    await this.authManager.login(
      { username: secrets.bison.email, password: secrets.bison.password },
      {
        usernameInput: 'input[name="email"]',
        passwordInput: 'input[name="password"]',
        submitButton: 'button[type="submit"]',
        successIndicator: '.workspace-selector',
      }
    );

    // Navigate to workspace
    await page.click(`a:has-text("${workspace}")`);
    await page.waitForTimeout(1000);

    logger.info('Successfully connected to Bison workspace');
  }

  async importContacts(params: BisonImportParams): Promise<number> {
    logger.info('Importing contacts to Bison', { listName: params.listName });

    const page = this.browser.getPage();

    await page.click('a:has-text("Contacts")');
    await page.click('button:has-text("Import new contacts")');

    // Upload CSV
    const fileInput = await page.$('input[type="file"]');
    await fileInput?.setInputFiles(params.csvPath);

    // Name the list
    await page.fill('input[name="list_name"]', params.listName);

    // Map fields
    for (const [csvField, bisonField] of Object.entries(params.fieldMapping)) {
      await page.selectOption(`select[data-csv-field="${csvField}"]`, bisonField);
    }

    // Submit import
    await page.click('button:has-text("Import")');

    // Wait for completion
    await page.waitForSelector('.import-complete', { timeout: 60000 });

    const countText = await page.textContent('.contact-count');
    const count = parseInt(countText?.match(/\d+/)?.[0] || '0');

    logger.info('Contacts imported successfully', { count });
    return count;
  }

  async findCampaign(titlePattern: string): Promise<BisonCampaign | null> {
    logger.info('Finding campaign', { titlePattern });

    const page = this.browser.getPage();
    await page.click('a:has-text("Campaigns")');

    // Search for campaign
    await page.fill('input[placeholder*="Search"]', titlePattern);
    await page.waitForTimeout(1000);

    const campaignLink = await page.$('a.campaign-title');
    if (!campaignLink) {
      logger.warn('Campaign not found', { titlePattern });
      return null;
    }

    const title = await campaignLink.textContent() || '';
    const id = await campaignLink.getAttribute('data-campaign-id') || '';

    return { id, title, contactCount: 0 };
  }

  async addContactsToCampaign(campaignId: string, listName: string): Promise<void> {
    logger.info('Adding contacts to campaign', { campaignId, listName });

    const page = this.browser.getPage();

    await page.click(`a[data-campaign-id="${campaignId}"]`);
    await page.click('button:has-text("Actions")');
    await page.click('button:has-text("Add more contacts")');

    await page.click(`input[value="${listName}"]`);
    await page.click('button:has-text("Add")');

    logger.info('Contacts added to campaign successfully');
  }

  async renameCampaign(campaignId: string, newTitle: string): Promise<void> {
    logger.info('Renaming campaign', { campaignId, newTitle });

    const page = this.browser.getPage();

    await page.click(`a[data-campaign-id="${campaignId}"]`);
    await page.click('button:has-text("Actions")');
    await page.click('button:has-text("Rename")');

    await page.fill('input[name="campaign_title"]', newTitle);
    await page.click('button:has-text("Save")');

    logger.info('Campaign renamed successfully');
  }

  async disconnect(): Promise<void> {
    await this.browser.close();
    logger.info('Disconnected from Bison');
  }
}
