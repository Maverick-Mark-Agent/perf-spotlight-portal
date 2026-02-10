import { Page } from 'playwright';

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
    console.log('Starting login flow', { username: credentials.username });

    try {
      // Fill username
      await this.page.waitForSelector(selectors.usernameInput, { timeout: 10000 });
      await this.page.fill(selectors.usernameInput, credentials.username);
      console.log('Username filled');

      // Fill password
      await this.page.fill(selectors.passwordInput, credentials.password);
      console.log('Password filled');

      // Click submit
      await this.page.click(selectors.submitButton);
      console.log('Submit clicked');

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
      console.log('Login successful');
    } catch (error) {
      console.error('Login failed', error);
      throw new Error(`Login failed: ${error}`);
    }
  }

  private async handleMFA(credentials: Credentials, selectors: LoginSelectors): Promise<void> {
    if (!credentials.mfaSecret) {
      console.error('MFA required but no secret provided');
      throw new Error('MFA required but no secret provided');
    }

    console.log('Handling MFA');

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
    console.log('Logging out');
    await this.page.click(logoutSelector);
    await this.page.waitForTimeout(1000);
    console.log('Logged out');
  }
}
