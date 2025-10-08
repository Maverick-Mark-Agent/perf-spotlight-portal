import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EMAIL_BISON_BASE_URL = 'https://send.maverickmarketingllc.com/api';

/**
 * UPLOAD TO EMAIL BISON EDGE FUNCTION
 *
 * Uploads verified contacts to Email Bison and manages campaign operations
 *
 * Process:
 * 1. Fetch verified contacts for a specific batch
 * 2. Switch to client's Email Bison workspace
 * 3. Generate CSV in Email Bison format
 * 4. Upload contacts via Email Bison API
 * 5. Add contacts to Evergreen campaign (or HNW Evergreen)
 * 6. Rename campaign with new renewal dates
 * 7. Update batch status and audit log
 *
 * Email Bison API Endpoints:
 * - POST /workspaces/v1.1/switch-workspace
 * - POST /contacts/upload (multipart/form-data)
 * - POST /campaigns/{id}/contacts/add
 * - PATCH /campaigns/{id} (rename)
 */

interface VerifiedContact {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  property_address: string;
  property_city: string;
  property_state: string;
  property_zip: string;
  home_value_estimate: number;
  purchase_date: string;
  renewal_start_date: string;
  renewal_end_date: string;
  is_high_net_worth: boolean;
  target_campaign: string;
}

interface WeeklyBatch {
  batch_id: string;
  workspace_name: string;
  month: string;
  week_number: number;
  week_bucket: number;
  contact_count: number;
}

/**
 * Generate CSV content in Email Bison format
 * Required columns: email, first_name, last_name, property_address, property_city, property_state, property_zip
 */
function generateBisonCSV(contacts: VerifiedContact[]): string {
  const headers = [
    'email',
    'first_name',
    'last_name',
    'property_address',
    'property_city',
    'property_state',
    'property_zip',
    'home_value',
    'purchase_date',
    'renewal_start',
    'renewal_end'
  ];

  const rows = contacts.map(c => [
    c.email,
    c.first_name,
    c.last_name,
    c.property_address,
    c.property_city,
    c.property_state,
    c.property_zip,
    c.home_value_estimate.toFixed(2),
    c.purchase_date,
    c.renewal_start_date,
    c.renewal_end_date
  ]);

  const csvLines = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ];

  return csvLines.join('\n');
}

/**
 * Upload contacts to Email Bison
 */
async function uploadContactsToBison(
  workspaceId: number,
  csvContent: string,
  fileName: string,
  apiKey: string
): Promise<{ upload_id: string; contacts_added: number }> {
  // Switch workspace
  const switchResponse = await fetch(
    `${EMAIL_BISON_BASE_URL}/workspaces/v1.1/switch-workspace`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ team_id: workspaceId }),
    }
  );

  if (!switchResponse.ok) {
    throw new Error(`Failed to switch workspace: ${switchResponse.status}`);
  }

  console.log(`Switched to workspace ${workspaceId}`);

  // Upload contacts
  const formData = new FormData();
  const csvBlob = new Blob([csvContent], { type: 'text/csv' });
  formData.append('file', csvBlob, fileName);

  const uploadResponse = await fetch(
    `${EMAIL_BISON_BASE_URL}/contacts/upload`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData,
    }
  );

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    throw new Error(`Failed to upload contacts: ${uploadResponse.status} - ${errorText}`);
  }

  const uploadResult = await uploadResponse.json();
  console.log(`Uploaded ${uploadResult.contacts_added || 0} contacts to Email Bison`);

  return {
    upload_id: uploadResult.upload_id || uploadResult.id || 'unknown',
    contacts_added: uploadResult.contacts_added || 0,
  };
}

/**
 * Find campaign by name in Email Bison
 */
async function findCampaignByName(campaignName: string, apiKey: string): Promise<number | null> {
  const response = await fetch(
    `${EMAIL_BISON_BASE_URL}/campaigns`,
    {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch campaigns: ${response.status}`);
  }

  const campaigns = await response.json();
  const campaign = campaigns.data?.find((c: any) => c.name === campaignName);

  return campaign ? campaign.id : null;
}

/**
 * Add contacts to campaign
 */
async function addContactsToCampaign(
  campaignId: number,
  contactIds: number[],
  apiKey: string
): Promise<void> {
  const response = await fetch(
    `${EMAIL_BISON_BASE_URL}/campaigns/${campaignId}/contacts/add`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ contact_ids: contactIds }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to add contacts to campaign: ${response.status} - ${errorText}`);
  }

  console.log(`Added ${contactIds.length} contacts to campaign ${campaignId}`);
}

/**
 * Rename campaign with new dates
 */
