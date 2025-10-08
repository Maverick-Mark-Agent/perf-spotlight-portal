import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * VERIFY CONTACTS DEBOUNCE EDGE FUNCTION
 *
 * Verifies email addresses using Debounce API and creates verified_contacts records
 *
 * Process:
 * 1. Fetch unverified contacts from raw_contacts (status = 'ready_for_verification')
 * 2. Batch verify emails via Debounce API (rate-limited, batches of 100)
 * 3. Calculate renewal windows (M+28 to M+34 days)
 * 4. Assign week buckets (1: days 1-7, 2: days 8-14, 3: days 15-21, 4: days 22-end)
 * 5. Insert into verified_contacts table
 * 6. Track Debounce credit usage
 *
 * Debounce API: https://debounce.io/api/docs
 * - Bulk verification endpoint: POST /v1/bulk
 * - Rate limit: 100 emails per request
 * - Cost: ~$500 for 1M credits
 */

interface DebounceVerifyRequest {
  emails: string[];
}

interface DebounceVerifyResponse {
  results: Array<{
    email: string;
    status: 'deliverable' | 'undeliverable' | 'risky' | 'unknown';
    reason?: string;
    suggestion?: string;
  }>;
  credits_used: number;
}

interface RawContact {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  property_address: string;
  property_city: string;
  property_state: string;
  property_zip: string;
  home_value_estimate: number;
  parsed_purchase_date: string;
  is_high_net_worth: boolean;
  workspace_name: string;
  month: string;
}

/**
 * Calculate renewal window and week bucket from purchase date
 * Renewal window: M+28 to M+34 days from purchase
 * Week buckets: 1 (days 1-7), 2 (8-14), 3 (15-21), 4 (22-end)
 */
function calculateRenewalWindow(purchaseDateStr: string, monthStr: string): {
  renewalStartDate: string;
  renewalEndDate: string;
  weekBucket: number;
  purchaseDay: number;
} {
  const purchaseDate = new Date(purchaseDateStr);
  const purchaseDay = purchaseDate.getDate();

  // Calculate renewal dates (M+28 to M+34)
  const renewalStart = new Date(purchaseDate);
  renewalStart.setMonth(renewalStart.getMonth() + 28);
  const renewalEnd = new Date(renewalStart);
  renewalEnd.setDate(renewalStart.getDate() + 6); // 28-34 = 7-day window

  // Assign week bucket based on purchase day
  let weekBucket: number;
  if (purchaseDay >= 1 && purchaseDay <= 7) {
    weekBucket = 1;
  } else if (purchaseDay >= 8 && purchaseDay <= 14) {
    weekBucket = 2;
  } else if (purchaseDay >= 15 && purchaseDay <= 21) {
    weekBucket = 3;
  } else {
    weekBucket = 4; // Days 22-31
  }

  return {
    renewalStartDate: renewalStart.toISOString().split('T')[0],
    renewalEndDate: renewalEnd.toISOString().split('T')[0],
    weekBucket,
    purchaseDay,
  };
}

/**
 * Verify emails with Debounce API (batch)
 */
