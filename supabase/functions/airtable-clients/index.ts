import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AirtableRecord {
  id: string;
  fields: {
    'Client Name'?: string;
    'Leads Generated This Month'?: number;
    'Projected Positive Replies (EOM)'?: number;
    'Leads Target'?: number;
    'Replies Target'?: number;
    'Monthly KPI Target'?: number;
    'Current Progress'?: number;
    'Replies Progress'?: number;
  };
}

interface AirtableResponse {
  records: AirtableRecord[];
}

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

    // Transform Airtable data to match our app's format
    const clients = data.records.map(record => ({
      id: record.id,
      name: record.fields['Client Name'] || 'Unknown Client',
      leadsGenerated: record.fields['Leads Generated This Month'] || 0,
      projectedReplies: record.fields['Projected Positive Replies (EOM)'] || 0,
      leadsTarget: record.fields['Leads Target'] || 0,
      repliesTarget: record.fields['Replies Target'] || 0,
      monthlyKPI: record.fields['Monthly KPI Target'] || 0,
      currentProgress: record.fields['Current Progress'] || 0,
      repliesProgress: record.fields['Replies Progress'] || 0,
    }));

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
        error: error.message || 'Failed to fetch data from Airtable' 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});