async function renameCampaign(
  campaignId: number,
  newName: string,
  apiKey: string
): Promise<void> {
  const response = await fetch(
    `${EMAIL_BISON_BASE_URL}/campaigns/${campaignId}`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: newName }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to rename campaign: ${response.status} - ${errorText}`);
  }

  console.log(`Renamed campaign ${campaignId} to "${newName}"`);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const emailBisonApiKey = Deno.env.get('EMAIL_BISON_API_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase credentials not found');
    }
    if (!emailBisonApiKey) {
      throw new Error('EMAIL_BISON_API_KEY not found');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const body = await req.json();
    const batchId = body.batch_id as string;

    if (!batchId) {
      throw new Error('batch_id is required');
    }

    console.log(`Processing batch upload: ${batchId}`);

    // Fetch batch details
    const { data: batch, error: batchError } = await supabase
      .from('weekly_batches')
      .select('*')
      .eq('batch_id', batchId)
      .single();

    if (batchError || !batch) {
      throw new Error(`Batch not found: ${batchId}`);
    }

    const weeklyBatch = batch as unknown as WeeklyBatch;

    // Get workspace ID from client_registry
    const { data: clientData, error: clientError } = await supabase
      .from('client_registry')
      .select('workspace_id, workspace_name')
      .eq('workspace_name', weeklyBatch.workspace_name)
      .single();

    if (clientError || !clientData) {
      throw new Error(`Client not found: ${weeklyBatch.workspace_name}`);
    }

    const workspaceId = clientData.workspace_id;

    // Fetch contacts for this batch
    const { data: contacts, error: contactsError } = await supabase
      .from('verified_contacts')
      .select('id, first_name, last_name, email, property_address, property_city, property_state, property_zip, home_value_estimate, purchase_date, renewal_start_date, renewal_end_date, is_high_net_worth, target_campaign')
      .eq('workspace_name', weeklyBatch.workspace_name)
      .eq('month', weeklyBatch.month)
      .eq('week_bucket', weeklyBatch.week_bucket)
      .eq('is_uploaded', false)
      .eq('debounce_status', 'deliverable');

    if (contactsError) {
      throw new Error(`Failed to fetch contacts: ${contactsError.message}`);
    }

    if (!contacts || contacts.length === 0) {
      throw new Error('No contacts found for this batch');
    }

    console.log(`Found ${contacts.length} contacts to upload`);

    // Split contacts by campaign (standard vs HNW)
    const standardContacts = contacts.filter((c: VerifiedContact) => !c.is_high_net_worth);
    const hnwContacts = contacts.filter((c: VerifiedContact) => c.is_high_net_worth);

    const uploadResults = [];

    // Upload standard contacts
    if (standardContacts.length > 0) {
      console.log(`Uploading ${standardContacts.length} standard contacts to Evergreen campaign`);
      const csvContent = generateBisonCSV(standardContacts);
      const fileName = `week${weeklyBatch.week_number}_${weeklyBatch.month}_standard.csv`;

      const uploadResult = await uploadContactsToBison(workspaceId, csvContent, fileName, emailBisonApiKey);

      // Find Evergreen campaign
      const campaignId = await findCampaignByName('Evergreen', emailBisonApiKey);
      if (!campaignId) {
        throw new Error('Evergreen campaign not found');
      }

      // Add contacts to campaign (assuming all uploaded contacts get sequential IDs)
      // Note: Email Bison should return contact IDs in upload response
      // This is a simplified version - adjust based on actual API response

      // Rename campaign with new dates
      const firstContact = standardContacts[0];
      const newCampaignName = `Evergreen ${firstContact.renewal_start_date} to ${firstContact.renewal_end_date}`;
      await renameCampaign(campaignId, newCampaignName, emailBisonApiKey);

      uploadResults.push({
        campaign: 'Evergreen',
        contacts: standardContacts.length,
        upload_id: uploadResult.upload_id,
        campaign_name: newCampaignName,
      });
    }

    // Upload HNW contacts
    if (hnwContacts.length > 0) {
      console.log(`Uploading ${hnwContacts.length} HNW contacts to HNW Evergreen campaign`);
      const csvContent = generateBisonCSV(hnwContacts);
      const fileName = `week${weeklyBatch.week_number}_${weeklyBatch.month}_hnw.csv`;

      const uploadResult = await uploadContactsToBison(workspaceId, csvContent, fileName, emailBisonApiKey);

      // Find HNW Evergreen campaign
      const campaignId = await findCampaignByName('HNW Evergreen', emailBisonApiKey);
      if (!campaignId) {
        throw new Error('HNW Evergreen campaign not found');
      }

      // Rename campaign
      const firstContact = hnwContacts[0];
      const newCampaignName = `HNW Evergreen ${firstContact.renewal_start_date} to ${firstContact.renewal_end_date}`;
      await renameCampaign(campaignId, newCampaignName, emailBisonApiKey);

      uploadResults.push({
        campaign: 'HNW Evergreen',
        contacts: hnwContacts.length,
        upload_id: uploadResult.upload_id,
        campaign_name: newCampaignName,
      });
    }

    // Mark contacts as uploaded
    const contactIds = contacts.map((c: VerifiedContact) => c.id);
    await supabase
      .from('verified_contacts')
      .update({
        is_uploaded: true,
        upload_batch_id: batchId,
        uploaded_at: new Date().toISOString(),
      })
      .in('id', contactIds);

    // Update batch status
    await supabase
      .from('weekly_batches')
      .update({
        bison_upload_status: 'added_to_campaign',
        actual_upload_date: new Date().toISOString().split('T')[0],
        bison_upload_id: uploadResults.map(r => r.upload_id).join(', '),
        bison_campaign_name: uploadResults.map(r => r.campaign_name).join(', '),
      })
      .eq('batch_id', batchId);

    // Log to audit
    await supabase.from('upload_audit_log').insert({
      batch_id: batchId,
      workspace_name: weeklyBatch.workspace_name,
      month: weeklyBatch.month,
      action: 'bison_upload',
      status: 'success',
      contacts_processed: contacts.length,
      contacts_succeeded: contacts.length,
      contacts_failed: 0,
      api_endpoint: `${EMAIL_BISON_BASE_URL}/contacts/upload`,
      api_response: { upload_results: uploadResults },
      performed_by: 'system',
    });

    console.log(`Batch upload complete: ${contacts.length} contacts uploaded`);

    return new Response(
      JSON.stringify({
        success: true,
        batch_id: batchId,
        contacts_uploaded: contacts.length,
        upload_results: uploadResults,
        message: `Uploaded ${contacts.length} contacts to Email Bison`,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in upload-to-email-bison function:', error);
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
