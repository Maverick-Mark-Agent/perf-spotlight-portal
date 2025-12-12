import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CACHE_DURATION_MINUTES = 30;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('📊 [Cached v3] Checking cache status...');

    // Check if cache exists and is fresh (within 30 minutes)
    const { data: cacheCheck, error: checkError } = await supabase
      .from('email_accounts_cache')
      .select('last_synced_at')
      .order('last_synced_at', { ascending: false })
      .limit(1)
      .single();

    let useCache = false;
    let cacheAge = Infinity;

    if (cacheCheck && !checkError) {
      const lastSync = new Date(cacheCheck.last_synced_at);
      cacheAge = (Date.now() - lastSync.getTime()) / 1000 / 60; // minutes
      useCache = cacheAge < CACHE_DURATION_MINUTES;
      console.log(`📊 Cache age: ${Math.round(cacheAge)} minutes (fresh: ${useCache})`);
    } else {
      console.log('📊 No cache found');
    }

    if (useCache) {
      // Return cached data
      console.log('✅ Returning data from cache');

      const { data: cachedAccounts, error: cacheError } = await supabase
        .from('email_accounts_cache')
        .select('*');

      if (cacheError) {
        console.error('❌ Error reading cache:', cacheError);
        throw cacheError;
      }

      // Transform cache format back to API format
      const records = cachedAccounts.map((account: any) => ({
        id: account.bison_id,
        fields: account.account_data
      }));

      return new Response(JSON.stringify({
        records,
        cached: true,
        cache_age_minutes: Math.round(cacheAge)
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'X-Cache-Status': 'HIT',
          'X-Cache-Age': Math.round(cacheAge * 60).toString()
        },
      });
    }

    // Cache miss - fetch fresh data and update cache
    console.log('🔄 Cache miss - fetching fresh data...');

    const hybridResponse = await fetch(
      `${supabaseUrl}/functions/v1/hybrid-email-accounts-v2`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!hybridResponse.ok) {
      const errorText = await hybridResponse.text();
      throw new Error(`hybrid-email-accounts-v2 failed: ${hybridResponse.status} - ${errorText}`);
    }

    const freshData = await hybridResponse.json();
    const accounts = freshData.records || [];

    console.log(`✅ Fetched ${accounts.length} fresh accounts`);

    // Update cache in background (don't wait for it)
    updateCache(supabase, accounts).catch(err => {
      console.error('⚠️ Failed to update cache (non-fatal):', err);
    });

    return new Response(JSON.stringify({
      records: accounts,
      cached: false,
      cache_age_minutes: 0
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'X-Cache-Status': 'MISS',
        'X-Cache-Age': '0'
      },
    });

  } catch (error) {
    console.error('Error in email-accounts-cached-v3:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function updateCache(supabase: any, accounts: any[]) {
  console.log('💾 Updating cache with', accounts.length, 'accounts...');

  // Delete old cache
  await supabase.from('email_accounts_cache').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  // Insert new cache in batches
  const BATCH_SIZE = 500;
  for (let i = 0; i < accounts.length; i += BATCH_SIZE) {
    const batch = accounts.slice(i, i + BATCH_SIZE);
    const cacheRecords = batch.map((record: any) => ({
      email_address: record.fields['Email Account'],
      bison_id: record.id,
      workspace_id: record.fields['Workspace ID'],
      workspace_name: record.fields.Workspace,
      bison_instance: record.fields['Bison Instance'] || 'Maverick',
      account_data: record.fields,
      last_synced_at: new Date().toISOString(),
      sync_status: 'success',
      sync_error: null,
    }));

    const { error } = await supabase
      .from('email_accounts_cache')
      .insert(cacheRecords);

    if (error) {
      console.error(`❌ Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, error);
    } else {
      console.log(`✅ Batch ${Math.floor(i / BATCH_SIZE) + 1} cached`);
    }
  }

  console.log('✅ Cache updated successfully');
}
