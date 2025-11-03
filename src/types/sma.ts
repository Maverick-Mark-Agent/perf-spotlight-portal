/**
 * SMA Insurance Commission Tracking Types
 * Used exclusively for SMA Insurance workspace
 */

export interface SMAPolicy {
  id: string;
  lead_id: string;
  workspace_name: string; // Always 'SMA Insurance'
  policy_type: string;
  premium_amount: number;
  agency_commission: number;
  maverick_commission: number; // Auto-calculated as 20% of agency_commission
  created_at: string;
  updated_at: string;
}

export interface SMAPolicyInput {
  policy_type: string;
  premium_amount: number;
  agency_commission: number;
}

export interface SMAPolicyFormData extends SMAPolicyInput {
  // For form state management - can have temporary ID before save
  tempId?: string;
}

export interface SMACommissionSummary {
  total_premium: number;
  total_agency_commission: number;
  total_maverick_commission: number;
  policy_count: number;
}

export const POLICY_TYPES = [
  'Auto',
  'Home',
  'Life',
  'Commercial',
  'Health',
  'Umbrella',
  'Other'
] as const;

export type PolicyType = typeof POLICY_TYPES[number];
