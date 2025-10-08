import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * GENERATE WEEKLY BATCHES EDGE FUNCTION
 *
 * Creates weekly batch records for Monday uploads
 *
 * Process:
 * 1. For a given month, identify all Mondays
 * 2. For each Monday, create a batch for each week bucket (1-4)
 * 3. Count contacts per batch (from verified_contacts)
 * 4. Schedule batch uploads for the appropriate Monday
 * 5. Generate CSV files for each batch
 *
 * Week Buckets:
 * - Bucket 1: Purchase days 1-7 (upload on 1st Monday)
 * - Bucket 2: Purchase days 8-14 (upload on 2nd Monday)
 * - Bucket 3: Purchase days 15-21 (upload on 3rd Monday)
 * - Bucket 4: Purchase days 22-31 (upload on 4th Monday)
 *
 * Scheduling Logic:
 * - Runs automatically on the 15th of each month (via cron)
 * - Generates batches for the NEXT month's processing
 * - Example: On 2025-11-15, generate batches for December Mondays
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
  week_bucket: number;
  is_high_net_worth: boolean;
}

/**
 * Get all Mondays in a given month
 */
function getMondaysInMonth(year: number, month: number): Date[] {
  const mondays: Date[] = [];
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Find first Monday
  let currentDate = new Date(firstDay);
  while (currentDate.getDay() !== 1) {
    currentDate.setDate(currentDate.getDate() + 1);
    if (currentDate > lastDay) break;
  }

  // Collect all Mondays
  while (currentDate <= lastDay) {
    mondays.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 7);
  }

  return mondays;
}

/**
 * Generate CSV content for a batch
 */
function generateBatchCSV(contacts: VerifiedContact[]): string {
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
    const body = await req.json();
    const workspaceName = body.workspace_name as string;
    const month = body.month as string; // Format: "2025-11"

    if (!workspaceName || !month) {
      throw new Error('workspace_name and month are required (format: YYYY-MM)');
    }

    console.log(`Generating weekly batches for ${workspaceName}, month: ${month}`);

    // Parse month
    const [year, monthNum] = month.split('-').map(Number);

    // Get all Mondays in the month
    const mondays = getMondaysInMonth(year, monthNum - 1); // JS months are 0-indexed

    if (mondays.length === 0) {
      throw new Error(`No Mondays found in ${month}`);
    }

    console.log(`Found ${mondays.length} Mondays in ${month}`);

    // Fetch all verified contacts for this workspace/month
    const { data: allContacts, error: contactsError } = await supabase
      .from('verified_contacts')
      .select('id, first_name, last_name, email, property_address, property_city, property_state, property_zip, home_value_estimate, purchase_date, renewal_start_date, renewal_end_date, week_bucket, is_high_net_worth')
      .eq('workspace_name', workspaceName)
      .eq('month', month)
      .eq('is_uploaded', false)
      .eq('debounce_status', 'deliverable');

    if (contactsError) {
      throw new Error(`Failed to fetch contacts: ${contactsError.message}`);
    }

    if (!allContacts || allContacts.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No verified contacts found for batch generation',
          batches_created: 0,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Found ${allContacts.length} verified contacts`);

    // Group contacts by week bucket
    const contactsByBucket: Record<number, VerifiedContact[]> = {
      1: [],
      2: [],
      3: [],
      4: [],
    };

    allContacts.forEach((contact: VerifiedContact) => {
      if (contact.week_bucket && contact.week_bucket >= 1 && contact.week_bucket <= 4) {
        contactsByBucket[contact.week_bucket].push(contact);
      }
    });

    // Create batches for each Monday
    const batchesCreated = [];

    for (let weekNumber = 1; weekNumber <= mondays.length && weekNumber <= 4; weekNumber++) {
      const monday = mondays[weekNumber - 1];
      const weekBucket = weekNumber;
      const contacts = contactsByBucket[weekBucket] || [];

      if (contacts.length === 0) {
        console.log(`No contacts for week ${weekNumber}, skipping batch creation`);
        continue;
      }

      // Count HNW contacts
      const hnwCount = contacts.filter(c => c.is_high_net_worth).length;

      // Generate CSV
      const csvContent = generateBatchCSV(contacts);
      const csvFileName = `${workspaceName}_week${weekNumber}_${month}.csv`;

      // TODO: Upload CSV to storage (S3/Supabase Storage)
      // For now, we'll store the CSV path as a placeholder
      const csvFilePath = `/batches/${month}/${csvFileName}`;

      // Create batch record
      const { data: batch, error: batchError } = await supabase
        .from('weekly_batches')
        .insert({
          workspace_name: workspaceName,
          month,
          week_number: weekNumber,
          week_bucket: weekBucket,
          scheduled_upload_date: monday.toISOString().split('T')[0],
          contact_count: contacts.length,
          hnw_count: hnwCount,
          csv_file_path: csvFilePath,
          csv_generated_at: new Date().toISOString(),
          bison_upload_status: 'pending',
        })
        .select()
        .single();

      if (batchError) {
        console.error(`Error creating batch for week ${weekNumber}:`, batchError);
        continue;
      }

      batchesCreated.push({
        batch_id: batch.batch_id,
        week_number: weekNumber,
        scheduled_date: monday.toISOString().split('T')[0],
        contact_count: contacts.length,
        hnw_count: hnwCount,
      });

      console.log(`Created batch ${batch.batch_id} for week ${weekNumber}: ${contacts.length} contacts`);
    }

    // Log to audit
    await supabase.from('upload_audit_log').insert({
      workspace_name: workspaceName,
      month,
      action: 'batch_generation',
      status: 'success',
      contacts_processed: allContacts.length,
      contacts_succeeded: allContacts.length,
      contacts_failed: 0,
      api_response: {
        batches_created: batchesCreated.length,
        batches: batchesCreated,
      },
      performed_by: 'system',
    });

    console.log(`Batch generation complete: ${batchesCreated.length} batches created`);

    return new Response(
      JSON.stringify({
        success: true,
        batches_created: batchesCreated.length,
        batches: batchesCreated,
        message: `Generated ${batchesCreated.length} weekly batches for ${month}`,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in generate-weekly-batches function:', error);
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
