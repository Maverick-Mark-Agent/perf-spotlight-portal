// Expense Tracking Types

export type PaymentMethod = 'credit_card' | 'bank_transfer' | 'check' | 'paypal' | 'cash' | 'other';
export type ExpenseStatus = 'pending' | 'approved' | 'rejected' | 'archived';
export type RecurringFrequency = 'weekly' | 'monthly' | 'quarterly' | 'annual';
export type BillingCycle = 'monthly' | 'annual' | 'quarterly' | 'one_time' | 'variable';
export type AllocationType = 'overhead' | 'client' | 'split';

export interface ExpenseCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  parent_id?: string;
  icon?: string;
  color: string;
  sort_order: number;
  is_tax_deductible: boolean;
  tax_category?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Vendor {
  id: string;
  name: string;
  display_name?: string;
  website?: string;
  email?: string;
  phone?: string;
  category_id?: string;
  category?: ExpenseCategory;
  default_payment_method?: PaymentMethod;
  billing_cycle?: BillingCycle;
  typical_amount?: number;
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  currency: string;
  expense_date: string;
  month_year: string;
  category_id: string;
  category?: ExpenseCategory;
  vendor_id?: string;
  vendor?: Vendor;
  payment_method?: PaymentMethod;
  payment_reference?: string;
  is_recurring: boolean;
  recurring_frequency?: RecurringFrequency;
  recurring_template_id?: string;
  is_tax_deductible: boolean;
  tax_category?: string;
  status: ExpenseStatus;
  has_receipt: boolean;
  notes?: string;
  created_by?: string;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
  // Joined data
  allocations?: ExpenseAllocation[];
  receipts?: ExpenseReceipt[];
}

export interface ExpenseAllocation {
  id: string;
  expense_id: string;
  workspace_name?: string;
  is_overhead: boolean;
  allocation_percentage: number;
  allocated_amount: number;
  allocation_notes?: string;
  created_at: string;
}

export interface ExpenseReceipt {
  id: string;
  expense_id: string;
  file_name: string;
  file_type: string;
  file_size?: number;
  storage_path: string;
  storage_bucket: string;
  uploaded_by?: string;
  uploaded_at: string;
  // Computed
  url?: string;
}

export interface RecurringExpenseTemplate {
  id: string;
  name: string;
  description?: string;
  amount: number;
  category_id: string;
  category?: ExpenseCategory;
  vendor_id?: string;
  vendor?: Vendor;
  frequency: RecurringFrequency;
  day_of_month: number;
  start_date: string;
  end_date?: string;
  next_occurrence?: string;
  workspace_name?: string; // NULL = overhead
  is_active: boolean;
  last_generated_date?: string;
  created_at: string;
  updated_at: string;
}

export interface BudgetTarget {
  id: string;
  month_year: string;
  category_id?: string;
  category?: ExpenseCategory;
  budget_amount: number;
  warning_threshold: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// Form Data Types

export interface ExpenseFormData {
  description: string;
  amount: number;
  expense_date: Date;
  category_id: string;
  vendor_id?: string;
  payment_method?: PaymentMethod;
  payment_reference?: string;
  is_recurring: boolean;
  recurring_frequency?: RecurringFrequency;
  is_tax_deductible: boolean;
  notes?: string;
  allocation_type: AllocationType;
  allocations: AllocationFormData[];
  receipt_file?: File;
}

export interface AllocationFormData {
  workspace_name?: string;
  is_overhead: boolean;
  allocation_percentage: number;
}

export interface VendorFormData {
  name: string;
  display_name?: string;
  website?: string;
  email?: string;
  phone?: string;
  category_id?: string;
  default_payment_method?: PaymentMethod;
  billing_cycle?: BillingCycle;
  typical_amount?: number;
  notes?: string;
}

export interface RecurringExpenseFormData {
  name: string;
  description?: string;
  amount: number;
  category_id: string;
  vendor_id?: string;
  frequency: RecurringFrequency;
  day_of_month: number;
  start_date: Date;
  end_date?: Date;
  workspace_name?: string; // NULL = overhead
}

// Analytics Types

export interface MonthlyExpenseSummary {
  month_year: string;
  category_name: string;
  category_slug: string;
  category_color: string;
  expense_count: number;
  total_amount: number;
  approved_amount: number;
  pending_amount: number;
  missing_receipts: number;
}

export interface ClientExpenseSummary {
  workspace_name: string;
  month_year: string;
  total_direct_costs: number;
  expense_count: number;
}

export interface OverheadExpenseSummary {
  month_year: string;
  total_overhead: number;
  expense_count: number;
}

export interface ExpenseDashboardData {
  expenses: Expense[];
  categories: ExpenseCategory[];
  vendors: Vendor[];
  totals: ExpenseTotals;
  pending_count: number;
  missing_receipts_count: number;
}

export interface ExpenseTotals {
  mtd_total: number;
  mtd_approved: number;
  mtd_pending: number;
  mtd_by_category: { category_name: string; category_color: string; amount: number }[];
  mtd_overhead: number;
  mtd_client_allocated: number;
}

export interface ProfitLossData {
  month_year: string;
  total_revenue: number;
  total_expenses: number;
  gross_profit: number;
  profit_margin: number;
  revenue_breakdown: {
    per_lead_revenue: number;
    retainer_revenue: number;
  };
  expense_breakdown: {
    category_name: string;
    amount: number;
  }[];
}

export interface BudgetStatus {
  month_year: string;
  category_id: string;
  category_name: string;
  budget_amount: number;
  actual_amount: number;
  remaining: number;
  percentage_used: number;
  status: 'under' | 'warning' | 'over';
}

// AI Assistant Types

export interface AssistantSession {
  id: string;
  started_at: string;
  last_message_at: string;
  message_count: number;
  expenses_created: number;
  receipts_matched: number;
}

export interface AssistantMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  attachments?: AssistantAttachment[];
  metadata?: AssistantActionsTaken;
  created_at: string;
}

export interface AssistantAttachment {
  file_name: string;
  file_type: string;
  storage_path?: string;
  base64_content?: string; // For uploads before processing
}

export interface AssistantActionsTaken {
  expenses_created?: {
    id: string;
    description: string;
    amount: number;
    vendor?: string;
    category?: string;
  }[];
  expenses_matched?: {
    id: string;
    description: string;
    amount: number;
    receipt_attached: boolean;
  }[];
  duplicates_skipped?: {
    description: string;
    amount: number;
    reason: string;
  }[];
  items_needing_review?: {
    description: string;
    amount: number;
    issue: string;
  }[];
}

export interface AssistantChatRequest {
  session_id?: string;
  message: string;
  attachments?: {
    file_name: string;
    file_type: string;
    base64_content: string;
  }[];
}

export interface AssistantChatResponse {
  session_id: string;
  message: string;
  actions_taken?: AssistantActionsTaken;
}
