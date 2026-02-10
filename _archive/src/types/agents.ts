// Agent types for workflow automation

// Workflow types
export type WorkflowType = 'cole_pull' | 'clay_format' | 'bison_upload' | 'evergreen_update' | 'full_pipeline';
export type RunStatus = 'running' | 'success' | 'failed' | 'partial';
export type ErrorType = 'AUTH' | 'CAPTCHA' | 'SELECTOR_MISS' | 'NETWORK' | 'TIMEOUT' | 'VALIDATION' | 'UPLOAD';

// Config types
export interface ClientConfig {
  id: number;
  name: string;
  workspace: string;
  states: string[];
  zips: string[];
  packageTier: 100 | 200;  // replies/month
  targetCount: number;      // 15000 or 30000
  filters?: {
    homeValueMax?: number;
    purchaseYearMin?: number;
    yearsAtAddressMin?: number;
  };
}

// Lead types
export interface LeadData {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  address1: string;
  city: string;
  state: string;
  zip: string;
  dob?: string;
  purchaseDate: string;
  homeValue: number;
  income?: number;
  headHousehold?: boolean;
}

// Browser types
export interface BrowserOptions {
  headless: boolean;
  slowMo: number;
  timeout: number;
}

// Connector types
export interface ConnectorResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  recordCount?: number;
}

// Agent run metrics
export interface AgentRunMetrics {
  records_pulled?: number;
  records_cleaned?: number;
  records_uploaded?: number;
  duration_ms?: number;
  chunks?: number;
}
