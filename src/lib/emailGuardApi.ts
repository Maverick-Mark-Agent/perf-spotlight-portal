/**
 * EmailGuard API Client
 *
 * Provides methods to interact with EmailGuard's monitoring and testing platform.
 * Base URL: https://app.emailguard.io
 *
 * Features:
 * - Domain management and import
 * - Inbox placement testing
 * - Blacklist monitoring
 * - DMARC reporting
 * - Domain masking/redirects
 */

const EMAILGUARD_BASE_URL = 'https://app.emailguard.io';

// Super admin token from environment (works in both browser and Node.js)
const EMAILGUARD_TOKEN =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_EMAILGUARD_API_TOKEN) ||
  (typeof process !== 'undefined' && process.env?.VITE_EMAILGUARD_API_TOKEN) ||
  '55160|mUtyLNRRg1MHpStPSKUNUsz8Bs0WjAEAixxcVG2m942abc15';

export interface EmailGuardDomain {
  uuid: string;
  name: string;
  ip: string;
  dns_verified?: boolean;
  ssl_provisioned?: boolean;
  created_at: string;
}

export interface EmailGuardInboxTest {
  id: string;
  name: string;
  status: 'waiting_for_email' | 'processing' | 'completed' | 'failed';
  filter_phrase: string;
  seed_emails: string[];
  overall_score?: number;
  inbox_count?: number;
  spam_count?: number;
  promotions_count?: number;
  missing_count?: number;
  results?: Array<{
    mailbox: string;
    placement: 'inbox' | 'spam' | 'promotions' | 'missing';
  }>;
  created_at: string;
  completed_at?: string;
}

export interface EmailGuardBlacklistCheck {
  blacklist_name: string;
  is_listed: boolean;
  listing_details?: any;
  checked_at: string;
}

export interface EmailGuardDMARCReport {
  id: string;
  domain: string;
  report_date: string;
  total_messages: number;
  dmarc_compliant: number;
  dmarc_failed: number;
  spf_passed: number;
  spf_failed: number;
  dkim_passed: number;
  dkim_failed: number;
  policy_applied: 'none' | 'quarantine' | 'reject';
  insights?: any;
}

export interface EmailGuardWorkspace {
  uuid: string;
  name: string;
  is_current: boolean;
  quotas: {
    total_email_accounts: number;
    total_domains: number;
    total_inbox_placement_tests: number;
  };
}

class EmailGuardApiClient {
  private baseUrl: string;
  private token: string;
  private currentWorkspaceUuid?: string;

  constructor(token?: string) {
    this.baseUrl = EMAILGUARD_BASE_URL;
    this.token = token || EMAILGUARD_TOKEN;
  }

