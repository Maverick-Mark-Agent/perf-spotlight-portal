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
    '3-day Average Sending'?: number;
  };
}

interface ClientRecord {
  id: string;
  fields: {
    'Client Company Name'?: string;
  };
}

interface ClientSchedule {
  clientName: string;
  todayEmails: number;
  tomorrowEmails: number;
  totalScheduled: number;
  threeDayAverage: number;
}

// Robust number normalizer: handles numbers, strings, arrays, and formatted values
function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (Array.isArray(value)) {
    return value.length ? toNumber(value[0]) : 0;
  }
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const s = String(value).trim().replace(/,/g, '');
  const n = parseFloat(s);
  return Number.isNaN(n) ? 0 : n;
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

    // Group by client ID and collect 3-day Average Sending values for median
    const clientScheduleMap = new Map<string, { todayEmails: number; tomorrowEmails: number; threeDayValues: number[] }>();

    allRecords.forEach(record => {
      const clientLinked = record.fields['Client Linked'];
      const todayEmails = record.fields['Emails Being Scheduled Today'] || 0;
      const tomorrowEmails = record.fields['Emails Being Scheduled Tomorrow'] || 0;
      const threeDayVal = record.fields['3-day Average Sending'];

      if (clientLinked && clientLinked.length > 0) {
        const clientId = clientLinked[0];
        
        if (!clientScheduleMap.has(clientId)) {
          clientScheduleMap.set(clientId, { todayEmails: 0, tomorrowEmails: 0, threeDayValues: [] });
        }
        
        const existing = clientScheduleMap.get(clientId)!;
        existing.todayEmails += todayEmails;
        existing.tomorrowEmails += tomorrowEmails;
        if (threeDayVal !== undefined && threeDayVal !== null) {
          const num = toNumber(threeDayVal);
          if (num > 0) {
            existing.threeDayValues.push(num);
          }
        }
      }
    });

    // Fetch client details from Clients table
    console.log('Fetching client details...');
    const clientIds = Array.from(clientScheduleMap.keys());
    const clientsTableName = '👨‍💻 Clients';
    
    const clientDetailsMap = new Map<string, { name: string }>();
    
    // Fetch clients in batches using filter formula
    for (let i = 0; i < clientIds.length; i += 10) {
      const batch = clientIds.slice(i, i + 10);
      const filterFormula = `OR(${batch.map(id => `RECORD_ID()='${id}'`).join(',')})`;
      
      const url = new URL(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(clientsTableName)}`);
      url.searchParams.append('filterByFormula', filterFormula);
      
      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${airtableApiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error(`Failed to fetch client details for batch ${i}`);
        continue;
      }

      const data = await response.json();
      (data.records as ClientRecord[]).forEach(record => {
        clientDetailsMap.set(record.id, {
          name: record.fields['Client Company Name'] || record.id,
        });
      });
    }

    console.log(`Fetched ${clientDetailsMap.size} client details`);

    // Convert to array with client names and per-client average 3-day average (from campaigns)
    const schedules: ClientSchedule[] = Array.from(clientScheduleMap.entries()).map(([clientId, data]) => {
      const clientDetails = clientDetailsMap.get(clientId) || { name: clientId };
      const vals = (data.threeDayValues || []).filter(v => typeof v === 'number' && !Number.isNaN(v));
      let average = 0;
      if (vals.length > 0) {
        const sum = vals.reduce((acc, val) => acc + val, 0);
        average = sum / vals.length;
      }
      return {
        clientName: clientDetails.name,
        todayEmails: data.todayEmails,
        tomorrowEmails: data.tomorrowEmails,
        totalScheduled: (data.todayEmails + data.tomorrowEmails) / 2,
        threeDayAverage: average,
      };
    });

    // Calculate median of per-client 3-day averages for reference
    const threeDayAverages = schedules.map(s => s.threeDayAverage).filter(v => v > 0).sort((a, b) => a - b);
    let medianThreeDayAverage = 0;
    if (threeDayAverages.length > 0) {
      const mid = Math.floor(threeDayAverages.length / 2);
      medianThreeDayAverage = threeDayAverages.length % 2 === 0
        ? (threeDayAverages[mid - 1] + threeDayAverages[mid]) / 2
        : threeDayAverages[mid];
    }
    
    const targetVolumePerDay = medianThreeDayAverage * 2; // Double it for 2-day sending

    console.log(`Processed ${schedules.length} clients with scheduled emails`);
    console.log(`Median 3-day average: ${medianThreeDayAverage}, Target Volume Per Day: ${targetVolumePerDay}`);

    return new Response(JSON.stringify({ schedules, targetVolumePerDay }), {
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