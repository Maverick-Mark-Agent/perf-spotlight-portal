/**
 * SMA Policies Service
 * Handles CRUD operations for SMA Insurance policies
 */

import { supabase } from "@/integrations/supabase/client";
import { SMAPolicy, SMAPolicyInput, SMACommissionSummary } from "@/types/sma";

/**
 * Fetch all policies for a specific lead
 */
export const getPoliciesByLeadId = async (leadId: string): Promise<SMAPolicy[]> => {
  const { data, error } = await supabase
    .from('sma_policies')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching SMA policies:', error);
    throw error;
  }

  return data || [];
};

/**
 * Create multiple policies for a lead (used when marking lead as Won)
 */
export const createPolicies = async (
  leadId: string,
  policies: SMAPolicyInput[]
): Promise<SMAPolicy[]> => {
  const policiesWithLeadId = policies.map(policy => ({
    lead_id: leadId,
    workspace_name: 'SMA Insurance',
    policy_type: policy.policy_type,
    premium_amount: policy.premium_amount,
    agency_commission: policy.agency_commission,
    // maverick_commission will be auto-calculated by database trigger
  }));

  const { data, error } = await supabase
    .from('sma_policies')
    .insert(policiesWithLeadId)
    .select();

  if (error) {
    console.error('Error creating SMA policies:', error);
    throw error;
  }

  return data || [];
};

/**
 * Create a single policy
 */
export const createPolicy = async (
  leadId: string,
  policy: SMAPolicyInput
): Promise<SMAPolicy> => {
  const { data, error } = await supabase
    .from('sma_policies')
    .insert({
      lead_id: leadId,
      workspace_name: 'SMA Insurance',
      policy_type: policy.policy_type,
      premium_amount: policy.premium_amount,
      agency_commission: policy.agency_commission,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating SMA policy:', error);
    throw error;
  }

  return data;
};

/**
 * Update an existing policy
 */
export const updatePolicy = async (
  policyId: string,
  updates: Partial<SMAPolicyInput>
): Promise<SMAPolicy> => {
  const { data, error } = await supabase
    .from('sma_policies')
    .update(updates)
    .eq('id', policyId)
    .select()
    .single();

  if (error) {
    console.error('Error updating SMA policy:', error);
    throw error;
  }

  return data;
};

/**
 * Delete a policy
 */
export const deletePolicy = async (policyId: string): Promise<void> => {
  const { error } = await supabase
    .from('sma_policies')
    .delete()
    .eq('id', policyId);

  if (error) {
    console.error('Error deleting SMA policy:', error);
    throw error;
  }
};

/**
 * Get commission summary for SMA Insurance workspace (all-time)
 */
export const getSMACommissionSummary = async (): Promise<SMACommissionSummary> => {
  const { data, error } = await supabase
    .from('sma_policies')
    .select('premium_amount, agency_commission, maverick_commission')
    .eq('workspace_name', 'SMA Insurance');

  if (error) {
    console.error('Error fetching SMA commission summary:', error);
    throw error;
  }

  if (!data || data.length === 0) {
    return {
      total_premium: 0,
      total_agency_commission: 0,
      total_maverick_commission: 0,
      policy_count: 0,
    };
  }

  const summary = data.reduce(
    (acc, policy) => ({
      total_premium: acc.total_premium + (policy.premium_amount || 0),
      total_agency_commission: acc.total_agency_commission + (policy.agency_commission || 0),
      total_maverick_commission: acc.total_maverick_commission + (policy.maverick_commission || 0),
      policy_count: acc.policy_count + 1,
    }),
    {
      total_premium: 0,
      total_agency_commission: 0,
      total_maverick_commission: 0,
      policy_count: 0,
    }
  );

  return summary;
};

/**
 * Get commission summary for a specific lead
 */
export const getLeadCommissionSummary = async (leadId: string): Promise<SMACommissionSummary> => {
  const { data, error } = await supabase
    .from('sma_policies')
    .select('premium_amount, agency_commission, maverick_commission')
    .eq('lead_id', leadId);

  if (error) {
    console.error('Error fetching lead commission summary:', error);
    throw error;
  }

  if (!data || data.length === 0) {
    return {
      total_premium: 0,
      total_agency_commission: 0,
      total_maverick_commission: 0,
      policy_count: 0,
    };
  }

  const summary = data.reduce(
    (acc, policy) => ({
      total_premium: acc.total_premium + (policy.premium_amount || 0),
      total_agency_commission: acc.total_agency_commission + (policy.agency_commission || 0),
      total_maverick_commission: acc.total_maverick_commission + (policy.maverick_commission || 0),
      policy_count: acc.policy_count + 1,
    }),
    {
      total_premium: 0,
      total_agency_commission: 0,
      total_maverick_commission: 0,
      policy_count: 0,
    }
  );

  return summary;
};
