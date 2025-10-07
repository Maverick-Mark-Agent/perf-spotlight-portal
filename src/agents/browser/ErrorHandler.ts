import { Page } from 'playwright';
import { BrowserController } from './BrowserController';
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

    console.error('Capturing error', { context, error: error.message });

    try {
      // Take screenshot
      await this.browser.screenshot(screenshotPath);
      console.log('Error screenshot captured', screenshotPath);

      return { screenshotPath, tracePath: undefined };
    } catch (captureError) {
      console.error('Failed to capture error artifacts', captureError);
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
        console.warn('Retry attempt failed', { attempt, maxRetries, error: lastError.message });

        if (attempt < maxRetries) {
          const delay = backoffMs * Math.pow(backoffMultiplier, attempt - 1);
          console.log('Waiting before retry', { delay, attempt });
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
    console.error('Selector not found', { selector, step });

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
