export interface Task {
  id: string;
  title: string;
  description: string | null;
  assignee_id: string | null;
  assignee_name: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  category: string | null;
  visibility: TaskVisibility;
  due_date: string | null; // ISO date string (YYYY-MM-DD)
  completed_at: string | null; // ISO timestamp
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
  source: TaskSource | null;
  is_recurring: boolean;
  recurring_pattern: string | null;
  last_completed: string | null; // ISO date string
  last_reminded_at: string | null; // ISO timestamp
}

export interface TaskSource {
  type: 'manual' | 'granola' | 'todoist' | 'slack';
  meetingId?: string;
  meetingTitle?: string;
  createdBy?: string;
  project?: string;
  id?: string;
  date?: string;
}

export interface TeamMember {
  id: string;
  user_id: string | null;
  name: string;
  role: string | null;
  telegram_id: string | null;
  slack_id: string | null;
  created_at: string;
}

export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done';
export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low';
export type TaskVisibility = 'internal' | 'team' | 'private';

export interface TaskFilters {
  status?: TaskStatus | TaskStatus[];
  assignee?: string | string[];
  category?: string | string[];
  visibility?: TaskVisibility;
  search?: string;
  showCompleted?: boolean;
}

export interface TaskCreateInput {
  title: string;
  description?: string;
  assignee_id?: string;
  assignee_name?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  category?: string;
  visibility?: TaskVisibility;
  due_date?: string;
  is_recurring?: boolean;
  recurring_pattern?: string;
  source?: TaskSource;
}

export interface TaskUpdateInput extends Partial<TaskCreateInput> {
  completed_at?: string | null;
  last_completed?: string | null;
}

// Category definitions matching the existing local tasks.json
export const TASK_CATEGORIES = {
  payment: { label: '💰 Payment', visibility: 'internal' as const },
  hr: { label: '👤 HR', visibility: 'internal' as const },
  salary: { label: '💰 Salary', visibility: 'internal' as const },
  contract: { label: '📝 Contract', visibility: 'internal' as const },
  operations: { label: '⚙️ Operations', visibility: 'team' as const },
  infrastructure: { label: '🔧 Infrastructure', visibility: 'team' as const },
  client: { label: '🤝 Client', visibility: 'team' as const },
  development: { label: '💻 Development', visibility: 'team' as const },
  bug: { label: '🐛 Bug', visibility: 'team' as const },
  campaign: { label: '📧 Campaign', visibility: 'team' as const },
  personal: { label: '👤 Personal', visibility: 'private' as const },
} as const;

export const RECURRING_PATTERNS = {
  daily: 'Every day',
  weekdays: 'Every weekday (Mon-Fri)',
  weekly: 'Every week',
  biweekly: 'Every 2 weeks',
  monthly: 'Every month',
} as const;

export const PRIORITY_COLORS = {
  urgent: { bg: '#f85149', border: '#f85149', text: 'Urgent' },
  high: { bg: '#d29922', border: '#d29922', text: 'High' },
  medium: { bg: '#58a6ff', border: '#58a6ff', text: 'Medium' },
  low: { bg: '#8b949e', border: '#8b949e', text: 'Low' },
} as const;

export const STATUS_CONFIG = {
  todo: { label: '📥 To Do', column: 'todo' as const },
  in_progress: { label: '🔨 In Progress', column: 'in_progress' as const },
  blocked: { label: '🚫 Blocked', column: 'blocked' as const },
  done: { label: '✅ Done', column: 'done' as const },
} as const;
