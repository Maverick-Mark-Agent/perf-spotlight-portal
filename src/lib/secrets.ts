import dotenv from 'dotenv';

dotenv.config();

export interface Secrets {
  // Supabase
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  supabaseAnonKey: string;

  // Redis
  redisUrl: string;

  // Cole X Dates (multi-state)
  cole: {
    [state: string]: {
      username: string;
      password: string;
    };
  };

  // Clay
  clay: {
    email: string;
    password: string;
  };

  // Email Bison
  bison: {
    email: string;
    password: string;
  };

  // Slack
  slackWebhookUrl: string;

  // Environment
  nodeEnv: string;
  logLevel: string;
  headless: boolean;
  slowMo: number;
}

class SecretsManager {
  private secrets: Secrets | null = null;

  load(): Secrets {
    if (this.secrets) return this.secrets;

    console.log('Loading secrets from environment');

    // Load Cole credentials dynamically by state
    const coleStates = ['NJ', 'TX', 'FL', 'CA']; // Add more as needed
    const cole: { [state: string]: { username: string; password: string } } = {};

    for (const state of coleStates) {
      const username = process.env[`COLE_${state}_USERNAME`];
      const password = process.env[`COLE_${state}_PASSWORD`];

      if (username && password) {
        cole[state] = { username, password };
      }
    }

    this.secrets = {
      supabaseUrl: this.required('SUPABASE_URL'),
      supabaseServiceRoleKey: this.required('SUPABASE_SERVICE_ROLE_KEY'),
      supabaseAnonKey: this.required('SUPABASE_ANON_KEY'),

      redisUrl: this.optional('REDIS_URL', 'redis://localhost:6379'),

      cole,

      clay: {
        email: this.required('CLAY_EMAIL'),
        password: this.required('CLAY_PASSWORD'),
      },

      bison: {
        email: this.required('BISON_EMAIL'),
        password: this.required('BISON_PASSWORD'),
      },

      slackWebhookUrl: this.required('SLACK_WEBHOOK_URL'),

      nodeEnv: this.optional('NODE_ENV', 'development'),
      logLevel: this.optional('LOG_LEVEL', 'info'),
      headless: process.env.HEADLESS !== 'false',
      slowMo: parseInt(this.optional('SLOW_MO', '0')),
    };

    this.validate();
    console.log('Secrets loaded successfully', { statesConfigured: Object.keys(cole) });

    return this.secrets;
  }

  private required(key: string): string {
    const value = process.env[key];
    if (!value) {
      throw new Error(`Required environment variable ${key} is not set`);
    }
    return value;
  }

  private optional(key: string, defaultValue: string): string {
    return process.env[key] || defaultValue;
  }

  private validate(): void {
    if (!this.secrets) throw new Error('Secrets not loaded');

    // Validate URLs
    try {
      new URL(this.secrets.supabaseUrl);
      new URL(this.secrets.redisUrl);
      new URL(this.secrets.slackWebhookUrl);
    } catch (error) {
      throw new Error('Invalid URL in environment variables');
    }

    // Validate at least one Cole state configured
    if (Object.keys(this.secrets.cole).length === 0) {
      console.warn('⚠️  No Cole state credentials configured');
    }

    // Validate email formats
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.secrets.clay.email)) {
      throw new Error('Invalid CLAY_EMAIL format');
    }
    if (!emailRegex.test(this.secrets.bison.email)) {
      throw new Error('Invalid BISON_EMAIL format');
    }
  }

  getColeCredentials(state: string): { username: string; password: string } {
    if (!this.secrets) throw new Error('Secrets not loaded');

    const creds = this.secrets.cole[state];
    if (!creds) {
      throw new Error(`No Cole credentials configured for state: ${state}`);
    }

    return creds;
  }

  get(): Secrets {
    if (!this.secrets) {
      return this.load();
    }
    return this.secrets;
  }
}

export const secretsManager = new SecretsManager();
// Load secrets immediately and export the manager instance
secretsManager.load();
// Export the manager instance so getColeCredentials() is available
export const secrets = secretsManager;
