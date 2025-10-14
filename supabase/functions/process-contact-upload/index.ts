import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { parse } from 'https://deno.land/std@0.224.0/csv/parse.ts';
import { mapCsvRow, isHeadOfHousehold, checkHNWCriteria, type ColumnMapping } from './flexible-csv-parser.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * FLEXIBLE CONTACT UPLOAD PROCESSOR
 *
 * Handles CSV uploads in ANY format by:
 * 1. Auto-detecting column names
 * 2. Mapping to standard database fields
 * 3. Storing unmapped columns in JSONB extra_fields
 * 4. Applying HNW filtering (TX contacts >= $900k → Kirk Hodgson)
 */

interface ProcessedContact {
  upload_batch_id: string;
  client_name: string;
  workspace_name: string;
  month: string;
  uploaded_by: string;

  first_name: string | null;
  last_name: string | null;
  email: string | null;
  property_address: string | null;
  property_city: string | null;
  property_state: string | null;
  property_zip: string | null;
  mailing_address: string | null;
  mailing_city: string | null;
  mailing_state: string | null;
  mailing_zip: string | null;
  home_value_estimate: number;
  purchase_date: string | null;

  extra_fields: Record<string, any>;
  csv_column_mapping: Record<string, string>;

  is_head_of_household: boolean;
  meets_value_criteria: boolean;
  is_high_net_worth: boolean;
  parsed_purchase_date: string | null;
  processing_status: 'filtered_out' | 'ready_for_verification';
  filter_reason: string | null;
}

