import { Page } from 'playwright';

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
    console.warn('Selector wait failed', { selector, error });
    return false;
  }
}

export async function safeClick(page: Page, selector: string, options: { timeout?: number } = {}): Promise<boolean> {
  try {
    await page.waitForSelector(selector, { timeout: options.timeout || 10000, state: 'visible' });
    await page.click(selector);
    return true;
  } catch (error) {
    console.error('Click failed', { selector, error });
    return false;
  }
}

export async function safeFill(page: Page, selector: string, value: string, options: { timeout?: number } = {}): Promise<boolean> {
  try {
    await page.waitForSelector(selector, { timeout: options.timeout || 10000, state: 'visible' });
    await page.fill(selector, value);
    return true;
  } catch (error) {
    console.error('Fill failed', { selector, error });
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
