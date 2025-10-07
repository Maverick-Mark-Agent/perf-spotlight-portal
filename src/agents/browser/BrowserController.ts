import { chromium, Browser, BrowserContext, Page } from 'playwright';

export interface BrowserOptions {
  headless?: boolean;
  slowMo?: number;
  timeout?: number;
  userDataDir?: string;
  proxy?: {
    server: string;
    username?: string;
    password?: string;
  };
}

export class BrowserController {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private options: BrowserOptions;

  constructor(options: BrowserOptions = {}) {
    this.options = {
      headless: process.env.HEADLESS !== 'false',
      slowMo: parseInt(process.env.SLOW_MO || '0'),
      timeout: 30000,
      ...options,
    };
  }

  async launch(): Promise<void> {
    console.log('Launching browser', this.options);

    this.browser = await chromium.launch({
      headless: this.options.headless,
      slowMo: this.options.slowMo,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--no-sandbox',
      ],
    });

    // Create context with stealth settings
    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'en-US',
      timezoneId: 'America/Chicago',
      permissions: [],
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    // Add init script to hide webdriver
    await this.context.addInitScript(() => {
      // @ts-ignore
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    this.page = await this.context.newPage();
    this.page.setDefaultTimeout(this.options.timeout);

    console.log('Browser launched successfully');
  }

  async navigate(url: string): Promise<void> {
    if (!this.page) throw new Error('Browser not launched');
    console.log('Navigating to URL', url);
    await this.page.goto(url, { waitUntil: 'networkidle' });
  }

  async close(): Promise<void> {
    console.log('Closing browser');
    await this.context?.close();
    await this.browser?.close();
    this.page = null;
    this.context = null;
    this.browser = null;
  }

  getPage(): Page {
    if (!this.page) throw new Error('Browser not launched');
    return this.page;
  }

  getContext(): BrowserContext {
    if (!this.context) throw new Error('Browser not launched');
    return this.context;
  }

  async screenshot(path: string): Promise<void> {
    if (!this.page) throw new Error('Browser not launched');
    await this.page.screenshot({ path, fullPage: true });
    console.log('Screenshot saved', path);
  }

  async startTracing(name: string): Promise<void> {
    if (!this.context) throw new Error('Browser not launched');
    await this.context.tracing.start({
      screenshots: true,
      snapshots: true,
      sources: true,
    });
    console.log('Tracing started', name);
  }

  async stopTracing(path: string): Promise<void> {
    if (!this.context) throw new Error('Browser not launched');
    await this.context.tracing.stop({ path });
    console.log('Trace saved', path);
  }
}