  /**
   * Make authenticated request to EmailGuard API
   */
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message ||
        `EmailGuard API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    return data.data || data;
  }

  // ==================== WORKSPACE MANAGEMENT ====================

  /**
   * List all workspaces
   */
  async listWorkspaces(): Promise<EmailGuardWorkspace[]> {
    return this.makeRequest<EmailGuardWorkspace[]>('/api/v1/workspaces');
  }

  /**
   * Get current workspace
   */
  async getCurrentWorkspace(): Promise<EmailGuardWorkspace> {
    return this.makeRequest<EmailGuardWorkspace>('/api/v1/workspaces/current');
  }

  /**
   * Switch to a different workspace
   */
  async switchWorkspace(workspaceUuid: string): Promise<void> {
    await this.makeRequest('/api/v1/workspaces/switch-workspace', {
      method: 'POST',
      body: JSON.stringify({ uuid: workspaceUuid }),
    });
    this.currentWorkspaceUuid = workspaceUuid;
  }

  /**
   * Create a new workspace
   */
  async createWorkspace(name: string): Promise<EmailGuardWorkspace> {
    return this.makeRequest<EmailGuardWorkspace>('/api/v1/workspaces', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  // ==================== DOMAIN MANAGEMENT ====================

  /**
   * List all domains in current workspace
   */
  async listDomains(): Promise<EmailGuardDomain[]> {
    return this.makeRequest<EmailGuardDomain[]>('/api/v1/domains');
  }

  /**
   * Create/import a domain
   */
  async createDomain(domainName: string): Promise<EmailGuardDomain> {
    return this.makeRequest<EmailGuardDomain>('/api/v1/domains', {
      method: 'POST',
      body: JSON.stringify({ name: domainName }),
    });
  }

  /**
   * Get domain details
   */
  async getDomain(domainUuid: string): Promise<EmailGuardDomain> {
    return this.makeRequest<EmailGuardDomain>(`/api/v1/domains/${domainUuid}`);
  }

  /**
   * Delete a domain
   */
  async deleteDomain(domainUuid: string): Promise<void> {
    await this.makeRequest(`/api/v1/domains/delete/${domainUuid}`, {
      method: 'DELETE',
    });
  }

  /**
   * Bulk import domains (with rate limiting)
   */
  async bulkImportDomains(
    domains: string[],
    onProgress?: (imported: number, total: number, domain: string) => void
  ): Promise<{ success: EmailGuardDomain[], failed: Array<{ domain: string, error: string }> }> {
    const success: EmailGuardDomain[] = [];
    const failed: Array<{ domain: string, error: string }> = [];

    for (let i = 0; i < domains.length; i++) {
      const domain = domains[i];
      try {
        const result = await this.createDomain(domain);
        success.push(result);
        onProgress?.(i + 1, domains.length, domain);

        // Rate limiting: 1 request per second
        if (i < domains.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        failed.push({
          domain,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        onProgress?.(i + 1, domains.length, domain);
      }
    }

    return { success, failed };
  }

  // ==================== INBOX PLACEMENT TESTING ====================

  /**
   * List all inbox placement tests
   */
  async listInboxTests(): Promise<EmailGuardInboxTest[]> {
    return this.makeRequest<EmailGuardInboxTest[]>('/api/v1/inbox-placement-tests');
  }

  /**
   * Create new inbox placement test
   */
  async createInboxTest(testName: string): Promise<EmailGuardInboxTest> {
    return this.makeRequest<EmailGuardInboxTest>('/api/v1/inbox-placement-tests', {
      method: 'POST',
      body: JSON.stringify({ name: testName }),
    });
  }

  /**
   * Get inbox test details and results
   */
  async getInboxTest(testId: string): Promise<EmailGuardInboxTest> {
    return this.makeRequest<EmailGuardInboxTest>(`/api/v1/inbox-placement-tests/${testId}`);
  }

  // ==================== BLACKLIST MONITORING ====================

  /**
   * Check domains against blacklists
   */
  async checkDomainBlacklists(domainUuids: string[]): Promise<EmailGuardBlacklistCheck[]> {
    return this.makeRequest<EmailGuardBlacklistCheck[]>('/api/v1/blacklist-checks/domains', {
      method: 'POST',
      body: JSON.stringify({ domain_uuids: domainUuids }),
    });
  }

  /**
   * Check email accounts against blacklists
   */
  async checkEmailAccountBlacklists(accountIds: string[]): Promise<EmailGuardBlacklistCheck[]> {
    return this.makeRequest<EmailGuardBlacklistCheck[]>('/api/v1/blacklist-checks/email-accounts', {
      method: 'POST',
      body: JSON.stringify({ email_account_ids: accountIds }),
    });
  }

  /**
   * Ad-hoc blacklist check (for specific IP or domain)
   */
  async checkBlacklist(target: string, type: 'domain' | 'ip' | 'email'): Promise<EmailGuardBlacklistCheck[]> {
    return this.makeRequest<EmailGuardBlacklistCheck[]>('/api/v1/blacklist-checks/ad-hoc', {
      method: 'POST',
      body: JSON.stringify({ target, type }),
    });
  }

  // ==================== DMARC REPORTING ====================

  /**
   * Get DMARC reports for domains
   */
  async getDMARCReports(params?: {
    domain_uuid?: string,
    start_date?: string,
    end_date?: string
  }): Promise<EmailGuardDMARCReport[]> {
    const queryParams = new URLSearchParams();
    if (params?.domain_uuid) queryParams.append('domain_uuid', params.domain_uuid);
    if (params?.start_date) queryParams.append('start_date', params.start_date);
    if (params?.end_date) queryParams.append('end_date', params.end_date);

    const query = queryParams.toString();
    const endpoint = `/api/v1/dmarc-reports${query ? `?${query}` : ''}`;

    return this.makeRequest<EmailGuardDMARCReport[]>(endpoint);
  }

  /**
   * Get DMARC insights for a specific domain
   */
  async getDMARCInsights(domainUuid: string): Promise<any> {
    return this.makeRequest(`/api/v1/dmarc-reports/domains/${domainUuid}/insights`);
  }

  // ==================== DOMAIN MASKING & REDIRECTS ====================

  /**
   * List domain masking proxies
   */
  async listDomainMasks(): Promise<any[]> {
    return this.makeRequest<any[]>('/api/v1/domain-masking-proxies');
  }

  /**
   * Create domain mask
   */
  async createDomainMask(maskingDomain: string, primaryDomain: string): Promise<any> {
    return this.makeRequest('/api/v1/domain-masking-proxies', {
      method: 'POST',
      body: JSON.stringify({
        masking_domain: maskingDomain,
        primary_domain: primaryDomain,
      }),
    });
  }

  /**
   * List hosted domain redirects
   */
  async listDomainRedirects(): Promise<any[]> {
    return this.makeRequest<any[]>('/api/v1/hosted-domain-redirects');
  }

  /**
   * Create hosted domain redirect
   */
  async createDomainRedirect(domain: string, redirectUrl: string): Promise<any> {
    return this.makeRequest('/api/v1/hosted-domain-redirects', {
      method: 'POST',
      body: JSON.stringify({
        domain,
        redirect: redirectUrl,
      }),
    });
  }

  // ==================== EMAIL AUTHENTICATION ====================

  /**
   * Generate SPF record
   */
  async generateSPF(params: any): Promise<any> {
    return this.makeRequest('/api/v1/email-authentication/spf-generator-wizard', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  /**
   * Generate DKIM record
   */
  async generateDKIM(params: any): Promise<any> {
    return this.makeRequest('/api/v1/email-authentication/dkim-raw-generator', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  /**
   * Lookup DMARC record
   */
  async lookupDMARC(domain: string): Promise<any> {
    return this.makeRequest('/api/v1/email-authentication/dmarc-lookup', {
      method: 'POST',
      body: JSON.stringify({ domain }),
    });
  }
}

// Export singleton instance
export const emailGuardApi = new EmailGuardApiClient();

// Also export class for testing or custom instances
export { EmailGuardApiClient };
