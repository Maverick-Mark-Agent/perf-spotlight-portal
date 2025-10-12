import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CleaningResult {
  success: boolean;
  workspace_name: string;
  month: string;
  total_raw_contacts: number;
  head_of_household_filtered: number;
  kim_wallace_contacts: number;
  kirk_hodgson_hnw_contacts: number;
  message: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { workspace_name, month } = await req.json();

    if (!workspace_name || !month) {
      throw new Error('workspace_name and month are required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase credentials not found');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Download raw CSV file
    const rawFilePath = `${workspace_name}/${month}/raw_contacts.csv`;
    const { data: csvBlob, error: downloadError } = await supabase.storage
      .from('contact-csvs')
      .download(rawFilePath);

    if (downloadError) throw downloadError;
    if (!csvBlob) throw new Error('CSV file not found');

    const csvText = await csvBlob.text();
    const lines = csvText.split('\n').filter(l => l.trim());

    if (lines.length < 2) {
      throw new Error('CSV file is empty or only contains header');
    }

    // Proper CSV parser that handles quoted fields with commas
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

    const header = lines[0];
    const headerColumns = parseCSVLine(header).map(h => h.trim());

    // Find column indexes
    const headHouseholdIdx = headerColumns.findIndex(h => h.toLowerCase().includes('head') && h.toLowerCase().includes('household'));
    const purchaseAmountIdx = headerColumns.findIndex(h => h.toLowerCase().includes('purchase') && h.toLowerCase().includes('amount'));
    const estHomeValueIdx = headerColumns.findIndex(h => h.toLowerCase() === 'est. home value' || h.toLowerCase() === 'est home value');
    const homeValueIdx = headerColumns.findIndex(h => h.toLowerCase() === 'home value');
    const purchaseDateIdx = headerColumns.findIndex(h => h.toLowerCase().includes('purchase') && h.toLowerCase().includes('date'));

    console.log(`Column indexes: headHousehold=${headHouseholdIdx}, purchaseAmount=${purchaseAmountIdx}, estHomeValue=${estHomeValueIdx}, homeValue=${homeValueIdx}, purchaseDate=${purchaseDateIdx}`);

    // Filter contacts
    const agencyRows: string[] = [header]; // Include header (for the agency)
    const kirkHodgsonRows: string[] = [header]; // Include header (for Kirk if Texas HNW)
    let totalRaw = 0;
    let nonHeadOfHousehold = 0;
    let agencyCount = 0;
    let kirkCount = 0;

    for (let i = 1; i < lines.length; i++) {
      const row = lines[i];
      const columns = parseCSVLine(row);
      totalRaw++;

      // Check Head of Household (column 23)
      const headHousehold = columns[headHouseholdIdx]?.trim();
      if (!headHousehold || headHousehold === '') {
        nonHeadOfHousehold++;
        continue; // Skip non-head of household
      }

      // Parse home values (remove $ and commas, convert to number)
      const parseValue = (val: string): number => {
        if (!val) return 0;
        const cleaned = val.replace(/[$,"]/g, '').trim();
        return cleaned ? parseFloat(cleaned) : 0;
      };

      // Format date: "11/10/2020" -> "November 10th, 2020"
      const formatDate = (dateStr: string): string => {
        if (!dateStr || dateStr.trim() === '') return '';

        const months = ['January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December'];

        const parts = dateStr.trim().split('/');
        if (parts.length !== 3) return dateStr; // Return original if not MM/DD/YYYY format

        const month = parseInt(parts[0]) - 1; // 0-indexed
        const day = parseInt(parts[1]);
        const year = parts[2];

        if (month < 0 || month > 11 || !day || !year) return dateStr;

        // Add ordinal suffix (st, nd, rd, th)
        const getOrdinal = (n: number): string => {
          const s = ['th', 'st', 'nd', 'rd'];
          const v = n % 100;
          return n + (s[(v - 20) % 10] || s[v] || s[0]);
        };

        return `${months[month]} ${getOrdinal(day)}, ${year}`;
      };

      const purchaseAmount = parseValue(columns[purchaseAmountIdx] || '0');
      const estHomeValue = parseValue(columns[estHomeValueIdx] || '0');
      const homeValue = parseValue(columns[homeValueIdx] || '0');

      const maxHomeValue = Math.max(purchaseAmount, estHomeValue, homeValue);

      // Format the purchase date
      if (purchaseDateIdx >= 0 && columns[purchaseDateIdx]) {
        columns[purchaseDateIdx] = formatDate(columns[purchaseDateIdx]);
      }

      // Re-join with proper CSV formatting (quote fields that contain commas)
      const processedRow = columns.map(col => {
        if (col.includes(',') || col.includes('"')) {
          return `"${col.replace(/"/g, '""')}"`;
        }
        return col;
      }).join(',');

      // Texas agencies route HNW to Kirk Hodgson, others keep their HNW
      const TEXAS_AGENCIES = ['Kim Wallace', 'David Amiri', 'John Roberts', 'Jason Binyon'];
      const isTexasAgency = TEXAS_AGENCIES.includes(workspace_name);

      // Route based on home value and agency location
      if (maxHomeValue > 900000 && isTexasAgency) {
        // Texas HNW -> Kirk Hodgson
        kirkHodgsonRows.push(processedRow);
        kirkCount++;
      } else {
        // Standard or Non-Texas HNW -> Original Agency
        agencyRows.push(processedRow);
        agencyCount++;
      }
    }

    // Upload cleaned files
    const agencyFilePath = `${workspace_name}/${month}/cleaned.csv`;
    const kirkFilePath = `Kirk Hodgson/${month}/hnw.csv`;

    // Upload agency's cleaned file
    const { error: agencyUploadError } = await supabase.storage
      .from('contact-csvs')
      .upload(agencyFilePath, new Blob([agencyRows.join('\n')], { type: 'text/csv' }), {
        cacheControl: '3600',
        upsert: true,
      });

    if (agencyUploadError) throw agencyUploadError;

    // Upload Kirk Hodgson's HNW file (if any HNW contacts)
    if (kirkCount > 0) {
      const { error: kirkUploadError } = await supabase.storage
        .from('contact-csvs')
        .upload(kirkFilePath, new Blob([kirkHodgsonRows.join('\n')], { type: 'text/csv' }), {
          cacheControl: '3600',
          upsert: true,
        });

      if (kirkUploadError) throw kirkUploadError;
    }

    const result: CleaningResult = {
      success: true,
      workspace_name,
      month,
      total_raw_contacts: totalRaw,
      head_of_household_filtered: nonHeadOfHousehold,
      kim_wallace_contacts: agencyCount,
      kirk_hodgson_hnw_contacts: kirkCount,
      message: `Cleaned ${totalRaw} contacts: ${agencyCount} for ${workspace_name}, ${kirkCount} HNW for Kirk Hodgson, ${nonHeadOfHousehold} filtered out (non-head of household)`,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in clean-raw-contacts:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
