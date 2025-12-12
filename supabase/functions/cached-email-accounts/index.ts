import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Cache configuration
const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes
let cachedData: any = null;
let cacheTimestamp: number = 0;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const now = Date.now();
    const cacheAge = now - cacheTimestamp;
    const isCacheValid = cachedData && cacheAge < CACHE_DURATION_MS;

    console.log(`📊 Cache status: ${isCacheValid ? 'HIT' : 'MISS'} (age: ${Math.round(cacheAge / 1000)}s)`);

    if (isCacheValid) {
      console.log(`✅ Returning cached data (${cachedData.records.length} accounts)`);
      return new Response(JSON.stringify(cachedData), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'X-Cache-Status': 'HIT',
          'X-Cache-Age': Math.round(cacheAge / 1000).toString(),
        },
      });
    }

    // Cache miss - fetch fresh data
    console.log(`🔄 Cache miss - fetching fresh data...`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Call the existing hybrid-email-accounts-v2 function
    console.log(`🔗 Calling hybrid-email-accounts-v2...`);
    const response = await fetch(`${supabaseUrl}/functions/v1/hybrid-email-accounts-v2`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
    });

    console.log(`📥 Response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ hybrid-email-accounts-v2 error: ${response.status} - ${errorText}`);
      throw new Error(`hybrid-email-accounts-v2 returned ${response.status}: ${errorText}`);
    }

    const freshData = await response.json();

    // Update cache
    cachedData = freshData;
    cacheTimestamp = now;

    console.log(`✅ Fresh data cached (${freshData.records?.length || 0} accounts)`);

    return new Response(JSON.stringify(freshData), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'X-Cache-Status': 'MISS',
        'X-Cache-Age': '0',
      },
    });

  } catch (error) {
    console.error('Error in cached-email-accounts function:', error);

    // If we have stale cache, return it with a warning
    if (cachedData) {
      console.log('⚠️ Error occurred, returning stale cache');
      return new Response(JSON.stringify(cachedData), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'X-Cache-Status': 'STALE',
          'X-Cache-Age': Math.round((Date.now() - cacheTimestamp) / 1000).toString(),
        },
        status: 200,
      });
    }

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
