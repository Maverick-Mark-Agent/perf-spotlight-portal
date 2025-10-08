import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { parse } from 'https://deno.land/std@0.224.0/csv/parse.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * PROCESS CONTACT UPLOAD EDGE FUNCTION
 *
 * Handles CSV upload from Cole X Dates and auto-processes contacts:
 * 1. Parse CSV and validate required fields
 * 2. Filter Head of Household
 * 3. Apply home value criteria (<$900k standard, >$900k HNW for TX)
 * 4. Parse purchase dates and calculate renewal windows
 * 5. Store in raw_contacts and mark ready for verification
 *
 * Expected CSV columns from Cole X Dates (13 fields):
 * - First Name, Last Name
 * - Mailing Address, Mailing City, Mailing State, Mailing ZIP
 * - Property Address, Property City, Property State, Property ZIP
 * - Home Value Estimate, Purchase Date, Email
 */

interface ColeXDatesRow {
  'First Name': string;
  'Last Name': string;
  'Mailing Address': string;
  'Mailing City': string;
  'Mailing State': string;
  'Mailing ZIP': string;
  'Property Address': string;
  'Property City': string;
  'Property State': string;
  'Property ZIP': string;
  'Home Value Estimate': string;
  'Purchase Date': string;
  'Email': string;
}

interface ProcessedContact {
  upload_batch_id: string;
  client_name: string;
  workspace_name: string;
  month: string;
  uploaded_by: string;

  first_name: string;
  last_name: string;
  mailing_address: string;
  mailing_city: string;
  mailing_state: string;
  mailing_zip: string;
  property_address: string;
  property_city: string;
  property_state: string;
  property_zip: string;
  home_value_estimate: number;
  purchase_date: string;
  email: string;

  is_head_of_household: boolean;
  meets_value_criteria: boolean;
  is_high_net_worth: boolean;
  parsed_purchase_date: string | null;
  processing_status: 'filtered_out' | 'ready_for_verification';
  filter_reason: string | null;
}

/**
 * Parse purchase date string into Date object
 * Handles formats: MM/DD/YYYY, M/D/YYYY, YYYY-MM-DD
 */
function parsePurchaseDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  // Try MM/DD/YYYY or M/D/YYYY format
  const slashMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, month, day, year] = slashMatch;
    return new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
  }

  // Try YYYY-MM-DD format
  const dashMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dashMatch) {
    return new Date(dateStr);
  }

  return null;
}

/**
 * Check if contact is Head of Household
 * Logic: First name doesn't contain "&" or "and" or multiple names
 */
function isHeadOfHousehold(firstName: string): boolean {
  if (!firstName) return false;

  const lowerFirst = firstName.toLowerCase();
  return !(
    lowerFirst.includes('&') ||
    lowerFirst.includes(' and ') ||
    lowerFirst.includes(',')
  );
}

/**
 * Check if home value meets criteria
 * - Standard: <$900k
 * - High Net Worth (TX only): >$900k
 */
function checkValueCriteria(homeValue: number, state: string): {
  meetsStandard: boolean;
  isHNW: boolean;
} {
  const isTexas = state?.toUpperCase() === 'TX';

  if (isTexas && homeValue > 900000) {
    return { meetsStandard: false, isHNW: true };
  }

  return { meetsStandard: homeValue < 900000, isHNW: false };
}

/**
 * Process a single contact row
 */
