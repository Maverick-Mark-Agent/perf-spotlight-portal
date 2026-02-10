// Types for the Email Infrastructure AI Assistant

export interface InfraAssistantMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  intent?: InfraIntent;
  entities?: InfraEntities;
  metadata?: InfraActionMetadata;
  created_at: string;
}

export interface InfraAssistantSession {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  last_message_at?: string;
}

export type InfraIntent =
  | 'query_accounts'      // "Show me X accounts"
  | 'query_metrics'       // "What's the Y for Z?"
  | 'query_issues'        // "What's broken?"
  | 'compare_performance' // "How does X compare?"
  | 'analyze_trends'      // "Has Y improved?"
  | 'get_guidance'        // "How do I fix X?"
  | 'schedule_report'     // "Send me daily updates"
  | 'check_domain'        // "Is domain X blacklisted?"
  | 'suggest_warmup'      // "Which accounts need warmup?"
  | 'optimize_cost'       // "Which accounts underperform?"
  | 'save_resolution'     // "I fixed it by doing X"
  | 'general_question';   // Fallback

export interface InfraEntities {
  workspace_name?: string;
  workspace_names?: string[];
  metric?: string;           // 'bounce_rate', 'reply_rate', 'sent_count', etc.
  status?: string;           // 'connected', 'disconnected', 'failed'
  date_range?: {
    start: string;
    end: string;
  };
  domain?: string;
  issue_type?: string;       // 'disconnected', 'high_bounce', 'low_reply', etc.
  comparison_type?: string;  // 'vs_average', 'vs_best', 'vs_previous_period'
  limit?: number;
}

export interface InfraActionMetadata {
  accounts_found?: number;
  issues_found?: InfraIssue[];
  comparison_result?: InfraComparisonResult;
  guidance_provided?: string[];
  resolution_saved?: boolean;
  report_scheduled?: {
    schedule: string;
    report_type: string;
  };
}

export interface InfraIssue {
  type: 'critical' | 'warning' | 'info';
  category: string;
  title: string;
  description: string;
  affected_count: number;
  sample_accounts?: string[];
  recommendation: string;
}

export interface InfraComparisonResult {
  subject: string;
  subject_value: number;
  comparison_value: number;
  difference_percent: number;
  interpretation: string;
}

export interface InfraChatRequest {
  session_id?: string;
  message: string;
}

export interface InfraChatResponse {
  session_id: string;
  message: string;
  intent?: InfraIntent;
  entities?: InfraEntities;
  metadata?: InfraActionMetadata;
}

export interface InfraResolution {
  id: string;
  issue_type: string;
  issue_context: Record<string, any>;
  resolution_steps: string[];
  resolution_summary: string;
  success: boolean;
  workspace_name?: string;
  created_at: string;
  created_by: string;
}

export interface InfraScheduledReport {
  id: string;
  user_id: string;
  schedule: string;
  report_type: string;
  config: Record<string, any>;
  delivery_method: 'slack' | 'email';
  delivery_target: string;
  last_sent_at?: string;
  next_send_at?: string;
  enabled: boolean;
  created_at: string;
}

// Infrastructure stats that get passed to the AI
export interface InfraStats {
  total_accounts: number;
  connected_accounts: number;
  disconnected_accounts: number;
  failed_accounts: number;
  total_sent: number;
  total_replies: number;
  total_bounced: number;
  avg_reply_rate: number;
  avg_bounce_rate: number;
  health_score: number;
  data_freshness_hours: number;
  critical_issues_count: number;
  warning_issues_count: number;
}

// Workspace-specific stats
export interface WorkspaceStats {
  workspace_name: string;
  account_count: number;
  connected_count: number;
  disconnected_count: number;
  total_sent: number;
  total_replies: number;
  total_bounced: number;
  reply_rate: number;
  bounce_rate: number;
}
