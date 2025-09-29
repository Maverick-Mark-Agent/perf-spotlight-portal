import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AirtableRecord {
  id: string;
  fields: {
    'Client Company Name'?: string;
    'Positive Replies MTD'?: number;
    'Projection: Positive Replies Received (by EOM)'?: number;
    'MTD - Leads Generated Progress'?: number;
    'Projection Positive Replies % Progress'?: number;
    'Monthly KPI'?: number;
    'Positive Replies Last 30 Days'?: number;
    'Positive Replies Last 7 Days'?: number;
    'Positive Replies Last 14-7 Days'?: number;
    'Positive Replies Current Month'?: number;
    'Positive Replies Last Month'?: number;
    'Last Week VS Week Before Positive Replies % Progress'?: number;
    'Positive Replies Last VS This Month'?: number;
  };
}

interface AirtableResponse {
  records: AirtableRecord[];
}

const parsePercent = (v: unknown) => {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return v;
  const s = String(v).trim();
  const cleaned = s.endsWith('%') ? s.slice(0, -1) : s;
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const airtableApiKey = Deno.env.get('AIRTABLE_API_KEY');
    const baseId = 'appONMVSIf5czukkf';
    const tableName = '👨‍💻 Clients';
    
    if (!airtableApiKey) {
      throw new Error('Airtable API key not configured');
    }

    console.log('Fetching data from Airtable...');
    
    const airtableUrl = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`;
    
    const response = await fetch(airtableUrl, {
      headers: {
        'Authorization': `Bearer ${airtableApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Airtable API error:', response.status, errorText);
      throw new Error(`Airtable API error: ${response.status} ${errorText}`);
    }

    const data: AirtableResponse = await response.json();
    console.log('Successfully fetched Airtable data:', data.records.length, 'records');
    
    // Log a sample record to debug field names
    if (data.records.length > 0) {
      console.log('Sample record fields:', Object.keys(data.records[0].fields));
      console.log('Sample record data:', data.records[0].fields);
    }

    // Transform Airtable data to match our app's format
    const clients = data.records.map(record => ({
      id: record.id,
      name: record.fields['Client Company Name'] || 'Unknown Client',
      leadsGenerated: record.fields['Positive Replies MTD'] || 0,
      projectedReplies: record.fields['Projection: Positive Replies Received (by EOM)'] || 0,
      leadsTarget: 0, // Not provided in new mapping
      repliesTarget: 0, // Not provided in new mapping
      monthlyKPI: record.fields['Monthly KPI'] || 0,
      currentProgress: record.fields['MTD - Leads Generated Progress'] || 0,
      repliesProgress: record.fields['Projection Positive Replies % Progress'] || 0,
      positiveRepliesLast30Days: record.fields['Positive Replies Last 30 Days'] || 0,
      positiveRepliesLast7Days: record.fields['Positive Replies Last 7 Days'] || 0,
      positiveRepliesLast14Days: record.fields['Positive Replies Last 14-7 Days'] || 0,
      positiveRepliesCurrentMonth: record.fields['Positive Replies Current Month'] || 0,
      positiveRepliesLastMonth: record.fields['Positive Replies Last Month'] || 0,
      lastWeekVsWeekBeforeProgress: record.fields['Last Week VS Week Before Positive Replies % Progress'] || 0,
      positiveRepliesLastVsThisMonth: parsePercent(record.fields['Positive Replies Last VS This Month']),
    }));

    console.log('Transformed clients:', clients.map(c => ({ id: c.id, name: c.name })));

    return new Response(
      JSON.stringify({ clients }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in airtable-clients function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to fetch data from Airtable' 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});