function processContact(
  row: ColeXDatesRow,
  uploadBatchId: string,
  clientName: string,
  workspaceName: string,
  month: string,
  uploadedBy: string
): ProcessedContact {
  const firstName = row['First Name']?.trim() || '';
  const lastName = row['Last Name']?.trim() || '';
  const email = row['Email']?.trim().toLowerCase() || '';
  const homeValueStr = row['Home Value Estimate']?.replace(/[$,]/g, '') || '0';
  const homeValue = parseFloat(homeValueStr) || 0;
  const propertyState = row['Property State']?.trim() || '';
  const purchaseDateStr = row['Purchase Date']?.trim() || '';

  // Parse purchase date
  const purchaseDate = parsePurchaseDate(purchaseDateStr);
  const parsedPurchaseDateISO = purchaseDate ? purchaseDate.toISOString().split('T')[0] : null;

  // Apply filters
  const isHoH = isHeadOfHousehold(firstName);
  const { meetsStandard, isHNW } = checkValueCriteria(homeValue, propertyState);

  // Determine processing status
  let processingStatus: 'filtered_out' | 'ready_for_verification' = 'ready_for_verification';
  let filterReason: string | null = null;

  if (!isHoH) {
    processingStatus = 'filtered_out';
    filterReason = 'Not head of household (multiple names detected)';
  } else if (!meetsStandard && !isHNW) {
    processingStatus = 'filtered_out';
    filterReason = `Home value ${homeValue >= 900000 ? '≥' : '<'}$900k outside criteria for ${propertyState}`;
  } else if (!email || !email.match(/^[^@]+@[^@]+\.[^@]+$/)) {
    processingStatus = 'filtered_out';
    filterReason = 'Invalid email format';
  } else if (!parsedPurchaseDateISO) {
    processingStatus = 'filtered_out';
    filterReason = 'Invalid purchase date format';
  }

  return {
    upload_batch_id: uploadBatchId,
    client_name: clientName,
    workspace_name: workspaceName,
    month,
    uploaded_by: uploadedBy,

    first_name: firstName,
    last_name: lastName,
    mailing_address: row['Mailing Address']?.trim() || '',
    mailing_city: row['Mailing City']?.trim() || '',
    mailing_state: row['Mailing State']?.trim() || '',
    mailing_zip: row['Mailing ZIP']?.trim() || '',
    property_address: row['Property Address']?.trim() || '',
    property_city: row['Property City']?.trim() || '',
    property_state: propertyState,
    property_zip: row['Property ZIP']?.trim() || '',
    home_value_estimate: homeValue,
    purchase_date: purchaseDateStr,
    email,

    is_head_of_household: isHoH,
    meets_value_criteria: meetsStandard || isHNW,
    is_high_net_worth: isHNW,
    parsed_purchase_date: parsedPurchaseDateISO,
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
    const month = formData.get('month') as string; // Format: "2025-11"
    const uploadedBy = formData.get('uploaded_by') as string || 'system';

    if (!csvFile) {
      throw new Error('CSV file is required');
    }
    if (!workspaceName) {
      throw new Error('workspace_name is required');
    }
    if (!month) {
      throw new Error('month is required (format: YYYY-MM)');
    }

    console.log(`Processing CSV upload for ${workspaceName}, month: ${month}`);

    // Get client info from registry
    const { data: clientData, error: clientError } = await supabase
      .from('client_registry')
      .select('workspace_name, display_name')
      .eq('workspace_name', workspaceName)
      .single();

    if (clientError || !clientData) {
      throw new Error(`Client not found in registry: ${workspaceName}`);
    }

    const clientName = clientData.display_name || clientData.workspace_name;

    // Parse CSV
    const csvText = await csvFile.text();
    const rows = parse(csvText, {
      skipFirstRow: true,
      columns: [
        'First Name', 'Last Name',
        'Mailing Address', 'Mailing City', 'Mailing State', 'Mailing ZIP',
        'Property Address', 'Property City', 'Property State', 'Property ZIP',
        'Home Value Estimate', 'Purchase Date', 'Email'
      ]
    }) as ColeXDatesRow[];

    console.log(`Parsed ${rows.length} rows from CSV`);

    // Generate batch ID
    const uploadBatchId = crypto.randomUUID();

    // Process all contacts
    const processedContacts = rows.map(row =>
      processContact(row, uploadBatchId, clientName, workspaceName, month, uploadedBy)
    );

    // Insert into raw_contacts
    const { data: insertedContacts, error: insertError } = await supabase
      .from('raw_contacts')
      .insert(processedContacts)
      .select();

    if (insertError) {
      console.error('Error inserting contacts:', insertError);
      throw new Error(`Failed to insert contacts: ${insertError.message}`);
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

    // Extract unique ZIP codes and populate client_zipcodes table for ZIP Dashboard
    const uniqueZips = new Map<string, { state: string; zip: string }>();
    processedContacts.forEach(c => {
      if (c.property_zip && c.property_state && c.processing_status === 'ready_for_verification') {
        const zipKey = `${c.property_zip}-${c.property_state}`;
        if (!uniqueZips.has(zipKey)) {
          uniqueZips.set(zipKey, {
            zip: c.property_zip,
            state: c.property_state
          });
        }
      }
    });

    // Insert ZIP codes into client_zipcodes table
    let zipsInserted = 0;
    if (uniqueZips.size > 0) {
      const zipRecords = Array.from(uniqueZips.values()).map(({ zip, state }) => ({
        client_name: clientName,
        workspace_name: workspaceName,
        month,
        zip,
        state,
        source: 'contact_pipeline',
        pulled_at: new Date().toISOString(),
      }));

      // Upsert ZIP codes (insert if not exists, ignore if exists)
      const { error: zipError, data: zipData } = await supabase
        .from('client_zipcodes')
        .upsert(zipRecords, {
          onConflict: 'client_name,month,zip',
          ignoreDuplicates: true
        })
        .select();

      if (zipError) {
        console.error('Warning: Failed to insert ZIP codes:', zipError);
        // Don't throw - this is supplementary data
      } else {
        zipsInserted = zipData?.length || 0;
        console.log(`Inserted ${zipsInserted} unique ZIP codes into client_zipcodes`);
      }
    }

    // Log to audit table
    await supabase.from('upload_audit_log').insert({
      workspace_name: workspaceName,
      month,
      action: 'csv_upload',
      status: 'success',
      contacts_processed: totalContacts,
      contacts_succeeded: readyForVerification,
      contacts_failed: filteredOut,
      api_request: {
        upload_batch_id: uploadBatchId,
        file_name: csvFile.name,
        file_size: csvFile.size,
      },
      api_response: {
        total_contacts: totalContacts,
        ready_for_verification: readyForVerification,
        filtered_out: filteredOut,
        hnw_contacts: hnwContacts,
        filter_reasons: filterReasons,
      },
      performed_by: uploadedBy,
    });

    console.log(`Upload complete: ${readyForVerification} ready for verification, ${filteredOut} filtered out`);

    return new Response(
      JSON.stringify({
        success: true,
        upload_batch_id: uploadBatchId,
        summary: {
          total_contacts: totalContacts,
          ready_for_verification: readyForVerification,
          filtered_out: filteredOut,
          hnw_contacts: hnwContacts,
          unique_zip_codes: uniqueZips.size,
          zips_inserted: zipsInserted,
          filter_reasons: filterReasons,
        },
        message: `Processed ${totalContacts} contacts: ${readyForVerification} ready for verification, ${filteredOut} filtered out, ${zipsInserted} ZIP codes added to territory map`,
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
