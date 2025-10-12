import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { workspace_name, month } = await req.json();

    console.log(`Retroactively routing HNW contacts for ${workspace_name} - ${month}`);

    // Texas agencies that route HNW to Kirk Hodgson
    const TEXAS_AGENCIES = ['Kim Wallace', 'David Amiri', 'John Roberts', 'Jason Binyon'];
    const isTexasAgency = TEXAS_AGENCIES.includes(workspace_name);

    if (!isTexasAgency) {
      return new Response(JSON.stringify({
        success: false,
        message: `${workspace_name} is not a Texas agency - no HNW routing needed`
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get all uploaded batches for this agency/month from zip_batch_pulls
    const { data: batches, error: batchError } = await supabase
      .from('zip_batch_pulls')
      .select('batch_number, csv_filename')
      .eq('workspace_name', workspace_name)
      .eq('month', month)
      .gt('raw_contacts_uploaded', 0)
      .order('batch_number');

    if (batchError) throw batchError;

    if (!batches || batches.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        message: 'No uploaded batches found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`Found ${batches.length} uploaded batches to process`);

    let totalHnwContacts = 0;
    const kirkHodgsonRows: string[] = [];
    let header = '';

    // Process each batch's raw CSV file
    for (const batch of batches) {
      const rawFilePath = `${workspace_name}/${month}/batch_${batch.batch_number}_raw.csv`;

      console.log(`Processing ${rawFilePath}...`);

      // Download the raw CSV file
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('contact-csvs')
        .download(rawFilePath);

      if (downloadError) {
        console.error(`Could not download ${rawFilePath}:`, downloadError);
        continue;
      }

      const csvText = await fileData.text();
      const lines = csvText.split('\n').filter(line => line.trim());

      if (lines.length === 0) continue;

      // Store header from first file
      if (!header) {
        header = lines[0];
        kirkHodgsonRows.push(header);
      }

      // Parse CSV with quote handling
      const parseCSVLine = (line: string): string[] => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
          } else {
            current += char;
          }
        }
        result.push(current);
        return result;
      };

      const headerCols = parseCSVLine(header);
      const hohIndex = headerCols.findIndex(col =>
        col.toLowerCase().includes('head of household') || col.toLowerCase().includes('hoh')
      );

      // Find home value columns
      const homeValueIndices = [
        headerCols.findIndex(col => col.toLowerCase().includes('purchase amount')),
        headerCols.findIndex(col => col.toLowerCase().includes('est. home value')),
        headerCols.findIndex(col => col.toLowerCase().includes('home value'))
      ].filter(idx => idx !== -1);

      // Process data rows
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);

        // Check HOH
        if (hohIndex !== -1 && !cols[hohIndex]?.trim()) {
          continue; // Skip non-HOH
        }

        // Check home value for HNW (>$900k)
        let maxHomeValue = 0;
        for (const idx of homeValueIndices) {
          if (idx !== -1 && cols[idx]) {
            const cleanValue = cols[idx].replace(/[$,]/g, '').trim();
            const value = parseFloat(cleanValue);
            if (!isNaN(value) && value > maxHomeValue) {
              maxHomeValue = value;
            }
          }
        }

        // If >$900k, route to Kirk Hodgson
        if (maxHomeValue > 900000) {
          kirkHodgsonRows.push(lines[i]);
          totalHnwContacts++;
        }
      }
    }

    if (totalHnwContacts === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No HNW contacts found to route to Kirk Hodgson',
        hnw_contacts: 0
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Upload Kirk Hodgson's HNW file
    const kirkFilePath = `Kirk Hodgson/${month}/hnw_from_${workspace_name.replace(/\s+/g, '_')}.csv`;
    const { error: uploadError } = await supabase.storage
      .from('contact-csvs')
      .upload(kirkFilePath, new Blob([kirkHodgsonRows.join('\n')], { type: 'text/csv' }), {
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) throw uploadError;

    console.log(`✅ Routed ${totalHnwContacts} HNW contacts to Kirk Hodgson`);

    return new Response(JSON.stringify({
      success: true,
      message: `Successfully routed HNW contacts from ${workspace_name} to Kirk Hodgson`,
      batches_processed: batches.length,
      hnw_contacts_routed: totalHnwContacts,
      kirk_file_path: kirkFilePath
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      details: error
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
