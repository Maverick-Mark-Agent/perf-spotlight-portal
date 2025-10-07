# Phase 3: Core Browser Automation Infrastructure

**Milestone:** Foundation
**Estimated Effort:** 6-8 hours
**Dependencies:** Phase 2 (Playwright installed)
**Blocks:** Phases 6-9, 11-15 (all connectors and workflows)

---

## Overview

Build the foundational browser automation infrastructure that all connectors (Cole, Clay, Bison) will use. This includes browser lifecycle management, authentication flows, error handling with screenshots/traces, and stealth mode configuration.

---

## Scope

### In Scope
- BrowserController for launching and managing Playwright browsers
- AuthManager for handling login flows and MFA
- ErrorHandler for capturing screenshots, traces, and implementing retries
- Stealth configuration to avoid bot detection
- Basic types and interfaces for browser automation

### Out of Scope
- Site-specific connectors (that's phases 6-8)
- Workflow orchestration (that's phase 16)
- Job scheduling (that's phase 16-17)

---

## Tasks

### Task 1: Create BrowserController

**File to create:** `src/agents/browser/BrowserController.ts`

**Content:**
```typescript
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { logger } from '@lib/logger';

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
    logger.info('Launching browser', { options: this.options });

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

    logger.info('Browser launched successfully');
  }

  async navigate(url: string): Promise<void> {
    if (!this.page) throw new Error('Browser not launched');
    logger.info('Navigating to URL', { url });
    await this.page.goto(url, { waitUntil: 'networkidle' });
  }

  async close(): Promise<void> {
    logger.info('Closing browser');
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
    logger.info('Screenshot saved', { path });
  }

  async startTracing(name: string): Promise<void> {
    if (!this.context) throw new Error('Browser not launched');
    await this.context.tracing.start({
      screenshots: true,
      snapshots: true,
      sources: true,
    });
    logger.info('Tracing started', { name });
  }

  async stopTracing(path: string): Promise<void> {
    if (!this.context) throw new Error('Browser not launched');
    await this.context.tracing.stop({ path });
    logger.info('Trace saved', { path });
  }
}
```

**Acceptance:**
- [ ] BrowserController class created
- [ ] Can launch Chromium with stealth settings
- [ ] Can navigate to URLs
- [ ] Can take screenshots
- [ ] Can capture Playwright traces
- [ ] Properly cleans up resources on close

---

### Task 2: Create AuthManager

**File to create:** `src/agents/browser/AuthManager.ts`

**Content:**
```typescript
import { Page } from 'playwright';
import { logger } from '@lib/logger';

export interface Credentials {
  username: string;
  password: string;
  mfaSecret?: string;  // TOTP secret for 2FA
}

export interface LoginSelectors {
  usernameInput: string;
  passwordInput: string;
  submitButton: string;
  mfaInput?: string;
  mfaSubmit?: string;
  successIndicator: string;  // Element visible after successful login
}

export class AuthManager {
  constructor(private page: Page) {}

  async login(credentials: Credentials, selectors: LoginSelectors): Promise<void> {
    logger.info('Starting login flow', { username: credentials.username });

    try {
      // Fill username
      await this.page.waitForSelector(selectors.usernameInput, { timeout: 10000 });
      await this.page.fill(selectors.usernameInput, credentials.username);
      logger.debug('Username filled');

      // Fill password
      await this.page.fill(selectors.passwordInput, credentials.password);
      logger.debug('Password filled');

      // Click submit
      await this.page.click(selectors.submitButton);
      logger.debug('Submit clicked');

      // Wait a bit for potential redirect/MFA prompt
      await this.page.waitForTimeout(2000);

      // Check for MFA
      if (selectors.mfaInput) {
        const mfaVisible = await this.page.isVisible(selectors.mfaInput).catch(() => false);
        if (mfaVisible) {
          await this.handleMFA(credentials, selectors);
        }
      }

      // Wait for success indicator
      await this.page.waitForSelector(selectors.successIndicator, { timeout: 15000 });
      logger.info('Login successful');
    } catch (error) {
      logger.error('Login failed', { error });
      throw new Error(`Login failed: ${error}`);
    }
  }

  private async handleMFA(credentials: Credentials, selectors: LoginSelectors): Promise<void> {
    if (!credentials.mfaSecret) {
      logger.error('MFA required but no secret provided');
      throw new Error('MFA required but no secret provided');
    }

    logger.info('Handling MFA');

    // Generate TOTP code (placeholder - implement with 'otplib' package)
    // For now, assume MFA is handled manually or throw error
    throw new Error('MFA not yet implemented - manual intervention required');
  }

  async isLoggedIn(successIndicator: string): Promise<boolean> {
    try {
      await this.page.waitForSelector(successIndicator, { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  async logout(logoutSelector: string): Promise<void> {
    logger.info('Logging out');
    await this.page.click(logoutSelector);
    await this.page.waitForTimeout(1000);
    logger.info('Logged out');
  }
}
```

**Acceptance:**
- [ ] AuthManager class created
- [ ] Can fill username and password
- [ ] Can click submit button
- [ ] Waits for success indicator
- [ ] Handles MFA placeholder (for future implementation)
- [ ] Can check if logged in

---

### Task 3: Create ErrorHandler

**File to create:** `src/agents/browser/ErrorHandler.ts`

**Content:**
```typescript
import { Page } from 'playwright';
import { BrowserController } from './BrowserController';
import { logger } from '@lib/logger';
import path from 'path';
import fs from 'fs/promises';

export type ErrorType = 'AUTH' | 'CAPTCHA' | 'SELECTOR_MISS' | 'NETWORK' | 'TIMEOUT' | 'VALIDATION' | 'UPLOAD';

export interface ErrorContext {
  step: string;
  errorType: ErrorType;
  message: string;
  url?: string;
  selector?: string;
}

export class ErrorHandler {
  private screenshotDir = 'artifacts/screenshots';
  private traceDir = 'artifacts/traces';

  constructor(private browser: BrowserController) {
    this.ensureDirectories();
  }

  private async ensureDirectories(): Promise<void> {
    await fs.mkdir(this.screenshotDir, { recursive: true });
    await fs.mkdir(this.traceDir, { recursive: true });
  }

  async captureError(context: ErrorContext, error: Error): Promise<{ screenshotPath: string; tracePath?: string }> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const screenshotPath = path.join(this.screenshotDir, `${context.step}-${timestamp}.png`);
    const tracePath = path.join(this.traceDir, `${context.step}-${timestamp}.zip`);

    logger.error('Capturing error', { context, error: error.message });

    try {
      // Take screenshot
      await this.browser.screenshot(screenshotPath);
      logger.info('Error screenshot captured', { path: screenshotPath });

      return { screenshotPath, tracePath: undefined };
    } catch (captureError) {
      logger.error('Failed to capture error artifacts', { error: captureError });
      return { screenshotPath: '', tracePath: undefined };
    }
  }

  async retry<T>(
    fn: () => Promise<T>,
    options: {
      maxRetries?: number;
      backoffMs?: number;
      backoffMultiplier?: number;
      onRetry?: (attempt: number, error: Error) => void;
    } = {}
  ): Promise<T> {
    const {
      maxRetries = 3,
      backoffMs = 1000,
      backoffMultiplier = 2,
      onRetry = () => {},
    } = options;

    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        logger.warn('Retry attempt failed', { attempt, maxRetries, error: lastError.message });

        if (attempt < maxRetries) {
          const delay = backoffMs * Math.pow(backoffMultiplier, attempt - 1);
          logger.info('Waiting before retry', { delay, attempt });
          onRetry(attempt, lastError);
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new Error('Retry failed with unknown error');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async handleSelectorNotFound(selector: string, step: string): Promise<void> {
    logger.error('Selector not found', { selector, step });

    const page = this.browser.getPage();
    const url = page.url();

    await this.captureError(
      { step, errorType: 'SELECTOR_MISS', message: `Selector not found: ${selector}`, url, selector },
      new Error('Selector not found')
    );

    throw new Error(`Selector not found: ${selector} at step: ${step}`);
  }

  isCaptchaError(error: Error): boolean {
    const captchaKeywords = ['captcha', 'recaptcha', 'bot detection', 'hcaptcha'];
    return captchaKeywords.some(keyword => error.message.toLowerCase().includes(keyword));
  }

  isAuthError(error: Error): boolean {
    const authKeywords = ['authentication', 'login', 'credentials', 'unauthorized', '401', '403'];
    return authKeywords.some(keyword => error.message.toLowerCase().includes(keyword));
  }
}
```

**Acceptance:**
- [ ] ErrorHandler class created
- [ ] Can capture screenshots on error
- [ ] Can retry operations with exponential backoff
- [ ] Creates artifact directories automatically
- [ ] Can classify error types (captcha, auth, etc.)

---

### Task 4: Create Browser Types

**File to create:** `src/agents/browser/types.ts`

**Content:**
```typescript
import { Page } from 'playwright';

export interface StepResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  screenshotPath?: string;
  tracePath?: string;
}

export interface WorkflowStep {
  name: string;
  execute: (page: Page) => Promise<StepResult>;
  retryable?: boolean;
  timeout?: number;
}

export interface BrowserSession {
  sessionId: string;
  site: string;
  startedAt: Date;
  isActive: boolean;
}

export interface NavigationOptions {
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
  timeout?: number;
}
```

**Acceptance:**
- [ ] Type definitions created
- [ ] Types can be imported without errors
- [ ] Cover common browser automation patterns

---

### Task 5: Create Browser Utilities

**File to create:** `src/agents/browser/utils.ts`

**Content:**
```typescript
import { Page } from 'playwright';
import { logger } from '@lib/logger';

export async function waitForSelector(
  page: Page,
  selector: string,
  options: { timeout?: number; visible?: boolean } = {}
): Promise<boolean> {
  const { timeout = 10000, visible = true } = options;

  try {
    await page.waitForSelector(selector, {
      timeout,
      state: visible ? 'visible' : 'attached',
    });
    return true;
  } catch (error) {
    logger.warn('Selector wait failed', { selector, error });
    return false;
  }
}

export async function safeClick(page: Page, selector: string, options: { timeout?: number } = {}): Promise<boolean> {
  try {
    await page.waitForSelector(selector, { timeout: options.timeout || 10000, state: 'visible' });
    await page.click(selector);
    return true;
  } catch (error) {
    logger.error('Click failed', { selector, error });
    return false;
  }
}

export async function safeFill(page: Page, selector: string, value: string, options: { timeout?: number } = {}): Promise<boolean> {
  try {
    await page.waitForSelector(selector, { timeout: options.timeout || 10000, state: 'visible' });
    await page.fill(selector, value);
    return true;
  } catch (error) {
    logger.error('Fill failed', { selector, error });
    return false;
  }
}

export async function waitForNavigation(page: Page, timeout: number = 30000): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout });
}

export async function scrollToBottom(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
  });
  await page.waitForTimeout(500);
}

export async function getCurrentUrl(page: Page): Promise<string> {
  return page.url();
}

export async function getPageTitle(page: Page): Promise<string> {
  return page.title();
}
```

**Acceptance:**
- [ ] Utility functions created
- [ ] Safe wrappers for common Playwright operations
- [ ] All functions handle errors gracefully

---

### Task 6: Create Index File

**File to create:** `src/agents/browser/index.ts`

**Content:**
```typescript
export { BrowserController } from './BrowserController';
export { AuthManager } from './AuthManager';
export { ErrorHandler } from './ErrorHandler';
export * from './types';
export * from './utils';

export type { BrowserOptions } from './BrowserController';
export type { Credentials, LoginSelectors } from './AuthManager';
export type { ErrorType, ErrorContext } from './ErrorHandler';
```

**Acceptance:**
- [ ] Index exports all browser automation modules
- [ ] Clean imports like `import { BrowserController } from '@agents/browser'`

---

### Task 7: Create Test Script

**File to create:** `tests/browser/browser-test.ts`

**Content:**
```typescript
import { BrowserController, AuthManager, ErrorHandler } from '@agents/browser';
import { logger } from '@lib/logger';

async function testBrowserLaunch() {
  const browser = new BrowserController({ headless: false, slowMo: 100 });

  try {
    await browser.launch();
    await browser.navigate('https://example.com');

    const page = browser.getPage();
    const title = await page.title();

    logger.info('Test successful', { title });

    await browser.screenshot('test-screenshot.png');
    await browser.close();

    console.log('✅ Browser test passed');
  } catch (error) {
    logger.error('Test failed', { error });
    await browser.close();
    process.exit(1);
  }
}

testBrowserLaunch();
```

**Acceptance:**
- [ ] Test script runs successfully
- [ ] Browser launches and navigates to example.com
- [ ] Screenshot captured
- [ ] Browser closes cleanly

---

## Definition of Done

- [ ] BrowserController created with launch/navigate/close/screenshot methods
- [ ] AuthManager created with login/logout/isLoggedIn methods
- [ ] ErrorHandler created with retry and error capture logic
- [ ] Browser types defined in `types.ts`
- [ ] Utility functions created in `utils.ts`
- [ ] Index file exports all modules
- [ ] Test script launches browser and navigates successfully
- [ ] Screenshot and trace capture working
- [ ] Artifact directories created automatically
- [ ] No TypeScript errors
- [ ] Code follows ESLint rules

---

## Validation Commands

```bash
# Type check
npm run validate:types

# Run browser test
tsx tests/browser/browser-test.ts

# Check artifacts directory created
ls -la artifacts/screenshots artifacts/traces

# Lint browser code
npm run lint
```

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Playwright browser fails to launch | Check system dependencies with `npx playwright install-deps` |
| Stealth mode insufficient for bot detection | Add more fingerprint randomization, rotate user agents |
| Screenshot/trace capture fails | Add try/catch, continue execution even if capture fails |
| Memory leaks from unclosed browsers | Ensure `close()` called in finally blocks |

---

## Files Created

- `src/agents/browser/BrowserController.ts`
- `src/agents/browser/AuthManager.ts`
- `src/agents/browser/ErrorHandler.ts`
- `src/agents/browser/types.ts`
- `src/agents/browser/utils.ts`
- `src/agents/browser/index.ts`
- `tests/browser/browser-test.ts`

---

## Next Phase

**Phase 4:** Secrets Management & Environment Setup
- Parallel to Phase 3 (can work independently)
- Needed before connectors (Phase 6-8)
