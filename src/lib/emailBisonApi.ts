/**
 * Email Bison API Client Library
 * Centralized client for all Email Bison API interactions
 */

const EMAIL_BISON_BASE_URL = 'https://send.maverickmarketingllc.com/api';
const EMAIL_BISON_API_KEY = '77|AqozJcNT8l2m52CRyvQyEEmLKa49ofuZRjK98aio8a3feb5d';

export interface EmailBisonWorkspace {
  id: number;
  name: string;
  personal_team: boolean;
  main: boolean;
  parent_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface EmailBisonWorkspaceStats {
  emails_sent: number;
  total_leads_contacted: number;
  opened: number;
  opened_percentage: number;
  unique_opens_per_contact: number;
  unique_opens_per_contact_percentage: number;
  unique_replies_per_contact: number;
  unique_replies_per_contact_percentage: number;
  bounced: number;
  bounced_percentage: number;
  unsubscribed: number;
  unsubscribed_percentage: number;
  interested: number;
  interested_percentage: number;
}

export interface EmailBisonSenderEmail {
  id: number;
  name: string;
  email: string;
  email_signature: string | null;
  daily_limit: number;
  type: string;
  status: string;
  tags: Array<{
    id: number;
    name: string;
    default: boolean;
    created_at: string;
    updated_at: string;
  }>;
  emails_sent_count: number;
  total_replied_count: number;
  total_opened_count: number;
  unsubscribed_count: number;
  bounced_count: number;
  unique_replied_count: number;
  unique_opened_count: number;
  total_leads_contacted_count: number;
  interested_leads_count: number;
  created_at: string;
  updated_at: string;
}

export interface EmailBisonCampaign {
  id: number;
  uuid: string;
  sequence_id: number | null;
  name: string;
  type: string;
  status: string;
  completion_percentage: number;
  emails_sent: number;
  opened: number;
  unique_opens: number | string;
  replied: number;
  unique_replies: number;
  bounced: number;
  unsubscribed: number;
  interested: number;
  total_leads_contacted: number;
  max_emails_per_day: number;
  max_new_leads_per_day: number;
  total_leads: number;
  created_at: string;
  updated_at: string;
  tags: any[];
}

class EmailBisonAPIClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(apiKey?: string) {
    this.baseUrl = EMAIL_BISON_BASE_URL;
    this.apiKey = apiKey || EMAIL_BISON_API_KEY;
  }

  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.data?.message ||
        errorData.message ||
        `Email Bison API error: ${response.status}`
      );
    }

    const data = await response.json();
    return data.data || data;
  }

  /**
   * Get all workspaces (clients)
   */
  async getWorkspaces(): Promise<EmailBisonWorkspace[]> {
    return this.makeRequest<EmailBisonWorkspace[]>('/workspaces/v1.1');
  }

  /**
   * Get a specific workspace by ID
   */
  async getWorkspace(workspaceId: number): Promise<EmailBisonWorkspace> {
    return this.makeRequest<EmailBisonWorkspace>(`/workspaces/v1.1/${workspaceId}`);
  }

  /**
   * Get workspace statistics for a date range
   */
  async getWorkspaceStats(
    workspaceId: number,
    startDate: string,
    endDate: string
  ): Promise<EmailBisonWorkspaceStats> {
    const params = new URLSearchParams({
      team_id: workspaceId.toString(),
      start_date: startDate,
      end_date: endDate,
    });

    return this.makeRequest<EmailBisonWorkspaceStats>(
      `/workspaces/v1.1/stats?${params.toString()}`
    );
  }

  /**
   * Get all sender emails (email accounts) across all workspaces
   */
  async getSenderEmails(perPage: number = 1000): Promise<EmailBisonSenderEmail[]> {
    const params = new URLSearchParams({
      per_page: perPage.toString(),
    });

    const response = await this.makeRequest<{ data: EmailBisonSenderEmail[] }>(
      `/sender-emails?${params.toString()}`
    );

    return response.data || response as any;
  }

  /**
   * Get a specific sender email by ID
   */
  async getSenderEmail(senderEmailId: number): Promise<EmailBisonSenderEmail> {
    return this.makeRequest<EmailBisonSenderEmail>(`/sender-emails/${senderEmailId}`);
  }

  /**
   * Get all campaigns
   */
  async getCampaigns(perPage: number = 1000): Promise<EmailBisonCampaign[]> {
    const params = new URLSearchParams({
      per_page: perPage.toString(),
    });

    const response = await this.makeRequest<{ data: EmailBisonCampaign[] }>(
      `/campaigns?${params.toString()}`
    );

    return response.data || response as any;
  }

  /**
   * Get campaigns for a specific sender email
   */
  async getSenderEmailCampaigns(senderEmailId: number): Promise<EmailBisonCampaign[]> {
    const response = await this.makeRequest<{ data: EmailBisonCampaign[] }>(
      `/sender-emails/${senderEmailId}/campaigns`
    );

    return response.data || response as any;
  }

  /**
   * Get all workspaces with their stats for a date range
   * This is a helper method that combines getWorkspaces and getWorkspaceStats
   */
  async getAllWorkspacesWithStats(startDate: string, endDate: string): Promise<Array<{
    workspace: EmailBisonWorkspace;
    stats: EmailBisonWorkspaceStats;
  }>> {
    const workspaces = await this.getWorkspaces();

    // Fetch stats for all workspaces in parallel
    const statsPromises = workspaces.map(workspace =>
      this.getWorkspaceStats(workspace.id, startDate, endDate)
        .then(stats => ({ workspace, stats }))
        .catch(error => {
          console.error(`Failed to fetch stats for workspace ${workspace.name}:`, error);
          // Return workspace with empty stats on error
          return {
            workspace,
            stats: {
              emails_sent: 0,
              total_leads_contacted: 0,
              opened: 0,
              opened_percentage: 0,
              unique_opens_per_contact: 0,
              unique_opens_per_contact_percentage: 0,
              unique_replies_per_contact: 0,
              unique_replies_per_contact_percentage: 0,
              bounced: 0,
              bounced_percentage: 0,
              unsubscribed: 0,
              unsubscribed_percentage: 0,
              interested: 0,
              interested_percentage: 0,
            },
          };
        })
    );

    return Promise.all(statsPromises);
  }
}

// Export singleton instance
export const emailBisonApi = new EmailBisonAPIClient();

// Export class for testing/custom instances
export { EmailBisonAPIClient };