function processContact(
  row: Record<string, string>,
  headers: string[],
  uploadBatchId: string,
  clientName: string,
  workspaceName: string,
  month: string,
  uploadedBy: string
): ProcessedContact {
  // Use flexible parser to map columns
  const mapped = mapCsvRow(row, headers);

  // Validate and log home value
  if (mapped.home_value_estimate && mapped.home_value_estimate > 0) {
    if (mapped.property_state === 'TX' && mapped.home_value_estimate >= 900000) {
      console.log(`🎯 HNW Candidate: ${mapped.first_name} ${mapped.last_name}, ${mapped.property_city} TX, $${mapped.home_value_estimate.toLocaleString()}`);
    }
  }

  // Apply filters
  const isHoH = isHeadOfHousehold(mapped.first_name);
  const { meetsStandard, isHNW } = checkHNWCriteria(
    mapped.home_value_estimate || 0,
    mapped.property_state
  );

  // Determine processing status
  let processingStatus: 'filtered_out' | 'ready_for_verification' = 'ready_for_verification';
  let filterReason: string | null = null;

  if (!isHoH) {
    processingStatus = 'filtered_out';
    filterReason = 'Not head of household (multiple names detected)';
  } else if (!meetsStandard && !isHNW) {
    processingStatus = 'filtered_out';
    filterReason = `Home value ${mapped.home_value_estimate >= 900000 ? '≥' : '<'}$900k outside criteria for ${mapped.property_state || 'unknown state'}`;
  } else if (mapped.email && !mapped.email.match(/^[^@]+@[^@]+\.[^@]+$/)) {
    processingStatus = 'filtered_out';
    filterReason = 'Invalid email format';
  } else if (mapped.purchase_date && !mapped.purchase_date.match(/^\d{4}-\d{2}-\d{2}$/)) {
    processingStatus = 'filtered_out';
    filterReason = 'Invalid purchase date format';
  }

  // If email is missing but everything else is good, allow it
  // (Not all CSVs have email - they can be enriched later)

  return {
    upload_batch_id: uploadBatchId,
    client_name: clientName,
    workspace_name: workspaceName,
    month,
    uploaded_by: uploadedBy,

    first_name: mapped.first_name || null,
    last_name: mapped.last_name || null,
    email: mapped.email || null,
    property_address: mapped.property_address || null,
    property_city: mapped.property_city || null,
    property_state: mapped.property_state || null,
    property_zip: mapped.property_zip || null,
    mailing_address: mapped.mailing_address || mapped.property_address || null,
    mailing_city: mapped.mailing_city || mapped.property_city || null,
    mailing_state: mapped.mailing_state || mapped.property_state || null,
    mailing_zip: mapped.mailing_zip || mapped.property_zip || null,
    home_value_estimate: mapped.home_value_estimate || 0,
    purchase_date: mapped.purchase_date,

    extra_fields: mapped.extra_fields,
    csv_column_mapping: mapped.csv_column_mapping,

    is_head_of_household: isHoH,
    meets_value_criteria: meetsStandard || isHNW,
    is_high_net_worth: isHNW,
    parsed_purchase_date: mapped.purchase_date,
    processing_status: processingStatus,
    filter_reason: filterReason,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase credentials not found');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const formData = await req.formData();
    const csvFile = formData.get('csv_file') as File;
    const workspaceName = formData.get('workspace_name') as string;
    const month = formData.get('month') as string;
    const uploadedBy = formData.get('uploaded_by') as string || 'system';

    if (!csvFile) throw new Error('CSV file is required');
    if (!workspaceName) throw new Error('workspace_name is required');
    if (!month) throw new Error('month is required (format: YYYY-MM)');

    console.log(`📥 Processing CSV upload for ${workspaceName}, month: ${month}`);

    // Get client info
    const { data: clientData, error: clientError } = await supabase
      .from('client_registry')
      .select('workspace_name, display_name')
      .eq('workspace_name', workspaceName)
      .single();

    if (clientError || !clientData) {
      throw new Error(`Client not found: ${workspaceName}`);
    }

    const clientName = clientData.display_name || clientData.workspace_name;

    // Parse CSV
    const csvText = await csvFile.text();
    const lines = csvText.split('\n').filter(line => line.trim());

    console.log(`📄 CSV has ${lines.length} lines (including header)`);

    // Parse with flexible headers
    const rows = parse(csvText, { skipFirstRow: true }) as Record<string, string>[];
    const headers = Object.keys(rows[0] || {});

    console.log(`📋 Detected ${headers.length} columns:`, headers.join(', '));

    // Generate batch ID
    const uploadBatchId = crypto.randomUUID();

    // Process all contacts
    const processedContacts = rows.map(row =>
      processContact(row, headers, uploadBatchId, clientName, workspaceName, month, uploadedBy)
    );

    console.log(`✅ Processed ${processedContacts.length} contacts`);

    // =====================================================
    // KIRK HODGSON HNW ROUTING: MOVE (not duplicate)
    // =====================================================
    const TEXAS_AGENCIES = ['Kim Wallace', 'David Amiri', 'John Roberts', 'Jason Binyon'];
    const isTexasAgency = TEXAS_AGENCIES.some(agency =>
      clientName.toLowerCase().includes(agency.toLowerCase())
    );

    let standardContacts = processedContacts;
    let kirkContacts: any[] = [];
    let kirkRoutingCount = 0;

    if (isTexasAgency) {
      const { data: kirkWorkspace } = await supabase
        .from('client_registry')
        .select('workspace_name, display_name')
        .ilike('display_name', '%Kirk%Hodg%')
        .single();

      if (kirkWorkspace) {
        const hnwTexasContacts = processedContacts.filter(
          c => c.is_high_net_worth && c.property_state === 'TX' && c.processing_status === 'ready_for_verification'
        );

        standardContacts = processedContacts.filter(
          c => !(c.is_high_net_worth && c.property_state === 'TX' && c.processing_status === 'ready_for_verification')
        );

        if (hnwTexasContacts.length > 0) {
          console.log(`🎯 Moving ${hnwTexasContacts.length} HNW Texas contacts to Kirk Hodgson...`);

          kirkContacts = hnwTexasContacts.map(contact => {
            const { upload_batch_id, ...contactData } = contact;
            return {
              ...contactData,
              upload_batch_id: crypto.randomUUID(),
              workspace_name: kirkWorkspace.workspace_name,
              client_name: kirkWorkspace.display_name,
              uploaded_by: `hnw_auto_route_from_${workspaceName}`,
            };
          });

          kirkRoutingCount = kirkContacts.length;
        }
      }
    }

    // Insert standard contacts to original workspace
    const { error: insertError } = await supabase
      .from('raw_contacts')
      .insert(standardContacts);

    if (insertError) {
      console.error('Error inserting contacts:', insertError);
      throw new Error(`Failed to insert contacts: ${insertError.message}`);
    }

    // Insert HNW contacts to Kirk Hodgson
    if (kirkContacts.length > 0) {
      const { error: kirkInsertError } = await supabase
        .from('raw_contacts')
        .insert(kirkContacts);

      if (kirkInsertError) {
        console.error('Warning: Failed to route HNW contacts to Kirk:', kirkInsertError);
        kirkRoutingCount = 0;
      } else {
        console.log(`✅ Successfully moved ${kirkRoutingCount} HNW contacts to Kirk Hodgson`);
      }
    }

    // Calculate stats
    const totalContacts = processedContacts.length;
    const filteredOut = processedContacts.filter(c => c.processing_status === 'filtered_out').length;
    const readyForVerification = processedContacts.filter(c => c.processing_status === 'ready_for_verification').length;
    const hnwContacts = processedContacts.filter(c => c.is_high_net_worth).length;

    // Group filter reasons
    const filterReasons: Record<string, number> = {};
    processedContacts.forEach(c => {
      if (c.filter_reason) {
        filterReasons[c.filter_reason] = (filterReasons[c.filter_reason] || 0) + 1;
      }
    });

    console.log(`✅ Upload complete: ${readyForVerification} ready, ${filteredOut} filtered out`);

    const responseMessage = kirkRoutingCount > 0
      ? `Processed ${totalContacts} contacts for ${clientName}: ${standardContacts.length} added to ${clientName}, ${kirkRoutingCount} HNW Texas contacts moved to Kirk Hodgson, ${filteredOut} filtered out.`
      : `Processed ${totalContacts} contacts: ${readyForVerification} ready for verification, ${filteredOut} filtered out.`;

    return new Response(
      JSON.stringify({
        success: true,
        upload_batch_id: uploadBatchId,
        summary: {
          total_contacts: totalContacts,
          ready_for_verification: readyForVerification,
          filtered_out: filteredOut,
          hnw_contacts: hnwContacts,
          kirk_routing_count: kirkRoutingCount,
          columns_detected: headers.length,
          column_names: headers,
          filter_reasons: filterReasons,
        },
        message: responseMessage,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in process-contact-upload function:', error);
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
