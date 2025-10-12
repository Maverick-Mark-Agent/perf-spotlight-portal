import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { csv_content, workspace_name, month, batch_number } = await req.json();

    if (!csv_content || !workspace_name || !month || !batch_number) {
      throw new Error('Missing required parameters: csv_content, workspace_name, month, batch_number');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`Processing batch upload: ${workspace_name} / ${month} / Batch ${batch_number}`);

    // Step 1: Get the batch's assigned ZIP codes from database
    const { data: batchZips, error: batchError } = await supabase
      .from('zip_batch_pulls')
      .select('zip')
      .eq('workspace_name', workspace_name)
      .eq('month', month)
      .eq('batch_number', batch_number);

    if (batchError) throw new Error(`Failed to fetch batch ZIPs: ${batchError.message}`);
    if (!batchZips || batchZips.length === 0) {
      throw new Error(`No ZIP codes found for batch ${batch_number}`);
    }

    const assignedZips = new Set(batchZips.map(b => b.zip));
    console.log(`Batch ${batch_number} has ${assignedZips.size} assigned ZIPs`);

    // Step 2: Parse uploaded CSV
    const lines = csv_content.split('\n').filter((l: string) => l.trim());
    if (lines.length < 2) {
      throw new Error('CSV file is empty or has no data rows');
    }

    const header = lines[0];
    const headerColumns = header.split(',');

    // Find ZIP column index
    const zipColumnIndex = headerColumns.findIndex((col: string) =>
      col.trim().toLowerCase().includes('zip') ||
      col.trim().toLowerCase().includes('postal')
    );

    if (zipColumnIndex === -1) {
      throw new Error('Could not find ZIP code column in CSV');
    }

    console.log(`Found ZIP column at index ${zipColumnIndex}`);

    // Step 3: Extract ZIP codes from uploaded CSV and verify they match batch assignment
    const uploadedZips = new Set<string>();
    for (let i = 1; i < lines.length; i++) {
      const columns = lines[i].split(',');
      if (columns[zipColumnIndex]) {
        const zip = columns[zipColumnIndex].trim().replace(/"/g, '');
        if (zip) uploadedZips.add(zip);
      }
    }

    const matchingZips = Array.from(uploadedZips).filter(zip => assignedZips.has(zip));

    if (matchingZips.length === 0) {
      throw new Error(`No ZIP codes in uploaded CSV match Batch ${batch_number}'s assigned ZIPs`);
    }

    console.log(`Found ${matchingZips.length} matching ZIPs out of ${uploadedZips.size} total ZIPs in CSV`);

    // Step 4: Filter CSV rows to only include contacts from matching ZIPs
    const matchingZipsSet = new Set(matchingZips);
    const filteredRows = lines.slice(1).filter((line: string) => {
      const columns = line.split(',');
      const zipInRow = columns[zipColumnIndex]?.trim().replace(/"/g, '');
      return zipInRow && matchingZipsSet.has(zipInRow);
    });

    const filteredContactCount = filteredRows.length;
    console.log(`Filtered to ${filteredContactCount} contacts matching batch ZIPs`);

    // Step 5: Download existing consolidated CSV (if exists)
    const consolidatedFilePath = `${workspace_name}/${month}/raw_contacts.csv`;
    const { data: existingFile } = await supabase.storage
      .from('contact-csvs')
      .download(consolidatedFilePath);

    let consolidatedContent: string;

    if (existingFile) {
      // Append filtered rows to existing file (without header)
      const existingText = await existingFile.text();
      consolidatedContent = existingText.trim() + '\n' + filteredRows.join('\n');
      console.log('Appending to existing consolidated CSV');
    } else {
      // First upload - include header and filtered rows
      consolidatedContent = header + '\n' + filteredRows.join('\n');
      console.log('Creating new consolidated CSV');
    }

    // Step 6: Upload consolidated CSV to storage
    const { error: storageError } = await supabase.storage
      .from('contact-csvs')
      .upload(consolidatedFilePath, new Blob([consolidatedContent], { type: 'text/csv' }), {
        cacheControl: '3600',
        upsert: true,
      });

    if (storageError) throw new Error(`Storage upload failed: ${storageError.message}`);

    console.log('Consolidated CSV uploaded successfully');

    // Step 7: Update database - mark matching ZIPs as pulled
    const contactsPerZip = Math.floor(filteredContactCount / matchingZips.length);
    const { error: dbError } = await supabase
      .from('zip_batch_pulls')
      .update({
        pulled_at: new Date().toISOString(),
        raw_contacts_uploaded: contactsPerZip,
      })
      .eq('workspace_name', workspace_name)
      .eq('month', month)
      .in('zip', matchingZips);

    if (dbError) throw new Error(`Database update failed: ${dbError.message}`);

    console.log(`Updated ${matchingZips.length} ZIPs in database`);

    // Step 8: Return success response
    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully uploaded ${filteredContactCount} contacts for ${matchingZips.length} ZIP codes`,
        details: {
          workspace_name,
          month,
          batch_number,
          zips_matched: matchingZips.length,
          contacts_added: filteredContactCount,
          consolidated_file: consolidatedFilePath,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('Error processing batch upload:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
