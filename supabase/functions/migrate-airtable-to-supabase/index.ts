import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const airtableApiKey = Deno.env.get('AIRTABLE_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!airtableApiKey) {
      throw new Error('AIRTABLE_API_KEY not found');
    }

    console.log('Starting migration from Airtable to Supabase...');

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all email account records from Airtable
    const airtableBaseId = 'appONMVSIf5czukkf';
    const airtableTable = 'Email%20Accounts';

    let allAirtableRecords: any[] = [];
    let offset = null;

    console.log('Fetching records from Airtable...');

    do {
      const url = new URL(`https://api.airtable.com/v0/${airtableBaseId}/${airtableTable}`);
      if (offset) {
        url.searchParams.append('offset', offset);
      }

      const airtableResponse = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${airtableApiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!airtableResponse.ok) {
        throw new Error(`Airtable API error: ${airtableResponse.status}`);
      }

      const airtableData = await airtableResponse.json();
      allAirtableRecords = allAirtableRecords.concat(airtableData.records || []);
      offset = airtableData.offset;

      console.log(`Fetched ${allAirtableRecords.length} records so far...`);

    } while (offset);

    console.log(`Total Airtable records: ${allAirtableRecords.length}`);

    // Transform Airtable records for Supabase
    const recordsToMigrate = allAirtableRecords
      .filter(record => {
        const email = record.fields['Email Account'];
        return email && email.trim().length > 0;
      })
      .map(record => ({
        email_address: (record.fields['Email Account'] || '').toLowerCase().trim(),
        price: parseFloat(record.fields['Price']) || 0,
        notes: record.fields['Notes'] || null,
        custom_tags: JSON.stringify(record.fields['Tags'] || []),
      }));

    console.log(`Records to migrate: ${recordsToMigrate.length}`);

    if (recordsToMigrate.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No records to migrate',
          migrated: 0,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // First, try to create the table if it doesn't exist
    console.log('Ensuring table exists...');
    const { error: tableCheckError } = await supabase
      .from('email_account_metadata')
      .select('id')
      .limit(1);

    if (tableCheckError && tableCheckError.message.includes('does not exist')) {
      return new Response(
        JSON.stringify({
          error: 'Table does not exist',
          instructions: 'Please create the email_account_metadata table first by running the SQL from supabase/migrations/20251003000000_create_email_account_metadata.sql in Supabase SQL Editor',
          sql_location: 'https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/sql/new'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Upsert records in batches (Supabase has a limit on batch size)
    const batchSize = 100;
    let migratedCount = 0;
    let errors = [];

    for (let i = 0; i < recordsToMigrate.length; i += batchSize) {
      const batch = recordsToMigrate.slice(i, i + batchSize);

      console.log(`Migrating batch ${Math.floor(i / batchSize) + 1} (${batch.length} records)...`);

      const { data, error } = await supabase
        .from('email_account_metadata')
        .upsert(batch, {
          onConflict: 'email_address',
          ignoreDuplicates: false
        });

      if (error) {
        console.error(`Error migrating batch:`, error);
        errors.push({
          batch: Math.floor(i / batchSize) + 1,
          error: error.message
        });
      } else {
        migratedCount += batch.length;
      }
    }

    console.log(`Migration complete! Migrated ${migratedCount} records`);

    // Get sample of migrated data for verification
    const { data: sampleData } = await supabase
      .from('email_account_metadata')
      .select('*')
      .limit(5);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Migration completed successfully',
        stats: {
          totalAirtableRecords: allAirtableRecords.length,
          recordsToMigrate: recordsToMigrate.length,
          migratedCount,
          errors: errors.length,
        },
        errors: errors.length > 0 ? errors : undefined,
        sampleData: sampleData || [],
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in migration function:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