async function verifyEmailsDebounce(emails: string[], apiKey: string): Promise<DebounceVerifyResponse> {
  const DEBOUNCE_API_URL = 'https://api.debounce.io/v1/bulk';

  const response = await fetch(DEBOUNCE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ emails }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Debounce API error: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const debounceApiKey = Deno.env.get('DEBOUNCE_API_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase credentials not found');
    }
    if (!debounceApiKey) {
      throw new Error('DEBOUNCE_API_KEY not found in secrets');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const body = await req.json();
    const workspaceName = body.workspace_name as string;
    const month = body.month as string;
    const batchSize = body.batch_size || 100; // Max 100 per Debounce API request

    if (!workspaceName || !month) {
      throw new Error('workspace_name and month are required');
    }

    console.log(`Verifying contacts for ${workspaceName}, month: ${month}`);

    // Fetch unverified contacts from raw_contacts
    const { data: rawContacts, error: fetchError } = await supabase
      .from('raw_contacts')
      .select('id, first_name, last_name, email, property_address, property_city, property_state, property_zip, home_value_estimate, parsed_purchase_date, is_high_net_worth, workspace_name, month')
      .eq('workspace_name', workspaceName)
      .eq('month', month)
      .eq('processing_status', 'ready_for_verification')
      .limit(batchSize);

    if (fetchError) {
      throw new Error(`Failed to fetch contacts: ${fetchError.message}`);
    }

    if (!rawContacts || rawContacts.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No contacts ready for verification',
          verified_count: 0,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Found ${rawContacts.length} contacts to verify`);

    // Extract emails for Debounce
    const emails = rawContacts.map((c: RawContact) => c.email);

    // Verify with Debounce
    const startTime = Date.now();
    const debounceResponse = await verifyEmailsDebounce(emails, debounceApiKey);
    const duration = Date.now() - startTime;

    console.log(`Debounce verification complete: ${debounceResponse.results.length} results, ${debounceResponse.credits_used} credits used`);

    // Create verified_contacts records
    const verifiedContacts = rawContacts.map((contact: RawContact, index: number) => {
      const debounceResult = debounceResponse.results[index];
      const renewalData = calculateRenewalWindow(contact.parsed_purchase_date, month);

      // Determine target campaign
      const targetCampaign = contact.is_high_net_worth ? 'HNW Evergreen' : 'Evergreen';

      return {
        raw_contact_id: contact.id,
        workspace_name: contact.workspace_name,
        month: contact.month,
        first_name: contact.first_name,
        last_name: contact.last_name,
        email: contact.email,
        property_address: contact.property_address,
        property_city: contact.property_city,
        property_state: contact.property_state,
        property_zip: contact.property_zip,
        home_value_estimate: contact.home_value_estimate,
        purchase_date: contact.parsed_purchase_date,
        purchase_day: renewalData.purchaseDay,
        renewal_start_date: renewalData.renewalStartDate,
        renewal_end_date: renewalData.renewalEndDate,
        week_bucket: renewalData.weekBucket,
        debounce_status: debounceResult.status,
        debounce_response: debounceResult,
        debounce_verified_at: new Date().toISOString(),
        debounce_credits_used: 1,
        is_high_net_worth: contact.is_high_net_worth,
        target_campaign: targetCampaign,
      };
    });

    // Insert verified contacts
    const { data: insertedContacts, error: insertError } = await supabase
      .from('verified_contacts')
      .insert(verifiedContacts)
      .select();

    if (insertError) {
      console.error('Error inserting verified contacts:', insertError);
      throw new Error(`Failed to insert verified contacts: ${insertError.message}`);
    }

    // Update raw_contacts status
    const rawContactIds = rawContacts.map((c: RawContact) => c.id);
    await supabase
      .from('raw_contacts')
      .update({
        processing_status: 'verified',
        processed_at: new Date().toISOString(),
      })
      .in('id', rawContactIds);

    // Track Debounce usage
    const deliverableCount = debounceResponse.results.filter(r => r.status === 'deliverable').length;
    const undeliverableCount = debounceResponse.results.filter(r => r.status === 'undeliverable').length;
    const riskyCount = debounceResponse.results.filter(r => r.status === 'risky').length;
    const unknownCount = debounceResponse.results.filter(r => r.status === 'unknown').length;

    await supabase.from('debounce_usage').insert({
      month,
      workspace_name: workspaceName,
      credits_used: debounceResponse.credits_used,
      emails_verified: rawContacts.length,
      deliverable_count: deliverableCount,
      undeliverable_count: undeliverableCount,
      risky_count: riskyCount,
      unknown_count: unknownCount,
    });

    // Log to audit
    await supabase.from('upload_audit_log').insert({
      workspace_name: workspaceName,
      month,
      action: 'contact_verification',
      status: 'success',
      contacts_processed: rawContacts.length,
      contacts_succeeded: deliverableCount,
      contacts_failed: undeliverableCount + riskyCount + unknownCount,
      api_endpoint: 'https://api.debounce.io/v1/bulk',
      api_response: {
        credits_used: debounceResponse.credits_used,
        deliverable: deliverableCount,
        undeliverable: undeliverableCount,
        risky: riskyCount,
        unknown: unknownCount,
      },
      duration_ms: duration,
      credits_used: debounceResponse.credits_used,
      performed_by: 'system',
    });

    console.log(`Verification complete: ${deliverableCount} deliverable, ${undeliverableCount} undeliverable, ${riskyCount} risky, ${unknownCount} unknown`);

    return new Response(
      JSON.stringify({
        success: true,
        verified_count: rawContacts.length,
        summary: {
          deliverable: deliverableCount,
          undeliverable: undeliverableCount,
          risky: riskyCount,
          unknown: unknownCount,
          credits_used: debounceResponse.credits_used,
          duration_ms: duration,
        },
        message: `Verified ${rawContacts.length} contacts: ${deliverableCount} deliverable, ${undeliverableCount} undeliverable`,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in verify-contacts-debounce function:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
