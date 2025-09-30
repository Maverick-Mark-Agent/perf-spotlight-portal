import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AirtableRecord {
  id: string;
  fields: {
    'Client Linked'?: string[];
    'Emails Being Scheduled Today'?: number;
    'Emails Being Scheduled Tomorrow'?: number;
  };
}

interface ClientSchedule {
  clientName: string;
  todayEmails: number;
  tomorrowEmails: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const airtableApiKey = Deno.env.get('AIRTABLE_API_KEY');
    const baseId = 'appONMVSIf5czukkf';
    const tableName = 'Campaigns Performance';
    
    if (!airtableApiKey) {
      throw new Error('AIRTABLE_API_KEY not found');
    }

    console.log('Fetching campaigns performance data from Airtable...');

    // Fetch all records with pagination
    let allRecords: AirtableRecord[] = [];
    let offset: string | null = null;
    let pageCount = 0;

    do {
      pageCount++;
      console.log(`Fetching page ${pageCount}${offset ? ` with offset: ${offset}` : ''}`);
      
      const url = new URL(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`);
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

    // Group by client and sum emails
    const clientScheduleMap = new Map<string, { todayEmails: number; tomorrowEmails: number }>();

    allRecords.forEach(record => {
      const clientLinked = record.fields['Client Linked'];
      const todayEmails = record.fields['Emails Being Scheduled Today'] || 0;
      const tomorrowEmails = record.fields['Emails Being Scheduled Tomorrow'] || 0;

      if (clientLinked && clientLinked.length > 0) {
        // Client Linked is an array of client IDs, we'll use the first one
        const clientId = clientLinked[0];
        
        if (!clientScheduleMap.has(clientId)) {
          clientScheduleMap.set(clientId, { todayEmails: 0, tomorrowEmails: 0 });
        }
        
        const existing = clientScheduleMap.get(clientId)!;
        existing.todayEmails += todayEmails;
        existing.tomorrowEmails += tomorrowEmails;
      }
    });

    // Convert to array
    const schedules: ClientSchedule[] = Array.from(clientScheduleMap.entries()).map(([clientName, data]) => ({
      clientName,
      todayEmails: data.todayEmails,
      tomorrowEmails: data.tomorrowEmails,
    }));

    console.log(`Processed ${schedules.length} clients with scheduled emails`);

    return new Response(JSON.stringify({ schedules }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error fetching campaigns performance:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});