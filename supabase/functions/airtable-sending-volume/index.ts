import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AirtableRecord {
  id: string;
  fields: {
    'Client Company Name'?: string;
    'Emails Sent MTD'?: number;
    'Monthly Email Target'?: number;
    [key: string]: any;
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

    console.log('Fetching sending volume data from Airtable...');
    
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
    
    // Log field names to help identify correct fields
    if (data.records.length > 0) {
      console.log('Available fields:', Object.keys(data.records[0].fields));
    }

    // Transform Airtable data to match the sending volume format
    const clients = data.records
      .map(record => {
        const name = record.fields['Client Company Name'];
        const emails = record.fields['Emails Sent MTD'] || 0;
        const target = record.fields['Monthly Email Target'] || 0;
        
        if (!name) return null;
        
        return {
          name,
          emails: typeof emails === 'number' ? emails : 0,
          target: typeof target === 'number' ? target : 0,
          targetPercentage: target > 0 ? (emails / target) * 100 : 0,
          isAboveTarget: emails >= target,
          variance: emails - target
        };
      })
      .filter(client => client !== null)
      .sort((a, b) => b.targetPercentage - a.targetPercentage)
      .map((client, index) => ({
        ...client,
        rank: index + 1
      }));

    console.log('Transformed clients:', clients.length);

    return new Response(
      JSON.stringify({ clients }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in airtable-sending-volume function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to fetch sending volume data from Airtable' 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
