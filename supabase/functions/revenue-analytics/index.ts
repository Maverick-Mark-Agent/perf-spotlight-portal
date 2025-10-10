import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Normalize client names for matching (handles case, spacing, special chars)
const normalizeClientName = (name: string): string => {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
};

// NOTE: Pricing data now comes from client_registry table in Supabase
// No more hardcoded pricing or name mapping!

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    // Get authorization from incoming request
    const authHeader = req.headers.get('Authorization');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Fetching MTD revenue analytics...');

    // Step 1: Get client pricing from client_registry
    console.log('📥 Fetching client pricing from client_registry...');
    const { data: registryClients, error: registryError } = await supabase
      .from('client_registry')
      .select('*')
      .eq('is_active', true);

    if (registryError) {
      throw new Error(`Error fetching client_registry: ${registryError.message}`);
    }

    console.log(`  Found ${registryClients.length} active clients in registry`);

    // Build pricing lookup by workspace name
    const pricingLookup: Record<string, any> = {};
    registryClients.forEach(client => {
      pricingLookup[client.workspace_name] = {
        billing_type: client.billing_type,
        price_per_lead: parseFloat(client.price_per_lead) || 0,
        retainer_amount: parseFloat(client.retainer_amount) || 0,
        workspace_id: client.workspace_id,
        display_name: client.display_name,
      };
    });

    // Step 2: Get MTD KPI data from client_metrics (real-time database query)
    console.log('📥 Fetching MTD KPI data from client_metrics...');
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    const { data: metricsData, error: metricsError } = await supabase
      .from('client_metrics')
      .select('*')
      .eq('metric_date', today)
      .eq('metric_type', 'mtd');

    if (metricsError) {
      throw new Error(`Error fetching client_metrics: ${metricsError.message}`);
    }

    console.log(`  Found ${metricsData?.length || 0} client metric records for today`);

    // Step 3: Get current month costs from client_costs table
    const currentMonthYear = new Date().toISOString().slice(0, 7); // YYYY-MM
    console.log(`📥 Fetching costs for ${currentMonthYear}...`);

    const { data: costsData, error: costsError } = await supabase
      .from('client_costs')
      .select('*')
      .eq('month_year', currentMonthYear);

    if (costsError && costsError.code !== 'PGRST116') { // Ignore "not found" errors
      console.warn(`⚠️ Error fetching costs (table may not exist yet): ${costsError.message}`);
    }

    // Build costs lookup
    const costsLookup: Record<string, number> = {};
    (costsData || []).forEach(cost => {
      costsLookup[cost.workspace_name] = parseFloat(cost.total_costs) || 0;
    });

    // Process each client with MTD revenue calculations
    const revenueClients = (metricsData || []).map(metric => {
      const workspaceName = metric.workspace_name;

      // Look up pricing from registry
      const pricing = pricingLookup[workspaceName];

      if (!pricing) {
        console.log(`⚠️ No pricing found in client_registry for "${workspaceName}"`);
        return null;
      }

      console.log(`✅ Processing "${workspaceName}" → ${pricing.billing_type} → $${pricing.price_per_lead || pricing.retainer_amount}`);

      // MTD billable leads (interested leads)
      const currentMonthLeads = metric.interested_replies_mtd || 0;

      // Calculate MTD revenue based on billing type
      let currentMonthRevenue = 0;
      if (pricing.billing_type === 'retainer') {
        // Retainer: fixed monthly amount
        currentMonthRevenue = pricing.retainer_amount;
      } else {
        // Per-lead: price per lead * MTD interested leads
        currentMonthRevenue = currentMonthLeads * pricing.price_per_lead;
      }

      // Get MTD costs (default to 0 if not found)
      const currentMonthCosts = costsLookup[workspaceName] || 0;

      // Calculate MTD profit
      const currentMonthProfit = currentMonthRevenue - currentMonthCosts;

      // Profit margin (avoid division by zero)
      const profitMargin = currentMonthRevenue > 0
        ? (currentMonthProfit / currentMonthRevenue) * 100
        : 0;

      return {
        workspace_name: pricing.display_name || workspaceName,
        billing_type: pricing.billing_type,

        // MTD Metrics
        current_month_leads: currentMonthLeads,
        current_month_revenue: currentMonthRevenue,
        current_month_costs: currentMonthCosts,
        current_month_profit: currentMonthProfit,

        // Profitability
        profit_margin: profitMargin,
        price_per_lead: pricing.price_per_lead,
        retainer_amount: pricing.retainer_amount,
      };
    }).filter(client => client !== null);

    // Sort by revenue (descending) - highest revenue first
    revenueClients.sort((a, b) => b.current_month_revenue - a.current_month_revenue);

    // Add rank
    revenueClients.forEach((client, index) => {
      client.rank = index + 1;
    });

    // Calculate totals
    const totals = revenueClients.reduce((acc, client) => ({
      total_mtd_revenue: acc.total_mtd_revenue + client.current_month_revenue,
      total_mtd_costs: acc.total_mtd_costs + client.current_month_costs,
      total_mtd_profit: acc.total_mtd_profit + client.current_month_profit,
      total_mtd_leads: acc.total_mtd_leads + client.current_month_leads,
      total_per_lead_revenue: acc.total_per_lead_revenue + (client.billing_type === 'per_lead' ? client.current_month_revenue : 0),
      total_retainer_revenue: acc.total_retainer_revenue + (client.billing_type === 'retainer' ? client.current_month_revenue : 0),
      per_lead_count: acc.per_lead_count + (client.billing_type === 'per_lead' ? 1 : 0),
      retainer_count: acc.retainer_count + (client.billing_type === 'retainer' ? 1 : 0),
    }), {
      total_mtd_revenue: 0,
      total_mtd_costs: 0,
      total_mtd_profit: 0,
      total_mtd_leads: 0,
      total_per_lead_revenue: 0,
      total_retainer_revenue: 0,
      per_lead_count: 0,
      retainer_count: 0,
    });

    // Calculate overall profit margin
    totals.overall_profit_margin = totals.total_mtd_revenue > 0
      ? (totals.total_mtd_profit / totals.total_mtd_revenue) * 100
      : 0;

    console.log(`✅ Processed ${revenueClients.length} clients with MTD revenue data`);
    console.log(`💰 Total MTD Revenue: $${totals.total_mtd_revenue.toFixed(2)}`);
    console.log(`💵 Per-Lead Revenue: $${totals.total_per_lead_revenue.toFixed(2)} (${totals.per_lead_count} clients)`);
    console.log(`💵 Retainer Revenue: $${totals.total_retainer_revenue.toFixed(2)} (${totals.retainer_count} clients)`);
    console.log(`📈 Total MTD Profit: $${totals.total_mtd_profit.toFixed(2)} (${totals.overall_profit_margin.toFixed(1)}% margin)`);

    return new Response(
      JSON.stringify({
        clients: revenueClients,
        totals,
        meta: {
          month_year: currentMonthYear,
          snapshot_date: today,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Revenue analytics error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
