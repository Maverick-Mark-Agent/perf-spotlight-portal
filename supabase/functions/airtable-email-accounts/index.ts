import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const baseId = 'appONMVSIf5czukkf';
    const tableName = 'Email%20Accounts';
    
    if (!airtableApiKey) {
      throw new Error('AIRTABLE_API_KEY not found');
    }

    // Fetch all records with pagination
    let allRecords = [];
    let offset = null;
    let pageCount = 0;

    do {
      pageCount++;
      console.log(`Fetching page ${pageCount}${offset ? ` with offset: ${offset}` : ''}`);
      
      const url = new URL(`https://api.airtable.com/v0/${baseId}/${tableName}`);
      if (offset) {
        url.searchParams.append('offset', offset);
      }

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${airtableApiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Airtable API error: ${response.status} on page ${pageCount}`);
      }

      const data = await response.json();
      allRecords = allRecords.concat(data.records || []);
      offset = data.offset;
      
      console.log(`Page ${pageCount}: Retrieved ${data.records?.length || 0} records. Total so far: ${allRecords.length}`);
      
    } while (offset);

    console.log(`Completed pagination: ${pageCount} pages, ${allRecords.length} total records`);

    const finalData = {
      records: allRecords
    };
    
    return new Response(JSON.stringify(finalData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error fetching email accounts:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});