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
